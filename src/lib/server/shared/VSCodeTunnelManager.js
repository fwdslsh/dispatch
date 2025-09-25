import { spawn } from 'node:child_process';
import { homedir, hostname } from 'node:os';
import { logger } from './utils/logger.js';

/**
 * Manages VS Code Remote Tunnel with runtime control
 * Uses database settings for persistent tunnel configuration
 */
export class VSCodeTunnelManager {
	constructor({ database }) {
		this.database = database;
		this.process = null;
		this.state = null;
		this.io = null; // Socket.IO instance for broadcasting
		this.lastError = null; // Store last error for status reporting
	}

	/**
	 * Set Socket.IO instance for broadcasting status updates
	 * @param {object} io - Socket.IO server instance
	 */
	setSocketIO(io) {
		this.io = io;
		logger.info('VSCODE_TUNNEL', 'Socket.IO instance set for broadcasting');
	}

	/**
	 * Initialize tunnel manager and restore state from database
	 * @returns {Promise<void>}
	 */
	async init() {
		try {
			await this._loadState();
			// Check if process is still alive
			if (this.state?.pid) {
				try {
					process.kill(this.state.pid, 0); // Check if process exists
					logger.info('VSCODE_TUNNEL', `Restored tunnel state for PID ${this.state.pid}`);
				} catch (error) {
					// Process is dead, clean up state
					logger.info('VSCODE_TUNNEL', 'Previous tunnel process is dead, cleaning up state');
					await this._clearState();
				}
			}
			logger.info('VSCODE_TUNNEL', 'VS Code Tunnel manager initialized from database');
		} catch (error) {
			logger.error('VSCODE_TUNNEL', `Failed to initialize tunnel manager: ${error.message}`);
		}
	}

	/**
	 * Start the VS Code tunnel
	 * @param {object} options - Tunnel options
	 * @returns {Promise<object>} Tunnel state
	 */
	async startTunnel(options = {}) {
		if (this.process && !this.process.killed) {
			throw new Error('Tunnel is already running');
		}

		if (this.state?.pid) {
			try {
				process.kill(this.state.pid, 0);
				throw new Error('Tunnel process is already running');
			} catch (killError) {
				// Process is dead, continue with start
				await this._clearState();
			}
		}

		const host = process.env.HOSTNAME || hostname();
		const tunnelName = options.name || `dispatch-${host}`;
		const workspaceRoot = process.env.WORKSPACES_ROOT || process.env.HOME || homedir();
		const extra = options.extra || [];

		const args = [
			'tunnel',
			'--accept-server-license-terms',
			'--name',
			tunnelName,
			'--no-sleep',
			...extra
		];

		logger.info('VSCODE_TUNNEL', `Starting VS Code tunnel: ${tunnelName} in ${workspaceRoot}`);

		try {
			this.process = spawn('code', args, {
				cwd: workspaceRoot,
				stdio: 'pipe',
				env: { ...process.env }
			});
		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new Error('VS Code CLI is not installed. Please install VS Code CLI first.');
			}
			throw error;
		}

		const openUrl = `https://vscode.dev/tunnel/${encodeURIComponent(tunnelName)}${encodeURIComponent(workspaceRoot)}`;
		
		const state = {
			pid: this.process.pid,
			name: tunnelName,
			folder: workspaceRoot,
			args,
			startedAt: new Date().toISOString(),
			openUrl
		};

		// Handle process output
		this.process.stdout.on('data', (data) => {
			const output = data.toString().trim();
			logger.info('VSCODE_TUNNEL', `stdout: ${output}`);
			
			// Broadcast device login URL if found
			if (output.includes('vscode.dev/tunnel') && this.io) {
				this.io.emit('vscode.tunnel.login-url', { url: output });
			}
		});

		this.process.stderr.on('data', (data) => {
			const output = data.toString().trim();
			logger.error('VSCODE_TUNNEL', `stderr: ${output}`);
			
			// Also check stderr for login URLs
			if (output.includes('vscode.dev/tunnel') && this.io) {
				this.io.emit('vscode.tunnel.login-url', { url: output });
			}
		});

		this.process.on('exit', async (code, signal) => {
			logger.info('VSCODE_TUNNEL', `Process exited with code=${code} signal=${signal}`);
			await this._clearState();
			
			// Broadcast status update
			if (this.io) {
				this.io.emit('vscode.tunnel.status', this.getStatus());
			}
		});

		this.process.on('error', async (error) => {
			logger.error('VSCODE_TUNNEL', `Process error: ${error.message}`);
			await this._clearState();
			
			// Store the error for later retrieval
			this.lastError = error.code === 'ENOENT' 
				? 'VS Code CLI is not installed. Please install VS Code CLI first.'
				: error.message;
			
			// Broadcast status update
			if (this.io) {
				this.io.emit('vscode.tunnel.status', this.getStatus());
			}
		});

		// Save state only after process is successfully started
		// Wait a bit to ensure the process doesn't immediately fail
		setTimeout(async () => {
			if (this.process && !this.process.killed) {
				await this._saveState(state);
				this.state = state;

				// Broadcast status update
				if (this.io) {
					this.io.emit('vscode.tunnel.status', this.getStatus());
				}
			}
		}, 100);

		return state;
	}

	/**
	 * Stop the VS Code tunnel
	 * @returns {Promise<boolean>} Success status
	 */
	async stopTunnel() {
		let success = false;

		// Try to kill running process
		if (this.process && !this.process.killed) {
			try {
				this.process.kill('SIGTERM');
				success = true;
				logger.info('VSCODE_TUNNEL', 'Tunnel process terminated');
			} catch (error) {
				logger.error('VSCODE_TUNNEL', `Failed to kill process: ${error.message}`);
			}
		}

		// Try to kill by PID from state
		if (this.state?.pid && !success) {
			try {
				process.kill(this.state.pid, 'SIGTERM');
				success = true;
				logger.info('VSCODE_TUNNEL', `Tunnel process ${this.state.pid} terminated`);
			} catch (error) {
				logger.warn('VSCODE_TUNNEL', `Process ${this.state.pid} not found or already dead`);
				success = true; // Consider it success if process is already dead
			}
		}

		await this._clearState();

		// Broadcast status update
		if (this.io) {
			this.io.emit('vscode.tunnel.status', this.getStatus());
		}

		return success;
	}

	/**
	 * Get tunnel status
	 * @returns {object} Status information
	 */
	getStatus() {
		const isRunning = this.state?.pid && (this.process && !this.process.killed);
		
		return {
			running: isRunning,
			state: this.state,
			error: this.lastError
		};
	}

	/**
	 * Load tunnel state from database
	 * @private
	 */
	async _loadState() {
		try {
			if (!this.database) {
				logger.warn('VSCODE_TUNNEL', 'No database available for loading state');
				return;
			}

			const settings = await this.database.getSettingsByCategory('vscode-tunnel');
			this.state = settings.state || null;
		} catch (error) {
			logger.error('VSCODE_TUNNEL', `Failed to load tunnel state: ${error.message}`);
			this.state = null;
		}
	}

	/**
	 * Save tunnel state to database
	 * @private
	 */
	async _saveState(state) {
		try {
			if (!this.database) {
				logger.warn('VSCODE_TUNNEL', 'No database available for saving state');
				return;
			}

			const tunnelSettings = {
				state: state,
				lastUpdated: Date.now()
			};

			await this.database.setSettingsForCategory(
				'vscode-tunnel',
				tunnelSettings,
				'VS Code Remote Tunnel configuration and state'
			);
		} catch (error) {
			logger.error('VSCODE_TUNNEL', `Failed to save tunnel state: ${error.message}`);
		}
	}

	/**
	 * Clear tunnel state
	 * @private
	 */
	async _clearState() {
		this.state = null;
		this.process = null;
		this.lastError = null;
		
		try {
			if (!this.database) {
				logger.warn('VSCODE_TUNNEL', 'No database available for clearing state');
				return;
			}

			await this.database.setSettingsForCategory(
				'vscode-tunnel',
				{ state: null, lastUpdated: Date.now() },
				'VS Code Remote Tunnel configuration and state'
			);
		} catch (error) {
			logger.error('VSCODE_TUNNEL', `Failed to clear tunnel state: ${error.message}`);
		}
	}
}