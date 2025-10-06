import { spawn } from 'node:child_process';
import { BaseTunnelManager } from './BaseTunnelManager.js';

/**
 * Manages LocalTunnel for public URL access with runtime control
 * Uses database settings for persistent tunnel configuration
 */
export class TunnelManager extends BaseTunnelManager {
	/**
	 * @param {Object} options
	 * @param {number} options.port
	 * @param {string} [options.subdomain]
	 * @param {*} [options.database]
	 * @param {*} [options.settingsRepository]
	 */
	constructor({ port, subdomain = '', database, settingsRepository }) {
		super({
			settingsRepository: settingsRepository || database,
			settingsCategory: 'tunnel',
			logPrefix: 'TUNNEL'
		});

		this.port = port;
		this.subdomain = subdomain;
		this.isEnabled = false;
		this.currentUrl = null;
	}

	/**
	 * Initialize tunnel manager and restore state from database
	 * @returns {Promise<void>}
	 */
	async init() {
		try {
			const settings = await this._loadSettings();

			// Restore configuration from database
			if (settings.subdomain !== undefined) {
				this.subdomain = settings.subdomain;
			}
			if (settings.enabled !== undefined) {
				this.isEnabled = settings.enabled;
			}
			// Note: URL is not restored since tunnel process needs to be restarted
			// after server restart

			this._logInfo('Tunnel manager initialized from database settings');
		} catch (error) {
			this._logError(`Failed to initialize tunnel manager: ${error.message}`);
		}
	}

	/**
	 * Start the LocalTunnel
	 * @returns {Promise<boolean>} Success status
	 */
	async start() {
		if (this._isProcessRunning()) {
			this._logWarn('Tunnel is already running');
			return false;
		}

		try {
			const args = ['--port', this.port.toString()];
			if (this.subdomain) args.push('--subdomain', this.subdomain);

			this._logInfo(`Starting LocalTunnel on port ${this.port}...`);
			this.process = spawn('npx', ['localtunnel', ...args], { stdio: 'pipe' });

			this.process.stdout.on('data', async (buf) => {
				const line = buf.toString().trim();
				this._logDebug(line);
				const url = this._extractUrl(line);
				if (url) {
					this.currentUrl = url;
					await this._saveTunnelSettings();
					this._logInfo(`Public URL: ${url}`);

					// Broadcast status update to all connected clients
					this._broadcastStatus('tunnel.status', this.getStatus());
				}
			});

			this.process.stderr.on('data', (buf) => {
				this._logError(buf.toString().trim());
			});

			this.process.on('exit', async (code, signal) => {
				this._logInfo(`Process exited with code=${code} signal=${signal}`);
				await this._cleanup();
			});

			this.isEnabled = true;
			await this._saveTunnelSettings();
			return true;
		} catch (error) {
			this._logError(`Failed to start tunnel: ${error.message}`);
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
		if (!this._isProcessRunning()) {
			this._logWarn('Tunnel is not running');
			return false;
		}

		try {
			this._killProcess();
			await this._cleanup();
			this._logInfo('Tunnel stopped');
			return true;
		} catch (error) {
			this._logError(`Failed to stop tunnel: ${error.message}`);
			return false;
		}
	}

	/**
	 * Get tunnel status
	 * @returns {Object} Status information
	 */
	getStatus() {
		return {
			enabled: this.isEnabled,
			running: this._isProcessRunning(),
			url: this.currentUrl,
			port: this.port,
			subdomain: this.subdomain
		};
	}

	/**
	 * Update tunnel configuration
	 * @param {Object} config - Configuration updates
	 * @returns {Promise<boolean>} Success status
	 */
	async updateConfig(config) {
		try {
			if (config.subdomain !== undefined) {
				this.subdomain = config.subdomain;
				this._logInfo(`Subdomain updated to: ${this.subdomain || '(default)'}`);
			}
			if (config.enabled !== undefined) {
				this.isEnabled = config.enabled;
			}
			await this._saveTunnelSettings();
			return true;
		} catch (error) {
			this._logError(`Failed to update config: ${error.message}`);
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
		const tunnelSettings = {
			enabled: this.isEnabled,
			subdomain: this.subdomain,
			url: this.currentUrl,
			port: this.port,
			lastUpdated: Date.now()
		};

		await this._saveSettings(tunnelSettings, 'LocalTunnel configuration and status');
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
