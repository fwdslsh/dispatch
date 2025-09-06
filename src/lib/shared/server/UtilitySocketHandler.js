/**
 * Utility Socket Handler
 *
 * Handles miscellaneous utility socket events that don't fit into specific domains.
 * Provides clean separation of utility functions from other handlers.
 */

import fs from 'fs';

/**
 * Create utility socket handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 * @param {Function} requireAuth - Authentication check function
 * @returns {Object} Utility handler functions
 */
export function createUtilitySocketHandlers(io, socket, requireAuth) {
	/**
	 * Get public URL from LocalTunnel if available
	 */
	const getPublicUrlHandler = (callback) => {
		try {
			console.log(`[UTILITY] Getting public URL for socket ${socket.id}`);

			// Read tunnel URL from file if it exists
			const tunnelUrlPath = '/tmp/tunnel-url.txt';

			if (fs.existsSync(tunnelUrlPath)) {
				const publicUrl = fs.readFileSync(tunnelUrlPath, 'utf8').trim();
				console.log(`[UTILITY] Found public URL: ${publicUrl}`);

				if (callback) {
					callback({ success: true, url: publicUrl });
				}
			} else {
				console.log('[UTILITY] No public URL found (tunnel not active)');

				if (callback) {
					callback({
						success: false,
						error:
							'No public tunnel active. Start the server with tunnel enabled to get a public URL.'
					});
				}
			}
		} catch (error) {
			console.error('[UTILITY] Error getting public URL:', error);
			if (callback) {
				callback({ success: false, error: error.message });
			}
		}
	};

	/**
	 * Ping handler for connection health checks
	 */
	const pingHandler = (data, callback) => {
		const timestamp = new Date().toISOString();
		console.log(`[UTILITY] Ping from socket ${socket.id} at ${timestamp}`);

		if (callback) {
			callback({
				success: true,
				timestamp,
				socketId: socket.id,
				data
			});
		}
	};

	/**
	 * Get server status and configuration
	 */
	const getServerStatusHandler = (callback) => {
		try {
			const status = {
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
				memory: process.memoryUsage(),
				version: process.version,
				platform: process.platform,
				environment: process.env.NODE_ENV || 'development',
				features: {
					tunnelEnabled: process.env.ENABLE_TUNNEL === 'true',
					authRequired: (process.env.TERMINAL_KEY || 'change-me').length >= 8,
					containerMode: process.env.CONTAINER_ENV === 'true'
				}
			};

			console.log(`[UTILITY] Server status requested by socket ${socket.id}`);

			if (callback) {
				callback({ success: true, status });
			}
		} catch (error) {
			console.error('[UTILITY] Error getting server status:', error);
			if (callback) {
				callback({ success: false, error: error.message });
			}
		}
	};

	/**
	 * Get socket connection info
	 */
	const getConnectionInfoHandler = (callback) => {
		try {
			const connectionInfo = {
				socketId: socket.id,
				remoteAddress: socket.handshake.address,
				userAgent: socket.handshake.headers['user-agent'],
				connectedAt: socket.handshake.time,
				authenticated: requireAuth(),
				namespace: socket.nsp.name
			};

			console.log(`[UTILITY] Connection info requested by socket ${socket.id}`);

			if (callback) {
				callback({ success: true, connectionInfo });
			}
		} catch (error) {
			console.error('[UTILITY] Error getting connection info:', error);
			if (callback) {
				callback({ success: false, error: error.message });
			}
		}
	};

	return {
		// Public URL utilities
		'get-public-url': getPublicUrlHandler,
		getPublicUrl: getPublicUrlHandler, // Alias for consistency

		// Connection utilities
		ping: pingHandler,
		'get-server-status': getServerStatusHandler,
		getServerStatus: getServerStatusHandler, // Alias for consistency
		'get-connection-info': getConnectionInfoHandler,
		getConnectionInfo: getConnectionInfoHandler // Alias for consistency
	};
}

/**
 * Register utility socket handlers with optional authentication
 * @param {Object} socket - Socket instance
 * @param {Object} handlers - Utility handlers object
 * @param {Function} requireAuth - Authentication check function
 */
export function registerUtilityHandlers(socket, handlers, requireAuth) {
	// Some utility handlers require auth, others don't
	const protectedEvents = [
		'get-public-url',
		'getPublicUrl',
		'get-server-status',
		'getServerStatus'
	];
	const publicEvents = ['ping', 'get-connection-info', 'getConnectionInfo'];

	for (const [eventName, handler] of Object.entries(handlers)) {
		if (protectedEvents.includes(eventName)) {
			// Protected handlers require authentication
			socket.on(eventName, (...args) => {
				if (!requireAuth()) {
					const callback = args.find((arg) => typeof arg === 'function');
					if (callback) {
						callback({ success: false, error: 'Authentication required' });
					}
					return;
				}
				handler(...args);
			});
		} else if (publicEvents.includes(eventName)) {
			// Public handlers don't require authentication
			socket.on(eventName, handler);
		} else {
			// Default to protected
			socket.on(eventName, (...args) => {
				if (!requireAuth()) {
					const callback = args.find((arg) => typeof arg === 'function');
					if (callback) {
						callback({ success: false, error: 'Authentication required' });
					}
					return;
				}
				handler(...args);
			});
		}
	}
}

/**
 * Utility handler factory for easy integration
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 * @param {Function} requireAuth - Authentication check function
 * @returns {Object} Configured and registered utility handlers
 */
export function createAndRegisterUtilityHandlers(io, socket, requireAuth) {
	const handlers = createUtilitySocketHandlers(io, socket, requireAuth);
	registerUtilityHandlers(socket, handlers, requireAuth);

	console.log(
		`[UTILITY] Registered ${Object.keys(handlers).length} utility handlers for socket ${socket.id}`
	);

	return handlers;
}
