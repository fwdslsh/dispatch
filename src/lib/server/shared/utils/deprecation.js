/**
 * Deprecation Warning Utility
 * Provides standardized deprecation warnings for obsolete code
 */

import { logger } from './logger.js';

/**
 * Track which deprecation warnings have been shown (to avoid spam)
 * @type {Set<string>}
 */
const shownWarnings = new Set();

/**
 * Show deprecation warning for obsolete code
 * @param {Object} options - Warning options
 * @param {string} options.name - Name of deprecated feature
 * @param {string} options.alternative - Recommended alternative
 * @param {string} [options.version] - Version when deprecated
 * @param {string} [options.removalVersion] - Version when feature will be removed
 * @param {string} [options.reason] - Reason for deprecation
 * @param {boolean} [options.once=true] - Show warning only once
 */
export function deprecationWarning({
	name,
	alternative,
	version,
	removalVersion,
	reason,
	once = true
}) {
	const warningKey = `${name}:${alternative}`;

	// Skip if already shown and once=true
	if (once && shownWarnings.has(warningKey)) {
		return;
	}

	let message = `⚠️  DEPRECATED: ${name}`;

	if (version) {
		message += ` (deprecated in v${version})`;
	}

	if (reason) {
		message += `\n   Reason: ${reason}`;
	}

	message += `\n   Use instead: ${alternative}`;

	if (removalVersion) {
		message += `\n   Will be removed in: v${removalVersion}`;
	}

	logger.warn('DEPRECATION', message);

	if (once) {
		shownWarnings.add(warningKey);
	}
}

/**
 * Mark function as deprecated with runtime warning
 * @param {Function} fn - Function to wrap
 * @param {Object} options - Deprecation options
 * @returns {Function} Wrapped function that shows deprecation warning
 */
export function deprecated(fn, options) {
	return function (...args) {
		deprecationWarning(options);
		return fn.apply(this, args);
	};
}

/**
 * Check if code is running in development mode
 * @returns {boolean} True if in development
 */
export function isDevelopment() {
	return process.env.NODE_ENV !== 'production';
}

/**
 * Only show deprecation warning in development
 * @param {Object} options - Warning options
 */
export function devOnlyDeprecationWarning(options) {
	if (isDevelopment()) {
		deprecationWarning(options);
	}
}

/**
 * Clear all shown warnings (useful for testing)
 */
export function clearDeprecationWarnings() {
	shownWarnings.clear();
}
