import { spawn } from 'node:child_process';
import { homedir, hostname } from 'node:os';
import { BaseTunnelManager } from './BaseTunnelManager.js';

/**
 * Manages VS Code Remote Tunnel with runtime control.
 */
export class VSCodeTunnelManager extends BaseTunnelManager {
	constructor({ database, configService } = {}) {
		super({
			database,
			logScope: 'VSCODE_TUNNEL',
			settingsCategory: 'vscode-tunnel',
			settingsDescription: 'VS Code Remote Tunnel configuration and state'
		});
		this.process = null;
		this.state = null;
		this.lastError = null;
		this.configService = configService || null;
	}

	/**
	 * Initialize tunnel manager and restore state from database.
	 * @returns {Promise<void>}
	 */
	async init() {
		const settings = await this.loadSettings({ state: null });
		this.state = settings.state || null;

		if (this.state?.pid) {
			try {
				process.kill(this.state.pid, 0);
				this.logInfo(`Restored tunnel state for PID ${this.state.pid}`);
			} catch (error) {
				this.logInfo('Previous tunnel process is dead, cleaning up state', error);
				await this._persistState(null);
			}
		}

		this.logInfo('VS Code Tunnel manager initialized from database');
	}

	/**
	 * Start the VS Code tunnel.
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
			} catch {
				await this._persistState(null);
			}
		}

		const host = process.env.HOSTNAME || hostname();
		const tunnelName = options.name || `dispatch-${host}`;
		const configuredRoot = this.configService?.get('workspacesRoot');
		const workspaceRoot =
			options.folder ||
			configuredRoot ||
			process.env.WORKSPACES_ROOT ||
			process.env.HOME ||
			homedir();
		const extra = options.extra || [];

		const args = [
			'tunnel',
			'--accept-server-license-terms',
			'--name',
			tunnelName,
			'--no-sleep',
			...extra
		];

		this.logInfo(`Starting VS Code tunnel: ${tunnelName} in ${workspaceRoot}`);

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

		this.process.stdout.on('data', (data) => {
			const output = data.toString().trim();
			this.logInfo(`stdout: ${output}`);

			if (output.includes('vscode.dev/tunnel')) {
				this.emit('vscode.tunnel.login-url', { url: output });
			}
		});

		this.process.stderr.on('data', (data) => {
			const output = data.toString().trim();
			this.logError(`stderr: ${output}`);

			if (output.includes('vscode.dev/tunnel')) {
				this.emit('vscode.tunnel.login-url', { url: output });
			}
		});

		this.process.on('exit', async (code, signal) => {
			this.logInfo(`Process exited with code=${code} signal=${signal}`);
			await this._persistState(null);
			this.emit('vscode.tunnel.status', this.getStatus());
		});

		this.process.on('error', async (error) => {
			this.logError(`Process error: ${error.message}`);
			await this._persistState(null);
			this.lastError =
				error.code === 'ENOENT'
					? 'VS Code CLI is not installed. Please install VS Code CLI first.'
					: error.message;
			this.emit('vscode.tunnel.status', this.getStatus());
		});

		setTimeout(async () => {
			if (this.process && !this.process.killed) {
				await this._persistState(state);
				this.state = state;
				this.emit('vscode.tunnel.status', this.getStatus());
			}
		}, 100);

		return state;
	}

	/**
	 * Stop the VS Code tunnel.
	 * @returns {Promise<boolean>} Success status
	 */
	async stopTunnel() {
		let success = false;

		if (this.process && !this.process.killed) {
			try {
				this.process.kill('SIGTERM');
				success = true;
				this.logInfo('Tunnel process terminated');
			} catch (error) {
				this.logError(`Failed to kill process: ${error.message}`);
			}
		}

		if (this.state?.pid && !success) {
			try {
				process.kill(this.state.pid, 'SIGTERM');
				success = true;
				this.logInfo(`Tunnel process ${this.state.pid} terminated`);
			} catch (error) {
				this.logWarn(`Process ${this.state.pid} not found or already dead`, error);
				success = true;
			}
		}

		await this._persistState(null);
		this.emit('vscode.tunnel.status', this.getStatus());

		return success;
	}

	/**
	 * Get tunnel status.
	 * @returns {object} Status information
	 */
	getStatus() {
		const isRunning = Boolean(this.state?.pid && this.process && !this.process.killed);

		return {
			running: isRunning,
			state: this.state,
			error: this.lastError
		};
	}

	async _persistState(state) {
		this.state = state;
		this.process = state ? this.process : null;
		this.lastError = null;

		await this.saveSettings({
			state,
			lastUpdated: Date.now()
		});
	}
}
