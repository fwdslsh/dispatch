/**
 * Socket.IO Authentication Utilities
 *
 * Centralized utilities for handling Socket.IO authentication
 * with cookie-based session authentication.
 *
 * COOKIE-BASED AUTHENTICATION:
 * - Browser clients: Automatically send session cookie via withCredentials
 * - Programmatic clients: Can still use API key via auth.token option
 */

import { io } from 'socket.io-client';
import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';

/**
 * Get socket URL from configuration or fall back to current origin
 * @param {Object} config - Configuration object with socketUrl
 * @returns {string} Socket URL to use for connection
 */
function getSocketUrl(config = {}) {
	return config.socketUrl || (typeof window !== 'undefined' ? window.location.origin : '');
}

/**
 * Create authenticated Socket.IO connection with cookie support
 * Browser clients automatically send session cookie via withCredentials
 * @param {Object} options - Socket.IO connection options
 * @param {Object} config - Configuration object with socketUrl, apiKey (optional)
 * @returns {Promise<Object>} Promise resolving to {socket, authenticated}
 */
export async function createAuthenticatedSocket(options = {}, config = {}) {
	// Use configured URL or current origin for socket connection to support remote access
	const socketUrl = getSocketUrl(config);

	// Enable cookie-based authentication for browser clients
	const socketOptions = {
		transports: ['websocket', 'polling'],
		withCredentials: true, // Send cookies with requests (session cookie)
		...options
	};

	// If API key provided (programmatic access), include in auth
	if (config.apiKey) {
		socketOptions.auth = { token: config.apiKey };
	}

	const socket = io(socketUrl, socketOptions);

	return new Promise((resolve, reject) => {
		// Wait for connection, then send client:hello
		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			// Send client:hello event for authentication
			// Server will check cookie or auth.token automatically
			socket.emit('client:hello', {}, (response) => {
				if (response?.success) {
					resolve({ socket, authenticated: true });
				} else {
					socket.disconnect();
					resolve({ socket: null, authenticated: false });
				}
			});
		});

		// Handle connection errors
		socket.on('connect_error', (error) => {
			socket.disconnect();
			reject(error);
		});

		// Handle session expiration
		socket.on('session:expired', (data) => {
			console.warn('Session expired:', data.message);
			socket.disconnect();
			// Optionally redirect to login
			if (typeof window !== 'undefined') {
				window.location.href = '/login';
			}
		});
	});
}

/**
 * Test authentication with a specific API key
 * @param {string} key - API key to test
 * @param {Object} config - Configuration object with socketUrl
 * @returns {Promise<boolean>} Promise resolving to authentication result
 */
export async function testAuthKey(key, config = {}) {
	// Use configured URL or current origin for socket connection to support remote access
	const socketUrl = getSocketUrl(config);
	const socket = io(socketUrl, {
		transports: ['websocket', 'polling'],
		withCredentials: true,
		auth: { token: key } // Send API key for testing
	});

	return new Promise((resolve) => {
		// Set a timeout to prevent hanging
		const timeout = setTimeout(() => {
			socket.disconnect();
			resolve(false);
		}, 5000);

		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			// Send client:hello with API key
			socket.emit('client:hello', { apiKey: key }, (response) => {
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
 * Authenticate existing socket connection with API key
 * @param {Object} socket - Socket.IO socket instance
 * @param {string} key - API key
 * @returns {Promise<boolean>} Promise resolving to authentication result
 */
export async function authenticateSocket(socket, key) {
	return new Promise((resolve) => {
		socket.emit('client:hello', { apiKey: key }, (response) => {
			resolve(response?.success === true);
		});
	});
}

/**
 * Check if user is currently authenticated via session cookie
 * @param {Object} _config - Configuration object with socketUrl (unused, relies on cookies)
 * @returns {Promise<boolean>} Promise resolving to authentication status
 */
export async function isAuthenticated(_config = {}) {
	try {
		// Try to access a protected API endpoint
		// If we have a valid session cookie, this will succeed
		const response = await fetch('/api/sessions', {
			method: 'GET',
			credentials: 'include'
		});

		return response.ok;
	} catch (err) {
		console.error('Error checking authentication:', err);
		return false;
	}
}

/**
 * Attempt auto-authentication with API key (for development/testing)
 * Note: This stores the key temporarily for testing, but production should use cookies
 * @param {string} apiKey - API key to test
 * @param {Object} config - Configuration object with socketUrl
 * @returns {Promise<boolean>} Promise resolving to authentication result
 */
export async function tryAutoAuth(apiKey, config = {}) {
	return await testAuthKey(apiKey, config);
}
