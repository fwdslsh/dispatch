/**
 * Socket.IO Authentication Utilities
 *
 * Centralized utilities for handling Socket.IO authentication
 * with the SocketIOServer authentication system.
 */

import { io } from 'socket.io-client';
import { STORAGE_CONFIG } from '$lib/shared/constants.js';
import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';

/**
 * Get stored authentication token for WebSocket connections
 * @returns {string|null} JWT token from sessionStorage or null
 */
export function getStoredAuthToken() {
	// Check sessionStorage for WebSocket authentication token
	// (httpOnly cookies can't be read by JavaScript, so we store a copy here)
	if (typeof sessionStorage !== 'undefined') {
		const token = sessionStorage.getItem('dispatch-auth-token');
		if (token) {
			return token;
		}
	}

	// Fall back to localStorage for backwards compatibility
	if (typeof localStorage !== 'undefined') {
		return localStorage.getItem(STORAGE_CONFIG.AUTH_TOKEN_KEY);
	}

	return null;
}

/**
 * Store authentication token for WebSocket connections
 * @param {string} token - Auth token to store
 */
export function storeAuthToken(token) {
	// Store in sessionStorage for WebSocket auth
	if (typeof sessionStorage !== 'undefined') {
		sessionStorage.setItem('dispatch-auth-token', token);
	}
	// Keep localStorage for backwards compatibility
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem(STORAGE_CONFIG.AUTH_TOKEN_KEY, token);
	}
}

/**
 * Remove stored authentication tokens
 */
export function clearAuthToken() {
	// Clear both sessionStorage and localStorage
	if (typeof sessionStorage !== 'undefined') {
		sessionStorage.removeItem('dispatch-auth-token');
	}
	if (typeof localStorage !== 'undefined') {
		localStorage.removeItem(STORAGE_CONFIG.AUTH_TOKEN_KEY);
	}
}

/**
 * Get socket URL from configuration or fall back to current origin
 * @param {Object} config - Configuration object with socketUrl
 * @returns {string} Socket URL to use for connection
 */
function getSocketUrl(config = {}) {
	return config.socketUrl || (typeof window !== 'undefined' ? window.location.origin : '');
}

/**
 * Create authenticated Socket.IO connection
 * @param {Object} options - Socket.IO connection options
 * @param {Object} config - Configuration object with socketUrl
 * @returns {Promise<Object>} Promise resolving to {socket, authenticated}
 */
export async function createAuthenticatedSocket(options = {}, config = {}) {
	// Use configured URL or current origin for socket connection to support remote access
	const socketUrl = getSocketUrl(config);
	const socket = io(socketUrl, { transports: ['websocket', 'polling'], ...options });

	return new Promise((resolve, reject) => {
		const token = getStoredAuthToken();

		if (!token) {
			socket.disconnect();
			resolve({ socket: null, authenticated: false });
			return;
		}

		// Try to authenticate with stored token
		socket.emit('auth', token, (response) => {
			if (response?.success) {
				resolve({ socket, authenticated: true });
			} else {
				// Clear invalid token
				clearAuthToken();
				socket.disconnect();
				resolve({ socket: null, authenticated: false });
			}
		});

		// Handle connection errors
		socket.on('connect_error', (error) => {
			socket.disconnect();
			reject(error);
		});
	});
}

/**
 * Test authentication with a specific key
 * @param {string} key - Authentication key to test
 * @param {Object} config - Configuration object with socketUrl
 * @returns {Promise<boolean>} Promise resolving to authentication result
 */
export async function testAuthKey(key, config = {}) {
	// Use configured URL or current origin for socket connection to support remote access
	const socketUrl = getSocketUrl(config);
	const socket = io(socketUrl, { transports: ['websocket', 'polling'] });

	return new Promise((resolve) => {
		// Set a timeout to prevent hanging
		const timeout = setTimeout(() => {
			socket.disconnect();
			resolve(false);
		}, 5000);

		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			socket.emit('auth', key, (response) => {
				clearTimeout(timeout);
				socket.disconnect();
				resolve(response?.success === true);
			});
		});

		// Handle connection errors
		socket.on(SOCKET_EVENTS.CONNECT_ERROR, () => {
			clearTimeout(timeout);
			socket.disconnect();
			resolve(false);
		});
	});
}

/**
 * Authenticate existing socket connection
 * @param {Object} socket - Socket.IO socket instance
 * @param {string} key - Authentication key
 * @returns {Promise<boolean>} Promise resolving to authentication result
 */
export async function authenticateSocket(socket, key) {
	return new Promise((resolve) => {
		socket.emit('auth', key, (response) => {
			resolve(response?.success === true);
		});
	});
}

/**
 * Check if user is currently authenticated
 * @param {Object} config - Configuration object with socketUrl
 * @returns {Promise<boolean>} Promise resolving to authentication status
 */
export async function isAuthenticated(config = {}) {
	const token = getStoredAuthToken();
	if (!token) return false;

	return await testAuthKey(token, config);
}

/**
 * Attempt auto-authentication with development key
 * @param {string} devKey - Development key to test (default: 'testkey12345')
 * @param {Object} config - Configuration object with socketUrl
 * @returns {Promise<boolean>} Promise resolving to authentication result
 */
export async function tryAutoAuth(devKey = 'testkey12345', config = {}) {
	const success = await testAuthKey(devKey, config);
	if (success) {
		storeAuthToken(devKey);
	}
	return success;
}
