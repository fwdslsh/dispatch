/**
 * Authentication Socket Handlers
 * @file Domain handlers for authentication-related socket events
 */

/**
 * Create auth handlers with service dependencies
 * @param {Object} services - Service dependencies
 * @param {JWTService} services.jwtService - JWT service
 * @returns {Object} Handler functions
 */
export function createAuthHandlers(services) {
	const { jwtService } = services;

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
		},

		/**
		 * Handle token validation event
		 * @param {Object} socket - Socket.IO socket
		 * @param {Object} data - Event data
		 * @param {string} data.token - JWT token to validate
		 * @param {Function} callback - Acknowledgment callback
		 */
		async validateToken(socket, data, callback) {
			try {
				const { token } = data;
				const claims = jwtService.validateToken(token);

				callback({
					success: true,
					claims
				});
			} catch (err) {
				callback({
					success: false,
					error: err.message
				});
			}
		},

		/**
		 * Handle token refresh event
		 * @param {Object} socket - Socket.IO socket
		 * @param {Object} data - Event data
		 * @param {string} data.token - JWT token to refresh
		 * @param {Function} callback - Acknowledgment callback
		 */
		async refreshToken(socket, data, callback) {
			try {
				const { token } = data;
				const newToken = jwtService.refreshToken(token);

				callback({
					success: true,
					token: newToken
				});
			} catch (err) {
				callback({
					success: false,
					error: err.message
				});
			}
		}
	};
}
