/**
 * Centralized logging utility with configurable log levels
 * Controlled by DISPATCH_LOG_LEVEL environment variable
 */

import { DatabaseManager } from '../db/DatabaseManager.js';
let _dbManager;
const LOG_LEVELS = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
	NONE: 4
};

const LOG_LEVEL_NAMES = {
	[LOG_LEVELS.DEBUG]: 'DEBUG',
	[LOG_LEVELS.INFO]: 'INFO',
	[LOG_LEVELS.WARN]: 'WARN',
	[LOG_LEVELS.ERROR]: 'ERROR',
	[LOG_LEVELS.NONE]: 'NONE'
};

// Parse log level from environment variable
function parseLogLevel(levelStr) {
	if (!levelStr) return LOG_LEVELS.INFO; // Default to INFO

	const normalized = levelStr.toUpperCase();
	switch (normalized) {
		case 'DEBUG':
			return LOG_LEVELS.DEBUG;
		case 'INFO':
			return LOG_LEVELS.INFO;
		case 'WARN':
			return LOG_LEVELS.WARN;
		case 'ERROR':
			return LOG_LEVELS.ERROR;
		case 'NONE':
			return LOG_LEVELS.NONE;
		default:
			return LOG_LEVELS.INFO;
	}
}

const currentLogLevel = parseLogLevel(process.env.DISPATCH_LOG_LEVEL);

/**
 * Format log message with timestamp and level
 * @param {string} level - Log level name
 * @param {string} component - Component or module name
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 */
function formatLogMessage(level, component, message, ...args) {
	const timestamp = new Date().toISOString();
	const prefix = `[${timestamp}] [${level}] [${component}]`;
	return [prefix, message, ...args];
}

/**
 * Log to database
 * @param {string} level - Log level
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 */

function logToDatabase(level, component, message, args) {
	// Prevent DB logging during Vite build/SSR/static analysis
	// Vite sets VITE_SSR or VITE_BUILD env vars during build/SSR
	if (
		process.env.VITE_SSR === 'true' ||
		process.env.VITE_BUILD === 'true' ||
		process.env.BUILD === 'true'
	) {
		// No-op during build/SSR/test
		return;
	}
	if (!_dbManager) _dbManager = new DatabaseManager();

	_dbManager
		.init()
		.then(() => _dbManager.addLog(level, component, message, args && args.length ? args : null))
		.catch((err) => {
			// Fallback: log DB error to console, but do not throw
			console.error('[LOGGER] Failed to write log to database:', err);
		});
}

/**
 * Log at DEBUG level
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 */

export function debug(component, message, ...args) {
	if (currentLogLevel <= LOG_LEVELS.DEBUG) {
		console.log(...formatLogMessage('DEBUG', component, message, ...args));
		void logToDatabase('DEBUG', component, message, args);
	}
}

/**
 * Log at INFO level
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 */

export function info(component, message, ...args) {
	if (currentLogLevel <= LOG_LEVELS.INFO) {
		console.log(...formatLogMessage('INFO', component, message, ...args));
		void logToDatabase('INFO', component, message, args);
	}
}

/**
 * Log at WARN level
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 */

export function warn(component, message, ...args) {
	if (currentLogLevel <= LOG_LEVELS.WARN) {
		console.warn(...formatLogMessage('WARN', component, message, ...args));
		void logToDatabase('WARN', component, message, args);
	}
}

/**
 * Log at ERROR level
 * @param {string} component - Component name
 * @param {string} message - Log message
 * @param {...any} args - Additional arguments
 */

export function error(component, message, ...args) {
	if (currentLogLevel <= LOG_LEVELS.ERROR) {
		console.error(...formatLogMessage('ERROR', component, message, ...args));
		void logToDatabase('ERROR', component, message, args);
	}
}

/**
 * Get current log level
 * @returns {number} Current log level
 */
export function getLogLevel() {
	return currentLogLevel;
}

/**
 * Get log level name
 * @returns {string} Current log level name
 */
export function getLogLevelName() {
	return LOG_LEVEL_NAMES[currentLogLevel];
}

// Export logger object for convenience
export const logger = {
	debug,
	info,
	warn,
	error,
	getLogLevel,
	getLogLevelName
};
