/**
 * Session ID utilities for application-managed session identification
 * Decouples workspace session management from session type-specific IDs
 */

import { randomUUID } from 'node:crypto';

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
	
	if (!typeSpecificId || typeof typeSpecificId !== 'string') {
		throw new Error('Type-specific ID is required and must be a string');
	}
	
	return {
		type,
		typeSpecificId,
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