import { SOCKET_EVENTS } from '../../shared/socket-events.js';
import { logger } from '../utils/logger.js';

let pty = null;

async function ensurePtyLoaded() {
	if (pty) return pty;

	try {
		pty = await import('node-pty');
		logger.info('TERMINAL', 'node-pty loaded successfully');
		return pty;
	} catch (err) {
		logger.error('TERMINAL', 'Failed to load node-pty:', err);
		throw new Error(`Terminal functionality not available: ${err.message}`);
	}
}

export class TerminalManager {
	constructor({ io, databaseManager }) {
		this.io = io;
		this.databaseManager = databaseManager;
		this.instanceId = Math.random().toString(36).substr(2, 9);
		this.terminals = new Map(); // sessionId -> { term } - local processes only
		// Terminal history is now stored in database instead of files
		// Initialization moved to runtime methods
		logger.warn('TERMINAL', `[INSTANCE-${this.instanceId}] TerminalManager created`);
	}

	// Set Socket.IO instance for real-time communication
	setSocketIO(io) {
		this.io = io;
	}

	async saveTerminalHistory(id, data) {
		try {
			await this.databaseManager.addTerminalHistory(id, data);
		} catch (error) {
			logger.error(`[TERMINAL] Failed to save terminal history for ${id}:`, error);
		}
	}

	// Start a terminal session (returns a Promise)
	start(opts) {
		return this.startAsync(opts);
	}

	// Async method to actually start the terminal
	/**
	 * @param {object} opts
	 * @param {string} opts.workspacePath
	 * @param {string} [opts.shell]
	 * @param {object} [opts.env]
	 * @param {boolean} [opts.resume]
	 * @param {string} opts.appSessionId - Required app session ID (primary identifier)
	 */
	async startAsync({ workspacePath, shell, env, resume, appSessionId }) {
		if (!appSessionId) {
			throw new Error('appSessionId is required for terminal creation');
		}

		shell = shell || process.env.SHELL || 'bash';
		env = env || {};
		resume = resume || false;

		const loadedPty = await ensurePtyLoaded();

		logger.info('TERMINAL', `[INSTANCE-${this.instanceId}] Creating terminal ${appSessionId} with shell ${shell} in ${workspacePath}`);

		const term = loadedPty.spawn(shell, [], {
			name: 'xterm-color',
			cols: 80,
			rows: 24,
			cwd: workspacePath,
			env
		});

		this.terminals.set(appSessionId, { term });

		logger.info('TERMINAL', `[INSTANCE-${this.instanceId}] Terminal ${appSessionId} created successfully, local terminals: ${this.terminals.size}`);

		term.onData((data) => {
			// Emit data via global Socket.IO
			this.io?.emit(SOCKET_EVENTS.TERMINAL_OUTPUT, {
				sessionId: appSessionId,
				data,
				timestamp: Date.now()
			});

			// Save to history
			this.saveTerminalHistory(appSessionId, data);
		});

		term.onExit(({ exitCode }) => {
			// Emit exit via global Socket.IO
			this.io?.emit(SOCKET_EVENTS.TERMINAL_EXIT, {
				sessionId: appSessionId,
				exitCode,
				timestamp: Date.now()
			});

			// Remove terminal from local map
			this.terminals.delete(appSessionId);
		});

		// Note: History loading is handled by the UI component to avoid duplication
		// The resume flag is used by the UI to determine if it should load history

		return { id: appSessionId };
	}

	write(sessionId, data) {
		const terminal = this.terminals.get(sessionId);
		if (!terminal) {
			logger.warn('TERMINAL', `[INSTANCE-${this.instanceId}] Terminal ${sessionId} not found in this process. Available: ${Array.from(this.terminals.keys()).join(', ')}`);
			return;
		}

		logger.debug('TERMINAL', `[INSTANCE-${this.instanceId}] Writing to terminal ${sessionId}:`, data);
		terminal.term.write(data);
		// Save user input to history too
		this.saveTerminalHistory(sessionId, data);
	}

	resize(sessionId, cols, rows) {
		logger.info('TERMINAL', `Resizing terminal ${sessionId} to ${cols}x${rows}`);
		const terminal = this.terminals.get(sessionId);
		if (terminal) {
			terminal.term.resize(cols, rows);
		} else {
			logger.warn('TERMINAL', `[INSTANCE-${this.instanceId}] Terminal ${sessionId} not found in this process for resize`);
		}
	}

	stop(sessionId) {
		const terminal = this.terminals.get(sessionId);
		if (terminal) {
			terminal.term.kill();
			// Clean up history when terminal is explicitly stopped
			this.clearTerminalHistory(sessionId);
			// Remove terminal from local map
			this.terminals.delete(sessionId);
			logger.info('TERMINAL', `[INSTANCE-${this.instanceId}] Terminal session ${sessionId} stopped`);
		} else {
			logger.warn('TERMINAL', `[INSTANCE-${this.instanceId}] Terminal ${sessionId} not found in this process for stop`);
		}
	}

	// List all active terminal sessions
	listSessions() {
		const sessions = [];
		this.terminals.forEach((terminal, sessionId) => {
			sessions.push({
				id: sessionId,
				typeSpecificId: sessionId,
				title: 'Terminal'
			});
		});
		return sessions;
	}

	async loadTerminalHistory(id) {
		try {
			const history = await this.databaseManager.getTerminalHistory(id);
			// getTerminalHistory already returns a concatenated string
			return history || '';
		} catch (error) {
			logger.error(`[TERMINAL] Failed to load terminal history for ${id}:`, error);
			return '';
		}
	}

	async clearTerminalHistory(id) {
		try {
			await this.databaseManager.clearTerminalHistory(id);
		} catch (error) {
			logger.error(`[TERMINAL] Failed to clear terminal history for ${id}:`, error);
		}
	}

	getTerminal(sessionId) {
		return this.terminals.get(sessionId) || null;
	}
}
