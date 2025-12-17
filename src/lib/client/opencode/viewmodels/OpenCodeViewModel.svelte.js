/**
 * OpenCode ViewModel
 * Manages state and business logic for OpenCode chat interface
 * @file src/lib/client/opencode/viewmodels/OpenCodeViewModel.svelte.js
 */

import { createLogger } from '$lib/client/shared/utils/logger.js';

const log = createLogger('opencode-viewmodel');

export class OpenCodeViewModel {
	// Props
	sessionId = $state(null);
	opencodeSessionId = $state(null);

	// UI State
	input = $state('');
	messages = $state([]);
	loading = $state(false);
	isAttached = $state(false);
	isMobile = $state(false);
	isWaitingForReply = $state(false);
	shouldScrollToBottom = $state(false);
	connectionError = $state(null);
	status = $state('idle'); // idle, working, error

	// Activity tracking
	runningActivities = $state([]);
	allActivities = $state([]);

	// Event tracking
	processedEventSeqs = $state(new Set());
	messageSequence = 0;
	toolSequence = 0;

	constructor({ sessionId, opencodeSessionId } = {}) {
		this.sessionId = sessionId;
		this.opencodeSessionId = opencodeSessionId;
	}

	/**
	 * Generate unique message ID
	 */
	nextMessageId() {
		this.messageSequence = (this.messageSequence + 1) % Number.MAX_SAFE_INTEGER;
		return `msg-${Date.now()}-${this.messageSequence}`;
	}

	/**
	 * Generate unique tool activity ID
	 */
	nextToolId() {
		this.toolSequence = (this.toolSequence + 1) % Number.MAX_SAFE_INTEGER;
		return `tool-${Date.now()}-${this.toolSequence}`;
	}

	/**
	 * Handle incoming Socket.IO events
	 */
	handleRunEvent(event) {
		// Detailed logging to diagnose message display issues
		console.log('[OpenCodeViewModel] Event received:', {
			channel: event.channel,
			type: event.type,
			seq: event.seq,
			payload: event.payload
		});

		// Deduplication by sequence number
		if (event.seq !== undefined && this.processedEventSeqs.has(event.seq)) {
			log.debug('[OpenCodeViewModel] Skipping duplicate event:', event.seq);
			return;
		}

		const { channel, type, payload } = event;

		// Handle AI messages (OpenCode uses AI adapter)
		if (channel === 'ai:message') {
			console.log('[OpenCodeViewModel] Processing AI message, events:', payload?.events);
			this.handleAIMessage(payload);
		}
		// Handle AI errors
		else if (channel === 'ai:error') {
			this.handleAIError(payload);
		}
		// Handle system input (for history replay)
		else if (channel === 'system:input') {
			// User message from history replay - add to messages if not already present
			// Payload can be: { data: input }, { input: text }, { text: text }, or raw string
			const inputText = typeof payload === 'string'
				? payload
				: payload?.data || payload?.input || payload?.text;

			console.log('[OpenCodeViewModel] system:input event:', { payload, extractedText: inputText });

			if (inputText && typeof inputText === 'string') {
				// Check if this message already exists (avoid duplicates)
				const exists = this.messages.some(
					(m) => m.role === 'user' && m.text === inputText
				);
				if (!exists) {
					this.messages = [
						...this.messages,
						{
							id: this.nextMessageId(),
							role: 'user',
							text: inputText,
							timestamp: Date.now()
						}
					];
					this.shouldScrollToBottom = true;
					console.log('[OpenCodeViewModel] Added user message from history:', inputText.substring(0, 50));
				}
			}
		}

		// Track processed events
		if (event.seq !== undefined) {
			this.processedEventSeqs.add(event.seq);
		}
	}

	/**
	 * Handle AI message events
	 */
	handleAIMessage(payload) {
		const events = payload?.events || [];

		for (const aiEvent of events) {
			this.processAIEvent(aiEvent);
		}
	}

	/**
	 * Process a single AI event
	 */
	processAIEvent(aiEvent) {
		const eventType = aiEvent.type || 'unknown';
		const properties = aiEvent.properties || {};

		console.log('[OpenCodeViewModel] Processing AI event:', {
			eventType,
			hasProperties: !!properties,
			fullEvent: aiEvent
		});

		// Handle tool use start
		if (eventType === 'tool_use' || eventType === 'content_block_start') {
			const toolName = properties.name || aiEvent.name || 'unknown';
			const toolUseId = properties.id || aiEvent.id || this.nextToolId();

			// Extract tool-specific info
			let summary = toolName;
			const input = properties.input || aiEvent.input || {};

			if (toolName === 'Bash' || toolName === 'bash') {
				const command = input.command || input.cmd;
				summary = command ? `$ ${command.slice(0, 40)}...` : 'Running command';
			} else if (toolName === 'Read' || toolName === 'Write' || toolName === 'Edit') {
				const filePath = input.file_path || input.path || input.filePath;
				summary = filePath ? filePath.split('/').pop() : toolName;
			} else if (toolName === 'Glob') {
				summary = input.pattern || 'Finding files';
			} else if (toolName === 'Grep') {
				summary = input.pattern || 'Searching';
			}

			// Create activity
			const activity = {
				id: toolUseId,
				tool: toolName,
				status: 'running',
				summary,
				startTime: Date.now()
			};

			// Add to running activities
			this.runningActivities = [...this.runningActivities, activity];
			this.allActivities = [...this.allActivities, activity];
			this.status = 'working';

			// Add tool message to chat
			const toolMessage = {
				id: this.nextMessageId(),
				role: 'tool',
				text: summary,
				toolData: { ...activity },
				timestamp: Date.now()
			};
			this.messages = [...this.messages, toolMessage];
			this.shouldScrollToBottom = true;
		}

		// Handle tool result (completion)
		if (eventType === 'tool_result' || eventType === 'content_block_stop') {
			const toolUseId = properties.tool_use_id || properties.id || aiEvent.id;
			const isError = properties.is_error || properties.error;

			// Remove from running activities
			this.runningActivities = this.runningActivities.filter((a) => a.id !== toolUseId);

			// Update activity status
			const activityIndex = this.allActivities.findIndex((a) => a.id === toolUseId);
			if (activityIndex !== -1) {
				const updatedActivities = [...this.allActivities];
				updatedActivities[activityIndex] = {
					...updatedActivities[activityIndex],
					status: isError ? 'error' : 'completed',
					endTime: Date.now()
				};
				this.allActivities = updatedActivities;
			}

			// Update tool message
			const msgIndex = this.messages.findIndex(
				(m) => m.role === 'tool' && m.toolData?.id === toolUseId
			);
			if (msgIndex !== -1) {
				const updatedMessages = [...this.messages];
				updatedMessages[msgIndex] = {
					...updatedMessages[msgIndex],
					toolData: {
						...updatedMessages[msgIndex].toolData,
						status: isError ? 'error' : 'completed',
						endTime: Date.now()
					}
				};
				this.messages = updatedMessages;
			}

			// Update status
			if (this.runningActivities.length === 0) {
				this.status = 'idle';
			}
		}

		// Handle text content (assistant response)
		// OpenCode SDK uses message.part.updated events with text in properties.part.text
		// Only process message.part.updated if the part type is "text"
		const isTextPartUpdate =
			eventType === 'message.part.updated' && properties.part?.type === 'text';
		const isOtherTextEvent =
			eventType === 'message.delta' ||
			eventType === 'text' ||
			eventType === 'text_delta' ||
			eventType === 'content_block_delta';

		if (isTextPartUpdate || isOtherTextEvent) {
			// Extract text from OpenCode event structure
			const text =
				properties.part?.text || // OpenCode: message.part.updated with type=text
				properties.delta || // OpenCode: incremental delta
				properties.text ||
				aiEvent.text ||
				aiEvent.delta?.text ||
				aiEvent.data?.text;

			console.log('[OpenCodeViewModel] Text event matched:', {
				eventType,
				extractedText: text,
				partText: properties.part?.text,
				delta: properties.delta,
				propertiesText: properties.text,
				aiEventText: aiEvent.text
			});

			if (text) {
				// Check if we should append to last assistant message
				const lastMessage = this.messages[this.messages.length - 1];

				// For message.part.updated, replace the entire message with the full text
				if (eventType === 'message.part.updated' && lastMessage?.role === 'assistant' && lastMessage.streaming) {
					// Replace entire message text (part.text contains full text, not delta)
					lastMessage.text = text;
					console.log('[OpenCodeViewModel] Updated full message text:', text.substring(0, 100) + '...');
					// Trigger reactivity
					this.messages = [...this.messages];
				} else if (lastMessage?.role === 'assistant' && lastMessage.streaming) {
					// Append to existing streaming message (for delta events)
					lastMessage.text += text;
					console.log('[OpenCodeViewModel] Appending text to existing message');
					// Trigger reactivity
					this.messages = [...this.messages];
				} else {
					// Create new assistant message
					console.log('[OpenCodeViewModel] Creating new assistant message with text:', text.substring(0, 100) + '...');
					this.messages = [
						...this.messages,
						{
							id: this.nextMessageId(),
							role: 'assistant',
							text: text,
							streaming: true,
							timestamp: Date.now()
						}
					];
				}
				this.shouldScrollToBottom = true;
			} else {
				console.warn('[OpenCodeViewModel] Text event matched but no text extracted!', aiEvent);
			}
		}

		// Handle message completion
		if (eventType === 'message.stop' || eventType === 'message_stop') {
			// Finalize streaming message
			const lastMessage = this.messages[this.messages.length - 1];
			if (lastMessage && lastMessage.streaming) {
				lastMessage.streaming = false;
				// Trigger reactivity
				this.messages = [...this.messages];
			}
			this.isWaitingForReply = false;
			this.status = 'idle';
		}

		// Handle session status updates
		if (eventType === 'session.status') {
			const sessionStatus = properties.status?.type;
			if (sessionStatus === 'idle') {
				this.isWaitingForReply = false;
				this.status = 'idle';

				// Finalize streaming message if any
				const lastMessage = this.messages[this.messages.length - 1];
				if (lastMessage && lastMessage.streaming) {
					lastMessage.streaming = false;
					this.messages = [...this.messages];
				}
			} else if (sessionStatus === 'working') {
				this.status = 'working';
			}
		}
	}

	/**
	 * Handle AI error events
	 */
	handleAIError(payload) {
		const errorText = payload?.message || payload?.error || 'An error occurred';

		this.messages = [
			...this.messages,
			{
				id: this.nextMessageId(),
				role: 'error',
				text: errorText,
				timestamp: Date.now()
			}
		];

		this.status = 'error';
		this.isWaitingForReply = false;
		this.shouldScrollToBottom = true;
	}

	/**
	 * Submit user input
	 */
	async submitInput(e) {
		if (e) e.preventDefault();

		const text = this.input.trim();
		if (!text || this.isWaitingForReply) return;

		// Add user message
		this.messages = [
			...this.messages,
			{
				id: this.nextMessageId(),
				role: 'user',
				text: text,
				timestamp: Date.now()
			}
		];

		// Clear input and set waiting state
		this.input = '';
		this.isWaitingForReply = true;
		this.shouldScrollToBottom = true;

		return text;
	}

	/**
	 * Attach to session
	 */
	attach() {
		this.isAttached = true;
		this.loading = false;
	}

	/**
	 * Set mobile state
	 */
	setMobile(isMobile) {
		this.isMobile = isMobile;
	}

	/**
	 * Set connection error
	 */
	setConnectionError(error) {
		this.connectionError = error;
	}

	/**
	 * Computed: Can submit input
	 */
	get canSubmit() {
		return this.input.trim().length > 0 && !this.isWaitingForReply && this.isAttached;
	}
}
