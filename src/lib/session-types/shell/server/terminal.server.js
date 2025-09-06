/**
 * Terminal Server - PTY session management for shell sessions
 *
 * Handles terminal session lifecycle, process spawning, and I/O management.
 * Simplified implementation for shell-based terminal sessions.
 */

import { spawn } from 'node-pty';
import { randomUUID } from 'crypto';
import path from 'path';
import os from 'os';

/**
 * Terminal session manager for shell PTY sessions
 */
export class TerminalManager {
	constructor() {
		this.sessions = new Map();
		this.sockets = new Map();
	}

	/**
	 * Create a new terminal session within a project
	 * @param {string} projectId - Project identifier
	 * @param {Object} options - Session options
	 * @returns {Promise<Object>} Session data
	 */
	async createSessionInProject(projectId, options = {}) {
		const sessionId = randomUUID();
		const {
			cols = 80,
			rows = 24,
			shell = process.env.SHELL || '/bin/bash',
			workingDirectory = process.cwd(),
			env = {}
		} = options;

		// Prepare environment
		const sessionEnv = {
			...process.env,
			...env,
			TERM: 'xterm-256color',
			COLORTERM: 'truecolor'
		};

		try {
			// Spawn PTY process
			const ptyProcess = spawn(shell, [], {
				name: 'xterm-color',
				cols,
				rows,
				cwd: workingDirectory,
				env: sessionEnv
			});

			const session = {
				id: sessionId,
				projectId,
				pid: ptyProcess.pid,
				ptyProcess,
				shell,
				workingDirectory,
				created: new Date(),
				active: true,
				cols,
				rows
			};

			// Set up PTY event handlers
			ptyProcess.onData((data) => {
				this.handleOutput(sessionId, data);
			});

			ptyProcess.onExit((exitCode, signal) => {
				this.handleExit(sessionId, exitCode, signal);
			});

			this.sessions.set(sessionId, session);

			console.log(`Created terminal session ${sessionId} for project ${projectId}`);

			return {
				id: sessionId,
				pid: ptyProcess.pid,
				shell,
				workingDirectory
			};
		} catch (error) {
			console.error('Failed to create terminal session:', error);
			throw new Error(`Failed to spawn terminal process: ${error.message}`);
		}
	}

	/**
	 * Attach a socket to an existing session
	 * @param {Object} socket - Socket.IO socket
	 * @param {Object} options - Attach options
	 * @returns {Promise<boolean>} Success status
	 */
	async attachToSession(socket, options) {
		const { sessionId } = options;
		const session = this.sessions.get(sessionId);

		if (!session || !session.active) {
			return false;
		}

		// Store socket association
		this.sockets.set(socket.id, { sessionId, socket });

		// Handle socket disconnect
		socket.on('disconnect', () => {
			this.detachSocket(socket);
		});

		console.log(`Socket ${socket.id} attached to session ${sessionId}`);
		return true;
	}

	/**
	 * Send input to a terminal session
	 * @param {string} sessionId - Session identifier
	 * @param {string} data - Input data
	 */
	sendInput(sessionId, data) {
		const session = this.sessions.get(sessionId);
		if (session && session.active) {
			session.ptyProcess.write(data);
		}
	}

	/**
	 * Resize terminal session
	 * @param {string} sessionId - Session identifier
	 * @param {number} cols - Columns
	 * @param {number} rows - Rows
	 */
	resize(sessionId, cols, rows) {
		const session = this.sessions.get(sessionId);
		if (session && session.active) {
			session.ptyProcess.resize(cols, rows);
			session.cols = cols;
			session.rows = rows;
			console.log(`Resized session ${sessionId} to ${cols}x${rows}`);
		}
	}

	/**
	 * End a terminal session
	 * @param {string} sessionId - Session identifier
	 */
	async endSession(sessionId) {
		const session = this.sessions.get(sessionId);
		if (!session) {
			return;
		}

		try {
			if (session.active && session.ptyProcess) {
				session.ptyProcess.kill();
			}
			session.active = false;

			// Remove socket associations
			for (const [socketId, socketData] of this.sockets.entries()) {
				if (socketData.sessionId === sessionId) {
					this.sockets.delete(socketId);
				}
			}

			console.log(`Ended terminal session ${sessionId}`);
		} catch (error) {
			console.error(`Error ending session ${sessionId}:`, error);
		}
	}

	/**
	 * List all active sessions
	 * @returns {Array} Session list
	 */
	listSessions() {
		const sessions = [];
		for (const session of this.sessions.values()) {
			sessions.push({
				id: session.id,
				projectId: session.projectId,
				pid: session.pid,
				shell: session.shell,
				workingDirectory: session.workingDirectory,
				created: session.created,
				active: session.active,
				cols: session.cols,
				rows: session.rows
			});
		}
		return sessions;
	}

	/**
	 * Handle terminal output
	 * @private
	 * @param {string} sessionId - Session identifier
	 * @param {string} data - Output data
	 */
	handleOutput(sessionId, data) {
		// Send output to all sockets attached to this session
		for (const socketData of this.sockets.values()) {
			if (socketData.sessionId === sessionId) {
				socketData.socket.emit('terminal-output', data);
			}
		}
	}

	/**
	 * Handle terminal process exit
	 * @private
	 * @param {string} sessionId - Session identifier
	 * @param {number} exitCode - Exit code
	 * @param {number} signal - Exit signal
	 */
	handleExit(sessionId, exitCode, signal) {
		const session = this.sessions.get(sessionId);
		if (session) {
			session.active = false;

			// Notify all attached sockets
			for (const socketData of this.sockets.values()) {
				if (socketData.sessionId === sessionId) {
					socketData.socket.emit('terminal-exit', { exitCode, signal });
				}
			}

			console.log(`Terminal session ${sessionId} exited with code ${exitCode}, signal ${signal}`);
		}
	}

	/**
	 * Detach a socket from its session
	 * @private
	 * @param {Object} socket - Socket.IO socket
	 */
	detachSocket(socket) {
		const socketData = this.sockets.get(socket.id);
		if (socketData) {
			console.log(`Socket ${socket.id} detached from session ${socketData.sessionId}`);
			this.sockets.delete(socket.id);
		}
	}

	/**
	 * Clean up all sessions
	 */
	async cleanup() {
		console.log('Cleaning up terminal sessions...');
		for (const sessionId of this.sessions.keys()) {
			await this.endSession(sessionId);
		}
		this.sessions.clear();
		this.sockets.clear();
	}
}

export default TerminalManager;
