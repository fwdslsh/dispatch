import { spawn } from 'node:child_process';
import { logger } from './utils/logger.js';

/**
 * Manages LocalTunnel for public URL access with runtime control
 * Uses database settings for persistent tunnel configuration
 */
export class TunnelManager {
	constructor({ port, subdomain = '', database }) {
		this.port = port;
		this.subdomain = subdomain;
		this.database = database;
		this.process = null;
		this.isEnabled = false;
		this.currentUrl = null;
		this.io = null; // Socket.IO instance for broadcasting
	}

	/**
	 * Set Socket.IO instance for broadcasting status updates
	 * @param {object} io - Socket.IO server instance
	 */
	setSocketIO(io) {
		this.io = io;
		logger.info('TUNNEL', 'Socket.IO instance set for broadcasting');
	}

	/**
	 * Initialize tunnel manager and restore state from database
	 * @returns {Promise<void>}
	 */
	async init() {
		try {
			const settings = await this._loadTunnelSettings();

			// Restore configuration from database
			if (settings.subdomain !== undefined) {
				this.subdomain = settings.subdomain;
			}
			if (settings.enabled !== undefined) {
				this.isEnabled = settings.enabled;
			}
			// Note: URL is not restored since tunnel process needs to be restarted
			// after server restart

			logger.info('TUNNEL', 'Tunnel manager initialized from database settings');
		} catch (error) {
			logger.error('TUNNEL', `Failed to initialize tunnel manager: ${error.message}`);
		}
	}

	/**
	 * Start the LocalTunnel
	 * @returns {Promise<boolean>} Success status
	 */
	async start() {
		if (this.process && !this.process.killed) {
			logger.warn('TUNNEL', 'Tunnel is already running');
			return false;
		}

		try {
			const args = ['--port', this.port.toString()];
			if (this.subdomain) args.push('--subdomain', this.subdomain);

			logger.info('TUNNEL', `Starting LocalTunnel on port ${this.port}...`);
			this.process = spawn('npx', ['localtunnel', ...args], { stdio: 'pipe' });

			this.process.stdout.on('data', async (buf) => {
				const line = buf.toString().trim();
				logger.debug('TUNNEL', line);
				const url = this._extractUrl(line);
				if (url) {
					this.currentUrl = url;
					await this._saveTunnelSettings();
					logger.info('TUNNEL', `Public URL: ${url}`);

					// Broadcast status update to all connected clients
					if (this.io) {
						this.io.emit('tunnel.status', this.getStatus());
					}
				}
			});

			this.process.stderr.on('data', (buf) => {
				logger.error('TUNNEL', buf.toString().trim());
			});

			this.process.on('exit', async (code, signal) => {
				logger.info('TUNNEL', `Process exited with code=${code} signal=${signal}`);
				await this._cleanup();
			});

			this.isEnabled = true;
			await this._saveTunnelSettings();
			return true;
		} catch (error) {
			logger.error('TUNNEL', `Failed to start tunnel: ${error.message}`);
			this.isEnabled = false;
			await this._saveTunnelSettings();
			return false;
		}
	}

	/**
	 * Stop the LocalTunnel
	 * @returns {Promise<boolean>} Success status
	 */
	async stop() {
		if (!this.process || this.process.killed) {
			logger.warn('TUNNEL', 'Tunnel is not running');
			return false;
		}

		try {
			this.process.kill();
			await this._cleanup();
			logger.info('TUNNEL', 'Tunnel stopped');
			return true;
		} catch (error) {
			logger.error('TUNNEL', `Failed to stop tunnel: ${error.message}`);
			return false;
		}
	}

	/**
	 * Get tunnel status
	 * @returns {object} Status information
	 */
	getStatus() {
		return {
			enabled: this.isEnabled,
			running: this.process && !this.process.killed,
			url: this.currentUrl,
			port: this.port,
			subdomain: this.subdomain
		};
	}

	/**
	 * Update tunnel configuration
	 * @param {object} config - Configuration updates
	 * @returns {Promise<boolean>} Success status
	 */
	async updateConfig(config) {
		try {
			if (config.subdomain !== undefined) {
				this.subdomain = config.subdomain;
				logger.info('TUNNEL', `Subdomain updated to: ${this.subdomain || '(default)'}`);
			}
			if (config.enabled !== undefined) {
				this.isEnabled = config.enabled;
			}
			await this._saveTunnelSettings();
			return true;
		} catch (error) {
			logger.error('TUNNEL', `Failed to update config: ${error.message}`);
			return false;
		}
	}

	/**
	 * Get current public URL
	 * @returns {string|null} Current URL or null if not available
	 */
	getPublicUrl() {
		if (!this.isEnabled || !this.currentUrl) {
			return null;
		}
		return this.currentUrl;
	}

	/**
	 * Extract URL from LocalTunnel output
	 * @private
	 */
	_extractUrl(line) {
		const match = line.match(/your url is:\s*(https?:\/\/[^\s]+)/i);
		return match ? match[1] : null;
	}

	/**
	 * Save tunnel settings to database
	 * @private
	 */
	async _saveTunnelSettings() {
		try {
			if (!this.database) {
				logger.warn('TUNNEL', 'No database available for saving settings');
				return;
			}

			const tunnelSettings = {
				enabled: this.isEnabled,
				subdomain: this.subdomain,
				url: this.currentUrl,
				port: this.port,
				lastUpdated: Date.now()
			};

			await this.database.setSettingsForCategory('tunnel', tunnelSettings, 'LocalTunnel configuration and status');
		} catch (error) {
			logger.error('TUNNEL', `Failed to save tunnel settings: ${error.message}`);
		}
	}

	/**
	 * Load tunnel settings from database
	 * @private
	 */
	async _loadTunnelSettings() {
		try {
			if (!this.database) {
				logger.warn('TUNNEL', 'No database available for loading settings');
				return {};
			}

			return await this.database.getSettingsByCategory('tunnel');
		} catch (error) {
			logger.error('TUNNEL', `Failed to load tunnel settings: ${error.message}`);
			return {};
		}
	}

	/**
	 * Cleanup tunnel state
	 * @private
	 */
	async _cleanup() {
		this.isEnabled = false;
		this.currentUrl = null;
		this.process = null;
		await this._saveTunnelSettings();
	}
}
