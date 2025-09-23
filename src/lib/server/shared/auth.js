import { logger } from './utils/logger.js';

const TERMINAL_KEY = process.env.TERMINAL_KEY;

// Global reference to AuthManager instance (set during initialization)
let authManager = null;

export function setAuthManager(manager) {
	authManager = manager;
}

export function getAuthManager() {
	return authManager;
}

export function validateKey(key) {
	// If TERMINAL_KEY is explicitly set to empty string, allow any key
	if (TERMINAL_KEY === '') {
		return true;
	}
	return key === TERMINAL_KEY;
}

export function requireAuth(key) {
	if (!validateKey(key)) {
		throw new Error('Invalid authentication key');
	}
}

/**
 * Extract token from request cookies or authorization header
 */
export function extractToken(request) {
	// Try cookies first
	const cookies = request.headers.cookie;
	if (cookies) {
		const match = cookies.match(/dispatch-auth-token=([^;]+)/);
		if (match) {
			return match[1];
		}
	}

	// Try Authorization header
	const authHeader = request.headers.authorization;
	if (authHeader && authHeader.startsWith('Bearer ')) {
		return authHeader.slice(7);
	}

	return null;
}

/**
 * Verify authentication token and return user info
 */
export async function verifyAuth(request) {
	if (!authManager) {
		// Fallback to legacy key validation if AuthManager not initialized
		const key = request.headers['x-auth-key'] || extractToken(request);
		if (validateKey(key)) {
			return { legacy: true, key };
		}
		return null;
	}

	const token = extractToken(request);
	if (!token) {
		// Try legacy key as fallback
		const key = request.headers['x-auth-key'] || request.url?.searchParams?.get('key');
		if (key && authManager.validateLegacyKey(key)) {
			return { legacy: true, key };
		}
		return null;
	}

	try {
		const auth = await authManager.verifyToken(token);
		return auth;
	} catch (error) {
		logger.warn('AUTH', 'Token verification failed:', error.message);
		return null;
	}
}

/**
 * Middleware to require authentication for routes
 */
export async function requireAuthMiddleware(request) {
	const auth = await verifyAuth(request);
	if (!auth) {
		throw new Error('Authentication required');
	}
	return auth;
}
