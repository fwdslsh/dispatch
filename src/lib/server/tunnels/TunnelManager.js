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

			let urlResolved = false;

			// Create promise that resolves when URL is received
			const urlPromise = new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					if (!urlResolved) {
						reject(new Error('Timeout waiting for tunnel URL (30s)'));
					}
				}, 30000); // 30 second timeout

				const handleData = async (buf) => {
					if (urlResolved) return; // URL already resolved, ignore additional data

					const line = buf.toString().trim();
					this._logDebug(line);
					const url = this._extractUrl(line);
					if (url) {
						urlResolved = true;
						clearTimeout(timeout);
						this.currentUrl = url;
						await this._saveTunnelSettings();
						this._logInfo(`Public URL: ${url}`);

						// Broadcast status update to all connected clients
						this._broadcastStatus('tunnel.status', this.getStatus());
						resolve(url);
					}
				};

				const handleError = (err) => {
					if (!urlResolved) {
						urlResolved = true;
						clearTimeout(timeout);
						reject(err);
					}
				};

				const handleExit = async (code, signal) => {
					this._logInfo(`Process exited with code=${code} signal=${signal}`);
					await this._cleanup();

					if (!urlResolved) {
						urlResolved = true;
						clearTimeout(timeout);
						if (code !== 0) {
							reject(new Error(`LocalTunnel process exited with code=${code} signal=${signal}`));
						} else {
							// Process exited cleanly but no URL was received
							reject(new Error('LocalTunnel process exited without providing URL'));
						}
					}
				};

				// Register event handlers
				this.process.stdout.on('data', handleData);
				this.process.stderr.on('data', (buf) => {
					this._logError(buf.toString().trim());
				});
				this.process.on('error', handleError);
				this.process.on('exit', handleExit);
			});

			this.isEnabled = true;
			await this._saveTunnelSettings();

			// Wait for URL to be available before returning
			await urlPromise;

			return true;
		} catch (error) {
			this._logError(`Failed to start tunnel: ${error.message}`);
			this.isEnabled = false;
			this.currentUrl = null;
			await this._saveTunnelSettings();

			// Clean up process if it exists
			if (this.process) {
				this._killProcess();
				this.process = null;
			}

			throw error; // Propagate error to caller
		}
	}

	/**
	 * Stop the LocalTunnel
	 * @returns {Promise<boolean>} Success status
	 */
	async stop() {
		if (!this._isProcessRunning()) {
			this._logWarn('Tunnel is not running');
			// Still cleanup state even if process isn't running
			await this._cleanup();
			return false;
		}

		try {
			const processToKill = this.process;
			this._killProcess();

			// Wait for process to actually exit
			if (processToKill && !processToKill.killed) {
				await new Promise((resolve) => {
					const timeout = setTimeout(() => {
						this._logWarn('Process did not exit gracefully, forcing kill');
						try {
							processToKill.kill('SIGKILL');
						} catch (e) {
							// Ignore errors on force kill
						}
						resolve();
					}, 2000); // 2 second timeout

					processToKill.once('exit', () => {
						clearTimeout(timeout);
						resolve();
					});
				});
			}

			await this._cleanup();
			this._logInfo('Tunnel stopped');

			// Broadcast status update to all connected clients
			this._broadcastStatus('tunnel.status', this.getStatus());

			return true;
		} catch (error) {
			this._logError(`Failed to stop tunnel: ${error.message}`);
			await this._cleanup(); // Cleanup state even if stop failed
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
