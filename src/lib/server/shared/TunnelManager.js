import { spawn } from 'node:child_process';
import { BaseTunnelManager } from './BaseTunnelManager.js';

/**
 * Manages LocalTunnel for public URL access with runtime control.
 */
export class TunnelManager extends BaseTunnelManager {
	constructor({ port, subdomain = '', database }) {
		super({
			database,
			logScope: 'TUNNEL',
			settingsCategory: 'tunnel',
			settingsDescription: 'LocalTunnel configuration and status'
		});
		this.port = port;
		this.subdomain = subdomain;
		this.process = null;
		this.isEnabled = false;
		this.currentUrl = null;
	}

	/**
	 * Initialize tunnel manager and restore state from database.
	 * @returns {Promise<void>}
	 */
	async init() {
		const settings = await this.loadSettings();

		if (settings.subdomain !== undefined) {
			this.subdomain = settings.subdomain;
		}
		if (settings.enabled !== undefined) {
			this.isEnabled = settings.enabled;
		}

		this.logInfo('Tunnel manager initialized from database settings');
	}

	/**
	 * Start the LocalTunnel.
	 * @returns {Promise<boolean>} Success status
	 */
	async start() {
		if (this.process && !this.process.killed) {
			this.logWarn('Tunnel is already running');
			return false;
		}

		try {
			const args = ['--port', this.port.toString()];
			if (this.subdomain) args.push('--subdomain', this.subdomain);

			this.logInfo(`Starting LocalTunnel on port ${this.port}...`);
			this.process = spawn('npx', ['localtunnel', ...args], { stdio: 'pipe' });

			this.process.stdout.on('data', async (buf) => {
				const line = buf.toString().trim();
				this.logDebug(line);
				const url = this._extractUrl(line);
				if (url) {
					this.currentUrl = url;
					await this._persistState();
					this.logInfo(`Public URL: ${url}`);

					this.emit('tunnel.status', this.getStatus());
				}
			});

			this.process.stderr.on('data', (buf) => {
				this.logError(buf.toString().trim());
			});

			this.process.on('exit', async (code, signal) => {
				this.logInfo(`Process exited with code=${code} signal=${signal}`);
				await this._cleanup();
			});

			this.isEnabled = true;
			await this._persistState();
			this.emit('tunnel.status', this.getStatus());
			return true;
		} catch (error) {
			this.logError(`Failed to start tunnel: ${error.message}`);
			this.isEnabled = false;
			await this._persistState();
			return false;
		}
	}

	/**
	 * Stop the LocalTunnel.
	 * @returns {Promise<boolean>} Success status
	 */
	async stop() {
		if (!this.process || this.process.killed) {
			this.logWarn('Tunnel is not running');
			return false;
		}

		try {
			this.process.kill();
			await this._cleanup();
			this.logInfo('Tunnel stopped');
			return true;
		} catch (error) {
			this.logError(`Failed to stop tunnel: ${error.message}`);
			return false;
		}
	}

	/**
	 * Get tunnel status.
	 * @returns {object} Status information
	 */
	getStatus() {
		return {
			enabled: this.isEnabled,
			running: Boolean(this.process && !this.process.killed),
			url: this.currentUrl,
			port: this.port,
			subdomain: this.subdomain
		};
	}

	/**
	 * Update tunnel configuration.
	 * @param {object} config - Configuration updates
	 * @returns {Promise<boolean>} Success status
	 */
	async updateConfig(config) {
		try {
			if (config.subdomain !== undefined) {
				this.subdomain = config.subdomain;
				this.logInfo(`Subdomain updated to: ${this.subdomain || '(default)'}`);
			}
			if (config.enabled !== undefined) {
				this.isEnabled = config.enabled;
			}
			await this._persistState();
			this.emit('tunnel.status', this.getStatus());
			return true;
		} catch (error) {
			this.logError(`Failed to update config: ${error.message}`);
			return false;
		}
	}

	/**
	 * Get current public URL.
	 * @returns {string|null}
	 */
	getPublicUrl() {
		if (!this.isEnabled || !this.currentUrl) {
			return null;
		}
		return this.currentUrl;
	}

	_extractUrl(line) {
		const match = line.match(/your url is:\s*(https?:\/\/[^\s]+)/i);
		return match ? match[1] : null;
	}

	async _persistState() {
		await this.saveSettings({
			enabled: this.isEnabled,
			subdomain: this.subdomain,
			url: this.currentUrl,
			port: this.port,
			lastUpdated: Date.now()
		});
	}

	async _cleanup() {
		this.isEnabled = false;
		this.currentUrl = null;
		this.process = null;
		await this._persistState();
		this.emit('tunnel.status', this.getStatus());
	}
}
