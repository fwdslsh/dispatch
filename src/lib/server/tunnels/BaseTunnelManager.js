import { logger } from '../shared/utils/logger.js';

/**
 * BaseTunnelManager - Abstract base class for tunnel management
 * @file Provides common functionality for tunnel managers
 */
export class BaseTunnelManager {
	/**
	 * @param {Object} options - Tunnel manager options
	 * @param {Object} options.settingsRepository - SettingsRepository instance
	 * @param {string} options.settingsCategory - Settings category name in settings
	 * @param {string} options.logPrefix - Logger prefix for this tunnel type
	 */
	constructor({ settingsRepository, settingsCategory, logPrefix }) {
		if (new.target === BaseTunnelManager) {
			throw new Error('BaseTunnelManager is abstract and cannot be instantiated directly');
		}

		this.settingsRepository = settingsRepository;
		this.settingsCategory = settingsCategory;
		this.logPrefix = logPrefix;
		this.process = null;
		this.io = null; // Socket.IO instance for broadcasting
	}

	/**
	 * Set Socket.IO instance for broadcasting status updates
	 * @param {Object} io - Socket.IO server instance
	 */
	setSocketIO(io) {
		this.io = io;
		logger.info(this.logPrefix, 'Socket.IO instance set for broadcasting');
	}

	/**
	 * Initialize tunnel manager (to be implemented by subclasses)
	 * @abstract
	 * @returns {Promise<void>}
	 */
	async init() {
		throw new Error('init() must be implemented by subclass');
	}

	/**
	 * Get tunnel status (to be implemented by subclasses)
	 * @abstract
	 * @returns {Object} Status information
	 */
	getStatus() {
		throw new Error('getStatus() must be implemented by subclass');
	}

	/**
	 * Load settings from settings repository
	 * @protected
	 * @returns {Promise<Object>} Settings object
	 */
	async _loadSettings() {
		try {
			if (!this.settingsRepository) {
				logger.warn(this.logPrefix, 'No settings repository available for loading settings');
				return {};
			}

			const settings = await this.settingsRepository.getByCategory(this.settingsCategory);
			return settings || {};
		} catch (error) {
			logger.error(this.logPrefix, `Failed to load settings: ${error.message}`);
			return {};
		}
	}

	/**
	 * Save settings to settings repository
	 * @protected
	 * @param {Object} settings - Settings to save
	 * @param {string} [description] - Settings description
	 * @returns {Promise<void>}
	 */
	async _saveSettings(settings, description = null) {
		try {
			if (!this.settingsRepository) {
				logger.warn(this.logPrefix, 'No settings repository available for saving settings');
				return;
			}

			await this.settingsRepository.setByCategory(
				this.settingsCategory,
				settings,
				description
			);
		} catch (error) {
			logger.error(this.logPrefix, `Failed to save settings: ${error.message}`);
		}
	}

	/**
	 * Broadcast status update to all connected clients
	 * @protected
	 * @param {string} event - Event name
	 * @param {Object} data - Event data
	 */
	_broadcastStatus(event, data) {
		if (this.io) {
			this.io.emit(event, data);
		}
	}

	/**
	 * Check if process is running
	 * @protected
	 * @returns {boolean} True if process is running
	 */
	_isProcessRunning() {
		return this.process && !this.process.killed;
	}

	/**
	 * Kill process if running
	 * @protected
	 * @param {string} [signal='SIGTERM'] - Signal to send
	 * @returns {boolean} True if process was killed
	 */
	_killProcess(signal = 'SIGTERM') {
		if (this._isProcessRunning()) {
			try {
				this.process.kill(signal);
				logger.info(this.logPrefix, `Process killed with ${signal}`);
				return true;
			} catch (error) {
				logger.error(this.logPrefix, `Failed to kill process: ${error.message}`);
				return false;
			}
		}
		return false;
	}

	/**
	 * Check if a process with given PID exists
	 * @protected
	 * @param {number} pid - Process ID
	 * @returns {boolean} True if process exists
	 */
	_processExists(pid) {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Log info message
	 * @protected
	 * @param {string} message - Message to log
	 */
	_logInfo(message) {
		logger.info(this.logPrefix, message);
	}

	/**
	 * Log error message
	 * @protected
	 * @param {string} message - Message to log
	 */
	_logError(message) {
		logger.error(this.logPrefix, message);
	}

	/**
	 * Log warning message
	 * @protected
	 * @param {string} message - Message to log
	 */
	_logWarn(message) {
		logger.warn(this.logPrefix, message);
	}

	/**
	 * Log debug message
	 * @protected
	 * @param {string} message - Message to log
	 */
	_logDebug(message) {
		logger.debug(this.logPrefix, message);
	}
}
