import { logger } from './utils/logger.js';

// Global reference to AuthManager instance (set during initialization)
let authManager = null;

export function setAuthManager(manager) {
	authManager = manager;
}

export function getAuthManager() {
	return authManager;
}

/**
 * Extract token from request cookies or authorization header
 */
export function extractToken(request) {
	// Try cookies first
	const cookieHeader = request.headers.get ? request.headers.get('cookie') : request.headers.cookie;
	if (cookieHeader) {
		const match = cookieHeader.match(/dispatch-auth-token=([^;]+)/);
		if (match) {
			return match[1];
		}
	}

	// Try Authorization header
	const authHeader = request.headers.get ? request.headers.get('authorization') : request.headers.authorization;
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
		logger.warn('AUTH', 'AuthManager not initialized');
		return null;
	}

	const token = extractToken(request);
	if (!token) {
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
