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

import { tick } from 'svelte';
import { runSessionClient } from '../../shared/services/RunSessionClient.js';

export class ClaudePaneViewModel {
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

	// Authentication state
	authStartRequested = $state(false);
	authAwaitingCode = $state(false);
	authInProgress = $state(false);
	pendingAuthUrl = $state('');

	// Connection state
	isAttached = $state(false);
	connectionError = $state(null);
	lastError = $state(null);

	// UI state
	isMobile = $state(false);
	messagesContainer = $state(null);

	// Derived status
	status = $derived.by(() => {
		if (this.connectionError) return 'connection-error';
		if (this.authInProgress) return 'auth-in-progress';
		if (this.authAwaitingCode) return 'awaiting-auth-code';
		if (this.loading) return 'loading';
		if (this.isCatchingUp) return 'catching-up';
		if (this.isWaitingForReply) return 'thinking';
		return 'idle';
	});

	// Derived states
	hasActiveSession = $derived.by(() => this.isAttached && this.sessionId !== null);
	canSubmit = $derived.by(() => this.input.trim().length > 0 && this.hasActiveSession);

	/**
	 * Initialize ViewModel with session props
	 */
	constructor(sessionId, claudeSessionId = null, shouldResume = false) {
		this.sessionId = sessionId;
		this.claudeSessionId = claudeSessionId;
		this.shouldResume = shouldResume;
	}

	/**
	 * Generate unique message ID
	 */
	nextMessageId() {
		this.messageSequence = (this.messageSequence + 1) % Number.MAX_SAFE_INTEGER;
		return `${Date.now()}-${this.messageSequence}`;
	}

	/**
	 * Scroll messages container to bottom
	 */
	async scrollToBottom() {
		await tick();
		if (this.messagesContainer) {
			this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
		}
	}

	/**
	 * Set messages container element reference
	 */
	setMessagesContainer(element) {
		this.messagesContainer = element;
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
			runSessionConnected: runSessionClient.getStatus().connected
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
		this.authStartRequested = false; // reset per user turn

		// Handle OAuth authorization code submission
		if (this.authAwaitingCode && userMessage) {
			try {
				this.authInProgress = true;
				const code = userMessage;
				this.input = '';

				// Send auth code through run session client
				runSessionClient.sendInput(this.sessionId, `/auth ${code}`);

				// Show status message
				this.messages = [
					...this.messages,
					{
						role: 'assistant',
						text: 'Submitting authorization code…',
						timestamp: new Date(),
						id: this.nextMessageId()
					}
				];
				await this.scrollToBottom();
			} catch (err) {
				console.error('[ClaudePaneViewModel] Failed to send auth code:', err);
			}
			return;
		}

		// Add user message immediately
		const userMsg = {
			role: 'user',
			text: userMessage,
			timestamp: new Date(),
			id: this.nextMessageId()
		};
		console.log('[ClaudePaneViewModel] Adding user message:', userMsg);
		this.messages = [
			...this.messages,
			userMsg
		];
		console.log('[ClaudePaneViewModel] Messages array after user message:', this.messages.length, this.messages);

		// Clear input and show waiting state
		this.input = '';
		this.isWaitingForReply = true;
		this.liveEventIcons = [];

		// Scroll to user message
		await this.scrollToBottom();

		try {
			// Send input through run session client
			runSessionClient.sendInput(this.sessionId, userMessage);
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
	 * Handle run session events
	 */
	handleRunEvent(event) {
		console.log('[ClaudePaneViewModel] Handling event:', event);

		const { channel, type, payload } = event;

		// Handle events by channel
		if (channel === 'claude:message') {
			switch (type) {
				case 'assistant':
					// Assistant message received - extract text from content
					console.log('[ClaudePaneViewModel] Processing assistant message, current messages:', this.messages.length);
					this.isWaitingForReply = false;
					this.liveEventIcons = [];

					// Extract message text from the event structure
					let messageText = '';
					console.log('[ClaudePaneViewModel] Payload structure:', JSON.stringify(payload, null, 2));

					if (payload.events && Array.isArray(payload.events)) {
						console.log('[ClaudePaneViewModel] Found', payload.events.length, 'events in payload');
						// Extract text from content blocks
						for (const evt of payload.events) {
							if (evt.message?.content) {
								console.log('[ClaudePaneViewModel] Found message with', evt.message.content.length, 'content blocks');
								for (const block of evt.message.content) {
									if (block.type === 'text' && block.text) {
										console.log('[ClaudePaneViewModel] Extracted text block:', block.text);
										messageText += block.text;
									}
								}
							}
						}
					} else {
						messageText = payload.text || payload.content || '';
						console.log('[ClaudePaneViewModel] Using fallback extraction, text:', messageText);
					}

					console.log('[ClaudePaneViewModel] Final extracted text:', messageText);

					if (messageText) {
						const newMessage = {
							role: 'assistant',
							text: messageText,
							timestamp: new Date(),
							id: this.nextMessageId()
						};
						console.log('[ClaudePaneViewModel] Adding message:', newMessage);
						this.messages = [
							...this.messages,
							newMessage
						];
						console.log('[ClaudePaneViewModel] Messages array now has', this.messages.length, 'messages');
						this.scrollToBottom();
					} else {
						console.warn('[ClaudePaneViewModel] No message text extracted from assistant event');
					}
					break;

				case 'system':
					// System initialization message
					console.log('[ClaudePaneViewModel] System init:', payload);
					break;

				case 'result':
					// Execution result - mark conversation complete
					this.isWaitingForReply = false;
					this.liveEventIcons = [];
					console.log('[ClaudePaneViewModel] Execution result:', payload);
					break;

				default:
					console.log('[ClaudePaneViewModel] Unhandled claude:message type:', type);
			}
			return;
		}

		// Handle error channel
		if (channel === 'claude:error') {
			this.isWaitingForReply = false;
			this.liveEventIcons = [];

			let errorMessage = payload.error || payload.message || 'An error occurred';
			// Extract error from nested structure if needed
			if (payload.events && Array.isArray(payload.events) && payload.events[0]?.error) {
				errorMessage = payload.events[0].error;
			}

			this.lastError = errorMessage;
			this.messages = [
				...this.messages,
				{
					role: 'assistant',
					text: `Error: ${errorMessage}`,
					timestamp: new Date(),
					id: this.nextMessageId()
				}
			];
			this.scrollToBottom();
			return;
		}

		// Handle other channel types
		if (channel === 'system:input') {
			// Echo user input (already handled via sendMessage)
			return;
		}

		// Legacy event format (for backward compatibility)
		switch (type) {
			case 'claude:message':
				// Assistant message received (legacy format)
				this.isWaitingForReply = false;
				this.liveEventIcons = [];
				this.messages = [
					...this.messages,
					{
						role: 'assistant',
						text: payload.text || payload.content || '',
						timestamp: new Date(),
						id: this.nextMessageId()
					}
				];
				this.scrollToBottom();
				break;

			case 'claude:auth_start':
				// OAuth authentication flow started
				this.authStartRequested = true;
				this.authAwaitingCode = false;
				this.authInProgress = true;
				this.pendingAuthUrl = payload.url || '';
				this.messages = [
					...this.messages,
					{
						role: 'assistant',
						text: `Please authorize Claude Code:\n\n[Open Authorization URL](${this.pendingAuthUrl})`,
						timestamp: new Date(),
						id: this.nextMessageId()
					}
				];
				this.scrollToBottom();
				break;

			case 'claude:auth_awaiting_code':
				// Waiting for authorization code
				this.authAwaitingCode = true;
				this.authInProgress = false;
				this.messages = [
					...this.messages,
					{
						role: 'assistant',
						text: 'Please paste the authorization code from the browser:',
						timestamp: new Date(),
						id: this.nextMessageId()
					}
				];
				this.scrollToBottom();
				break;

			case 'claude:auth_success':
				// Authentication successful
				this.authInProgress = false;
				this.authAwaitingCode = false;
				this.authStartRequested = false;
				this.messages = [
					...this.messages,
					{
						role: 'assistant',
						text: '✓ Authentication successful! You can now use Claude Code.',
						timestamp: new Date(),
						id: this.nextMessageId()
					}
				];
				this.scrollToBottom();
				break;

			case 'claude:auth_error':
				// Authentication failed
				this.authInProgress = false;
				this.authAwaitingCode = false;
				this.lastError = payload.error || 'Authentication failed';
				this.messages = [
					...this.messages,
					{
						role: 'assistant',
						text: `Authentication error: ${this.lastError}`,
						timestamp: new Date(),
						id: this.nextMessageId()
					}
				];
				this.scrollToBottom();
				break;

			case 'claude:tool_use':
			case 'claude:tool_result':
			case 'claude:thinking':
				// Add to live event icons for streaming feedback
				this.pushLiveIcon(event);
				break;

			case 'claude:error':
				// Handle errors
				this.isWaitingForReply = false;
				this.liveEventIcons = [];
				this.lastError = payload.error || 'An error occurred';
				this.messages = [
					...this.messages,
					{
						role: 'assistant',
						text: `Error: ${this.lastError}`,
						timestamp: new Date(),
						id: this.nextMessageId()
					}
				];
				this.scrollToBottom();
				break;

			default:
				console.log('[ClaudePaneViewModel] Unhandled event type:', type);
		}
	}

	/**
	 * Add live event icon for streaming feedback
	 */
	pushLiveIcon(event) {
		const icon = {
			type: event.type,
			timestamp: Date.now(),
			id: this.nextMessageId()
		};
		this.liveEventIcons = [...this.liveEventIcons, icon];
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

		const loadedMessages = history
			.filter((entry) => entry.type === 'claude:message')
			.map((entry) => ({
				role: entry.payload?.role || 'assistant',
				text: entry.payload?.text || entry.payload?.content || '',
				timestamp: new Date(entry.timestamp || Date.now()),
				id: this.nextMessageId()
			}));

		this.messages = loadedMessages;
		this.isCatchingUp = false;

		await this.scrollToBottom();
	}

	/**
	 * Clear all messages
	 */
	clearMessages() {
		this.messages = [];
		this.liveEventIcons = [];
	}
}
