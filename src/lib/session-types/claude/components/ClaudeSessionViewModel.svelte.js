/**
 * ClaudeSessionViewModel - Encapsulates all Claude session logic
 *
 * Handles socket connections, Claude authentication via Socket.IO,
 * chat management, and session state. UI components should be thin and only handle presentation.
 *
 * Uses namespaced Socket.IO handlers for Claude Code service integration.
 */

import { io } from 'socket.io-client';

export class ClaudeSessionViewModel {
	// Private fields
	#socket = null;
	#terminalKey = '';

	// Public reactive state
	socket = $state(null);
	sessionId = $state(null);

	// Connection state
	isConnecting = $state(false);
	error = $state(null);
	connectionStatus = $state('disconnected'); // 'disconnected', 'connecting', 'connected'

	// Authentication state
	isTerminalAuthenticated = $state(false);
	isClaudeAuthenticated = $state(false);
	authStep = $state('terminal'); // 'terminal', 'claude-check', 'ready'

	// Chat state
	messages = $state([]);
	isSending = $state(false);

	// Configuration
	projectId = $state('');
	sessionOptions = $state({});

	// Callbacks
	#onSessionCreated = null;
	#onSessionEnded = null;

	// Actions - static object to prevent reactive loops
	actions;

	constructor(projectId = '', sessionOptions = {}, terminalKey = 'testkey12345') {
		this.projectId = projectId;
		this.sessionOptions = sessionOptions;
		this.#terminalKey = terminalKey;

		// Initialize static actions object
		this.actions = {
			connect: this.connect.bind(this),
			disconnect: this.disconnect.bind(this),
			initializeClaudeSession: this.initializeClaudeSession.bind(this),
			sendMessage: this.sendMessage.bind(this),
			clearChat: this.clearChat.bind(this),
			endSession: this.endSession.bind(this),
			retry: this.retry.bind(this)
		};
	}

	/**
	 * Set callback handlers
	 */
	setCallbacks({ onSessionCreated = null, onSessionEnded = null } = {}) {
		this.#onSessionCreated = onSessionCreated;
		this.#onSessionEnded = onSessionEnded;
	}

	/**
	 * Connect to Claude session
	 */
	async connect() {
		if (this.#socket?.connected) {
			return; // Already connected
		}

		try {
			this.isConnecting = true;
			this.error = null;
			this.connectionStatus = 'connecting';
			this.authStep = 'terminal';

			// Create socket connection
			this.#socket = io('/', {
				autoConnect: true
			});

			this.socket = this.#socket; // Expose to UI

			// Set up socket event handlers
			this.#setupSocketHandlers();
		} catch (err) {
			console.error('Error connecting to Claude:', err);
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
	 * Check Claude authentication and initialize session
	 */
	async initializeClaudeSession() {
		if (!this.#socket) {
			this.error = 'Not connected to server';
			return;
		}

		try {
			// Check Claude authentication
			this.#socket.emit('claude:check-auth', (response) => {
				if (response.success) {
					this.isClaudeAuthenticated = response.authenticated;

					if (response.authenticated) {
						this.authStep = 'ready';
						this.#createClaudeSession();
					} else {
						this.authStep = 'claude-check';
					}
				} else {
					this.error = response.error;
					this.authStep = 'claude-check';
				}
			});
		} catch (error) {
			console.error('Error checking Claude auth:', error);
			this.error = error.message;
		}
	}

	/**
	 * Send message to Claude via socket
	 */
	async sendMessage(messageText) {
		if (!messageText?.trim() || this.isSending || !this.#socket || !this.sessionId) {
			return;
		}

		this.isSending = true;

		try {
			// Send message via socket
			this.#socket.emit(
				'claude:send-message',
				{
					message: messageText.trim(),
					sessionId: this.sessionId
				},
				(response) => {
					if (response.success) {
						// User message was added, response will come via socket event
						console.log('Message sent successfully');
					} else {
						this.error = response.error;
						this.isSending = false;
					}
				}
			);
		} catch (err) {
			console.error('Error sending message:', err);
			this.error = err.message;
			this.isSending = false;
		}
	}

	/**
	 * Clear chat history
	 */
	clearChat() {
		if (!this.#socket || !this.sessionId) return;

		this.#socket.emit(
			'claude:clear-chat',
			{
				sessionId: this.sessionId
			},
			(response) => {
				if (response.success) {
					// Messages will be updated via socket event
					console.log('Chat cleared successfully');
				} else {
					this.error = response.error;
				}
			}
		);
	}

	/**
	 * End the Claude session
	 */
	endSession() {
		if (!this.#socket || !this.sessionId) return;

		const currentSessionId = this.sessionId;

		this.#socket.emit(
			'claude:end-session',
			{
				sessionId: currentSessionId
			},
			(response) => {
				if (response.success) {
					this.#onSessionEnded?.({ sessionId: currentSessionId, type: 'claude' });
					this.sessionId = null;
				} else {
					this.error = response.error;
				}
			}
		);
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
			this.#authenticateTerminal();
		});

		this.#socket.on('disconnect', () => {
			console.log('Disconnected from server');
			this.connectionStatus = 'disconnected';
			this.isTerminalAuthenticated = false;
			this.sessionId = null;
		});

		this.#socket.on('connect_error', (err) => {
			console.error('Connection error:', err);
			this.error = 'Failed to connect to server';
			this.isConnecting = false;
			this.connectionStatus = 'disconnected';
		});

		// Claude-specific socket handlers
		this.#socket.on('claude:session-created', (data) => {
			console.log('Claude session created:', data);
			this.sessionId = data.sessionId;
			this.#onSessionCreated?.({
				sessionId: data.sessionId,
				type: 'claude',
				projectId: data.projectId
			});
		});

		this.#socket.on('claude:message-response', (data) => {
			if (data.sessionId === this.sessionId) {
				this.messages.push(data.message);
				this.isSending = false;
			}
		});

		this.#socket.on('claude:typing', (data) => {
			if (data.sessionId === this.sessionId) {
				this.isSending = data.isTyping;
			}
		});

		this.#socket.on('claude:chat-cleared', (data) => {
			if (data.sessionId === this.sessionId) {
				// The server will provide the new messages via claude:get-history if needed
				// Or we can reset to a simple cleared message
				this.messages = [
					{
						id: `msg-${Date.now()}`,
						role: 'assistant',
						content: 'Chat history cleared. How can I help you with your project?',
						timestamp: new Date().toISOString()
					}
				];
			}
		});

		this.#socket.on('claude:session-ended', (data) => {
			if (data.sessionId === this.sessionId) {
				this.sessionId = null;
				this.messages = [];
			}
		});
	}

	#authenticateTerminal() {
		if (!this.#socket) return;

		// Step 1: Terminal key authentication
		this.#socket.emit('auth', this.#terminalKey, (response) => {
			if (response.success) {
				this.isTerminalAuthenticated = true;
				this.authStep = 'claude-check';
				this.isConnecting = false;
				// Move to Claude initialization
				this.initializeClaudeSession();
			} else {
				this.error = 'Terminal authentication failed';
				this.isConnecting = false;
				this.connectionStatus = 'connected';
			}
		});
	}

	#createClaudeSession() {
		if (!this.#socket) return;

		// Initialize Claude session via socket
		this.#socket.emit(
			'claude:init-session',
			{
				projectId: this.projectId,
				sessionOptions: this.sessionOptions
			},
			(response) => {
				if (response.success) {
					this.sessionId = response.session.id;
					this.isClaudeAuthenticated = response.session.authenticated;

					// Add welcome message
					if (response.session.welcomeMessage) {
						this.messages = [response.session.welcomeMessage];
					}

					this.authStep = 'ready';
					this.error = null;
				} else {
					this.error = response.error;
					this.authStep = 'claude-check';
				}
			}
		);
	}

	#resetState() {
		this.sessionId = null;
		this.isConnecting = false;
		this.isTerminalAuthenticated = false;
		this.isClaudeAuthenticated = false;
		this.error = null;
		this.connectionStatus = 'disconnected';
		this.authStep = 'terminal';
		this.messages = [];
		this.isSending = false;
	}


}
