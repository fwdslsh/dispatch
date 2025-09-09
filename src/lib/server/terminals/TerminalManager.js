import os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

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
		// Create history directory if it doesn't exist
		this.historyDir = process.env.TERMINAL_HISTORY_DIR || join(os.tmpdir(), 'dispatch-terminal-history');
		this.initHistoryDir();
	}

	async initHistoryDir() {
		try {
			await fs.mkdir(this.historyDir, { recursive: true });
		} catch (error) {
			console.error('Failed to create terminal history directory:', error);
		}
	}

	async saveTerminalHistory(id, data) {
		try {
			const historyFile = join(this.historyDir, `${id}.log`);
			await fs.appendFile(historyFile, data, 'utf8');
		} catch (error) {
			console.error(`Failed to save terminal history for ${id}:`, error);
		}
	}

	async loadTerminalHistory(id) {
		try {
			const historyFile = join(this.historyDir, `${id}.log`);
			const data = await fs.readFile(historyFile, 'utf8');
			return data;
		} catch (error) {
			// File doesn't exist or can't be read, return empty string
			return '';
		}
	}

	async clearTerminalHistory(id) {
		try {
			const historyFile = join(this.historyDir, `${id}.log`);
			await fs.unlink(historyFile);
		} catch (error) {
			// File doesn't exist, ignore error
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
		terminalId = null
	}) {
		if (!pty) {
			console.error('Cannot start terminal: node-pty is not available');
			throw new Error('Terminal functionality not available - node-pty failed to load');
		}

		const id = terminalId || `pty_${this.nextId++}`;
		console.log(`Creating terminal ${id} with shell ${shell} in ${workspacePath}`);

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
			this.terminals.set(id, { term, workspacePath, socket: this.io, history: '' });

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

			// If resuming, load and replay history
			if (resume) {
				this.loadTerminalHistory(id).then((history) => {
					if (history) {
						console.log(`Restoring terminal history for ${id}, size: ${history.length} chars`);
						// Write history to terminal to restore state
						term.write(history);
					}
				});
			}

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
