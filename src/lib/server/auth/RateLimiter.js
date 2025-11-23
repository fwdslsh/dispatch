/**
 * RateLimiter.js
 *
 * Simple in-memory rate limiter for authentication and API endpoints.
 * Prevents brute-force attacks by limiting attempts per IP address or identifier.
 *
 * Features:
 * - Configurable max attempts and time window
 * - Automatic cleanup of expired entries
 * - Memory-efficient sliding window implementation
 * - Thread-safe for Node.js single-threaded model
 *
 * Usage:
 * const limiter = new RateLimiter(10, 60000); // 10 attempts per minute
 * const result = limiter.check('192.168.1.1');
 * if (!result.allowed) {
 *   return error(429, { error: 'Too many attempts', retryAfter: result.retryAfter });
 * }
 */

import { logger } from '../shared/utils/logger.js';

export class RateLimiter {
	/**
	 * @param {number} maxAttempts - Maximum attempts allowed in time window
	 * @param {number} windowMs - Time window in milliseconds
	 * @param {string} name - Name for logging purposes
	 */
	constructor(maxAttempts = 10, windowMs = 60000, name = 'rate-limiter') {
		this.maxAttempts = maxAttempts;
		this.windowMs = windowMs;
		this.name = name;

		// Map of identifier -> array of attempt timestamps
		this.attempts = new Map();

		// Periodic cleanup to prevent memory leaks
		this.cleanupInterval = setInterval(() => this.cleanup(), windowMs);

		logger.info(
			'RATE_LIMITER',
			`Initialized ${name}: ${maxAttempts} attempts per ${windowMs}ms`
		);
	}

	/**
	 * Check if an identifier has exceeded rate limit
	 * @param {string} identifier - Unique identifier (IP address, user ID, etc.)
	 * @returns {{ allowed: boolean, retryAfter?: number, remaining?: number }}
	 */
	check(identifier) {
		if (!identifier) {
			logger.warn('RATE_LIMITER', `${this.name}: Empty identifier provided`);
			return { allowed: true, remaining: this.maxAttempts };
		}

		const now = Date.now();
		const windowStart = now - this.windowMs;

		// Get existing attempts and filter out expired ones
		let attemptTimes = this.attempts.get(identifier) || [];
		attemptTimes = attemptTimes.filter((time) => time > windowStart);

		// Check if limit exceeded
		if (attemptTimes.length >= this.maxAttempts) {
			const oldestAttempt = Math.min(...attemptTimes);
			const retryAfter = Math.ceil((oldestAttempt + this.windowMs - now) / 1000);

			logger.warn('RATE_LIMITER', `${this.name}: Rate limit exceeded for ${identifier}`, {
				attempts: attemptTimes.length,
				maxAttempts: this.maxAttempts,
				retryAfter
			});

			return {
				allowed: false,
				retryAfter,
				remaining: 0
			};
		}

		// Record new attempt
		attemptTimes.push(now);
		this.attempts.set(identifier, attemptTimes);

		const remaining = this.maxAttempts - attemptTimes.length;

		logger.debug('RATE_LIMITER', `${this.name}: Attempt recorded for ${identifier}`, {
			attempts: attemptTimes.length,
			remaining
		});

		return {
			allowed: true,
			remaining
		};
	}

	/**
	 * Reset attempts for an identifier (e.g., after successful authentication)
	 * @param {string} identifier - Unique identifier
	 */
	reset(identifier) {
		if (this.attempts.has(identifier)) {
			this.attempts.delete(identifier);
			logger.debug('RATE_LIMITER', `${this.name}: Reset attempts for ${identifier}`);
		}
	}

	/**
	 * Clean up expired attempts to prevent memory leaks
	 */
	cleanup() {
		const now = Date.now();
		const windowStart = now - this.windowMs;
		let cleaned = 0;

		for (const [identifier, attemptTimes] of this.attempts.entries()) {
			const validAttempts = attemptTimes.filter((time) => time > windowStart);

			if (validAttempts.length === 0) {
				this.attempts.delete(identifier);
				cleaned++;
			} else if (validAttempts.length < attemptTimes.length) {
				this.attempts.set(identifier, validAttempts);
			}
		}

		if (cleaned > 0) {
			logger.debug('RATE_LIMITER', `${this.name}: Cleaned up ${cleaned} expired entries`);
		}
	}

	/**
	 * Get current statistics for monitoring
	 * @returns {{ totalIdentifiers: number, maxAttempts: number, windowMs: number, name: string }}
	 */
	getStats() {
		return {
			totalIdentifiers: this.attempts.size,
			maxAttempts: this.maxAttempts,
			windowMs: this.windowMs,
			name: this.name
		};
	}

	/**
	 * Destroy the rate limiter and clean up resources
	 */
	destroy() {
		clearInterval(this.cleanupInterval);
		this.attempts.clear();
		logger.info('RATE_LIMITER', `${this.name}: Destroyed`);
	}
}

/**
 * Create a preconfigured rate limiter for authentication endpoints
 * Default: 10 attempts per minute
 */
export function createAuthRateLimiter() {
	return new RateLimiter(10, 60000, 'auth');
}

/**
 * Create a preconfigured rate limiter for API endpoints
 * Default: 100 requests per minute
 */
export function createApiRateLimiter() {
	return new RateLimiter(100, 60000, 'api');
}

/**
 * Create a preconfigured rate limiter for Socket.IO connections
 * Default: 5 connection attempts per minute
 */
export function createSocketRateLimiter() {
	return new RateLimiter(5, 60000, 'socket');
}
