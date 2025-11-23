/**
 * ClaudePaneViewModel.svelte.js
 *
 * ViewModel for Claude pane managing state and business logic for Claude Code sessions.
 * Uses Svelte 5 runes-in-classes pattern for reactive state management.
 *
 * Responsibilities:
 * - Manage message history and conversation state
 * - Handle authentication flow (OAuth)
 * - Manage connection state to run sessions
 * - Process incoming events from Claude adapter
 * - Handle user input and message sending
 * - Track live event icons for streaming feedback
 */

import { SvelteSet, SvelteDate } from 'svelte/reactivity';
import { runSessionClient } from '../../shared/services/RunSessionClient.js';
import * as MessageParser from '../services/MessageParser.js';
import { ClaudeEventHandlers } from '../services/EventHandlers.js';
import { AuthenticationManager } from '../services/AuthenticationManager.svelte.js';

export class ClaudePaneViewModel {
	// Dependency injection
	sessionClient = null;
	eventHandlers = null;

	// Core session props
	sessionId = $state(null);
	claudeSessionId = $state(null);
	shouldResume = $state(false);

	// Message state
	messages = $state([]);
	input = $state('');
	messageSequence = 0;

	// Loading and status state
	loading = $state(false);
	isWaitingForReply = $state(false);
	isCatchingUp = $state(false);

	// Live event feedback
	liveEventIcons = $state([]);

	// Event sourcing deduplication - track processed event sequences
	processedEventSeqs = $state(new SvelteSet());

	// Authentication manager (encapsulates auth flow state)
	authManager = new AuthenticationManager();

	// Connection state
	isAttached = $state(false);
	connectionError = $state(null);
	lastError = $state(null);

	// UI state
	isMobile = $state(false);

	// UI signal for View layer (replaces direct DOM manipulation)
	shouldScrollToBottom = $state(false);

	// Derived status
	status = $derived.by(() => {
		if (this.connectionError) return 'connection-error';
		if (this.authManager.inProgress) return 'auth-in-progress';
		if (this.authManager.awaitingCode) return 'awaiting-auth-code';
		if (this.loading) return 'loading';
		if (this.isCatchingUp) return 'catching-up';
		if (this.isWaitingForReply) return 'thinking';
		return 'idle';
	});

	// Derived states
	hasActiveSession = $derived.by(() => this.isAttached && this.sessionId !== null);
	canSubmit = $derived.by(() => this.input.trim().length > 0 && this.hasActiveSession);

	/**
	 * Initialize ViewModel with session props and optional dependencies
	 *
	 * @param {Object} options - Constructor options
	 * @param {string} options.sessionId - Run session ID
	 * @param {string|null} [options.claudeSessionId=null] - Claude session ID for resume
	 * @param {boolean} [options.shouldResume=false] - Whether to resume existing session
	 * @param {Object|null} [options.sessionClient=null] - RunSessionClient instance for DI
	 *
	 * @example
	 * // Production usage with singleton client
	 * const vm = new ClaudePaneViewModel({ sessionId: 'abc123' });
	 *
	 * @example
	 * // Testing usage with mock client
	 * const mockClient = { sendInput: vi.fn(), getStatus: vi.fn() };
	 * const vm = new ClaudePaneViewModel({
	 *   sessionId: 'test-id',
	 *   sessionClient: mockClient
	 * });
	 */
	constructor({ sessionId, claudeSessionId = null, shouldResume = false, sessionClient = null }) {
		this.sessionId = sessionId;
		this.claudeSessionId = claudeSessionId;
		this.shouldResume = shouldResume;
		// Use injected client or fallback to singleton (Dependency Inversion Principle)
		this.sessionClient = sessionClient || runSessionClient;
		// Initialize event handlers using Strategy Pattern
		this.eventHandlers = new ClaudeEventHandlers(this);
	}

	/**
	 * Generate unique message ID
	 */
	nextMessageId() {
		this.messageSequence = (this.messageSequence + 1) % Number.MAX_SAFE_INTEGER;
		return `${Date.now()}-${this.messageSequence}`;
	}


	/**
	 * Send user input message
	 */
	async submitInput(e) {
		if (e) e.preventDefault();

		console.log('[ClaudePaneViewModel] submitInput called:', {
			sessionId: this.sessionId,
			claudeSessionId: this.claudeSessionId,
			input: this.input.trim(),
			runSessionConnected: this.sessionClient.getStatus().connected
		});

		if (!this.input.trim()) return;
		if (!this.isAttached) {
			console.error('[ClaudePaneViewModel] Not attached to run session');
			return;
		}
		if (!this.sessionId) {
			console.error('[ClaudePaneViewModel] SessionId not available');
			return;
		}

		const userMessage = this.input.trim();
		this.authManager.resetForNewTurn(); // reset per user turn

		// Handle OAuth authorization code submission via AuthenticationManager
		const authCommand = this.authManager.processAuthInput(userMessage);
		if (authCommand) {
			try {
				this.input = '';

				// Send auth code through run session client
				this.sessionClient.sendInput(this.sessionId, authCommand);

				// Show status message
				this.messages = [
					...this.messages,
					{
						role: 'assistant',
						text: 'Submitting authorization code…',
						timestamp: new SvelteDate(),
						id: this.nextMessageId()
					}
				];
				this.shouldScrollToBottom = true;
			} catch (err) {
				console.error('[ClaudePaneViewModel] Failed to send auth code:', err);
			}
			return;
		}

		// Add user message immediately
		const userMsg = {
			role: 'user',
			text: userMessage,
			timestamp: new SvelteDate(),
			id: this.nextMessageId()
		};
		console.log('[ClaudePaneViewModel] Adding user message:', userMsg);
		this.messages = [...this.messages, userMsg];
		console.log(
			'[ClaudePaneViewModel] Messages array after user message:',
			this.messages.length,
			this.messages
		);

		// Clear input and show waiting state
		this.input = '';
		this.isWaitingForReply = true;
		this.liveEventIcons = [];

		// Signal to scroll to user message
		this.shouldScrollToBottom = true;

		try {
			// Send input through run session client
			this.sessionClient.sendInput(this.sessionId, userMessage);
		} catch (error) {
			console.error('[ClaudePaneViewModel] Failed to send message:', error);
			this.lastError = error.message || 'Failed to send message';
			this.isWaitingForReply = false;
		}
	}

	/**
	 * Cancel processing/waiting state
	 */
	cancelProcessing() {
		this.isWaitingForReply = false;
		this.liveEventIcons = [];
	}

	/**
	 * Handle run session events (simplified with Strategy Pattern)
	 * @param {Object} event - Event object with seq, channel, type, payload
	 */
	handleRunEvent(event) {
		console.log('[ClaudePaneViewModel] Handling event:', event);

		// Event sourcing deduplication - check sequence number
		if (event.seq !== undefined && this.processedEventSeqs.has(event.seq)) {
			console.log('[ClaudePaneViewModel] Skipping already processed event seq:', event.seq);
			return;
		}

		// Delegate to event handler strategy
		const action = this.eventHandlers.handleEvent(event);

		// Apply the action to update state
		this.applyAction(action);

		// Track this event as processed (if it has a sequence number)
		if (event.seq !== undefined) {
			this.processedEventSeqs.add(event.seq);
		}
	}

	/**
	 * Apply state changes from event handler action
	 * @param {Object} action - Action object describing state changes
	 */
	applyAction(action) {
		if (!action || action.type === 'noop') return;

		switch (action.type) {
			case 'add_message':
				this.messages = [...this.messages, action.message];
				if (action.clearWaiting) {
					this.isWaitingForReply = false;
					this.liveEventIcons = [];
				}
				if (action.scrollToBottom) {
					this.shouldScrollToBottom = true;
				}
				break;

			case 'add_error_message':
				this.messages = [...this.messages, action.message];
				this.lastError = action.setError;
				this.isWaitingForReply = false;
				this.liveEventIcons = [];
				this.shouldScrollToBottom = true;
				break;

			case 'clear_waiting':
				this.isWaitingForReply = false;
				this.liveEventIcons = [];
				break;

			case 'update_auth_state':
				Object.assign(this, action.updates);
				if (action.message) {
					this.messages = [...this.messages, action.message];
				}
				if (action.setError) {
					this.lastError = action.setError;
				}
				if (action.scrollToBottom) {
					this.shouldScrollToBottom = true;
				}
				break;

			case 'add_live_icon':
				this.liveEventIcons = [...this.liveEventIcons, action.icon];
				break;

			default:
				console.warn('[ClaudePaneViewModel] Unknown action type:', action.type);
		}
	}

	/**
	 * Add live event icon for streaming feedback
	 * Implements bounds checking to prevent memory leak
	 */
	pushLiveIcon(event) {
		const icon = {
			type: event.type,
			timestamp: Date.now(),
			id: this.nextMessageId()
		};
		this.liveEventIcons = [...this.liveEventIcons, icon];

		// Prevent memory leak by limiting to last 50 icons
		if (this.liveEventIcons.length > 50) {
			this.liveEventIcons = this.liveEventIcons.slice(-50);
		}
	}

	/**
	 * Set mobile device flag
	 */
	setMobile(isMobile) {
		this.isMobile = isMobile;
	}

	/**
	 * Attach to run session
	 */
	attach() {
		this.isAttached = true;
		this.connectionError = null;
	}

	/**
	 * Detach from run session
	 */
	detach() {
		this.isAttached = false;
	}

	/**
	 * Set connection error
	 */
	setConnectionError(error) {
		this.connectionError = error;
		this.isAttached = false;
	}

	/**
	 * Load previous messages from history
	 */
	async loadPreviousMessages(history) {
		if (!history || history.length === 0) return;

		this.isCatchingUp = true;

		const loadedMessages = [];

		for (const entry of history) {
			const { channel, type, payload } = entry;

			// Load user input messages - use MessageParser for consistent extraction
			if (channel === 'system:input') {
				const userText = MessageParser.parseUserInput(payload);
				if (userText) {
					const message = MessageParser.createMessage(
						userText,
						'user',
						() => this.nextMessageId(),
						new SvelteDate(entry.timestamp || Date.now())
					);
					if (message) {
						loadedMessages.push(message);
					}
				}
			}

			// Load assistant messages - use MessageParser for consistent extraction
			if (channel === 'claude:message' && type === 'assistant') {
				const messageText = MessageParser.extractMessageText(payload);
				if (messageText) {
					const message = MessageParser.createMessage(
						messageText,
						'assistant',
						() => this.nextMessageId(),
						new SvelteDate(entry.timestamp || Date.now())
					);
					if (message) {
						loadedMessages.push(message);
					}
				}
			}
		}

		console.log('[ClaudePaneViewModel] Loaded', loadedMessages.length, 'messages from history');
		this.messages = loadedMessages;
		this.isCatchingUp = false;

		this.shouldScrollToBottom = true;
	}

	/**
	 * Clear all messages
	 */
	clearMessages() {
		this.messages = [];
		this.liveEventIcons = [];
	}
}
