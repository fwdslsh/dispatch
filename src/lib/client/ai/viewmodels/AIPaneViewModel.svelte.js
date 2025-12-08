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
 * - Tracks tool activities for mobile-friendly display
 *
 * @file src/lib/client/ai/viewmodels/AIPaneViewModel.svelte.js
 */

import { SvelteSet, SvelteMap, SvelteDate } from 'svelte/reactivity';
import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';

/**
 * @typedef {Object} Message
 * @property {string} id - Unique message ID
 * @property {'user'|'assistant'|'system'|'error'|'tool'} role - Message role
 * @property {string} text - Message text content
 * @property {string} [eventType] - Original event type
 * @property {Date} timestamp - Message timestamp
 * @property {Object} [toolData] - Tool-specific data for tool messages
 */

/**
 * @typedef {Object} ToolActivity
 * @property {string} id - Unique activity ID
 * @property {string} tool - Tool name (Bash, Read, Write, etc.)
 * @property {'running'|'completed'|'error'} status - Activity status
 * @property {string} [summary] - Brief description
 * @property {string} [filePath] - File path for file operations
 * @property {string} [command] - Command for bash operations
 * @property {number} startTime - Start timestamp
 * @property {number} [endTime] - End timestamp
 */

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

	// Tool activity tracking
	/** @type {Map<string, ToolActivity>} */
	toolActivities = $state(new SvelteMap());
	toolSequence = 0;

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

	// Derived: Current running activities for ActivityStrip
	runningActivities = $derived.by(() => {
		return Array.from(this.toolActivities.values())
			.filter((a) => a.status === 'running')
			.sort((a, b) => a.startTime - b.startTime);
	});

	// Derived: All activities for display
	allActivities = $derived.by(() => {
		return Array.from(this.toolActivities.values()).sort((a, b) => a.startTime - b.startTime);
	});

	// Derived status
	status = $derived.by(() => {
		if (this.connectionError) return 'connection-error';
		if (this.loading) return 'loading';
		if (this.isCatchingUp) return 'catching-up';
		if (this.runningActivities.length > 0) return 'working';
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
		return `msg-${Date.now()}-${this.messageSequence}`;
	}

	/**
	 * Generate unique tool activity ID
	 * @returns {string}
	 */
	nextToolId() {
		this.toolSequence = (this.toolSequence + 1) % Number.MAX_SAFE_INTEGER;
		return `tool-${Date.now()}-${this.toolSequence}`;
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

		// Clear previous tool activities for new turn
		this.toolActivities = new SvelteMap();

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
			// User message - already displayed when sent
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
			this.processAIEvent(aiEvent);
		}
	}

	/**
	 * Process a single AI event
	 * @param {Object} aiEvent
	 */
	processAIEvent(aiEvent) {
		const eventType = aiEvent.type || 'unknown';
		const properties = aiEvent.properties || {};

		// Handle tool use start
		if (eventType === 'tool_use' || eventType === 'content_block_start') {
			const toolName = properties.name || aiEvent.name || 'unknown';
			const toolUseId = properties.id || aiEvent.id || this.nextToolId();

			// Extract tool-specific info
			let filePath = null;
			let command = null;
			let summary = toolName;

			const input = properties.input || aiEvent.input || {};

			if (toolName === 'Bash' || toolName === 'bash') {
				command = input.command || input.cmd;
				summary = command ? `$ ${command.slice(0, 40)}...` : 'Running command';
			} else if (
				toolName === 'Read' ||
				toolName === 'read' ||
				toolName === 'Write' ||
				toolName === 'write'
			) {
				filePath = input.file_path || input.path || input.filePath;
				summary = filePath ? filePath.split('/').pop() : toolName;
			} else if (toolName === 'Edit' || toolName === 'edit') {
				filePath = input.file_path || input.path || input.filePath;
				summary = filePath ? `Editing ${filePath.split('/').pop()}` : 'Editing file';
			} else if (toolName === 'Glob' || toolName === 'glob') {
				summary = input.pattern || 'Finding files';
			} else if (toolName === 'Grep' || toolName === 'grep') {
				summary = input.pattern || 'Searching';
			}

			// Create activity
			const activity = {
				id: toolUseId,
				tool: toolName,
				status: 'running',
				summary,
				filePath,
				command,
				startTime: Date.now()
			};

			// Add to activities map
			const newMap = new SvelteMap(this.toolActivities);
			newMap.set(toolUseId, activity);
			this.toolActivities = newMap;

			// Add tool message to chat
			const toolMessage = {
				role: 'tool',
				text: summary,
				toolData: { ...activity },
				timestamp: new SvelteDate(),
				id: this.nextMessageId()
			};
			this.messages = [...this.messages, toolMessage];
			this.shouldScrollToBottom = true;
		}

		// Handle tool result (completion)
		if (eventType === 'tool_result' || eventType === 'content_block_stop') {
			const toolUseId = properties.tool_use_id || properties.id || aiEvent.id;
			const isError = properties.is_error || properties.error;

			if (toolUseId && this.toolActivities.has(toolUseId)) {
				const newMap = new SvelteMap(this.toolActivities);
				const activity = { ...newMap.get(toolUseId) };
				activity.status = isError ? 'error' : 'completed';
				activity.endTime = Date.now();
				newMap.set(toolUseId, activity);
				this.toolActivities = newMap;

				// Update the tool message status
				const msgIndex = this.messages.findIndex(
					(m) => m.role === 'tool' && m.toolData?.id === toolUseId
				);
				if (msgIndex !== -1) {
					const updatedMessages = [...this.messages];
					updatedMessages[msgIndex] = {
						...updatedMessages[msgIndex],
						toolData: { ...activity }
					};
					this.messages = updatedMessages;
				}
			}
		}

		// Handle text content (assistant response)
		if (
			eventType === 'message.delta' ||
			eventType === 'text' ||
			eventType === 'text_delta' ||
			eventType === 'content_block_delta'
		) {
			const text =
				properties.text || aiEvent.text || aiEvent.delta?.text || aiEvent.data?.text;

			if (text) {
				// Check if we should append to last assistant message
				const lastMessage = this.messages[this.messages.length - 1];
				if (lastMessage?.role === 'assistant' && lastMessage.streaming) {
					// Append to streaming message
					const updatedMessages = [...this.messages];
					updatedMessages[updatedMessages.length - 1] = {
						...lastMessage,
						text: lastMessage.text + text
					};
					this.messages = updatedMessages;
				} else {
					// Create new streaming message
					const message = {
						role: 'assistant',
						text,
						streaming: true,
						eventType,
						timestamp: new SvelteDate(),
						id: this.nextMessageId()
					};
					this.messages = [...this.messages, message];
				}
				this.shouldScrollToBottom = true;
			}
		}

		// Handle complete assistant message
		if (eventType === 'assistant' || eventType === 'message') {
			const content = properties.content || aiEvent.content || aiEvent.data?.content;

			if (content) {
				// Mark last streaming message as complete if exists
				const lastMessage = this.messages[this.messages.length - 1];
				if (lastMessage?.streaming) {
					const updatedMessages = [...this.messages];
					updatedMessages[updatedMessages.length - 1] = {
						...lastMessage,
						streaming: false
					};
					this.messages = updatedMessages;
				} else {
					const message = {
						role: 'assistant',
						text: content,
						eventType,
						timestamp: new SvelteDate(),
						id: this.nextMessageId()
					};
					this.messages = [...this.messages, message];
				}
				this.shouldScrollToBottom = true;
			}
		}

		// Handle message stop/complete
		if (eventType === 'message_stop' || eventType === 'message.stop') {
			// Mark all running tools as completed
			const newMap = new SvelteMap();
			for (const [id, activity] of this.toolActivities) {
				if (activity.status === 'running') {
					newMap.set(id, { ...activity, status: 'completed', endTime: Date.now() });
				} else {
					newMap.set(id, activity);
				}
			}
			this.toolActivities = newMap;

			// Mark last streaming message as complete
			const lastMessage = this.messages[this.messages.length - 1];
			if (lastMessage?.streaming) {
				const updatedMessages = [...this.messages];
				updatedMessages[updatedMessages.length - 1] = {
					...lastMessage,
					streaming: false
				};
				this.messages = updatedMessages;
			}
		}

		// Check for session completion
		if (eventType === 'session.idle' || eventType === 'session.completed') {
			this.isWaitingForReply = false;
			this.isCatchingUp = false;

			// Mark all tools complete
			const newMap = new SvelteMap();
			for (const [id, activity] of this.toolActivities) {
				if (activity.status === 'running') {
					newMap.set(id, { ...activity, status: 'completed', endTime: Date.now() });
				} else {
					newMap.set(id, activity);
				}
			}
			this.toolActivities = newMap;
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

		// Mark all running tools as errored
		const newMap = new SvelteMap();
		for (const [id, activity] of this.toolActivities) {
			if (activity.status === 'running') {
				newMap.set(id, { ...activity, status: 'error', endTime: Date.now() });
			} else {
				newMap.set(id, activity);
			}
		}
		this.toolActivities = newMap;

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
				const userText =
					typeof payload === 'string' ? payload : payload?.input || payload?.text;
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
					const text =
						aiEvent.properties?.text || aiEvent.data?.text || aiEvent.text;
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
		this.toolActivities = new SvelteMap();
	}
}
