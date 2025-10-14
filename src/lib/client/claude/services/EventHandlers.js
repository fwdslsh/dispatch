/**
 * EventHandlers.js
 *
 * Event handler strategies for different Claude event types using Strategy Pattern.
 * Each handler is responsible for processing a specific event type and returning
 * action objects that describe state changes (not direct mutations).
 *
 * This separates event routing logic from state management, reducing cyclomatic
 * complexity and improving testability.
 */

import { extractMessageText, parseUserInput, parseErrorMessage } from './MessageParser.js';

/**
 * ClaudeEventHandlers class
 *
 * Implements Strategy Pattern for handling different Claude event types.
 * Each handler method returns an action object describing state changes.
 */
export class ClaudeEventHandlers {
	/**
	 * @param {Object} viewModel - Reference to ClaudePaneViewModel for accessing state
	 */
	constructor(viewModel) {
		this.vm = viewModel;

		// Channel-based handler map (modern format)
		this.channelHandlers = {
			'claude:message': this.handleClaudeMessage.bind(this),
			'claude:error': this.handleClaudeError.bind(this),
			'system:input': this.handleSystemInput.bind(this)
		};

		// Legacy type-based handler map (backward compatibility)
		this.legacyHandlers = {
			'claude:message': this.handleLegacyMessage.bind(this),
			'claude:auth_start': this.handleAuthStart.bind(this),
			'claude:auth_awaiting_code': this.handleAuthAwaitingCode.bind(this),
			'claude:auth_success': this.handleAuthSuccess.bind(this),
			'claude:auth_error': this.handleAuthError.bind(this),
			'claude:tool_use': this.handleLiveEvent.bind(this),
			'claude:tool_result': this.handleLiveEvent.bind(this),
			'claude:thinking': this.handleLiveEvent.bind(this),
			'claude:error': this.handleLegacyError.bind(this)
		};
	}

	/**
	 * Main event router - delegates to appropriate handler
	 * @param {Object} event - Event object with channel, type, and payload
	 * @returns {Object} - Action object describing state changes
	 */
	handleEvent(event) {
		const { channel, type } = event;

		// Try channel-based routing first (modern format)
		const channelHandler = this.channelHandlers[channel];
		if (channelHandler) {
			return channelHandler(event);
		}

		// Fall back to legacy type-based routing
		const legacyHandler = this.legacyHandlers[type];
		if (legacyHandler) {
			return legacyHandler(event);
		}

		console.log('[ClaudeEventHandlers] Unhandled event:', type, channel);
		return { type: 'noop' };
	}

	// ============================================================
	// MODERN CHANNEL-BASED HANDLERS
	// ============================================================

	/**
	 * Handle claude:message channel events
	 */
	handleClaudeMessage(event) {
		const { type, payload } = event;

		switch (type) {
			case 'assistant':
				return this.handleAssistantMessage(payload);
			case 'system':
				console.log('[ClaudeEventHandlers] System init:', payload);
				return { type: 'noop' };
			case 'result':
				return this.handleExecutionResult(payload);
			default:
				console.log('[ClaudeEventHandlers] Unhandled claude:message type:', type);
				return { type: 'noop' };
		}
	}

	/**
	 * Handle assistant message
	 */
	handleAssistantMessage(payload) {
		const messageText = extractMessageText(payload);

		if (!messageText) {
			console.warn('[ClaudeEventHandlers] No text extracted from assistant event');
			return { type: 'noop' };
		}

		console.log('[ClaudeEventHandlers] Processing assistant message:', messageText);

		return {
			type: 'add_message',
			message: {
				role: 'assistant',
				text: messageText,
				timestamp: new Date(),
				id: this.vm.nextMessageId()
			},
			clearWaiting: true,
			scrollToBottom: true
		};
	}

	/**
	 * Handle execution result
	 */
	handleExecutionResult(payload) {
		console.log('[ClaudeEventHandlers] Execution result:', payload);
		return {
			type: 'clear_waiting'
		};
	}

	/**
	 * Handle error channel events
	 */
	handleClaudeError(event) {
		const { payload } = event;
		const errorMessage = parseErrorMessage(payload);

		return {
			type: 'add_error_message',
			message: {
				role: 'assistant',
				text: `Error: ${errorMessage}`,
				timestamp: new Date(),
				id: this.vm.nextMessageId()
			},
			clearWaiting: true,
			setError: errorMessage
		};
	}

	/**
	 * Handle system input events (from history or other clients)
	 * Note: Deduplication is now handled by event sequence tracking in ViewModel
	 */
	handleSystemInput(event) {
		const { payload } = event;
		const userText = parseUserInput(payload);

		if (!userText) return { type: 'noop' };

		// Check for duplicate (last message is same)
		const lastMessage = this.vm.messages[this.vm.messages.length - 1];
		if (lastMessage?.role === 'user' && lastMessage?.text === userText) {
			console.log('[ClaudeEventHandlers] Skipping duplicate user message');
			return { type: 'noop' };
		}

		console.log('[ClaudeEventHandlers] Adding user message from system:input event:', userText);

		return {
			type: 'add_message',
			message: {
				role: 'user',
				text: userText,
				timestamp: new Date(),
				id: this.vm.nextMessageId()
			},
			scrollToBottom: true
		};
	}

	// ============================================================
	// LEGACY TYPE-BASED HANDLERS (Backward Compatibility)
	// ============================================================

	/**
	 * Handle legacy claude:message type
	 */
	handleLegacyMessage(event) {
		const { payload } = event;
		const messageText = payload.text || payload.content || '';

		return {
			type: 'add_message',
			message: {
				role: 'assistant',
				text: messageText,
				timestamp: new Date(),
				id: this.vm.nextMessageId()
			},
			clearWaiting: true,
			scrollToBottom: true
		};
	}

	/**
	 * Handle authentication start
	 */
	handleAuthStart(_event) {
		const { payload } = _event;
		const authUrl = payload.url || '';

		// Delegate to AuthenticationManager and get message
		const authResult = this.vm.authManager.handleAuthStart(authUrl);

		return {
			type: 'add_message',
			message: {
				role: authResult.role,
				text: authResult.message,
				timestamp: new Date(),
				id: this.vm.nextMessageId()
			},
			scrollToBottom: true
		};
	}

	/**
	 * Handle awaiting authorization code
	 */
	handleAuthAwaitingCode(_event) {
		// Delegate to AuthenticationManager and get message
		const authResult = this.vm.authManager.handleAuthAwaitingCode();

		return {
			type: 'add_message',
			message: {
				role: authResult.role,
				text: authResult.message,
				timestamp: new Date(),
				id: this.vm.nextMessageId()
			},
			scrollToBottom: true
		};
	}

	/**
	 * Handle authentication success
	 */
	handleAuthSuccess(_event) {
		// Delegate to AuthenticationManager and get message
		const authResult = this.vm.authManager.handleAuthSuccess();

		return {
			type: 'add_message',
			message: {
				role: authResult.role,
				text: authResult.message,
				timestamp: new Date(),
				id: this.vm.nextMessageId()
			},
			scrollToBottom: true
		};
	}

	/**
	 * Handle authentication error
	 */
	handleAuthError(event) {
		const { payload } = event;
		const errorMsg = payload.error || 'Authentication failed';

		// Delegate to AuthenticationManager and get message
		const authResult = this.vm.authManager.handleAuthError(errorMsg);

		return {
			type: 'add_error_message',
			message: {
				role: authResult.role,
				text: authResult.message,
				timestamp: new Date(),
				id: this.vm.nextMessageId()
			},
			setError: errorMsg,
			scrollToBottom: true
		};
	}

	/**
	 * Handle live events (tool_use, tool_result, thinking)
	 */
	handleLiveEvent(event) {
		return {
			type: 'add_live_icon',
			icon: {
				type: event.type,
				timestamp: Date.now(),
				id: this.vm.nextMessageId()
			}
		};
	}

	/**
	 * Handle legacy error format
	 */
	handleLegacyError(event) {
		const { payload } = event;
		const errorMsg = parseErrorMessage(payload);

		return {
			type: 'add_error_message',
			message: {
				role: 'assistant',
				text: `Error: ${errorMsg}`,
				timestamp: new Date(),
				id: this.vm.nextMessageId()
			},
			clearWaiting: true,
			setError: errorMsg,
			scrollToBottom: true
		};
	}
}
