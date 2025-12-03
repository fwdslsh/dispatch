/**
 * Session ID utilities for application-managed session identification
 * Decouples workspace session management from session type-specific IDs
 */

import { randomUUID } from 'node:crypto';

/**
 * SessionId Value Object
 * Encapsulates session ID generation and validation logic
 * Format: {kind}-{timestamp}-{nonce}
 */
export class SessionId {
	/**
	 * Create a new SessionId
	 * @param {string} kind - Session type/kind (e.g., 'pty', 'claude', 'file-editor')
	 * @param {number} [timestamp] - Optional timestamp (defaults to Date.now())
	 * @param {string} [nonce] - Optional nonce (defaults to random string)
	 */
	constructor(kind, timestamp = Date.now(), nonce = null) {
		if (!kind || typeof kind !== 'string') {
			throw new Error('Session kind is required and must be a string');
		}

		this.kind = kind;
		this.timestamp = timestamp;
		this.nonce = nonce || Math.random().toString(36).substr(2, 9);
	}

	/**
	 * Generate the string representation of this SessionId
	 * @returns {string} Session ID in format: {kind}-{timestamp}-{nonce}
	 */
	toString() {
		return `${this.kind}-${this.timestamp}-${this.nonce}`;
	}

	/**
	 * Get the string value (alias for toString())
	 * @returns {string} Session ID string
	 */
	getValue() {
		return this.toString();
	}

	/**
	 * Parse a session ID string into a SessionId object
	 * @param {string} id - Session ID string to parse
	 * @returns {SessionId|null} Parsed SessionId or null if invalid
	 */
	static parse(id) {
		if (typeof id !== 'string') return null;

		const parts = id.split('-');
		if (parts.length < 3) return null;

		const kind = parts[0];
		const timestamp = parseInt(parts[1], 10);
		const nonce = parts.slice(2).join('-'); // Handle nonces that might contain dashes

		if (!kind || isNaN(timestamp)) return null;

		return new SessionId(kind, timestamp, nonce);
	}

	/**
	 * Validate if a string is a valid session ID
	 * @param {string} id - ID to validate
	 * @returns {boolean} True if valid session ID format
	 */
	static isValid(id) {
		return SessionId.parse(id) !== null;
	}

	/**
	 * Create a new session ID for a given kind
	 * @param {string} kind - Session type/kind
	 * @returns {SessionId} New SessionId instance
	 */
	static create(kind) {
		return new SessionId(kind);
	}
}

/**
 * Generate a new application-managed session ID
 * @returns {string} A UUID v4 string
 */
export function generateSessionId() {
	return randomUUID();
}

/**
 * Validate if a string is a valid session ID (UUID format)
 * @param {string} id - The ID to validate
 * @returns {boolean} True if valid UUID format
 */
export function isValidSessionId(id) {
	if (typeof id !== 'string') return false;
	// UUID v4 regex pattern
	const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidPattern.test(id);
}

/**
 * Create session descriptor for a specific session type
 * @param {string} type - Session type ('claude', 'pty', etc.)
 * @param {string} typeSpecificId - The ID used by the session type implementation
 * @param {object} [additionalFields={}] - Additional fields for the session descriptor
 * @returns {object} Session descriptor object
 */
export function createSessionDescriptor(type, typeSpecificId, additionalFields = {}) {
	if (!type || typeof type !== 'string') {
		throw new Error('Session type is required and must be a string');
	}

	// Allow missing/unknown type-specific IDs (e.g., fresh Claude sessions);
	// store as empty string to keep schema simple and update later.
	const safeTypeSpecificId = typeof typeSpecificId === 'string' ? typeSpecificId : '';

	return {
		type,
		typeSpecificId: safeTypeSpecificId,
		createdAt: Date.now(),
		...additionalFields
	};
}

/**
 * Extract type-specific ID from session descriptor
 * @param {object} sessionDescriptor - Session descriptor object
 * @returns {string|null} Type-specific ID or null if not found
 */
export function getTypeSpecificId(sessionDescriptor) {
	return sessionDescriptor?.typeSpecificId || null;
}

/**
 * Get session type from session descriptor
 * @param {object} sessionDescriptor - Session descriptor object
 * @returns {string|null} Session type or null if not found
 */
export function getSessionType(sessionDescriptor) {
	return sessionDescriptor?.type || null;
}
