/**
 * Authentication Middleware Factory
 * @file Creates Socket.IO authentication middleware with multiple strategies
 *
 * Supports three authentication strategies:
 * 1. Session ID (browser authentication via cookie)
 * 2. API key (programmatic access)
 * 3. Session cookie in headers (WebSocket handshake)
 */

import { logger } from '../../shared/utils/logger.js';
import { CookieService } from '../../auth/CookieService.server.js';
import { createSocketRateLimiter } from '../../auth/RateLimiter.js';

// Rate limiter for Socket.IO authentication (5 attempts per minute per IP)
const socketAuthRateLimiter = createSocketRateLimiter();

/**
 * Parse cookies from Socket.IO handshake headers
 * Socket.IO doesn't provide parsed cookies like SvelteKit, so we parse manually
 */
function parseCookies(cookieHeader) {
	if (!cookieHeader) return {};

	const cookies = {};
	cookieHeader.split(';').forEach((cookie) => {
		const [name, ...rest] = cookie.trim().split('=');
		if (name && rest.length > 0) {
			cookies[name] = decodeURIComponent(rest.join('='));
		}
	});
	return cookies;
}

/**
 * Validate authentication token (API key or legacy terminal key)
 * Includes rate limiting to prevent brute-force attacks
 *
 * @param {object} socket - Socket.IO socket instance
 * @param {string} token - API key or session ID from client
 * @param {object} services - Services object (auth, sessionManager)
 * @returns {Promise<object>} { authenticated: boolean, error?: string, retryAfter?: number }
 */
async function validateToken(socket, token, services) {
	const { auth: authService } = services;

	// Rate limiting: Check authentication attempts per IP address
	const clientIp = socket.handshake.address || 'unknown';
	const rateLimitResult = socketAuthRateLimiter.check(clientIp);

	if (!rateLimitResult.allowed) {
		logger.warn('SOCKET', `Rate limit exceeded for socket auth from IP ${clientIp}`, {
			socketId: socket.id,
			retryAfter: rateLimitResult.retryAfter
		});
		return {
			authenticated: false,
			error: 'Too many authentication attempts. Please try again later.',
			retryAfter: rateLimitResult.retryAfter
		};
	}

	// Validate using AuthService (supports both API keys and OAuth sessions)
	const authResult = await authService.validateAuth(token);

	if (!authResult.valid) {
		logger.warn('SOCKET', `Invalid authentication token from socket ${socket.id}`);
		return {
			authenticated: false,
			error: 'Invalid authentication token'
		};
	}

	// Reset rate limit on successful authentication
	socketAuthRateLimiter.reset(clientIp);

	// Store auth context in socket data
	socket.data.authenticated = true;
	socket.data.auth = {
		provider: authResult.provider,
		userId: authResult.userId,
		apiKeyId: authResult.apiKeyId,
		label: authResult.label
	};

	logger.debug('SOCKET', `Socket ${socket.id} authenticated via ${authResult.provider}`);
	return { authenticated: true };
}

/**
 * Validate session cookie from Socket.IO handshake
 *
 * @param {object} socket - Socket.IO socket instance
 * @param {string} cookieSessionId - Session ID from cookie
 * @param {object} services - Services object (sessionManager)
 * @returns {Promise<object>} { authenticated: boolean, error?: string }
 */
async function validateSessionCookie(socket, cookieSessionId, services) {
	const sessionData = await services.sessionManager.validateSession(cookieSessionId);

	if (!sessionData) {
		return {
			authenticated: false,
			error: 'Invalid or expired session'
		};
	}

	// Store auth context in socket data
	socket.data.authenticated = true;
	socket.data.auth = {
		provider: sessionData.session.provider,
		userId: sessionData.session.userId
	};
	socket.data.session = sessionData.session;
	socket.data.user = sessionData.user;

	logger.debug('SOCKET', `Socket ${socket.id} authenticated via session cookie`);
	return { authenticated: true };
}

/**
 * Attempt all authentication strategies for Socket.IO event
 *
 * Strategies (in order):
 * 1. Check for sessionId in event data (browser auth via cookie)
 * 2. Check for apiKey/terminalKey in event data (programmatic access)
 * 3. Check for session cookie in handshake headers (WebSocket auth)
 * 4. Check if socket is already authenticated
 *
 * @param {object} socket - Socket.IO socket instance
 * @param {object} data - Event data from client
 * @param {object} services - Services object (auth, sessionManager)
 * @returns {Promise<object>} { authenticated: boolean, error?: string, provider?: string }
 */
export async function authenticateSocket(socket, data, services) {
	const { sessionId, apiKey, terminalKey } = data || {};

	// Strategy 1: Check for sessionId (browser authentication via cookie)
	if (sessionId) {
		const result = await validateSessionCookie(socket, sessionId, services);
		if (result.authenticated) {
			return { ...result, provider: 'session_cookie' };
		}
	}

	// Strategy 2: Check for apiKey or legacy terminalKey
	const token = apiKey || terminalKey;
	if (token) {
		const result = await validateToken(socket, token, services);
		if (result.authenticated) {
			return { ...result, provider: 'api_key' };
		}
		// Return error from token validation (includes rate limit info)
		return result;
	}

	// Strategy 3: Check for session cookie in handshake headers
	const cookieHeader = socket.handshake.headers.cookie;
	if (cookieHeader) {
		const cookies = parseCookies(cookieHeader);
		const cookieSessionId = cookies[CookieService.COOKIE_NAME];

		if (cookieSessionId) {
			const result = await validateSessionCookie(socket, cookieSessionId, services);
			if (result.authenticated) {
				return { ...result, provider: 'cookie_header' };
			}
		}
	}

	// Strategy 4: Check if socket is already authenticated
	if (socket.data.authenticated) {
		return {
			authenticated: true,
			provider: socket.data.auth?.provider || 'existing_session'
		};
	}

	// No valid authentication found
	return {
		authenticated: false,
		error: 'Authentication required (sessionId, apiKey, or valid cookie)'
	};
}

/**
 * Create authentication middleware that validates auth for specific events
 *
 * @param {object} services - Services object (auth, sessionManager)
 * @param {object} [options={}] - Middleware options
 * @param {boolean} [options.required=true] - Whether authentication is required
 * @param {string[]} [options.exemptEvents=[]] - Events that don't require auth
 * @returns {Function} Socket.IO middleware function
 */
export function createAuthenticationMiddleware(services, options = {}) {
	const {
		required = true,
		exemptEvents = ['client:hello', 'tunnel:status', 'vscode-tunnel:status']
	} = options;

	/**
	 * @this {import('socket.io').Socket}
	 */
	return async function ([event, data, callback], next) {
		// Skip auth for exempt events
		if (exemptEvents.includes(event)) {
			next();
			return;
		}

		// Get the socket from the middleware context
		const socket = this;

		// Check if already authenticated
		if (socket.data.authenticated) {
			next();
			return;
		}

		// Attempt authentication using all strategies
		const result = await authenticateSocket(socket, data, services);

		if (!result.authenticated) {
			if (required) {
				logger.warn('SOCKET', `Authentication required for event ${event} from socket ${socket.id}`);

				// Send error response via callback
				if (callback && typeof callback === 'function') {
					callback({
						success: false,
						error: result.error || 'Authentication required',
						retryAfter: result.retryAfter
					});
				}

				// Don't call next() - block the event
				return;
			}
		}

		// Authentication successful or not required, proceed
		next();
	};
}

/**
 * Helper function for event handlers to require authentication
 * Use this in individual event handlers that need custom auth logic
 *
 * @param {object} socket - Socket.IO socket instance
 * @param {object} data - Event data from client
 * @param {function} callback - Event callback function
 * @param {object} services - Services object (auth, sessionManager)
 * @returns {Promise<boolean>} True if authenticated, false otherwise
 */
export async function requireAuth(socket, data, callback, services) {
	const result = await authenticateSocket(socket, data, services);

	if (!result.authenticated) {
		logger.warn('SOCKET', `Authentication failed for socket ${socket.id}: ${result.error}`);

		if (callback && typeof callback === 'function') {
			callback({
				success: false,
				error: result.error || 'Authentication required',
				retryAfter: result.retryAfter
			});
		}

		return false;
	}

	return true;
}
