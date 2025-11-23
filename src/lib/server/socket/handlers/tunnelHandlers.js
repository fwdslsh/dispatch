/**
 * Tunnel Socket Handlers
 * @file Domain handlers for LocalTunnel management socket events
 */

import { logger } from '../../shared/utils/logger.js';

/**
 * Create tunnel handlers factory
 * @param {object} tunnelManager - Tunnel manager service
 * @returns {object} Handler functions
 */
export function createTunnelHandlers(tunnelManager) {
	return {
		/**
		 * Handle tunnel start event
		 * @param {object} socket - Socket.IO socket
		 * @param {object} data - Event data
		 * @param {Function} callback - Acknowledgment callback
		 */
		async start(socket, data, callback) {
			try {
				await tunnelManager.start();
				const status = tunnelManager.getStatus();

				if (callback) {
					callback({
						success: true,
						url: status.url,
						status: status
					});
				}
			} catch (error) {
				logger.error('SOCKET', 'Error starting tunnel:', error);
				if (callback) {
					callback({
						success: false,
						error: error.message
					});
				}
			}
		},

		/**
		 * Handle tunnel stop event
		 * @param {object} socket - Socket.IO socket
		 * @param {object} data - Event data
		 * @param {Function} callback - Acknowledgment callback
		 */
		async stop(socket, data, callback) {
			try {
				await tunnelManager.stop();
				const status = tunnelManager.getStatus();

				if (callback) {
					callback({
						success: true,
						status
					});
				}
			} catch (error) {
				logger.error('SOCKET', 'Error stopping tunnel:', error);
				if (callback) {
					callback({
						success: false,
						error: error.message
					});
				}
			}
		},

		/**
		 * Handle tunnel status event
		 * @param {object} socket - Socket.IO socket
		 * @param {object} data - Event data
		 * @param {Function} callback - Acknowledgment callback
		 */
		async status(socket, data, callback) {
			try {
				const status = tunnelManager.getStatus();

				if (callback) {
					callback({
						success: true,
						status
					});
				}
			} catch (error) {
				logger.error('SOCKET', 'Error getting tunnel status:', error);
				if (callback) {
					callback({
						success: false,
						error: error.message
					});
				}
			}
		},

		/**
		 * Handle tunnel config update event
		 * @param {object} socket - Socket.IO socket
		 * @param {object} data - Event data
		 * @param {string} data.subdomain - Subdomain to use for tunnel
		 * @param {Function} callback - Acknowledgment callback
		 */
		async updateConfig(socket, data, callback) {
			try {
				const { subdomain } = data || {};

				// Update configuration
				const success = await tunnelManager.updateConfig({ subdomain });

				if (success) {
					const status = tunnelManager.getStatus();

					if (callback) {
						callback({
							success: true,
							status
						});
					}

					// Broadcast status update to all connected clients
					tunnelManager._broadcastStatus('tunnel:status', status);
				} else {
					if (callback) {
						callback({
							success: false,
							error: 'Failed to update configuration'
						});
					}
				}
			} catch (error) {
				logger.error('SOCKET', 'Error updating tunnel config:', error);
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
