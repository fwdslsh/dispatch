import { spawn } from 'node:child_process';
import { homedir, hostname } from 'node:os';
import { BaseTunnelManager } from './BaseTunnelManager.js';

/**
 * Manages VS Code Remote Tunnel with runtime control
 * Uses database settings for persistent tunnel configuration
 */
export class VSCodeTunnelManager extends BaseTunnelManager {
	constructor({ database, settingsRepository }) {
		super({
			settingsRepository: settingsRepository || database,
			settingsCategory: 'vscode-tunnel',
			logPrefix: 'VSCODE_TUNNEL'
		});

		this.state = null;
		this.lastError = null; // Store last error for status reporting
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
				if (this._processExists(this.state.pid)) {
					this._logInfo(`Restored tunnel state for PID ${this.state.pid}`);
				} else {
					// Process is dead, clean up state
					this._logInfo('Previous tunnel process is dead, cleaning up state');
					await this._clearState();
				}
			}
			this._logInfo('VS Code Tunnel manager initialized from database');
		} catch (error) {
			this._logError(`Failed to initialize tunnel manager: ${error.message}`);
		}
	}

	/**
	 * Start the VS Code tunnel
	 * @param {Object} options - Tunnel options
	 * @returns {Promise<Object>} Tunnel state
	 */
	async startTunnel(options = {}) {
		if (this._isProcessRunning()) {
			throw new Error('Tunnel is already running');
		}

		if (this.state?.pid) {
			if (this._processExists(this.state.pid)) {
				throw new Error('Tunnel process is already running');
			} else {
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

		this._logInfo(`Starting VS Code tunnel: ${tunnelName} in ${workspaceRoot}`);

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
			this._logInfo(`stdout: ${output}`);

			// Broadcast device login URL if found
			if (output.includes('vscode.dev/tunnel')) {
				this._broadcastStatus('vscode.tunnel.login-url', { url: output });
			}
		});

		this.process.stderr.on('data', (data) => {
			const output = data.toString().trim();
			this._logError(`stderr: ${output}`);

			// Also check stderr for login URLs
			if (output.includes('vscode.dev/tunnel')) {
				this._broadcastStatus('vscode.tunnel.login-url', { url: output });
			}
		});

		this.process.on('exit', async (code, signal) => {
			this._logInfo(`Process exited with code=${code} signal=${signal}`);
			await this._clearState();

			// Broadcast status update
			this._broadcastStatus('vscode.tunnel.status', this.getStatus());
		});

		this.process.on('error', async (error) => {
			this._logError(`Process error: ${error.message}`);
			await this._clearState();

			// Store the error for later retrieval
			this.lastError =
				error.code === 'ENOENT'
					? 'VS Code CLI is not installed. Please install VS Code CLI first.'
					: error.message;

			// Broadcast status update
			this._broadcastStatus('vscode.tunnel.status', this.getStatus());
		});

		// Save state only after process is successfully started
		// Wait a bit to ensure the process doesn't immediately fail
		setTimeout(async () => {
			if (this._isProcessRunning()) {
				await this._saveState(state);
				this.state = state;

				// Broadcast status update
				this._broadcastStatus('vscode.tunnel.status', this.getStatus());
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
		if (this._killProcess('SIGTERM')) {
			success = true;
			this._logInfo('Tunnel process terminated');
		}

		// Try to kill by PID from state
		if (this.state?.pid && !success) {
			try {
				process.kill(this.state.pid, 'SIGTERM');
				success = true;
				this._logInfo(`Tunnel process ${this.state.pid} terminated`);
			} catch (error) {
				this._logWarn(`Process ${this.state.pid} not found or already dead`);
				success = true; // Consider it success if process is already dead
			}
		}

		await this._clearState();

		// Broadcast status update
		this._broadcastStatus('vscode.tunnel.status', this.getStatus());

		return success;
	}

	/**
	 * Get tunnel status
	 * @returns {Object} Status information
	 */
	getStatus() {
		const isRunning = this.state?.pid && this._isProcessRunning();

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
		const settings = await this._loadSettings();
		this.state = settings.state || null;
	}

	/**
	 * Save tunnel state to database
	 * @private
	 */
	async _saveState(state) {
		const tunnelSettings = {
			state: state,
			lastUpdated: Date.now()
		};

		await this._saveSettings(
			tunnelSettings,
			'VS Code Remote Tunnel configuration and state'
		);
	}

	/**
	 * Clear tunnel state
	 * @private
	 */
	async _clearState() {
		this.state = null;
		this.process = null;
		this.lastError = null;

		await this._saveSettings(
			{ state: null, lastUpdated: Date.now() },
			'VS Code Remote Tunnel configuration and state'
		);
	}
}
