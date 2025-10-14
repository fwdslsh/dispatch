/**
 * Authentication Socket Handlers
 * @file Domain handlers for authentication-related socket events
 *
 * NOTE: JWT-based token validation has been removed.
 * Authentication now uses cookie-based sessions via SessionManager.
 * See src/lib/server/shared/socket-setup.js for cookie authentication middleware.
 */

/**
 * Create auth handlers with service dependencies
 * @param {Object} _services - Service dependencies (unused, kept for consistency)
 * @returns {Object} Handler functions
 */
export function createAuthHandlers(_services) {
	return {
		/**
		 * Handle client hello event
		 * @param {Object} socket - Socket.IO socket
		 * @param {Object} data - Event data
		 * @param {string} data.clientId - Client identifier
		 * @param {Function} callback - Acknowledgment callback
		 */
		async hello(socket, data, callback) {
			const { clientId } = data;

			// Store client ID on socket
			socket.clientId = clientId;

			callback({
				success: true,
				message: 'Connected',
				clientId
			});
		}

		// JWT-based validateToken and refreshToken handlers removed
		// Authentication now handled via cookie-based sessions in socket-setup.js
	};
}
