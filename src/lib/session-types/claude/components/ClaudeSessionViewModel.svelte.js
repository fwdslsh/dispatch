/**
 * ClaudeSessionViewModel - Encapsulates all Claude session logic
 *
 * Handles Claude sessions using ClaudeClient for socket communication,
 * chat management, and session state. UI components should be thin and only handle presentation.
 *
 * Uses ClaudeClient for proper abstraction of Socket.IO communication.
 */

import { ClaudeClient } from '../io/ClaudeClient.js';
import { io } from 'socket.io-client';

export class ClaudeSessionViewModel {
	// Private fields
	#claudeClient = null;
	#terminalKey = '';

	// Public reactive state
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
		if (this.#claudeClient?.connected) {
			return; // Already connected
		}

		try {
			this.isConnecting = true;
			this.error = null;
			this.connectionStatus = 'connecting';
			this.authStep = 'terminal';

			// Create Claude client
			this.#claudeClient = new ClaudeClient(io);

			// Set up event handlers
			this.#setupClaudeClientHandlers();

			// The BaseClient automatically connects, so we just need to wait a bit
			// for the connection to establish
			setTimeout(() => {
				this.isTerminalAuthenticated = true;
				this.connectionStatus = 'connected';
				this.authStep = 'claude-check';
				this.isConnecting = false;

				// Move to Claude initialization
				this.initializeClaudeSession();
			}, 100);
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
		if (this.#claudeClient) {
			this.#claudeClient.disconnect();
			this.#claudeClient = null;
		}

		this.#resetState();
	}

	/**
	 * Check Claude authentication and initialize session
	 */
	async initializeClaudeSession() {
		if (!this.#claudeClient) {
			this.error = 'Not connected to server';
			return;
		}

		try {
			console.log('ClaudeSessionViewModel: Checking Claude authentication...');
			// Check Claude authentication
			const response = await this.#claudeClient.checkAuth();
			console.log('ClaudeSessionViewModel: Auth response received:', response);

			this.isClaudeAuthenticated = response.authenticated;

			if (response.authenticated) {
				console.log('ClaudeSessionViewModel: User is authenticated, creating session...');
				this.authStep = 'ready';
				this.#createClaudeSession();
			} else {
				console.log('ClaudeSessionViewModel: User needs authentication, showing auth form');
				this.authStep = 'claude-check';
			}
		} catch (error) {
			console.error('Error checking Claude auth:', error);
			this.error = error.message;
			this.authStep = 'claude-check';
		}
	}

	/**
	 * Send message to Claude via client
	 */
	async sendMessage(messageText) {
		if (!messageText?.trim() || this.isSending || !this.#claudeClient || !this.sessionId) {
			return;
		}

		this.isSending = true;

		try {
			// Send message via Claude client
			await this.#claudeClient.sendMessage(messageText.trim());
			// User message was added, response will come via event handler
			console.log('Message sent successfully');
		} catch (err) {
			console.error('Error sending message:', err);
			this.error = err.message;
			this.isSending = false;
		}
	}

	/**
	 * Clear chat history
	 */
	async clearChat() {
		if (!this.#claudeClient || !this.sessionId) return;

		try {
			await this.#claudeClient.clearChat();
			console.log('Chat cleared successfully');
			// Messages will be updated via event handler
		} catch (err) {
			console.error('Error clearing chat:', err);
			this.error = err.message;
		}
	}

	/**
	 * End the Claude session
	 */
	async endSession() {
		if (!this.#claudeClient || !this.sessionId) return;

		const currentSessionId = this.sessionId;

		try {
			await this.#claudeClient.endSession();
			this.#onSessionEnded?.({ sessionId: currentSessionId, type: 'claude' });
			this.sessionId = null;
		} catch (err) {
			console.error('Error ending session:', err);
			this.error = err.message;
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

	#setupClaudeClientHandlers() {
		if (!this.#claudeClient) return;

		// Set up event callbacks
		this.#claudeClient.setOnSessionCreated((data) => {
			console.log('Claude session created:', data);
			this.sessionId = data.sessionId;
			this.#onSessionCreated?.({
				sessionId: data.sessionId,
				type: 'claude',
				projectId: data.projectId
			});
		});

		this.#claudeClient.setOnResponse((data) => {
			if (data.sessionId === this.sessionId) {
				this.messages.push(data.message);
				this.isSending = false;
			}
		});

		this.#claudeClient.setOnTyping((data) => {
			if (data.sessionId === this.sessionId) {
				this.isSending = data.isTyping;
			}
		});

		this.#claudeClient.setOnCleared((data) => {
			if (data.sessionId === this.sessionId) {
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

		this.#claudeClient.setOnSessionEnded((data) => {
			if (data.sessionId === this.sessionId) {
				this.sessionId = null;
				this.messages = [];
			}
		});
	}

	async #createClaudeSession() {
		if (!this.#claudeClient) return;

		try {
			// Initialize Claude session via client
			const response = await this.#claudeClient.createSession(this.projectId, this.sessionOptions);

			this.sessionId = response.session.id;
			this.isClaudeAuthenticated = response.session.authenticated;

			// Add welcome message
			if (response.session.welcomeMessage) {
				this.messages = [response.session.welcomeMessage];
			}

			this.authStep = 'ready';
			this.error = null;
		} catch (err) {
			console.error('Error creating Claude session:', err);
			this.error = err.message;
			this.authStep = 'claude-check';
		}
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
