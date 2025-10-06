/**
 * Session Socket Handlers
 * @file Domain handlers for session-related socket events
 */

/**
 * Create session handlers with service dependencies
 * @param {Object} services - Service dependencies
 * @param {SessionOrchestrator} services.sessionOrchestrator - Session orchestrator
 * @returns {Object} Handler functions
 */
export function createSessionHandlers(services) {
	const { sessionOrchestrator } = services;

	return {
		/**
		 * Handle session attach event
		 * @param {Object} socket - Socket.IO socket
		 * @param {Object} data - Event data
		 * @param {string} data.sessionId - Session ID to attach to
		 * @param {number} [data.fromSeq=0] - Starting sequence number
		 * @param {Function} callback - Acknowledgment callback
		 */
		async attach(socket, data, callback) {
			try {
				const { sessionId, fromSeq = 0 } = data;

				const result = await sessionOrchestrator.attachToSession(sessionId, fromSeq);

				callback({
					success: true,
					session: result.session,
					events: result.events
				});
			} catch (err) {
				callback({
					success: false,
					error: err.message
				});
			}
		},

		/**
		 * Handle session input event
		 * @param {Object} socket - Socket.IO socket
		 * @param {Object} data - Event data
		 * @param {string} data.sessionId - Session ID
		 * @param {string} data.input - Input data
		 */
		async input(socket, data) {
			try {
				const { sessionId, input } = data;
				await sessionOrchestrator.sendInput(sessionId, input);
			} catch (err) {
				console.error('Error sending input:', err);
				socket.emit('error', { message: err.message });
			}
		},

		/**
		 * Handle session close event
		 * @param {Object} socket - Socket.IO socket
		 * @param {Object} data - Event data
		 * @param {string} data.sessionId - Session ID
		 * @param {Function} [callback] - Optional acknowledgment callback
		 */
		async close(socket, data, callback) {
			try {
				const { sessionId } = data;
				await sessionOrchestrator.closeSession(sessionId);

				if (callback) {
					callback({ success: true });
				}
			} catch (err) {
				if (callback) {
					callback({
						success: false,
						error: err.message
					});
				}
			}
		}
	};
}
