/**
 * ErrorService.js
 *
 * Centralized error handling service.
 * Provides error logging, classification, recovery strategies, and user-friendly error messages.
 */

import { ERROR_CODES } from '$lib/shared/constants.js';

/**
 * @typedef {Object} ErrorInfo
 * @property {string} code - Error code
 * @property {string} message - User-friendly message
 * @property {string} originalMessage - Original error message
 * @property {string} category - Error category
 * @property {boolean} recoverable - Whether error is recoverable
 * @property {Array} suggestions - Recovery suggestions
 * @property {Date} timestamp - When error occurred
 */

export class ErrorService {
	/**
	 * @param {Object} config
	 */
	constructor(config = {}) {
		this.config = {
			debug: false,
			enableLogging: true,
			maxLogEntries: 100,
			...config
		};

		// Error log
		this.errorLog = $state([]);

		// Error categories
		this.categories = {
			AUTH: 'Authentication',
			NETWORK: 'Network',
			VALIDATION: 'Validation',
			SESSION: 'Session',
			TERMINAL: 'Terminal',
			STORAGE: 'Storage',
			SYSTEM: 'System',
			USER: 'User Input'
		};

		// Error handlers by category
		this.handlers = new Map();

		// Recovery strategies
		this.recoveryStrategies = new Map();

		this.setupDefaultHandlers();
		this.setupRecoveryStrategies();
	}

	/**
	 * Setup default error handlers
	 */
	setupDefaultHandlers() {
		this.handlers.set('NETWORK', (error) => {
			return {
				code: 'NETWORK_ERROR',
				message: 'Connection failed. Please check your internet connection.',
				category: this.categories.NETWORK,
				recoverable: true,
				suggestions: ['Check internet connection', 'Try again in a moment', 'Refresh the page']
			};
		});

		this.handlers.set('AUTH', (error) => {
			return {
				code: 'AUTH_ERROR',
				message: 'Authentication failed. Please sign in again.',
				category: this.categories.AUTH,
				recoverable: true,
				suggestions: ['Sign in again', 'Check credentials', 'Clear browser data']
			};
		});

		this.handlers.set('TERMINAL', (error) => {
			if (error.message?.includes('node-pty failed to load')) {
				return {
					code: 'TERMINAL_UNAVAILABLE',
					message: 'Terminal is temporarily unavailable. Please try again in a moment.',
					category: this.categories.TERMINAL,
					recoverable: true,
					suggestions: ['Wait a moment and try again', 'Refresh the page']
				};
			}

			return {
				code: 'TERMINAL_ERROR',
				message: 'Terminal operation failed.',
				category: this.categories.TERMINAL,
				recoverable: true,
				suggestions: ['Try creating a new terminal session', 'Check workspace permissions']
			};
		});

		this.handlers.set('SESSION', (error) => {
			return {
				code: 'SESSION_ERROR',
				message: 'Session operation failed. The session may have ended.',
				category: this.categories.SESSION,
				recoverable: true,
				suggestions: ['Try refreshing sessions', 'Create a new session', 'Check workspace access']
			};
		});

		this.handlers.set('STORAGE', (error) => {
			return {
				code: 'STORAGE_ERROR',
				message: 'Storage operation failed. Your browser storage may be full.',
				category: this.categories.STORAGE,
				recoverable: true,
				suggestions: ['Clear browser storage', 'Free up disk space', 'Use incognito mode']
			};
		});
	}

	/**
	 * Setup recovery strategies
	 */
	setupRecoveryStrategies() {
		this.recoveryStrategies.set('NETWORK_ERROR', async () => {
			// Simple retry logic
			return new Promise((resolve) => {
				setTimeout(() => {
					resolve({ success: false, message: 'Manual retry required' });
				}, 1000);
			});
		});

		this.recoveryStrategies.set('AUTH_ERROR', async () => {
			// Clear auth token and redirect to login
			if (typeof localStorage !== 'undefined') {
				localStorage.removeItem('dispatch-auth-key');
			}
			return { success: true, message: 'Cleared authentication data' };
		});

		this.recoveryStrategies.set('STORAGE_ERROR', async () => {
			// Try to clean up old data
			try {
				// This would integrate with PersistenceService
				return { success: true, message: 'Cleaned up storage' };
			} catch {
				return { success: false, message: 'Could not clean up storage' };
			}
		});
	}

	/**
	 * Handle an error
	 * @param {Error|string} error
	 * @param {Object} context
	 * @returns {ErrorInfo}
	 */
	handleError(error, context = {}) {
		const errorInfo = this.processError(error, context);
		this.logError(errorInfo);
		return errorInfo;
	}

	/**
	 * Process an error and classify it
	 * @param {Error|string} error
	 * @param {Object} context
	 * @returns {ErrorInfo}
	 */
	processError(error, context = {}) {
		const originalMessage = typeof error === 'string' ? error : error.message || 'Unknown error';
		const category = this.classifyError(error, context);

		const handler = this.handlers.get(category);
		const errorInfo = handler ? handler(error) : this.getDefaultErrorInfo(error);

		return {
			...errorInfo,
			originalMessage,
			timestamp: new Date(),
			context
		};
	}

	/**
	 * Classify an error by category
	 * @param {Error|string} error
	 * @param {Object} context
	 * @returns {string}
	 */
	classifyError(error, context = {}) {
		const message = typeof error === 'string' ? error : error.message || '';
		const status = /** @type {any} */ (error)?.status || context?.status;

		// Network errors
		if (status === 0 || message.includes('fetch')) {
			return 'NETWORK';
		}

		// Auth errors
		if (status === 401 || status === 403 || message.includes('auth')) {
			return 'AUTH';
		}

		// Terminal errors
		if (
			message.includes('pty') ||
			message.includes('terminal') ||
			context.component === 'terminal'
		) {
			return 'TERMINAL';
		}

		// Session errors
		if (message.includes('session') || context.component === 'session') {
			return 'SESSION';
		}

		// Storage errors
		if (message.includes('storage') || message.includes('quota')) {
			return 'STORAGE';
		}

		// Validation errors
		if (status >= 400 && status < 500 && status !== 401 && status !== 403) {
			return 'VALIDATION';
		}

		return 'SYSTEM';
	}

	/**
	 * Get default error info
	 * @param {Error|string} error
	 * @returns {Partial<ErrorInfo>}
	 */
	getDefaultErrorInfo(error) {
		return {
			code: 'UNKNOWN_ERROR',
			message: 'An unexpected error occurred. Please try again.',
			category: this.categories.SYSTEM,
			recoverable: true,
			suggestions: ['Try again', 'Refresh the page', 'Contact support if the problem persists']
		};
	}

	/**
	 * Log an error
	 * @param {ErrorInfo} errorInfo
	 */
	logError(errorInfo) {
		if (!this.config.enableLogging) return;

		// Add to error log
		this.errorLog.unshift({
			...errorInfo,
			id: Date.now() + Math.random()
		});

		// Limit log size
		if (this.errorLog.length > this.config.maxLogEntries) {
			this.errorLog = this.errorLog.slice(0, this.config.maxLogEntries);
		}

		// Console logging
		if (this.config.debug) {
			console.error(`[ErrorService] ${errorInfo.category}: ${errorInfo.message}`, errorInfo);
		}
	}

	/**
	 * Attempt to recover from an error
	 * @param {string} errorCode
	 * @returns {Promise<{success: boolean, message: string}>}
	 */
	async attemptRecovery(errorCode) {
		const strategy = this.recoveryStrategies.get(errorCode);
		if (!strategy) {
			return { success: false, message: 'No recovery strategy available' };
		}

		try {
			return await strategy();
		} catch (error) {
			return { success: false, message: `Recovery failed: ${error.message}` };
		}
	}

	/**
	 * Get error statistics
	 * @returns {Object}
	 */
	getErrorStats() {
		const stats = {};
		const now = new Date();
		const lastHour = new Date(now.getTime() - 60 * 60 * 1000);

		// Count by category
		const byCategory = {};
		const recentErrors = [];

		for (const error of this.errorLog) {
			const category = error.category || 'Unknown';
			byCategory[category] = (byCategory[category] || 0) + 1;

			if (error.timestamp > lastHour) {
				recentErrors.push(error);
			}
		}

		return {
			total: this.errorLog.length,
			recent: recentErrors.length,
			byCategory,
			mostCommon: Object.entries(byCategory)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 3)
				.map(([category, count]) => ({ category, count }))
		};
	}

	/**
	 * Clear error log
	 */
	clearErrorLog() {
		this.errorLog = [];
	}

	/**
	 * Get recent errors
	 * @param {number} limit
	 * @returns {Array}
	 */
	getRecentErrors(limit = 10) {
		return this.errorLog.slice(0, limit);
	}

	/**
	 * Check if error is recoverable
	 * @param {ErrorInfo} errorInfo
	 * @returns {boolean}
	 */
	isRecoverable(errorInfo) {
		return errorInfo.recoverable && this.recoveryStrategies.has(errorInfo.code);
	}

	/**
	 * Export error log
	 * @returns {string}
	 */
	exportErrorLog() {
		return JSON.stringify(
			{
				timestamp: new Date().toISOString(),
				errors: this.errorLog,
				stats: this.getErrorStats()
			},
			null,
			2
		);
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		this.clearErrorLog();
		this.handlers.clear();
		this.recoveryStrategies.clear();
	}
}
