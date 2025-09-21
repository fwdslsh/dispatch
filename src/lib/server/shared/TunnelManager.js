import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logger } from './utils/logger.js';

/**
 * Manages LocalTunnel for public URL access with runtime control
 */
export class TunnelManager {
	constructor({ port, subdomain = '', configDir }) {
		this.port = port;
		this.subdomain = subdomain;
		this.configDir = configDir;
		this.tunnelFile = path.join(configDir, 'tunnel-url.txt');
		this.process = null;
		this.isEnabled = false;
		this.currentUrl = null;
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

			this.process.stdout.on('data', (buf) => {
				const line = buf.toString().trim();
				logger.debug('TUNNEL', line);
				const url = this._extractUrl(line);
				if (url) {
					this.currentUrl = url;
					this._writeUrlFile(url);
					logger.info('TUNNEL', `Public URL: ${url}`);
				}
			});

			this.process.stderr.on('data', (buf) => {
				logger.error('TUNNEL', buf.toString().trim());
			});

			this.process.on('exit', (code, signal) => {
				logger.info('TUNNEL', `Process exited with code=${code} signal=${signal}`);
				this._cleanup();
			});

			this.isEnabled = true;
			return true;
		} catch (error) {
			logger.error('TUNNEL', `Failed to start tunnel: ${error.message}`);
			this.isEnabled = false;
			return false;
		}
	}

	/**
	 * Stop the LocalTunnel
	 * @returns {boolean} Success status
	 */
	stop() {
		if (!this.process || this.process.killed) {
			logger.warn('TUNNEL', 'Tunnel is not running');
			return false;
		}

		try {
			this.process.kill();
			this._cleanup();
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
	 * Write URL to file
	 * @private
	 */
	_writeUrlFile(url) {
		try {
			fs.writeFileSync(this.tunnelFile, url + os.EOL);
		} catch (error) {
			logger.error('TUNNEL', `Failed to write URL file: ${error.message}`);
		}
	}

	/**
	 * Cleanup tunnel state
	 * @private
	 */
	_cleanup() {
		this.isEnabled = false;
		this.currentUrl = null;
		this.process = null;
		try {
			fs.unlinkSync(this.tunnelFile);
		} catch {
			// Ignore errors if file doesn't exist
		}
	}
}
