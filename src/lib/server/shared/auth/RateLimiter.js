import { createDAOs } from '../db/models/index.js';
import { logger } from '../utils/logger.js';

/**
 * Rate limiting and brute force protection for authentication
 * Uses database-backed storage for persistence across restarts
 */
export class RateLimiter {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);
		this.memoryCache = new Map(); // Short-term cache for performance
		this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
	}

	/**
	 * Check if request is allowed under rate limiting rules
	 */
	async checkRateLimit(identifier, options = {}) {
		try {
			const {
				maxAttempts = 10,
				windowMinutes = 15,
				blockDurationMinutes = 60,
				type = 'login'
			} = options;

			const windowMs = windowMinutes * 60 * 1000;
			const blockDurationMs = blockDurationMinutes * 60 * 1000;
			const now = Date.now();
			const windowStart = now - windowMs;

			// Check memory cache first for performance
			const cacheKey = `${type}_${identifier}`;
			const cached = this.memoryCache.get(cacheKey);

			if (cached && cached.blockedUntil && cached.blockedUntil > now) {
				return {
					allowed: false,
					blocked: true,
					remainingTime: cached.blockedUntil - now,
					attempts: cached.attempts,
					maxAttempts
				};
			}

			// Get recent attempts from database
			const attempts = await this.getRecentAttempts(identifier, type, windowStart);

			// Check if currently blocked
			if (attempts.length >= maxAttempts) {
				const blockUntil = now + blockDurationMs;

				// Update cache
				this.memoryCache.set(cacheKey, {
					attempts: attempts.length,
					blockedUntil: blockUntil,
					lastCheck: now
				});

				// Clean up cache periodically
				this.cleanupCache();

				return {
					allowed: false,
					blocked: true,
					remainingTime: blockDurationMs,
					attempts: attempts.length,
					maxAttempts
				};
			}

			// Update cache with current state
			this.memoryCache.set(cacheKey, {
				attempts: attempts.length,
				blockedUntil: null,
				lastCheck: now
			});

			return {
				allowed: true,
				blocked: false,
				attempts: attempts.length,
				maxAttempts,
				remainingAttempts: maxAttempts - attempts.length
			};
		} catch (error) {
			logger.error('RATE_LIMITER', `Rate limit check error: ${error.message}`);
			// Fail open - allow request if rate limiting fails
			return { allowed: true, blocked: false, error: 'Rate limit check failed' };
		}
	}

	/**
	 * Record a failed attempt
	 */
	async recordFailedAttempt(identifier, options = {}) {
		try {
			const {
				type = 'login',
				ipAddress = null,
				userAgent = null,
				userId = null,
				details = null
			} = options;

			// Log the failed attempt in auth_events table
			await this.daos.authEvents.create({
				userId,
				eventType: 'failed_login',
				ipAddress,
				userAgent,
				details: {
					identifier,
					type,
					...details
				}
			});

			// Clear relevant cache entries
			const cacheKey = `${type}_${identifier}`;
			this.memoryCache.delete(cacheKey);

			logger.debug('RATE_LIMITER', `Recorded failed attempt for ${type}: ${identifier}`);
		} catch (error) {
			logger.error('RATE_LIMITER', `Failed to record attempt: ${error.message}`);
		}
	}

	/**
	 * Record a successful attempt (clears rate limiting)
	 */
	async recordSuccessfulAttempt(identifier, options = {}) {
		try {
			const { type = 'login' } = options;

			// Clear cache for this identifier
			const cacheKey = `${type}_${identifier}`;
			this.memoryCache.delete(cacheKey);

			logger.debug('RATE_LIMITER', `Cleared rate limit for successful ${type}: ${identifier}`);
		} catch (error) {
			logger.error('RATE_LIMITER', `Failed to record successful attempt: ${error.message}`);
		}
	}

	/**
	 * Check multiple rate limiting rules for comprehensive protection
	 */
	async checkComprehensiveRateLimit(request) {
		try {
			const { ipAddress, username, userAgent } = request;
			const checks = [];

			// IP-based rate limiting (prevents IP-based attacks)
			if (ipAddress) {
				const ipCheck = await this.checkRateLimit(ipAddress, {
					maxAttempts: 20,
					windowMinutes: 15,
					blockDurationMinutes: 30,
					type: 'ip_login'
				});
				checks.push({ type: 'ip', ...ipCheck });
			}

			// Username-based rate limiting (prevents targeted user attacks)
			if (username) {
				const userCheck = await this.checkRateLimit(username, {
					maxAttempts: 5,
					windowMinutes: 15,
					blockDurationMinutes: 60,
					type: 'user_login'
				});
				checks.push({ type: 'user', ...userCheck });
			}

			// User-Agent based rate limiting (prevents bot attacks)
			if (userAgent) {
				const botCheck = await this.checkRateLimit(userAgent, {
					maxAttempts: 50,
					windowMinutes: 15,
					blockDurationMinutes: 15,
					type: 'useragent_login'
				});
				checks.push({ type: 'useragent', ...botCheck });
			}

			// Find the most restrictive limit
			const blocked = checks.find((check) => check.blocked);
			if (blocked) {
				return {
					allowed: false,
					blocked: true,
					reason: `Rate limited by ${blocked.type}`,
					remainingTime: blocked.remainingTime,
					checks
				};
			}

			return {
				allowed: true,
				blocked: false,
				checks
			};
		} catch (error) {
			logger.error('RATE_LIMITER', `Comprehensive rate limit check error: ${error.message}`);
			return { allowed: true, blocked: false, error: 'Rate limit check failed' };
		}
	}

	/**
	 * Get rate limiting statistics for admin dashboard
	 */
	async getRateLimitStats(hours = 24) {
		try {
			const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

			// Get failed attempts from auth_events
			const failedAttempts = await this.db.all(
				`
				SELECT
					ip_address,
					COUNT(*) as attempts,
					MAX(created_at) as last_attempt
				FROM auth_events
				WHERE event_type = 'failed_login'
				AND created_at > ?
				GROUP BY ip_address
				ORDER BY attempts DESC
				LIMIT 50
			`,
				[cutoffTime]
			);

			// Get blocked IPs (those with many recent failures)
			const blockedIPs = failedAttempts.filter((attempt) => attempt.attempts >= 10);

			// Get top attacking IPs
			const topAttackers = failedAttempts.slice(0, 10);

			// Get recent attack patterns
			const hourlyStats = await this.db.all(
				`
				SELECT
					CAST(created_at / 3600000 as INTEGER) * 3600000 as hour,
					COUNT(*) as failed_attempts
				FROM auth_events
				WHERE event_type = 'failed_login'
				AND created_at > ?
				GROUP BY CAST(created_at / 3600000 as INTEGER)
				ORDER BY hour DESC
				LIMIT 24
			`,
				[cutoffTime]
			);

			return {
				period_hours: hours,
				total_failed_attempts: failedAttempts.reduce((sum, a) => sum + a.attempts, 0),
				unique_ips: failedAttempts.length,
				blocked_ips: blockedIPs.length,
				top_attackers: topAttackers,
				hourly_stats: hourlyStats,
				cache_entries: this.memoryCache.size
			};
		} catch (error) {
			logger.error('RATE_LIMITER', `Failed to get rate limit stats: ${error.message}`);
			return {
				error: 'Failed to get rate limit statistics'
			};
		}
	}

	/**
	 * Manually block or unblock an identifier
	 */
	async setBlock(identifier, blocked, options = {}) {
		try {
			const { type = 'manual', durationMinutes = 60, reason = 'Manual block' } = options;

			if (blocked) {
				const blockUntil = Date.now() + durationMinutes * 60 * 1000;
				const cacheKey = `${type}_${identifier}`;

				this.memoryCache.set(cacheKey, {
					attempts: 999, // High number to ensure blocking
					blockedUntil: blockUntil,
					lastCheck: Date.now(),
					manual: true,
					reason
				});

				logger.info(
					'RATE_LIMITER',
					`Manually blocked ${identifier} for ${durationMinutes} minutes: ${reason}`
				);
			} else {
				// Unblock - remove from cache
				const keysToRemove = [];
				for (const [key, value] of this.memoryCache.entries()) {
					if (key.includes(identifier)) {
						keysToRemove.push(key);
					}
				}

				keysToRemove.forEach((key) => this.memoryCache.delete(key));

				logger.info('RATE_LIMITER', `Manually unblocked ${identifier}`);
			}

			return { success: true };
		} catch (error) {
			logger.error('RATE_LIMITER', `Failed to set block status: ${error.message}`);
			return { success: false, error: 'Failed to update block status' };
		}
	}

	/**
	 * Get current blocking status for an identifier
	 */
	async getBlockStatus(identifier, type = 'login') {
		try {
			const cacheKey = `${type}_${identifier}`;
			const cached = this.memoryCache.get(cacheKey);

			if (cached && cached.blockedUntil) {
				const now = Date.now();
				if (cached.blockedUntil > now) {
					return {
						blocked: true,
						remainingTime: cached.blockedUntil - now,
						reason: cached.reason || 'Rate limit exceeded',
						manual: cached.manual || false
					};
				}
			}

			return { blocked: false };
		} catch (error) {
			logger.error('RATE_LIMITER', `Failed to get block status: ${error.message}`);
			return { blocked: false, error: 'Failed to check block status' };
		}
	}

	/**
	 * Clean up expired cache entries
	 */
	cleanupCache() {
		const now = Date.now();
		const cacheMaxAge = this.cacheTimeout;

		for (const [key, value] of this.memoryCache.entries()) {
			// Remove expired blocked entries
			if (value.blockedUntil && value.blockedUntil <= now) {
				this.memoryCache.delete(key);
				continue;
			}

			// Remove old cache entries
			if (value.lastCheck && now - value.lastCheck > cacheMaxAge) {
				this.memoryCache.delete(key);
			}
		}
	}

	/**
	 * Get recent failed attempts from database
	 */
	async getRecentAttempts(identifier, type, sinceTimestamp) {
		try {
			// Query auth_events for failed attempts
			const query = `
				SELECT id, created_at, ip_address, details
				FROM auth_events
				WHERE event_type = 'failed_login'
				AND created_at > ?
				AND (
					ip_address = ? OR
					JSON_EXTRACT(details, '$.identifier') = ? OR
					JSON_EXTRACT(details, '$.username') = ?
				)
				ORDER BY created_at DESC
			`;

			const attempts = await this.db.all(query, [
				sinceTimestamp,
				identifier,
				identifier,
				identifier
			]);

			return attempts;
		} catch (error) {
			logger.error('RATE_LIMITER', `Failed to get recent attempts: ${error.message}`);
			return [];
		}
	}

	/**
	 * Analyze attack patterns for security insights
	 */
	async analyzeAttackPatterns(hours = 24) {
		try {
			const cutoffTime = Date.now() - hours * 60 * 60 * 1000;

			// Get failed attempts with details
			const attacks = await this.db.all(
				`
				SELECT
					ip_address,
					user_agent,
					details,
					created_at,
					COUNT(*) OVER (PARTITION BY ip_address) as ip_attempts,
					COUNT(*) OVER (PARTITION BY user_agent) as ua_attempts
				FROM auth_events
				WHERE event_type = 'failed_login'
				AND created_at > ?
				ORDER BY created_at DESC
			`,
				[cutoffTime]
			);

			// Analyze patterns
			const patterns = {
				distributed_attacks: new Set(),
				bot_attacks: new Set(),
				credential_stuffing: new Set(),
				brute_force: new Set()
			};

			attacks.forEach((attack) => {
				// Distributed attack: same user-agent from multiple IPs
				if (attack.ua_attempts > 5) {
					patterns.distributed_attacks.add(attack.user_agent);
				}

				// Bot attack: suspicious user-agent patterns
				if (
					attack.user_agent &&
					(attack.user_agent.includes('bot') ||
						attack.user_agent.includes('crawler') ||
						attack.user_agent.length < 10)
				) {
					patterns.bot_attacks.add(attack.user_agent);
				}

				// Credential stuffing: many different usernames from same IP
				if (attack.ip_attempts > 20) {
					patterns.credential_stuffing.add(attack.ip_address);
				}

				// Brute force: many attempts on single user
				if (attack.ip_attempts > 10 && attack.ip_attempts <= 20) {
					patterns.brute_force.add(attack.ip_address);
				}
			});

			return {
				total_attacks: attacks.length,
				unique_ips: new Set(attacks.map((a) => a.ip_address)).size,
				patterns: {
					distributed_attacks: patterns.distributed_attacks.size,
					bot_attacks: patterns.bot_attacks.size,
					credential_stuffing: patterns.credential_stuffing.size,
					brute_force: patterns.brute_force.size
				},
				top_attacking_ips: [...patterns.credential_stuffing, ...patterns.brute_force].slice(0, 10),
				suspicious_user_agents: [...patterns.distributed_attacks, ...patterns.bot_attacks].slice(
					0,
					10
				)
			};
		} catch (error) {
			logger.error('RATE_LIMITER', `Attack pattern analysis error: ${error.message}`);
			return { error: 'Failed to analyze attack patterns' };
		}
	}

	/**
	 * Configure rate limiting rules
	 */
	async updateRateLimitConfig(config) {
		try {
			const currentConfig = await this.db.getSettingsByCategory('security');
			const newRateLimitConfig = {
				...currentConfig.rate_limiting,
				...config
			};

			await this.db.updateSettingInCategory('security', 'rate_limiting', newRateLimitConfig);

			// Clear cache to apply new settings
			this.memoryCache.clear();

			logger.info('RATE_LIMITER', 'Updated rate limiting configuration');

			return { success: true };
		} catch (error) {
			logger.error('RATE_LIMITER', `Failed to update rate limit config: ${error.message}`);
			return { success: false, error: 'Failed to update configuration' };
		}
	}

	/**
	 * Emergency shutdown - block all authentication temporarily
	 */
	async emergencyShutdown(durationMinutes = 30, reason = 'Emergency shutdown') {
		try {
			const blockUntil = Date.now() + durationMinutes * 60 * 1000;

			// Set a global block
			this.memoryCache.set('emergency_block', {
				blocked: true,
				blockedUntil: blockUntil,
				reason,
				emergency: true
			});

			logger.warn(
				'RATE_LIMITER',
				`Emergency shutdown activated for ${durationMinutes} minutes: ${reason}`
			);

			return { success: true, duration: durationMinutes };
		} catch (error) {
			logger.error('RATE_LIMITER', `Emergency shutdown error: ${error.message}`);
			return { success: false, error: 'Failed to activate emergency shutdown' };
		}
	}

	/**
	 * Check if emergency shutdown is active
	 */
	isEmergencyShutdown() {
		const emergency = this.memoryCache.get('emergency_block');
		if (emergency && emergency.blockedUntil && emergency.blockedUntil > Date.now()) {
			return {
				active: true,
				remainingTime: emergency.blockedUntil - Date.now(),
				reason: emergency.reason
			};
		}
		return { active: false };
	}
}
