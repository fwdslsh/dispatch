/**
 * AIPaneViewModel.svelte.js
 *
 * ViewModel for AI pane managing state and business logic for AI sessions.
 * Uses Svelte 5 runes-in-classes pattern for reactive state management.
 *
 * v2.0 Hard Fork: OpenCode-first architecture
 * - Simplified from ClaudePaneViewModel
 * - Works with unified AI adapter (OpenCode-powered)
 * - No OAuth handling (OpenCode manages authentication)
 *
 * @file src/lib/client/ai/viewmodels/AIPaneViewModel.svelte.js
 */

import { SvelteSet, SvelteDate } from 'svelte/reactivity';
import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';

export class AIPaneViewModel {
	// Dependency injection
	sessionClient = null;

	// Core session props
	sessionId = $state(null);
	aiSessionId = $state(null);
	shouldResume = $state(false);

	// Message state
	messages = $state([]);
	input = $state('');
	messageSequence = 0;

	// Loading and status state
	loading = $state(false);
	isWaitingForReply = $state(false);
	isCatchingUp = $state(false);

	// Event sourcing deduplication
	processedEventSeqs = $state(new SvelteSet());

	// Connection state
	isAttached = $state(false);
	connectionError = $state(null);
	lastError = $state(null);

	// UI state
	isMobile = $state(false);
	shouldScrollToBottom = $state(false);

	// Derived status
	status = $derived.by(() => {
		if (this.connectionError) return 'connection-error';
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
	 * @param {Object} options
	 * @param {string} options.sessionId - Run session ID
	 * @param {string|null} [options.aiSessionId=null] - AI session ID for resume
	 * @param {boolean} [options.shouldResume=false] - Whether to resume existing session
	 * @param {Object|null} [options.sessionClient=null] - RunSessionClient for DI
	 */
	constructor({ sessionId, aiSessionId = null, shouldResume = false, sessionClient = null }) {
		this.sessionId = sessionId;
		this.aiSessionId = aiSessionId;
		this.shouldResume = shouldResume;
		this.sessionClient = sessionClient || runSessionClient;
	}

	/**
	 * Generate unique message ID
	 * @returns {string}
	 */
	nextMessageId() {
		this.messageSequence = (this.messageSequence + 1) % Number.MAX_SAFE_INTEGER;
		return `${Date.now()}-${this.messageSequence}`;
	}

	/**
	 * Send user input message
	 * @param {Event} [e] - Optional form event
	 */
	async submitInput(e) {
		if (e) e.preventDefault();

		console.log('[AIPaneViewModel] submitInput:', {
			sessionId: this.sessionId,
			input: this.input.trim(),
			connected: this.sessionClient.getStatus().connected
		});

		if (!this.input.trim()) return;
		if (!this.isAttached) {
			console.error('[AIPaneViewModel] Not attached to session');
			return;
		}
		if (!this.sessionId) {
			console.error('[AIPaneViewModel] SessionId not available');
			return;
		}

		const userMessage = this.input.trim();

		// Add user message immediately
		const userMsg = {
			role: 'user',
			text: userMessage,
			timestamp: new SvelteDate(),
			id: this.nextMessageId()
		};
		this.messages = [...this.messages, userMsg];

		// Clear input and show waiting state
		this.input = '';
		this.isWaitingForReply = true;
		this.shouldScrollToBottom = true;

		try {
			// Send input through run session client
			this.sessionClient.sendInput(this.sessionId, userMessage);
		} catch (error) {
			console.error('[AIPaneViewModel] Failed to send message:', error);
			this.lastError = error.message || 'Failed to send message';
			this.isWaitingForReply = false;
		}
	}

	/**
	 * Cancel processing/waiting state
	 */
	cancelProcessing() {
		this.isWaitingForReply = false;
	}

	/**
	 * Handle run session events
	 * @param {Object} event - Event with seq, channel, type, payload
	 */
	handleRunEvent(event) {
		console.log('[AIPaneViewModel] Event:', event);

		// Deduplication by sequence number
		if (event.seq !== undefined && this.processedEventSeqs.has(event.seq)) {
			console.log('[AIPaneViewModel] Skipping duplicate event:', event.seq);
			return;
		}

		const { channel, type, payload } = event;

		// Handle AI messages
		if (channel === 'ai:message') {
			this.handleAIMessage(payload);
		}
		// Handle AI errors
		else if (channel === 'ai:error') {
			this.handleAIError(payload);
		}
		// Handle system input (for history replay)
		else if (channel === 'system:input') {
			// Already displayed user message, skip
		}

		// Track processed events
		if (event.seq !== undefined) {
			this.processedEventSeqs.add(event.seq);
		}
	}

	/**
	 * Handle AI message events from OpenCode
	 * @param {Object} payload
	 */
	handleAIMessage(payload) {
		const events = payload?.events || [];

		for (const aiEvent of events) {
			// Extract text content from various event types
			let text = null;
			let eventType = aiEvent.type || 'unknown';

			// Handle different OpenCode event types
			if (aiEvent.type === 'message.delta' || aiEvent.type === 'text') {
				text = aiEvent.properties?.text || aiEvent.data?.text || aiEvent.text;
			} else if (aiEvent.type === 'assistant' || aiEvent.type === 'message') {
				text = aiEvent.properties?.content || aiEvent.data?.content || aiEvent.content;
			} else if (aiEvent.data) {
				// Fallback: try to extract any text from data
				text = typeof aiEvent.data === 'string'
					? aiEvent.data
					: JSON.stringify(aiEvent.data, null, 2);
			}

			if (text) {
				const message = {
					role: 'assistant',
					text,
					eventType,
					timestamp: new SvelteDate(),
					id: this.nextMessageId()
				};
				this.messages = [...this.messages, message];
				this.shouldScrollToBottom = true;
			}

			// Check for session completion
			if (aiEvent.type === 'session.idle' || aiEvent.type === 'session.completed') {
				this.isWaitingForReply = false;
				this.isCatchingUp = false;
			}
		}
	}

	/**
	 * Handle AI error events
	 * @param {Object} payload
	 */
	handleAIError(payload) {
		const errorMessage = payload?.error || 'Unknown error occurred';

		this.lastError = errorMessage;
		this.isWaitingForReply = false;

		// Add error message to chat
		const message = {
			role: 'error',
			text: errorMessage,
			timestamp: new SvelteDate(),
			id: this.nextMessageId()
		};
		this.messages = [...this.messages, message];
		this.shouldScrollToBottom = true;
	}

	/**
	 * Set mobile device flag
	 * @param {boolean} isMobile
	 */
	setMobile(isMobile) {
		this.isMobile = isMobile;
	}

	/**
	 * Mark as attached to run session
	 */
	attach() {
		this.isAttached = true;
		this.connectionError = null;
	}

	/**
	 * Mark as detached from run session
	 */
	detach() {
		this.isAttached = false;
	}

	/**
	 * Set connection error
	 * @param {string} error
	 */
	setConnectionError(error) {
		this.connectionError = error;
		this.isAttached = false;
	}

	/**
	 * Load previous messages from history
	 * @param {Array} history
	 */
	async loadPreviousMessages(history) {
		if (!history || history.length === 0) return;

		this.isCatchingUp = true;
		const loadedMessages = [];

		for (const entry of history) {
			const { channel, type, payload } = entry;

			// Load user input messages
			if (channel === 'system:input') {
				const userText = typeof payload === 'string' ? payload : payload?.input || payload?.text;
				if (userText) {
					loadedMessages.push({
						role: 'user',
						text: userText,
						timestamp: new SvelteDate(entry.timestamp || Date.now()),
						id: this.nextMessageId()
					});
				}
			}

			// Load AI messages
			if (channel === 'ai:message') {
				const events = payload?.events || [];
				for (const aiEvent of events) {
					const text = aiEvent.properties?.text || aiEvent.data?.text || aiEvent.text;
					if (text) {
						loadedMessages.push({
							role: 'assistant',
							text,
							eventType: aiEvent.type,
							timestamp: new SvelteDate(entry.timestamp || Date.now()),
							id: this.nextMessageId()
						});
					}
				}
			}
		}

		console.log('[AIPaneViewModel] Loaded', loadedMessages.length, 'messages');
		this.messages = loadedMessages;
		this.isCatchingUp = false;
		this.shouldScrollToBottom = true;
	}

	/**
	 * Clear all messages
	 */
	clearMessages() {
		this.messages = [];
	}
}
