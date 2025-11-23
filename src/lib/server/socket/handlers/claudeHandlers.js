/**
 * Claude Authentication Socket Handlers
 * @file Domain handlers for Claude Code authentication socket events
 */

import { logger } from '../../shared/utils/logger.js';
import { SOCKET_EVENTS } from '../../../shared/socket-events.js';

/**
 * Create Claude authentication handlers factory
 * @param {object} claudeAuthManager - Claude authentication manager service
 * @returns {object} Handler functions
 */
export function createClaudeHandlers(claudeAuthManager) {
	return {
		/**
		 * Handle Claude auth start event
		 * Initiates Claude OAuth flow using ClaudeAuthManager
		 *
		 * @param {object} socket - Socket.IO socket
		 * @param {object} data - Event data
		 * @param {Function} callback - Acknowledgment callback
		 */
		async authStart(socket, data, callback) {
			try {
				// Start Claude OAuth flow using ClaudeAuthManager
				const success = await claudeAuthManager.start(socket);

				logger.info('SOCKET', `Claude auth start result: ${success}`);

				if (callback) {
					// Return consistent error field for client
					const errorMsg = success
						? null
						: 'Failed to start Claude authentication. Please ensure the Claude CLI is installed.';

					callback({
						success,
						error: errorMsg,
						message: success ? 'OAuth flow started' : errorMsg
					});

					if (!success) {
						logger.warn('SOCKET', `Returned error to client: ${errorMsg}`);
					}
				}
			} catch (error) {
				logger.error('SOCKET', 'Error starting Claude auth:', error);
				if (callback) {
					callback({
						success: false,
						error: error.message
					});
				}
			}
		},

		/**
		 * Handle Claude auth code submission event
		 * Submits authorization code to Claude OAuth flow
		 *
		 * @param {object} socket - Socket.IO socket
		 * @param {object} data - Event data
		 * @param {string} data.code - Authorization code from OAuth flow
		 * @param {Function} callback - Acknowledgment callback
		 */
		async authCode(socket, data, callback) {
			try {
				const { code } = data || {};

				if (!code) {
					logger.warn('SOCKET', `Claude auth code missing from socket ${socket.id}`);
					if (callback) {
						callback({
							success: false,
							error: 'Authorization code required'
						});
					}
					return;
				}

				// Submit authorization code to Claude OAuth flow
				const success = claudeAuthManager.submitCode(socket, code);

				if (callback) {
					callback({
						success,
						message: success ? 'Code submitted' : 'Failed to submit code'
					});
				}
			} catch (error) {
				logger.error('SOCKET', 'Error submitting Claude auth code:', error);
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

/**
 * Claude event names mapping
 * Maps handler names to Socket.IO event names
 */
export const CLAUDE_EVENTS = {
	AUTH_START: SOCKET_EVENTS.CLAUDE_AUTH_START,
	AUTH_CODE: SOCKET_EVENTS.CLAUDE_AUTH_CODE
};
