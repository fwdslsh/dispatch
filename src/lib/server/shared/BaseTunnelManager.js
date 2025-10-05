import { logger } from './utils/logger.js';

/**
 * Base class for tunnel managers that handles shared concerns such as
 * Socket.IO wiring, logging and persisting settings/state in the database.
 */
export class BaseTunnelManager {
	constructor({ database, logScope, settingsCategory, settingsDescription }) {
		this.database = database;
		this.logScope = logScope;
		this.settingsCategory = settingsCategory;
		this.settingsDescription = settingsDescription;
		this.io = null;
	}

	/**
	 * Attach a Socket.IO instance used for broadcasting status updates.
	 * @param {import('socket.io').Server} io
	 */
	setSocketIO(io) {
		this.io = io;
		this.logInfo('Socket.IO instance set for broadcasting');
	}

	/**
	 * Emit a Socket.IO event if the transport is available.
	 * @param {string} event
	 * @param {any} payload
	 */
	emit(event, payload) {
		if (!this.io) return;
		this.io.emit(event, payload);
	}

	/**
	 * Persist settings/state for the tunnel manager.
	 * @param {Record<string, any>} settings
	 */
	async saveSettings(settings) {
		if (!this.database) {
			this.logWarn('No database available for saving settings');
			return;
		}

		try {
			await this.database.settings.setCategory(
				this.settingsCategory,
				settings,
				this.settingsDescription
			);
		} catch (error) {
			this.logError(`Failed to save settings: ${error.message}`);
		}
	}

	/**
	 * Load persisted settings/state for the tunnel manager.
	 * @param {Record<string, any>} [fallback={}]
	 * @returns {Promise<Record<string, any>>}
	 */
	async loadSettings(fallback = {}) {
		if (!this.database) {
			this.logWarn('No database available for loading settings');
			return fallback;
		}

		try {
			const settings = await this.database.settings.getCategorySettings(this.settingsCategory);
			return Object.keys(settings || {}).length ? settings : fallback;
		} catch (error) {
			this.logError(`Failed to load settings: ${error.message}`);
			return fallback;
		}
	}

	/**
	 * Convenience helper to log debug level messages.
	 * @param {string} message
	 * @param {...any} args
	 */
	logDebug(message, ...args) {
		logger.debug(this.logScope, message, ...args);
	}

	/**
	 * Convenience helper to log info level messages.
	 * @param {string} message
	 * @param {...any} args
	 */
	logInfo(message, ...args) {
		logger.info(this.logScope, message, ...args);
	}

	/**
	 * Convenience helper to log warning level messages.
	 * @param {string} message
	 * @param {...any} args
	 */
	logWarn(message, ...args) {
		logger.warn(this.logScope, message, ...args);
	}

	/**
	 * Convenience helper to log error level messages.
	 * @param {string} message
	 * @param {...any} args
	 */
	logError(message, ...args) {
		logger.error(this.logScope, message, ...args);
	}
}
