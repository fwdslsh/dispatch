/**
 * VS Code Tunnel Socket Handlers
 * @file Domain handlers for VS Code tunnel management socket events
 */

import { logger } from '../../shared/utils/logger.js';

/**
 * Create VS Code tunnel handlers factory
 * @param {object} vscodeManager - VS Code tunnel manager service
 * @returns {object} Handler functions
 */
export function createVSCodeHandlers(vscodeManager) {
	return {
		/**
		 * Handle VS Code tunnel start event
		 * @param {object} socket - Socket.IO socket
		 * @param {object} data - Event data
		 * @param {Function} callback - Acknowledgment callback
		 */
		async start(socket, data, callback) {
			try {
				await vscodeManager.start();
				const status = vscodeManager.getStatus();

				if (callback) {
					callback({
						success: true,
						url: status.url,
						status: status
					});
				}
			} catch (error) {
				logger.error('SOCKET', 'Error starting VS Code tunnel:', error);
				if (callback) {
					callback({
						success: false,
						error: error.message
					});
				}
			}
		},

		/**
		 * Handle VS Code tunnel stop event
		 * @param {object} socket - Socket.IO socket
		 * @param {object} data - Event data
		 * @param {Function} callback - Acknowledgment callback
		 */
		async stop(socket, data, callback) {
			try {
				await vscodeManager.stop();
				const status = vscodeManager.getStatus();

				if (callback) {
					callback({
						success: true,
						status
					});
				}
			} catch (error) {
				logger.error('SOCKET', 'Error stopping VS Code tunnel:', error);
				if (callback) {
					callback({
						success: false,
						error: error.message
					});
				}
			}
		},

		/**
		 * Handle VS Code tunnel status event
		 * @param {object} socket - Socket.IO socket
		 * @param {object} data - Event data
		 * @param {Function} callback - Acknowledgment callback
		 */
		async status(socket, data, callback) {
			try {
				const status = vscodeManager.getStatus();

				if (callback) {
					callback({
						success: true,
						status
					});
				}
			} catch (error) {
				logger.error('SOCKET', 'Error getting VS Code tunnel status:', error);
				if (callback) {
					callback({
						success: false,
						error: error.message
					});
				}
			}
		}
	};
}
