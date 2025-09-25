import { createDAOs } from '../db/models/index.js';

/**
 * SecurityPolicyManager - Manages security policies that adapt to hosting context
 *
 * Handles CORS, cookies, HSTS, CSRF, and other security policies based on:
 * - Localhost vs tunnel vs custom domain contexts
 * - HTTPS availability and certificate type
 * - Development vs production environments
 */
export class SecurityPolicyManager {
	constructor(databaseManager) {
		this.db = databaseManager;
		this.daos = createDAOs(databaseManager);

		// In-memory CSRF token storage
		this.csrfTokens = new Map();
		this.csrfTokenTimeout = 60 * 60 * 1000; // 1 hour

		// Cache for security context detection
		this.contextCache = new Map();
		this.contextCacheTimeout = 5 * 60 * 1000; // 5 minutes

		// Start cleanup interval
		this.startCleanupInterval();
	}

	/**
	 * CORS Policy Management
	 */
	async updateCORSOrigins(origins) {
		// Validate all origins
		origins.forEach((origin) => this.validateOrigin(origin));

		await this.db.setSettingsForCategory(
			'security',
			{
				cors_allowed_origins: origins
			},
			'CORS origins update'
		);

		await this.logPolicyChange('cors', { origins });
	}

	async getCORSOrigins() {
		const settings = await this.db.getSettingsByCategory('security');
		return settings.cors_allowed_origins || ['http://localhost:3030'];
	}

	async updateTunnelOrigins(tunnelInfo) {
		const currentOrigins = await this.getCORSOrigins();
		const tunnelOrigin = tunnelInfo.url;

		// Remove old tunnel origins (loca.lt, tunnel.site, etc.)
		const filteredOrigins = currentOrigins.filter((origin) => {
			try {
				const url = new URL(origin);
				// Keep non-tunnel origins
				return (
					!url.hostname.includes('loca.lt') &&
					!url.hostname.includes('tunnel.site') &&
					!url.hostname.includes('localtunnel.me')
				);
			} catch {
				return true; // Keep if not a valid URL
			}
		});

		// Add new tunnel origin
		if (!filteredOrigins.includes(tunnelOrigin)) {
			const newOrigins = [...filteredOrigins, tunnelOrigin];
			await this.updateCORSOrigins(newOrigins);
		}

		// Update security context for tunnel
		await this.updateSecurityContext({
			mode: 'tunnel',
			isSecure: tunnelOrigin.startsWith('https'),
			hasTunnel: true
		});
	}

	validateOrigin(origin) {
		try {
			const url = new URL(origin);
			if (!['http:', 'https:'].includes(url.protocol)) {
				throw new Error('Invalid protocol');
			}
		} catch (error) {
			throw new Error(`Invalid origin URL: ${origin}`);
		}
	}

	async getCORSConfiguration() {
		const origins = await this.getCORSOrigins();
		return {
			origin: origins,
			credentials: true,
			methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
			allowedHeaders: [
				'Content-Type',
				'Authorization',
				'X-Requested-With',
				'X-CSRF-Token',
				'Accept',
				'Origin'
			],
			exposedHeaders: ['X-CSRF-Token'],
			optionsSuccessStatus: 200
		};
	}

	/**
	 * Cookie Security Policy Management
	 */
	getCookieOptions(context) {
		const {
			isHttps = false,
			isLocalhost = false,
			isTunnel = false,
			isLAN = false,
			isSecureContext = false
		} = context;

		const options = {
			httpOnly: true,
			maxAge: 24 * 60 * 60 * 1000 // 24 hours
		};

		// Secure flag - only for HTTPS
		options.secure = isHttps;

		// SameSite policy based on context
		if (isTunnel) {
			// Tunnel contexts need relaxed SameSite for cross-origin functionality
			options.sameSite = 'none';
			options.secure = true; // Required for sameSite=none
		} else if (isLocalhost || isLAN) {
			// Local contexts can use strict
			options.sameSite = 'strict';
		} else {
			// Default to lax for general use
			options.sameSite = 'lax';
		}

		return options;
	}

	/**
	 * HSTS Policy Management
	 */
	async updateCertificateContext(certContext) {
		await this.db.setSettingsForCategory(
			'security',
			{
				certificate_context: certContext
			},
			'Certificate context update'
		);

		await this.logPolicyChange('certificate', certContext);
	}

	async getHSTSConfiguration() {
		const settings = await this.db.getSettingsByCategory('security');
		const certContext = settings.certificate_context || {};

		const enabled = this.shouldEnableHSTS(certContext);

		return {
			enabled,
			maxAge: enabled ? 31536000 : 0, // 1 year or disabled
			includeSubDomains: enabled && certContext.type === 'letsencrypt',
			preload: false // Don't enable preload automatically
		};
	}

	shouldEnableHSTS(certContext) {
		const { type, domain } = certContext;

		// Only enable HSTS for production certificates with stable domains
		if (type === 'letsencrypt' && domain && !domain.includes('tunnel')) {
			return true;
		}

		// Disable for mkcert, self-signed, and tunnel contexts
		return false;
	}

	/**
	 * CSRF Protection
	 */
	generateCSRFToken() {
		const bytes = new Uint8Array(32);
		crypto.getRandomValues(bytes);
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, '0'))
			.join('');
	}

	storeCSRFToken(sessionId, token) {
		this.csrfTokens.set(sessionId, {
			token,
			timestamp: Date.now()
		});
	}

	validateCSRFToken(sessionId, token) {
		const stored = this.csrfTokens.get(sessionId);
		if (!stored) {
			return false;
		}

		// Check if token has expired
		if (Date.now() - stored.timestamp > this.csrfTokenTimeout) {
			this.csrfTokens.delete(sessionId);
			return false;
		}

		return stored.token === token;
	}

	cleanupExpiredCSRFTokens() {
		const now = Date.now();
		for (const [sessionId, data] of this.csrfTokens.entries()) {
			if (now - data.timestamp > this.csrfTokenTimeout) {
				this.csrfTokens.delete(sessionId);
			}
		}
	}

	/**
	 * Security Header Configuration (Helmet)
	 */
	getHelmetConfiguration(context) {
		const {
			environment = 'production',
			isHttps = false,
			isTunnel = false,
			isCustomDomain = false
		} = context;

		const config = {
			contentSecurityPolicy:
				environment === 'production'
					? {
							directives: {
								defaultSrc: ["'self'"],
								scriptSrc: ["'self'", "'unsafe-inline'"],
								styleSrc: ["'self'", "'unsafe-inline'"],
								fontSrc: ["'self'"],
								imgSrc: ["'self'", 'data:', 'https:'],
								connectSrc: ["'self'", 'wss:', 'ws:'],
								mediaSrc: ["'self'"],
								objectSrc: ["'none'"],
								childSrc: ["'self'"],
								workerSrc: ["'self'"],
								frameSrc: ["'none'"]
							}
						}
					: false,

			hsts:
				this.shouldEnableHSTS({ type: isCustomDomain ? 'letsencrypt' : 'tunnel' }) && isHttps
					? {
							maxAge: 31536000,
							includeSubDomains: isCustomDomain,
							preload: false
						}
					: false,

			noSniff: true,
			xssFilter: true,
			referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

			frameguard: isTunnel ? { action: 'sameorigin' } : { action: 'deny' },

			crossOriginEmbedderPolicy: environment === 'production',
			crossOriginResourcePolicy: { policy: 'cross-origin' },
			crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }
		};

		return config;
	}

	/**
	 * Rate Limiting Configuration
	 */
	getRateLimitConfiguration(endpoint, context = {}) {
		const { isLAN = false, isTunnel = false, isLocalhost = false } = context;

		// Base configuration by endpoint type
		const configs = {
			auth: {
				windowMs: 15 * 60 * 1000, // 15 minutes
				max: isLAN ? 50 : isTunnel ? 10 : 20,
				skipSuccessfulRequests: true,
				standardHeaders: true,
				legacyHeaders: false
			},
			'failed-auth': {
				windowMs: 15 * 60 * 1000,
				max: isLAN ? 10 : isTunnel ? 3 : 5,
				skipSuccessfulRequests: false,
				standardHeaders: true,
				legacyHeaders: false
			},
			api: {
				windowMs: 15 * 60 * 1000,
				max: isLAN ? 200 : isTunnel ? 50 : 100,
				skipSuccessfulRequests: true,
				standardHeaders: true,
				legacyHeaders: false
			},
			upload: {
				windowMs: 60 * 60 * 1000, // 1 hour
				max: isLAN ? 20 : isTunnel ? 5 : 10,
				skipSuccessfulRequests: true,
				standardHeaders: true,
				legacyHeaders: false
			}
		};

		return configs[endpoint] || configs.api;
	}

	/**
	 * Security Context Detection
	 */
	detectSecurityContext(request) {
		const { hostname, protocol } = request;
		const cacheKey = `${hostname}-${protocol}`;

		// Check cache first
		const cached = this.contextCache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < this.contextCacheTimeout) {
			return cached.context;
		}

		const context = {
			hostname,
			protocol,
			isHttps: protocol === 'https:',
			isLocalhost: hostname === 'localhost' || hostname === '127.0.0.1',
			isTunnel: hostname.includes('.localtunnel.me') || hostname.includes('.ngrok.io'),
			isLAN: this.isLANAddress(hostname),
			isCustomDomain: this.isCustomDomain(hostname),
			isSecureContext: protocol === 'https:' || hostname === 'localhost'
		};

		// Cache the result
		this.contextCache.set(cacheKey, {
			context,
			timestamp: Date.now()
		});

		return context;
	}

	isLANAddress(hostname) {
		// Check for private IP ranges
		const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
		const match = hostname.match(ipv4Regex);

		if (match) {
			const [, a, b, c, d] = match.map(Number);

			// Private IP ranges
			return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a === 127; // localhost
		}

		return false;
	}

	isCustomDomain(hostname) {
		return (
			!this.isLANAddress(hostname) &&
			hostname !== 'localhost' &&
			!hostname.includes('.localtunnel.me') &&
			!hostname.includes('.ngrok.io')
		);
	}

	/**
	 * Policy Update Management
	 */
	async updateSecurityPolicies(oldContext, newContext) {
		const changes = [];

		// Update CORS if hostname changed
		if (oldContext.hostname !== newContext.hostname) {
			await this.updateTunnelOrigins({ url: `${newContext.protocol}//${newContext.hostname}` });
			changes.push('cors');
		}

		// Update certificate context if HTTPS status changed
		if (oldContext.isHttps !== newContext.isHttps) {
			await this.updateCertificateContext({
				type: newContext.isTunnel ? 'tunnel' : newContext.isCustomDomain ? 'letsencrypt' : 'mkcert',
				domain: newContext.hostname
			});
			changes.push('certificate');
		}

		if (changes.length > 0) {
			await this.logPolicyChange('context-change', {
				oldContext,
				newContext,
				changes
			});
		}

		return changes;
	}

	validatePolicyConfiguration(config) {
		if (config.cors?.origins) {
			config.cors.origins.forEach((origin) => this.validateOrigin(origin));
		}

		if (config.cookies) {
			const { secure, sameSite } = config.cookies;
			if (sameSite && !['strict', 'lax', 'none'].includes(sameSite)) {
				throw new Error(`Invalid SameSite value: ${sameSite}`);
			}
		}

		if (config.hsts?.maxAge && config.hsts.maxAge < 0) {
			throw new Error('HSTS maxAge must be non-negative');
		}
	}

	/**
	 * Update security context based on hosting environment
	 * @param {object} context - Hosting context information
	 */
	async updateSecurityContext(context) {
		const { mode, isSecure, hasTunnel } = context;

		// Cache the context
		this.contextCache.set('current', {
			context,
			timestamp: Date.now()
		});

		// Update database settings
		await this.db.setSettingsForCategory(
			'security',
			{
				hosting_context: {
					mode,
					isSecure,
					hasTunnel,
					updatedAt: new Date().toISOString()
				}
			},
			'Security context update'
		);

		// Log the change
		await this.logPolicyChange('hosting_context', context);
	}

	/**
	 * Handle tunnel disconnection - restore original policies
	 */
	async onTunnelDisconnected() {
		// Get current origins and remove tunnel URLs
		const currentOrigins = await this.getCORSOrigins();
		const filteredOrigins = currentOrigins.filter((origin) => {
			try {
				const url = new URL(origin);
				// Remove tunnel origins
				return (
					!url.hostname.includes('loca.lt') &&
					!url.hostname.includes('tunnel.site') &&
					!url.hostname.includes('localtunnel.me')
				);
			} catch {
				return true;
			}
		});

		// Update CORS origins
		await this.updateCORSOrigins(filteredOrigins);

		// Reset security context to LAN mode
		await this.updateSecurityContext({
			mode: 'lan',
			isSecure: false,
			hasTunnel: false
		});

		// Log disconnection
		await this.logPolicyChange('tunnel_disconnected', {
			restoredOrigins: filteredOrigins
		});
	}

	/**
	 * Audit Logging
	 */
	async logPolicyChange(policy, changes) {
		await this.daos.authEvents.logEvent(
			null, // system event
			null, // no specific device
			null, // no IP for system events
			'SecurityPolicyManager',
			'policy_change',
			{
				policy,
				changes,
				timestamp: new Date().toISOString()
			}
		);
	}

	async getPolicyAuditLogs(options = {}) {
		const { limit = 100, days = 30 } = options;
		const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;

		const events = await this.db.all(
			`
			SELECT * FROM auth_events
			WHERE event_type = 'policy_change'
			AND created_at > ?
			ORDER BY created_at DESC
			LIMIT ?
		`,
			[cutoffTime, limit]
		);

		return events.map((event) => ({
			id: event.id,
			policy: JSON.parse(event.details || '{}').policy,
			changes: JSON.parse(event.details || '{}').changes,
			timestamp: new Date(event.created_at)
		}));
	}

	/**
	 * Cleanup and Maintenance
	 */
	startCleanupInterval() {
		// Clean up expired tokens every 5 minutes
		setInterval(
			() => {
				this.cleanupExpiredCSRFTokens();
				this.cleanupContextCache();
			},
			5 * 60 * 1000
		);
	}

	cleanupContextCache() {
		const now = Date.now();
		for (const [key, data] of this.contextCache.entries()) {
			if (now - data.timestamp > this.contextCacheTimeout) {
				this.contextCache.delete(key);
			}
		}
	}

	async cleanup() {
		// Called during shutdown
		this.csrfTokens.clear();
		this.contextCache.clear();
	}
}
