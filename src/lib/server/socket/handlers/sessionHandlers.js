/**
 * Session Socket Handlers
 * @file Domain handlers for session-related socket events
 * Updated to work with SessionOrchestrator
 */

import { logger } from '../../shared/utils/logger.js';

/**
 * Create session handlers factory
 * @param {SessionOrchestrator} sessionOrchestrator
 * @returns {Object} Handler functions
 */
export function createSessionHandlers(sessionOrchestrator) {
	return {
		/**
		 * Handle session attach event
		 */
		async attach(socket, { runId, afterSeq = 0 }) {
			try {
				// Join room for this session
				socket.join(`run:${runId}`);

				// Attach to session (or resume if stopped)
				const result = await sessionOrchestrator.attachToSession(runId, afterSeq);

				// If not active, try to resume
				if (!result.process && result.session.status === 'stopped') {
					const resumed = await sessionOrchestrator.resumeSession(runId);
					return { success: true, resumed: true, ...resumed };
				}

				return {
					success: true,
					session: result.session,
					events: result.events,
					resumed: false
				};
			} catch (error) {
				logger.error('SOCKET', `Failed to attach to session ${runId}:`, error);
				return { success: false, error: error.message };
			}
		},

		/**
		 * Handle session input event
		 */
		async input(socket, { runId, data }) {
			try {
				await sessionOrchestrator.sendInput(runId, data);
				return { success: true };
			} catch (error) {
				logger.error('SOCKET', `Failed to send input to ${runId}:`, error);
				return { success: false, error: error.message };
			}
		},

		/**
		 * Handle session resize event
		 */
		async resize(socket, { runId, cols, rows }) {
			try {
				const active = sessionOrchestrator.getActiveProcess(runId);
				if (active?.resize) {
					active.resize(cols, rows);
					return { success: true };
				}
				return { success: false, error: 'Resize not supported' };
			} catch (error) {
				logger.error('SOCKET', `Failed to resize ${runId}:`, error);
				return { success: false, error: error.message };
			}
		},

		/**
		 * Handle session close event
		 */
		async close(socket, { runId }) {
			try {
				await sessionOrchestrator.closeSession(runId);
				socket.leave(`run:${runId}`);
				return { success: true };
			} catch (error) {
				logger.error('SOCKET', `Failed to close session ${runId}:`, error);
				return { success: false, error: error.message };
			}
		}
	};
}
