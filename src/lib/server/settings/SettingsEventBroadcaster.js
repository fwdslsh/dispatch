/**
 * SettingsEventBroadcaster - Real-time settings update notification system
 * Handles broadcasting settings changes to connected clients via Socket.IO
 */

import { SOCKET_EVENTS } from '../../shared/socket-events.js';
import { logger } from '../shared/utils/logger.js';

export class SettingsEventBroadcaster {
	constructor() {
		this.io = null;
	}

	/**
	 * Set the Socket.IO instance for broadcasting
	 * @param {object} socketIO - Socket.IO server instance
	 */
	setSocketIO(socketIO) {
		this.io = socketIO;
		logger.info('SETTINGS_BROADCASTER', 'Socket.IO instance configured');
	}

	/**
	 * Broadcast settings update to all connected clients
	 * @param {string} categoryId - Category that was updated
	 * @param {Object} updatedSettings - Settings that were changed (key-value pairs)
	 * @param {Object} metadata - Additional metadata about the update
	 */
	broadcastSettingsUpdate(categoryId, updatedSettings, metadata = {}) {
		if (!this.io) {
			logger.warn('SETTINGS_BROADCASTER', 'Socket.IO not configured, skipping broadcast');
			return;
		}

		const eventData = {
			categoryId,
			settings: updatedSettings,
			timestamp: new Date().toISOString(),
			...metadata
		};

		// Broadcast to all authenticated clients
		this.io.emit(SOCKET_EVENTS.SETTINGS_CATEGORY_UPDATED, eventData);

		// Also emit generic settings updated event
		this.io.emit(SOCKET_EVENTS.SETTINGS_UPDATED, {
			categories: [categoryId],
			timestamp: eventData.timestamp
		});

		logger.info('SETTINGS_BROADCASTER', `Broadcasted settings update for category: ${categoryId}`, {
			settingsCount: Object.keys(updatedSettings).length,
			metadata
		});
	}

	/**
	 * Broadcast authentication invalidation event
	 * @param {string} reason - Reason for invalidation
	 * @param {Object} affectedSettings - Settings that caused the invalidation
	 */
	broadcastAuthInvalidation(reason, affectedSettings = {}) {
		if (!this.io) {
			logger.warn('SETTINGS_BROADCASTER', 'Socket.IO not configured, skipping auth invalidation broadcast');
			return;
		}

		const eventData = {
			reason,
			affectedSettings,
			timestamp: new Date().toISOString()
		};

		this.io.emit(SOCKET_EVENTS.SETTINGS_AUTH_INVALIDATED, eventData);

		logger.info('SETTINGS_BROADCASTER', `Broadcasted auth invalidation: ${reason}`, eventData);
	}

	/**
	 * Broadcast general settings reload notification
	 * Used when multiple categories or the entire settings system needs to be refreshed
	 */
	broadcastSettingsReload() {
		if (!this.io) {
			logger.warn('SETTINGS_BROADCASTER', 'Socket.IO not configured, skipping reload broadcast');
			return;
		}

		const eventData = {
			type: 'full_reload',
			timestamp: new Date().toISOString()
		};

		this.io.emit(SOCKET_EVENTS.SETTINGS_UPDATED, eventData);

		logger.info('SETTINGS_BROADCASTER', 'Broadcasted settings reload event');
	}

	/**
	 * Check if broadcasting is available
	 * @returns {boolean} Whether Socket.IO is configured and ready
	 */
	isReady() {
		return Boolean(this.io);
	}
}

// Singleton instance for global use
export const settingsEventBroadcaster = new SettingsEventBroadcaster();