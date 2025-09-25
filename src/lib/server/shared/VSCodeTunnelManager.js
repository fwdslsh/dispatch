import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { resolve } from 'node:path';
import { homedir, hostname } from 'node:os';
import { logger } from './utils/logger.js';

/**
 * Manages VS Code Remote Tunnel with runtime control
 * Uses filesystem state file for persistent tunnel configuration
 */
export class VSCodeTunnelManager {
	constructor({ folder, database }) {
		this.folder = folder || process.env.HOME || homedir();
		this.database = database;
		this.process = null;
		this.state = null;
		this.io = null; // Socket.IO instance for broadcasting
		this.stateFilePath = resolve(this.folder, '.dispatch', 'vscode-tunnel-state.json');
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
	 * Initialize tunnel manager and restore state from filesystem
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
			logger.info('VSCODE_TUNNEL', 'VS Code Tunnel manager initialized');
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
		const cwd = options.folder || this.folder;
		const extra = options.extra || [];

		const args = [
			'tunnel',
			'--accept-server-license-terms',
			'--name',
			tunnelName,
			'--no-sleep',
			...extra
		];

		logger.info('VSCODE_TUNNEL', `Starting VS Code tunnel: ${tunnelName} in ${cwd}`);

		this.process = spawn('code', args, {
			cwd,
			stdio: 'pipe',
			env: { ...process.env }
		});

		const openUrl = `https://vscode.dev/tunnel/${encodeURIComponent(tunnelName)}${encodeURIComponent(cwd)}`;
		
		const state = {
			pid: this.process.pid,
			name: tunnelName,
			folder: cwd,
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
		});

		// Save state
		await this._saveState(state);
		this.state = state;

		// Broadcast status update
		if (this.io) {
			this.io.emit('vscode.tunnel.status', this.getStatus());
		}

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
			state: this.state
		};
	}

	/**
	 * Load tunnel state from filesystem
	 * @private
	 */
	async _loadState() {
		try {
			const stateData = await fs.readFile(this.stateFilePath, 'utf-8');
			this.state = JSON.parse(stateData);
		} catch (error) {
			// State file doesn't exist or is invalid
			this.state = null;
		}
	}

	/**
	 * Save tunnel state to filesystem
	 * @private
	 */
	async _saveState(state) {
		try {
			// Ensure directory exists
			await fs.mkdir(resolve(this.stateFilePath, '..'), { recursive: true });
			await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2));
		} catch (error) {
			logger.error('VSCODE_TUNNEL', `Failed to save state: ${error.message}`);
		}
	}

	/**
	 * Clear tunnel state
	 * @private
	 */
	async _clearState() {
		this.state = null;
		this.process = null;
		
		try {
			await fs.unlink(this.stateFilePath);
		} catch (error) {
			// File doesn't exist, ignore
		}
	}
}