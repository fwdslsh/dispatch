/**
 * MessageParser.js
 *
 * Pure functions for parsing and normalizing Claude message payloads.
 * Provides a single source of truth for message text extraction logic.
 *
 * All functions are stateless and fully testable.
 */

/**
 * Extract text content from an array of Claude events.
 *
 * Claude events contain message content blocks that may include text.
 * This function iterates through events and extracts all text blocks.
 *
 * @param {Array<Object>} events - Array of Claude event objects
 * @returns {string} Concatenated text from all text blocks
 *
 * @example
 * const events = [
 *   {
 *     message: {
 *       content: [
 *         { type: 'text', text: 'Hello ' },
 *         { type: 'text', text: 'world' }
 *       ]
 *     }
 *   }
 * ];
 * extractTextFromEvents(events); // Returns: 'Hello world'
 */
export function extractTextFromEvents(events) {
	if (!Array.isArray(events)) {
		return '';
	}

	let text = '';

	for (const evt of events) {
		if (evt.message?.content && Array.isArray(evt.message.content)) {
			for (const block of evt.message.content) {
				if (block.type === 'text' && typeof block.text === 'string') {
					text += block.text;
				}
			}
		}
	}

	return text;
}

/**
 * Extract message text from a Claude message payload.
 *
 * Handles multiple payload formats:
 * 1. Structured format with events array (primary)
 * 2. Fallback to direct text/content properties
 *
 * @param {Object} payload - Claude message payload
 * @returns {string} Extracted message text
 *
 * @example
 * // Structured format
 * const payload1 = {
 *   events: [{ message: { content: [{ type: 'text', text: 'Hi' }] } }]
 * };
 * extractMessageText(payload1); // Returns: 'Hi'
 *
 * // Fallback format
 * const payload2 = { text: 'Hello' };
 * extractMessageText(payload2); // Returns: 'Hello'
 */
export function extractMessageText(payload) {
	if (!payload || typeof payload !== 'object') {
		return '';
	}

	// Try structured format with events array first
	if (payload.events && Array.isArray(payload.events)) {
		const text = extractTextFromEvents(payload.events);
		if (text) {
			return text;
		}
	}

	// Fallback to direct properties
	return payload.text || payload.content || '';
}

/**
 * Normalize a raw message object into a standard message structure.
 *
 * Ensures all messages have consistent shape with required fields:
 * - role: 'user' or 'assistant'
 * - text: message content (string)
 * - timestamp: Date object
 * - id: unique identifier
 *
 * @param {Object} rawMessage - Raw message data
 * @param {string} role - Message role ('user' or 'assistant')
 * @param {Function} idGenerator - Function to generate unique message IDs
 * @returns {Object|null} Normalized message or null if invalid
 *
 * @example
 * const raw = { text: 'Hello', timestamp: Date.now() };
 * const normalized = normalizeMessage(raw, 'user', () => 'msg-1');
 * // Returns: { role: 'user', text: 'Hello', timestamp: Date, id: 'msg-1' }
 */
export function normalizeMessage(rawMessage, role, idGenerator) {
	if (!rawMessage || typeof rawMessage !== 'object') {
		return null;
	}

	if (!role || (role !== 'user' && role !== 'assistant')) {
		return null;
	}

	const text = typeof rawMessage.text === 'string' ? rawMessage.text : '';
	if (!text) {
		return null;
	}

	const timestamp = rawMessage.timestamp ? new Date(rawMessage.timestamp) : new Date();

	const id = typeof idGenerator === 'function' ? idGenerator() : `${Date.now()}-${Math.random()}`;

	return {
		role,
		text,
		timestamp,
		id
	};
}

/**
 * Create a message object from extracted text.
 *
 * Convenience function that combines text extraction and normalization.
 * Useful for creating messages directly from payloads.
 *
 * @param {string} text - Message text content
 * @param {string} role - Message role ('user' or 'assistant')
 * @param {Function} idGenerator - Function to generate unique message IDs
 * @param {Date} [timestamp] - Optional timestamp (defaults to now)
 * @returns {Object|null} Message object or null if text is empty
 *
 * @example
 * const msg = createMessage('Hello', 'user', () => 'msg-1');
 * // Returns: { role: 'user', text: 'Hello', timestamp: Date, id: 'msg-1' }
 */
export function createMessage(text, role, idGenerator, timestamp = null) {
	if (!text || typeof text !== 'string') {
		return null;
	}

	if (!role || (role !== 'user' && role !== 'assistant')) {
		return null;
	}

	const id = typeof idGenerator === 'function' ? idGenerator() : `${Date.now()}-${Math.random()}`;

	return {
		role,
		text,
		timestamp: timestamp || new Date(),
		id
	};
}

/**
 * Parse user input message from system:input channel payload.
 *
 * Extracts user text from the standardized system input format.
 * Handles both 'data' and 'text' properties for backward compatibility.
 *
 * @param {Object} payload - System input payload
 * @returns {string} User input text
 *
 * @example
 * const payload = { data: 'User typed this' };
 * parseUserInput(payload); // Returns: 'User typed this'
 */
export function parseUserInput(payload) {
	if (!payload || typeof payload !== 'object') {
		return '';
	}

	return payload.data || payload.text || '';
}

/**
 * Parse error message from error channel payload.
 *
 * Handles multiple error payload formats:
 * 1. Direct error/message properties
 * 2. Nested error in events array
 *
 * @param {Object} payload - Error payload
 * @returns {string} Error message text
 *
 * @example
 * const payload = { error: 'Something went wrong' };
 * parseErrorMessage(payload); // Returns: 'Something went wrong'
 */
export function parseErrorMessage(payload) {
	if (!payload || typeof payload !== 'object') {
		return 'An error occurred';
	}

	// Check direct properties first
	if (payload.error) {
		return String(payload.error);
	}

	if (payload.message) {
		return String(payload.message);
	}

	// Check nested error in events array
	if (payload.events && Array.isArray(payload.events) && payload.events[0]?.error) {
		return String(payload.events[0].error);
	}

	return 'An error occurred';
}
