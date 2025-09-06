/**
 * ShellSessionViewModel - Encapsulates all shell session logic
 *
 * Handles socket connections, authentication, terminal management, and session state.
 * UI components should be thin and only handle presentation.
 */

import { io } from 'socket.io-client';

export class ShellSessionViewModel {
	// Private fields
	#socket = null;
	#terminalKey = '';

	// Public reactive state
	socket = $state(null);
	sessionId = $state(null);
	isConnecting = $state(false);
	isAuthenticated = $state(false);
	error = $state(null);
	terminalHistory = $state('');
	connectionStatus = $state('disconnected'); // 'disconnected', 'connecting', 'connected', 'authenticated'

	// Configuration
	projectId = $state('');
	sessionOptions = $state({});

	// Callbacks
	#onSessionCreated = null;
	#onSessionEnded = null;

	constructor(projectId = '', sessionOptions = {}, terminalKey = 'testkey12345') {
		this.projectId = projectId;
		this.sessionOptions = sessionOptions;
		this.#terminalKey = terminalKey;
	}

	/**
	 * Set callback handlers
	 */
	setCallbacks({ onSessionCreated = null, onSessionEnded = null } = {}) {
		this.#onSessionCreated = onSessionCreated;
		this.#onSessionEnded = onSessionEnded;
	}

	/**
	 * Connect to shell session
	 */
	async connect() {
		if (this.#socket?.connected) {
			return; // Already connected
		}

		try {
			this.isConnecting = true;
			this.error = null;
			this.connectionStatus = 'connecting';

			// Create socket connection
			this.#socket = io('/', {
				autoConnect: true
			});

			this.socket = this.#socket; // Expose to UI

			// Set up socket event handlers
			this.#setupSocketHandlers();
		} catch (err) {
			console.error('Error connecting to shell:', err);
			this.error = err.message;
			this.isConnecting = false;
			this.connectionStatus = 'disconnected';
		}
	}

	/**
	 * Disconnect from session
	 */
	disconnect() {
		if (this.#socket) {
			this.#socket.disconnect();
			this.#socket = null;
			this.socket = null;
		}

		this.#resetState();
	}

	/**
	 * Send input to terminal
	 */
	sendInput(data) {
		if (this.#socket && this.sessionId) {
			this.#socket.emit('input', data);
		}
	}

	/**
	 * Resize terminal
	 */
	resizeTerminal(cols, rows) {
		if (this.#socket && this.sessionId) {
			this.#socket.emit('resize', { cols, rows });
		}
	}

	/**
	 * End the session
	 */
	endSession() {
		if (this.#socket && this.sessionId) {
			this.#socket.emit('end', this.sessionId);
		}
	}

	/**
	 * Retry connection
	 */
	retry() {
		this.disconnect();
		setTimeout(() => {
			this.connect();
		}, 100);
	}

	// Private methods

	#setupSocketHandlers() {
		if (!this.#socket) return;

		this.#socket.on('connect', () => {
			console.log('Connected to server');
			this.connectionStatus = 'connected';
			this.#authenticate();
		});

		this.#socket.on('disconnect', () => {
			console.log('Disconnected from server');
			this.connectionStatus = 'disconnected';
			this.isAuthenticated = false;
			this.sessionId = null;
		});

		this.#socket.on('connect_error', (err) => {
			console.error('Connection error:', err);
			this.error = 'Failed to connect to server';
			this.isConnecting = false;
			this.connectionStatus = 'disconnected';
		});

		this.#socket.on('output', (data) => {
			this.terminalHistory += data.data;
		});

		this.#socket.on('ended', (data) => {
			console.log('Session ended:', data);
			this.#onSessionEnded?.({ sessionId: this.sessionId, ...data });
			this.sessionId = null;
		});
	}

	#authenticate() {
		if (!this.#socket) return;

		// Terminal key authentication
		this.#socket.emit('auth', this.#terminalKey, (response) => {
			if (response.success) {
				this.isAuthenticated = true;
				this.connectionStatus = 'authenticated';
				this.#createSession();
			} else {
				this.error = 'Authentication failed';
				this.isConnecting = false;
				this.connectionStatus = 'connected';
			}
		});
	}

	#createSession() {
		if (!this.#socket) return;

		const options = {
			mode: 'shell',
			cols: this.sessionOptions.cols || 80,
			rows: this.sessionOptions.rows || 24,
			name: this.sessionOptions.name || 'Shell Session',
			project: this.projectId,
			workingDirectory: this.sessionOptions.workingDirectory
		};

		this.#socket.emit('create', options, (response) => {
			if (response.success) {
				this.sessionId = response.sessionId;
				this.isConnecting = false;
				this.#onSessionCreated?.({ sessionId: this.sessionId, type: 'shell' });
			} else {
				this.error = response.error || 'Failed to create session';
				this.isConnecting = false;
			}
		});
	}

	#resetState() {
		this.sessionId = null;
		this.isConnecting = false;
		this.isAuthenticated = false;
		this.error = null;
		this.connectionStatus = 'disconnected';
		this.terminalHistory = '';
	}

	/**
	 * Get current state summary for UI
	 */
	get state() {
		return {
			socket: this.socket,
			sessionId: this.sessionId,
			isConnecting: this.isConnecting,
			isAuthenticated: this.isAuthenticated,
			error: this.error,
			terminalHistory: this.terminalHistory,
			connectionStatus: this.connectionStatus,
			isReady: this.sessionId && this.isAuthenticated && !this.isConnecting
		};
	}

	/**
	 * Get actions available to UI
	 */
	get actions() {
		return {
			connect: this.connect.bind(this),
			disconnect: this.disconnect.bind(this),
			sendInput: this.sendInput.bind(this),
			resizeTerminal: this.resizeTerminal.bind(this),
			endSession: this.endSession.bind(this),
			retry: this.retry.bind(this)
		};
	}
}
