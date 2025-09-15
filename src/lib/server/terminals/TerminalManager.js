import { getDatabaseManager } from '../db/DatabaseManager.js';
import { SOCKET_EVENTS } from '../../shared/socket-events.js';
import { logger } from '../utils/logger.js';

let pty;
let ptyLoadAttempted = false;
let ptyLoadError = null;

async function ensurePtyLoaded() {
	if (pty) return pty;

	// In development mode, always allow retry if the previous error was Vite-related
	const isViteError = ptyLoadError?.message?.includes('Vite module runner has been closed');
	if (ptyLoadAttempted && !pty && !isViteError) {
		return null; // Don't retry for non-Vite errors
	}

	ptyLoadAttempted = true;
	try {
		// In development, Vite might be restarting - let's handle this gracefully
		pty = await import('node-pty');
		logger.info('TERMINAL', 'node-pty loaded successfully');
		ptyLoadError = null;
		return pty;
	} catch (err) {
		ptyLoadError = err;
		logger.error('Failed to load node-pty:', err);
		// In development mode, if Vite module runner is closed, allow retry on next call
		if (err.message?.includes('Vite module runner has been closed')) {
			logger.warn('TERMINAL', 'Vite module runner closed - resetting for retry on next attempt');
			// Reset the attempt flag so we can try again immediately on next call
			ptyLoadAttempted = false;
		}
		pty = null;
		return null;
	}
}

// Reset function to allow retrying after Vite restarts
export function resetPtyState() {
	pty = null;
	ptyLoadAttempted = false;
	ptyLoadError = null;
	logger.info('TERMINAL', 'Reset node-pty loading state for retry');
}

export class TerminalManager {
	constructor({ io }) {
		this.io = io;
		this.terminals = new Map(); // id -> { term, workspacePath, history }
		this.nextId = 1;
		// Terminal history is now stored in database instead of files
		// Initialization moved to runtime methods
	}

	async initializePty() {
		if (pty) return; // Already initialized
		try {
			pty = await import('node-pty');
			logger.info('TERMINAL', 'node-pty loaded successfully');
		} catch (err) {
			logger.error('Failed to load node-pty:', err);
			pty = null;
		}
	}

	async initializeDatabase() {
		try {
			await getDatabaseManager().init();
		} catch (error) {
			logger.error('[TERMINAL] Failed to initialize database:', error);
		}
	}

	async saveTerminalHistory(id, data) {
		try {
			await getDatabaseManager().addTerminalHistory(id, data);
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
		if (!loadedPty) {
			logger.error('TERMINAL', 'Cannot start terminal: node-pty is not available');
			// Provide a more helpful error message
			const errorMsg = ptyLoadError?.message?.includes('Vite module runner has been closed')
				? 'Terminal functionality temporarily unavailable - development server restarting'
				: 'Terminal functionality not available - node-pty failed to load';
			throw new Error(errorMsg);
		}

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
			appSessionId // Store application session ID for routing
		});

		logger.info('TERMINAL', `Terminal ${id} created successfully`);
		logger.debug('TERMINAL', `Terminal ${id} socket info:`, {
			hasSocket: !!(socket || this.io),
			socketType: socket ? 'per-session' : 'global',
			socketConnected: socket ? socket.connected : 'N/A'
		});

		term.onData((data) => {
			const terminalData = this.terminals.get(id);
			if (terminalData && terminalData.socket) {
				try {
					logger.debug('TERMINAL', `Emitting output to socket for terminal ${id}`);
					terminalData.socket.emit(SOCKET_EVENTS.TERMINAL_OUTPUT, { sessionId: id, data });
				} catch (e) {
					logger.error('TERMINAL', `Error emitting terminal output:`, e);
				}
				// Save to history
				this.saveTerminalHistory(id, data);
			} else {
				logger.debug('TERMINAL', `No socket available for terminal ${id} - data will be lost`);
			}
		});

		term.onExit(({ exitCode }) => {
			const terminalData = this.terminals.get(id);
			if (terminalData && terminalData.socket) {
				try {
					terminalData.socket.emit(SOCKET_EVENTS.TERMINAL_EXIT, { sessionId: id, exitCode });
				} catch {}
			}
			this.terminals.delete(id);
		});

		// Note: History loading is handled by the UI component to avoid duplication
		// The resume flag is used by the UI to determine if it should load history

		logger.info('TERMINAL', `Terminal ${id} created successfully`);
		return { id };
	}

	write(id, data) {
		const terminal = this.terminals.get(id);
		if (!terminal) {
			logger.error(
				'TERMINAL',
				`Terminal ${id} not found. Available terminals: ${Array.from(this.terminals.keys()).join(', ')}`
			);
			return;
		}
		logger.debug('TERMINAL', `[DEBUG] Writing to terminal ${id}:`, data);
		terminal.term.write(data);
		// Save user input to history too
		this.saveTerminalHistory(id, data);
	}

	resize(id, cols, rows) {
		logger.info('TERMINAL', `Resizing terminal ${id} to ${cols}x${rows}`);
		const terminal = this.terminals.get(id);
		if (terminal) terminal.term.resize(cols, rows);
	}

	stop(id) {
		const terminal = this.terminals.get(id);
		if (terminal) {
			terminal.term.kill();
			// Clean up history when terminal is explicitly stopped
			this.clearTerminalHistory(id);
		}
	}

	async clearTerminalHistory(id) {
		try {
			await getDatabaseManager().clearTerminalHistory(id);
		} catch (error) {
			logger.error(`[TERMINAL] Failed to clear terminal history for ${id}:`, error);
		}
	}
}
