import { spawn } from 'node:child_process';
import { logger } from '../shared/utils/logger.js';

/**
 * Manages the OpenCode server process
 * Provides start/stop controls and status monitoring
 */
export class OpenCodeServerManager {
	/**
	 * @param {Object} options
	 * @param {*} options.settingsRepository
	 */
	constructor({ settingsRepository }) {
		this.settingsRepository = settingsRepository;
		this.process = null;
		this.isEnabled = false;
		this.hostname = 'localhost';
		this.port = 4096;
		this.status = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'
		this.errorMessage = null;
	}

	/**
	 * Initialize server manager and restore state from database
	 * @returns {Promise<void>}
	 */
	async init() {
		try {
			const settings = await this._loadSettings();

			// Restore configuration from database
			if (settings.hostname !== undefined) {
				this.hostname = settings.hostname;
			}
			if (settings.port !== undefined) {
				this.port = settings.port;
			}
			if (settings.enabled !== undefined) {
				this.isEnabled = settings.enabled;
			}

			logger.info('OPENCODE_SERVER', 'Server manager initialized from database settings');

			// Auto-start if enabled
			if (this.isEnabled) {
				logger.info('OPENCODE_SERVER', 'Auto-starting OpenCode server...');
				try {
					await this.start();
				} catch (startError) {
					logger.error('OPENCODE_SERVER', `Auto-start failed: ${startError.message}`);
					// Auto-start failure should not crash the app
					// The error state is already set in start() method
				}
			}
		} catch (error) {
			logger.error('OPENCODE_SERVER', `Failed to initialize: ${error.message}`);
		}
	}

	/**
	 * Load settings from database
	 * @returns {Promise<Object>}
	 */
	async _loadSettings() {
		try {
			return await this.settingsRepository.getByCategory('opencode_server');
		} catch (error) {
			logger.warn('OPENCODE_SERVER', `Failed to load settings: ${error.message}`);
			return {};
		}
	}

	/**
	 * Save settings to database
	 * @returns {Promise<void>}
	 */
	async _saveSettings() {
		try {
			await this.settingsRepository.setByCategory(
				'opencode_server',
				{
					hostname: this.hostname,
					port: this.port,
					enabled: this.isEnabled
				},
				'OpenCode server configuration'
			);
		} catch (error) {
			logger.error('OPENCODE_SERVER', `Failed to save settings: ${error.message}`);
		}
	}

	/**
	 * Check if the OpenCode command is available
	 * @returns {Promise<boolean>}
	 */
	async _isOpencodeInstalled() {
		return new Promise((resolve) => {
			const check = spawn('which', ['opencode']);
			check.on('exit', (code) => {
				resolve(code === 0);
			});
			check.on('error', () => {
				resolve(false);
			});
		});
	}

	/**
	 * Start the OpenCode server
	 * @param {Object} [options]
	 * @param {string} [options.hostname]
	 * @param {number} [options.port]
	 * @returns {Promise<boolean>} Success status
	 */
	async start(options = {}) {
		if (this._isProcessRunning()) {
			logger.warn('OPENCODE_SERVER', 'Server is already running');
			return false;
		}

		try {
			// Check if opencode is installed
			const isInstalled = await this._isOpencodeInstalled();
			if (!isInstalled) {
				this.status = 'error';
				this.errorMessage = 'OpenCode CLI not installed. Run: npm install -g opencode-ai@latest';
				logger.error('OPENCODE_SERVER', this.errorMessage);
				return false;
			}

			// Update configuration if provided
			if (options.hostname) this.hostname = options.hostname;
			if (options.port) this.port = options.port;

			const args = [
				'serve',
				'--hostname',
				this.hostname,
				'--port',
				this.port.toString()
			];

			logger.info(
				'OPENCODE_SERVER',
				`Starting OpenCode server on ${this.hostname}:${this.port}...`
			);

			this.status = 'starting';
			this.errorMessage = null;

			// Mark as enabled AFTER we successfully start, not before
			this.process = spawn('opencode', args, {
				stdio: 'pipe',
				env: { ...process.env }
			});

			let serverReady = false;

			// Create promise that resolves when server is ready
			const readyPromise = new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					if (!serverReady) {
						reject(new Error('Timeout waiting for server to start (30s)'));
					}
				}, 30000); // 30 second timeout

				const handleData = (buf) => {
					const line = buf.toString().trim();
					logger.debug('OPENCODE_SERVER', line);

					// Check for error indicators first
					if (line.includes('EADDRINUSE') || line.includes('Failed to start server')) {
						if (!serverReady) {
							serverReady = true;
							clearTimeout(timeout);
							this.status = 'error';
							this.errorMessage = `Failed to start server - port ${this.port} is already in use`;
							reject(new Error(this.errorMessage));
						}
						return;
					}

					// Check for server ready indicators (must be specific to avoid false positives)
					const isReady =
						line.includes('Server listening') ||
						(line.includes('listening') && line.includes(`${this.port}`)) ||
						(line.includes('started') && line.includes('server'));

					if (isReady && !serverReady) {
						// Wait a bit to ensure process doesn't exit immediately
						setTimeout(() => {
							if (this.process && this.process.exitCode === null && !serverReady) {
								serverReady = true;
								clearTimeout(timeout);
								this.status = 'running';
								logger.info('OPENCODE_SERVER', `Server ready at http://${this.hostname}:${this.port}`);
								resolve(true);
							}
						}, 500);
					}
				};

				const handleError = (err) => {
					if (!serverReady) {
						serverReady = true;
						clearTimeout(timeout);
						this.status = 'error';
						this.errorMessage = err.message;
						reject(err);
					}
				};

				const handleExit = async (code, signal) => {
					logger.info('OPENCODE_SERVER', `Process exited with code=${code} signal=${signal}`);
					this.status = 'stopped';
					this.process = null;

					if (!serverReady) {
						serverReady = true;
						clearTimeout(timeout);
						this.status = 'error';

						// Check if it's a port conflict error
						if (code === 1) {
							this.errorMessage = `Failed to start server - port ${this.port} may already be in use`;
						} else {
							this.errorMessage = `Server exited with code=${code}`;
						}

						if (code !== 0) {
							reject(new Error(this.errorMessage));
						} else {
							reject(new Error('Server process exited without starting'));
						}
					}
				};

				// Register event handlers
				this.process.stdout.on('data', handleData);
				this.process.stderr.on('data', (buf) => {
					const line = buf.toString().trim();
					logger.error('OPENCODE_SERVER', line);
					// Some servers log ready message to stderr
					handleData(buf);
				});
				this.process.on('error', handleError);
				this.process.on('exit', handleExit);
			});

			// Wait for server to be ready before marking as enabled
			await readyPromise;

			// Only mark as enabled after successful start
			this.isEnabled = true;
			await this._saveSettings();

			return true;
		} catch (error) {
			logger.error('OPENCODE_SERVER', `Failed to start server: ${error.message}`);
			this.status = 'error';
			this.errorMessage = error.message;
			this.isEnabled = false;
			await this._saveSettings();

			// Clean up process if it exists
			if (this.process) {
				this._killProcess();
				this.process = null;
			}

			throw error;
		}
	}

	/**
	 * Stop the OpenCode server
	 * @returns {Promise<boolean>} Success status
	 */
	async stop() {
		if (!this._isProcessRunning()) {
			logger.warn('OPENCODE_SERVER', 'Server is not running');
			return false;
		}

		try {
			logger.info('OPENCODE_SERVER', 'Stopping OpenCode server...');
			this._killProcess();
			this.process = null;
			this.status = 'stopped';
			this.isEnabled = false;
			this.errorMessage = null;
			await this._saveSettings();
			logger.info('OPENCODE_SERVER', 'Server stopped successfully');
			return true;
		} catch (error) {
			logger.error('OPENCODE_SERVER', `Failed to stop server: ${error.message}`);
			throw error;
		}
	}

	/**
	 * Restart the OpenCode server
	 * @returns {Promise<boolean>} Success status
	 */
	async restart() {
		logger.info('OPENCODE_SERVER', 'Restarting OpenCode server...');
		await this.stop();
		// Wait a bit before restarting
		await new Promise((resolve) => setTimeout(resolve, 1000));
		return await this.start();
	}

	/**
	 * Check if the server process is running
	 * @returns {boolean}
	 */
	_isProcessRunning() {
		return this.process !== null && this.process.exitCode === null;
	}

	/**
	 * Kill the server process
	 */
	_killProcess() {
		if (this.process) {
			try {
				this.process.kill('SIGTERM');
				// Force kill after 5 seconds if not terminated
				setTimeout(() => {
					if (this.process && this.process.exitCode === null) {
						logger.warn('OPENCODE_SERVER', 'Force killing server process');
						this.process.kill('SIGKILL');
					}
				}, 5000);
			} catch (error) {
				logger.error('OPENCODE_SERVER', `Error killing process: ${error.message}`);
			}
		}
	}

	/**
	 * Get current server status
	 * @returns {Object}
	 */
	getStatus() {
		return {
			enabled: this.isEnabled,
			running: this._isProcessRunning(),
			status: this.status,
			hostname: this.hostname,
			port: this.port,
			url: this._isProcessRunning() ? `http://${this.hostname}:${this.port}` : null,
			error: this.errorMessage
		};
	}

	/**
	 * Update server configuration
	 * @param {Object} config
	 * @param {string} [config.hostname]
	 * @param {number} [config.port]
	 * @param {boolean} [config.enabled]
	 * @returns {Promise<void>}
	 */
	async updateConfig(config) {
		const wasRunning = this._isProcessRunning();

		// Update configuration
		if (config.hostname !== undefined) this.hostname = config.hostname;
		if (config.port !== undefined) this.port = config.port;
		if (config.enabled !== undefined) this.isEnabled = config.enabled;

		// Clear error state when updating config
		if (this.status === 'error') {
			this.status = 'stopped';
			this.errorMessage = null;
		}

		await this._saveSettings();

		// Only restart if server was actually running (not in error state)
		if (wasRunning && this.status === 'running') {
			logger.info('OPENCODE_SERVER', 'Configuration changed, restarting server...');
			await this.restart();
		}
	}

	/**
	 * Cleanup on shutdown
	 * @returns {Promise<void>}
	 */
	async cleanup() {
		if (this._isProcessRunning()) {
			logger.info('OPENCODE_SERVER', 'Cleaning up server on shutdown...');
			await this.stop();
		}
	}
}
