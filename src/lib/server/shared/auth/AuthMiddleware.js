import { logger } from '../utils/logger.js';

/**
 * Authentication middleware for Express/SvelteKit routes
 * Provides unified authentication and authorization
 */
export class AuthMiddleware {
	constructor(authManager) {
		this.authManager = authManager;
	}

	/**
	 * Create middleware function for authentication
	 */
	authenticate(options = {}) {
		const { required = true, adminOnly = false, skipPaths = [], fallbackToLegacy = true } = options;

		return async (req, res, next) => {
			try {
				const path = req.path || req.url;

				// Skip authentication for specified paths
				if (skipPaths.some((skipPath) => path.startsWith(skipPath))) {
					return next();
				}

				// Try to get token from multiple sources
				const token = this.extractToken(req);

				if (token) {
					// Validate session token
					const validation = await this.authManager.validateSession(token);

					if (validation.valid) {
						// Set user context
						req.user = validation.user;
						req.device = validation.device;
						req.session = validation.session;
						req.isAuthenticated = true;

						// Check admin requirement
						if (adminOnly && !req.user.isAdmin) {
							return this.sendUnauthorized(res, 'Admin access required');
						}

						return next();
					} else {
						// Token is invalid
						logger.debug('AUTH_MIDDLEWARE', `Invalid token: ${validation.error}`);
					}
				}

				// Fallback to legacy terminal key authentication if enabled
				if (fallbackToLegacy) {
					const legacyAuth = this.checkLegacyAuth(req);
					if (legacyAuth.valid) {
						req.user = legacyAuth.user;
						req.isAuthenticated = true;
						req.isLegacyAuth = true;

						if (adminOnly && !legacyAuth.user.isAdmin) {
							return this.sendUnauthorized(res, 'Admin access required');
						}

						return next();
					}
				}

				// No valid authentication found
				if (required) {
					return this.sendUnauthenticated(res);
				} else {
					// Optional authentication - continue without user context
					req.isAuthenticated = false;
					return next();
				}
			} catch (error) {
				logger.error('AUTH_MIDDLEWARE', `Authentication error: ${error.message}`);
				return this.sendInternalError(res);
			}
		};
	}

	/**
	 * Create middleware for SvelteKit hooks
	 */
	createSvelteKitHook(options = {}) {
		return async ({ event, resolve }) => {
			const { request } = event;

			try {
				// Extract token from request
				const token = this.extractTokenFromRequest(request);

				if (token) {
					const validation = await this.authManager.validateSession(token);

					if (validation.valid) {
						// Set auth context in event.locals
						event.locals.user = validation.user;
						event.locals.device = validation.device;
						event.locals.session = validation.session;
						event.locals.isAuthenticated = true;
					}
				}

				// Fallback to legacy auth if enabled
				if (!event.locals.isAuthenticated && options.fallbackToLegacy) {
					const legacyAuth = this.checkLegacyAuthFromRequest(request);
					if (legacyAuth.valid) {
						event.locals.user = legacyAuth.user;
						event.locals.isAuthenticated = true;
						event.locals.isLegacyAuth = true;
					}
				}

				// Set default auth state
				if (!event.locals.isAuthenticated) {
					event.locals.isAuthenticated = false;
					event.locals.user = null;
				}
			} catch (error) {
				logger.error('AUTH_MIDDLEWARE', `SvelteKit auth hook error: ${error.message}`);
				event.locals.isAuthenticated = false;
				event.locals.user = null;
			}

			return resolve(event);
		};
	}

	/**
	 * Route guard for protected pages
	 */
	requireAuth(options = {}) {
		const { adminOnly = false, redirectTo = '/login' } = options;

		return (req, res, next) => {
			if (!req.isAuthenticated) {
				if (req.path.startsWith('/api/')) {
					return this.sendUnauthenticated(res);
				} else {
					return res.redirect(redirectTo);
				}
			}

			if (adminOnly && !req.user?.isAdmin) {
				if (req.path.startsWith('/api/')) {
					return this.sendUnauthorized(res, 'Admin access required');
				} else {
					return res.redirect('/unauthorized');
				}
			}

			next();
		};
	}

	/**
	 * CSRF protection middleware
	 */
	csrfProtection() {
		return (req, res, next) => {
			// Skip CSRF for GET, HEAD, OPTIONS
			if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
				return next();
			}

			// Skip CSRF for unauthenticated requests
			if (!req.isAuthenticated) {
				return next();
			}

			// Check CSRF token
			const csrfToken = req.headers['x-csrf-token'] || req.body?.csrfToken;
			const sessionToken = this.extractToken(req);

			if (!csrfToken || !this.validateCSRFToken(csrfToken, sessionToken)) {
				logger.warn('AUTH_MIDDLEWARE', `CSRF token validation failed for ${req.path}`);
				return res.status(403).json({
					error: 'CSRF token validation failed',
					code: 'INVALID_CSRF_TOKEN'
				});
			}

			next();
		};
	}

	/**
	 * Rate limiting middleware
	 */
	rateLimit(options = {}) {
		const { maxRequests = 100, windowMs = 15 * 60 * 1000 } = options;

		return async (req, res, next) => {
			try {
				const clientId = req.user?.id || req.ip || 'anonymous';
				const key = `rate_limit_${clientId}`;

				// Simple in-memory rate limiting
				// In production, use Redis or database-backed implementation
				const now = Date.now();
				const requests = req.app.locals.rateLimitStore?.[key] || {
					count: 0,
					resetTime: now + windowMs
				};

				if (now > requests.resetTime) {
					requests.count = 0;
					requests.resetTime = now + windowMs;
				}

				requests.count++;

				if (!req.app.locals.rateLimitStore) {
					req.app.locals.rateLimitStore = {};
				}
				req.app.locals.rateLimitStore[key] = requests;

				if (requests.count > maxRequests) {
					logger.warn('AUTH_MIDDLEWARE', `Rate limit exceeded for ${clientId}`);
					return res.status(429).json({
						error: 'Rate limit exceeded',
						resetTime: requests.resetTime
					});
				}

				// Add rate limit headers
				res.set({
					'X-RateLimit-Limit': maxRequests,
					'X-RateLimit-Remaining': Math.max(0, maxRequests - requests.count),
					'X-RateLimit-Reset': requests.resetTime
				});

				next();
			} catch (error) {
				logger.error('AUTH_MIDDLEWARE', `Rate limit error: ${error.message}`);
				next();
			}
		};
	}

	/**
	 * Extract authentication token from request
	 */
	extractToken(req) {
		// Try Authorization header first
		const authHeader = req.headers.authorization;
		if (authHeader && authHeader.startsWith('Bearer ')) {
			return authHeader.substring(7);
		}

		// Try cookie
		const sessionCookie = req.cookies?.sessionToken || req.cookies?.['dispatch-session'];
		if (sessionCookie) {
			return sessionCookie;
		}

		// Try query parameter (not recommended, but for compatibility)
		if (req.query?.token) {
			return req.query.token;
		}

		return null;
	}

	/**
	 * Extract token from SvelteKit Request object
	 */
	extractTokenFromRequest(request) {
		// Try Authorization header
		const authHeader = request.headers.get('authorization');
		if (authHeader && authHeader.startsWith('Bearer ')) {
			return authHeader.substring(7);
		}

		// Try cookies
		const cookieHeader = request.headers.get('cookie');
		if (cookieHeader) {
			const cookies = this.parseCookies(cookieHeader);
			if (cookies.sessionToken || cookies['dispatch-session']) {
				return cookies.sessionToken || cookies['dispatch-session'];
			}
		}

		return null;
	}

	/**
	 * Check legacy terminal key authentication
	 */
	checkLegacyAuth(req) {
		const terminalKey = process.env.TERMINAL_KEY || 'change-me';
		const providedKey = req.headers['x-terminal-key'] || req.query.key || req.body?.key;

		if (providedKey && providedKey === terminalKey) {
			return {
				valid: true,
				user: {
					id: 'legacy',
					username: 'admin',
					displayName: 'Administrator (Legacy)',
					isAdmin: true,
					isActive: true
				}
			};
		}

		return { valid: false };
	}

	/**
	 * Check legacy auth from SvelteKit Request
	 */
	checkLegacyAuthFromRequest(request) {
		const terminalKey = process.env.TERMINAL_KEY || 'change-me';
		const providedKey =
			request.headers.get('x-terminal-key') || request.url.searchParams.get('key');

		if (providedKey && providedKey === terminalKey) {
			return {
				valid: true,
				user: {
					id: 'legacy',
					username: 'admin',
					displayName: 'Administrator (Legacy)',
					isAdmin: true,
					isActive: true
				}
			};
		}

		return { valid: false };
	}

	/**
	 * Generate CSRF token
	 */
	generateCSRFToken(sessionToken) {
		const { createHash } = require('crypto');
		const timestamp = Date.now();
		const data = `${sessionToken}:${timestamp}`;
		const hash = createHash('sha256').update(data).digest('hex');
		return `${timestamp}:${hash}`;
	}

	/**
	 * Validate CSRF token
	 */
	validateCSRFToken(csrfToken, sessionToken) {
		try {
			const [timestamp, hash] = csrfToken.split(':');
			const now = Date.now();
			const tokenAge = now - parseInt(timestamp);

			// Token should not be older than 1 hour
			if (tokenAge > 60 * 60 * 1000) {
				return false;
			}

			// Regenerate hash and compare
			const { createHash } = require('crypto');
			const data = `${sessionToken}:${timestamp}`;
			const expectedHash = createHash('sha256').update(data).digest('hex');

			return hash === expectedHash;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Parse cookie header
	 */
	parseCookies(cookieHeader) {
		const cookies = {};
		cookieHeader.split(';').forEach((cookie) => {
			const [name, value] = cookie.trim().split('=');
			if (name && value) {
				cookies[name] = decodeURIComponent(value);
			}
		});
		return cookies;
	}

	/**
	 * Send unauthenticated response
	 */
	sendUnauthenticated(res) {
		return res.status(401).json({
			error: 'Authentication required',
			code: 'UNAUTHENTICATED'
		});
	}

	/**
	 * Send unauthorized response
	 */
	sendUnauthorized(res, message = 'Insufficient privileges') {
		return res.status(403).json({
			error: message,
			code: 'UNAUTHORIZED'
		});
	}

	/**
	 * Send internal error response
	 */
	sendInternalError(res) {
		return res.status(500).json({
			error: 'Internal authentication error',
			code: 'INTERNAL_ERROR'
		});
	}

	/**
	 * Create user context for templates
	 */
	createUserContext(req) {
		if (!req.isAuthenticated) {
			return {
				isAuthenticated: false,
				user: null,
				isAdmin: false,
				isLegacyAuth: false
			};
		}

		return {
			isAuthenticated: true,
			user: {
				id: req.user.id,
				username: req.user.username,
				displayName: req.user.displayName,
				email: req.user.email,
				isAdmin: req.user.isAdmin
			},
			isAdmin: req.user.isAdmin,
			isLegacyAuth: !!req.isLegacyAuth,
			device: req.device
				? {
						id: req.device.id,
						name: req.device.deviceName,
						trusted: req.device.isTrusted
					}
				: null
		};
	}
}
