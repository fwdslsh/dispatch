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
 * Get stored authentication token
 * @returns {string|null} Stored auth token or null
 */
export function getStoredAuthToken() {
	return localStorage.getItem(STORAGE_CONFIG.AUTH_TOKEN_KEY);
}

/**
 * Store authentication token
 * @param {string} token - Auth token to store
 */
export function storeAuthToken(token) {
	localStorage.setItem(STORAGE_CONFIG.AUTH_TOKEN_KEY, token);
}

/**
 * Remove stored authentication token
 */
export function clearAuthToken() {
	localStorage.removeItem(STORAGE_CONFIG.AUTH_TOKEN_KEY);
}

/**
 * Create authenticated Socket.IO connection
 * @param {Object} options - Socket.IO connection options
 * @returns {Promise<Object>} Promise resolving to {socket, authenticated}
 */
export async function createAuthenticatedSocket(options = {}) {
	const socket = io({ transports: ['websocket', 'polling'], ...options });

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
 * @returns {Promise<boolean>} Promise resolving to authentication result
 */
export async function testAuthKey(key) {
	const socket = io({ transports: ['websocket', 'polling'] });

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
 * @returns {Promise<boolean>} Promise resolving to authentication status
 */
export async function isAuthenticated() {
	const token = getStoredAuthToken();
	if (!token) return false;

	return await testAuthKey(token);
}

/**
 * Attempt auto-authentication with development key
 * @param {string} devKey - Development key to test (default: 'testkey12345')
 * @returns {Promise<boolean>} Promise resolving to authentication result
 */
export async function tryAutoAuth(devKey = 'testkey12345') {
	const success = await testAuthKey(devKey);
	if (success) {
		storeAuthToken(devKey);
	}
	return success;
}
