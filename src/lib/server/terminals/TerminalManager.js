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
		this.terminals = new Map(); // pty_id -> { term, workspacePath, history, appSessionId }
		this.appSessionMap = new Map(); // appSessionId -> pty_id
		this.nextId = 1;
		// Terminal history is now stored in database instead of files
		// Initialization moved to runtime methods
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
	 * @param {string} [opts.terminalId]
	 * @param {string} [opts.appSessionId]
	 * @param {any} [opts.socket]
	 */
	async startAsync({ workspacePath, shell, env, resume, terminalId, appSessionId, socket }) {
		shell = shell || process.env.SHELL || 'bash';
		env = env || {};
		resume = resume || false;
		terminalId = terminalId || null;
		appSessionId = appSessionId || null;

		const loadedPty = await ensurePtyLoaded();

		const id = terminalId || `pty_${this.nextId++}`;
		logger.info(
			'TERMINAL',
			`Creating terminal ${id} with shell ${shell} in ${workspacePath}${appSessionId ? ` (app session: ${appSessionId})` : ''}`
		);

		const term = loadedPty.spawn(shell, [], {
			name: 'xterm-color',
			cols: 80,
			rows: 24,
			cwd: workspacePath,
			env
		});

		this.terminals.set(id, {
			term,
			workspacePath,
			socket: socket || this.io,
			history: '',
			appSessionId, // Store application session ID for routing
			idleTimer: null // Timer for debouncing idle state
		});

		// Store app session ID mapping for lookup
		if (appSessionId) {
			this.appSessionMap.set(appSessionId, id);
			logger.debug('TERMINAL', `App session mapping: ${appSessionId} -> ${id}. Total mappings: ${this.appSessionMap.size}`);
		}

		logger.info('TERMINAL', `Terminal ${id} created successfully`);
		logger.debug('TERMINAL', `Terminal ${id} socket info:`, {
			hasSocket: !!(socket || this.io),
			socketType: socket ? 'per-session' : 'global',
			socketConnected: socket ? socket.connected : 'N/A'
		});

		term.onData((data) => {
			const terminalData = this.terminals.get(id);

			// Activity state tracking is now handled by UI layer
			// Removed sessionRegistry dependency for streaming state

			// Always emit and buffer, even if socket is null
			const messageData = {
				sessionId: appSessionId || id,
				data,
				timestamp: Date.now()
			};

			// Emit directly to socket
			if (terminalData?.socket) {
				terminalData.socket.emit(SOCKET_EVENTS.TERMINAL_OUTPUT, messageData);
			} else if (this.io) {
				this.io.emit(SOCKET_EVENTS.TERMINAL_OUTPUT, messageData);
			}

			// Save to history
			this.saveTerminalHistory(id, data);
		});

		term.onExit(({ exitCode }) => {
			const terminalData = this.terminals.get(id);

			// Clear any pending idle timer
			if (terminalData && terminalData.idleTimer) {
				clearTimeout(terminalData.idleTimer);
			}

			// Activity state tracking is now handled by UI layer

			// Always emit and buffer, even if socket is null
			const messageData = {
				sessionId: appSessionId || id,
				exitCode,
				timestamp: Date.now()
			};

			// Emit directly to socket
			if (terminalData?.socket) {
				terminalData.socket.emit(SOCKET_EVENTS.TERMINAL_EXIT, messageData);
			} else if (this.io) {
				this.io.emit(SOCKET_EVENTS.TERMINAL_EXIT, messageData);
			}

			// Remove from both maps
			this.terminals.delete(id);
			if (terminalData?.appSessionId) {
				this.appSessionMap.delete(terminalData.appSessionId);
			}
		});

		// Note: History loading is handled by the UI component to avoid duplication
		// The resume flag is used by the UI to determine if it should load history

		logger.info('TERMINAL', `Terminal ${id} created successfully`);
		return { id };
	}

	write(id, data) {
		// Check if id is an app session ID first
		let ptyId = id;
		if (this.appSessionMap.has(id)) {
			ptyId = this.appSessionMap.get(id);
			logger.debug('TERMINAL', `Resolved app session ${id} to PTY ${ptyId}`);
		} else {
			logger.debug('TERMINAL', `Using direct PTY ID: ${id}`);
		}

		const terminal = this.terminals.get(ptyId);
		if (!terminal) {
			logger.error(
				'TERMINAL',
				`Terminal ${id} (pty: ${ptyId}) not found. Available terminals: ${Array.from(this.terminals.keys()).join(', ')}, App sessions: ${Array.from(this.appSessionMap.keys()).join(', ')}`
			);
			return;
		}
		// Activity state tracking is now handled by UI layer
		logger.debug('TERMINAL', `[DEBUG] Writing to terminal ${id}:`, data);
		terminal.term.write(data);
		// Save user input to history too
		this.saveTerminalHistory(id, data);
	}

	resize(id, cols, rows) {
		logger.info('TERMINAL', `Resizing terminal ${id} to ${cols}x${rows}`);

		// Check if id is an app session ID first
		let ptyId = id;
		if (this.appSessionMap.has(id)) {
			ptyId = this.appSessionMap.get(id);
		}

		const terminal = this.terminals.get(ptyId);
		if (terminal) terminal.term.resize(cols, rows);
	}

	stop(id) {
		// Check if id is an app session ID first
		let ptyId = id;
		if (this.appSessionMap.has(id)) {
			ptyId = this.appSessionMap.get(id);
		}

		const terminal = this.terminals.get(ptyId);
		if (terminal) {
			// Clear any pending idle timer
			if (terminal.idleTimer) {
				clearTimeout(terminal.idleTimer);
			}
			// Activity state tracking is now handled by UI layer
			terminal.term.kill();
			// Clean up history when terminal is explicitly stopped
			this.clearTerminalHistory(ptyId);

			// Remove from both maps
			this.terminals.delete(ptyId);
			if (terminal.appSessionId) {
				this.appSessionMap.delete(terminal.appSessionId);
			}
		}
	}

	// List all active terminal sessions
	listSessions() {
		const sessions = [];
		this.terminals.forEach((terminal, id) => {
			sessions.push({
				id: terminal.appSessionId || id,
				typeSpecificId: id,
				workspacePath: terminal.workspacePath,
				title: terminal.title || 'Terminal'
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
		// Check if sessionId is an app session ID first
		let ptyId = sessionId;
		if (this.appSessionMap.has(sessionId)) {
			ptyId = this.appSessionMap.get(sessionId);
		}

		return this.terminals.get(ptyId) || null;
	}
}
