/**
 * Data manipulation utilities to simplify common patterns
 *
 * Provides standardized patterns for data cloning and sanitization
 * following SOLID principles while maintaining simplicity.
 */

/**
 * Safely clone data using structuredClone if available, fallback to JSON
 * @param {any} data - Data to clone
 * @returns {any} Cloned data or null if cloning fails
 */
export function safeClone(data) {
	if (data === null || data === undefined) {
		return null;
	}

	// Preserve primitives as-is
	const type = typeof data;
	if (type === 'string' || type === 'number' || type === 'boolean') {
		return data;
	}

	// Handle non-serializable types
	if (type === 'function') return '[non-serializable:function]';
	if (type === 'symbol') return '[non-serializable:symbol]';

	try {
		// Prefer structuredClone when available
		if (typeof globalThis.structuredClone === 'function') {
			return structuredClone(data);
		} else {
			const serialized = JSON.stringify(data);
			return typeof serialized === 'string' ? JSON.parse(serialized) : null;
		}
	} catch {
		return null;
	}
}

/**
 * Sanitize data by removing sensitive fields
 * @param {any} data - Data to sanitize
 * @param {Array<string>} sensitiveFields - Fields to redact
 * @returns {any} Sanitized data
 */
export function sanitizeData(data, sensitiveFields = ['key', 'password', 'token']) {
	const cloned = safeClone(data);

	if (cloned && typeof cloned === 'object') {
		for (const field of sensitiveFields) {
			if (cloned[field]) {
				cloned[field] = '[REDACTED]';
			}
		}
	}

	return cloned;
}

/**
 * Check if data is safe for logging (not sensitive)
 * @param {string} eventType - Event type to check
 * @param {Array<string>} sensitiveEvents - Event types that contain sensitive data
 * @returns {boolean} True if safe to log
 */
export function isSafeForLogging(eventType, sensitiveEvents = ['key', 'auth', 'login', 'password']) {
	return !sensitiveEvents.some(sensitive => eventType.toLowerCase().includes(sensitive));
}