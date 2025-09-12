/**
 * Centralized logging utility with configurable log levels
 * Controlled by DISPATCH_LOG_LEVEL environment variable
 */

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
		case 'DEBUG': return LOG_LEVELS.DEBUG;
		case 'INFO': return LOG_LEVELS.INFO;
		case 'WARN': return LOG_LEVELS.WARN;
		case 'ERROR': return LOG_LEVELS.ERROR;
		case 'NONE': return LOG_LEVELS.NONE;
		default: return LOG_LEVELS.INFO;
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
 * Log at DEBUG level
 * @param {string} component - Component name
 * @param {string} message - Log message  
 * @param {...any} args - Additional arguments
 */
export function debug(component, message, ...args) {
	if (currentLogLevel <= LOG_LEVELS.DEBUG) {
		console.log(...formatLogMessage('DEBUG', component, message, ...args));
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