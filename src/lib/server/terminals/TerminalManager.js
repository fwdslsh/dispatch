import os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { databaseManager } from '../db/DatabaseManager.js';

let pty;
try {
	pty = await import('node-pty');
	console.log('node-pty loaded successfully');
} catch (err) {
	console.error('Failed to load node-pty:', err);
	pty = null;
}

export class TerminalManager {
	constructor({ io }) {
		this.io = io;
		this.terminals = new Map(); // id -> { term, workspacePath, history }
		this.nextId = 1;
		// Terminal history is now stored in database instead of files
		this.initializeDatabase();
	}

	async initializeDatabase() {
		try {
			await databaseManager.init();
		} catch (error) {
			console.error('[TERMINAL] Failed to initialize database:', error);
		}
	}

	async saveTerminalHistory(id, data) {
		try {
			await databaseManager.addTerminalHistory(id, data);
		} catch (error) {
			console.error(`[TERMINAL] Failed to save terminal history for ${id}:`, error);
		}
	}

	async loadTerminalHistory(id) {
		try {
			return await databaseManager.getTerminalHistory(id);
		} catch (error) {
			console.error(`[TERMINAL] Failed to load terminal history for ${id}:`, error);
			return '';
		}
	}

	async clearTerminalHistory(id) {
		try {
			await databaseManager.clearTerminalHistory(id);
		} catch (error) {
			console.error(`[TERMINAL] Failed to clear terminal history for ${id}:`, error);
		}
	}

	setSocketIO(io) {
		this.io = io;
		// Update socket reference for all existing terminals
		for (const [id, terminalData] of this.terminals) {
			terminalData.socket = io;
		}
	}

	start({
		workspacePath,
		shell = os.platform() === 'win32' ? 'powershell.exe' : process.env.SHELL || 'bash',
		env = {},
		resume = false,
		terminalId = null,
		appSessionId = null
	}) {
		if (!pty) {
			console.error('Cannot start terminal: node-pty is not available');
			throw new Error('Terminal functionality not available - node-pty failed to load');
		}

		const id = terminalId || `pty_${this.nextId++}`;
		console.log(
			`Creating terminal ${id} with shell ${shell} in ${workspacePath}${appSessionId ? ` (app session: ${appSessionId})` : ''}`
		);

		try {
			const term = pty.spawn(shell, [], {
				name: 'xterm-color',
				cwd: workspacePath,
				env: {
					...process.env,
					...env,
					TERM: 'xterm-256color',
					PS1: '\\u@\\h:\\w$ '
				}
			});
			this.terminals.set(id, {
				term,
				workspacePath,
				socket: this.io,
				history: '',
				appSessionId // Store application session ID for routing
			});

			term.onData((data) => {
				const terminalData = this.terminals.get(id);
				if (terminalData && terminalData.socket) {
					terminalData.socket.emit('data', data);
					// Save to history
					this.saveTerminalHistory(id, data);
				}
			});

			term.onExit(({ exitCode }) => {
				const terminalData = this.terminals.get(id);
				if (terminalData && terminalData.socket) {
					terminalData.socket.emit('exit', { exitCode });
				}
				this.terminals.delete(id);
			});

			// Note: History loading is handled by the UI component to avoid duplication
			// The resume flag is used by the UI to determine if it should load history

			console.log(`Terminal ${id} created successfully`);
			return { id };
		} catch (err) {
			console.error(`Failed to create terminal ${id}:`, err);
			throw err;
		}
	}

	write(id, data) {
		const terminal = this.terminals.get(id);
		if (!terminal) {
			console.error(
				`Terminal ${id} not found. Available terminals:`,
				Array.from(this.terminals.keys())
			);
			return;
		}
		terminal.term.write(data);
		// Save user input to history too
		this.saveTerminalHistory(id, data);
	}

	resize(id, cols, rows) {
		console.log(`Resizing terminal ${id} to ${cols}x${rows}`);
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
}
