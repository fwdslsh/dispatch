import { logger } from '../shared/utils/logger.js';
import { EventEmitter } from 'node:events';
import { SESSION_TYPE } from '../../shared/session-types.js';

/**
 * File Editor adapter for file editing sessions
 * Provides a simple adapter interface for file browsing, editing, and management
 */
export class FileEditorAdapter {
	/**
	 * @param {Object} params
	 * @param {string} params.cwd - Working directory
	 * @param {Object} [params.options={}] - File editor options
	 * @param {Function} params.onEvent - Event callback
	 */
	async create({ cwd, options = {}, onEvent }) {
		// Create an EventEmitter-based process for file editor sessions
		const proc = new FileEditorProcess({
			cwd: cwd || process.env.WORKSPACES_ROOT || process.env.HOME,
			options,
			onEvent
		});

		await proc.initialize();

		// Return adapter interface matching the expected structure
		return {
			kind: SESSION_TYPE.FILE_EDITOR,
			input: {
				write(data) {
					// File editor doesn't process streaming input like terminals
					// But we need this interface for compatibility with RunSessionManager
					proc.handleInput(data);
				}
			},
			close() {
				proc.close();
			},
			getCwd() {
				return proc.getCwd();
			},
			isAlive() {
				return proc.isAlive();
			},
			// Expose the process for any direct access needed
			getProcess() {
				return proc;
			}
		};
	}
}

/**
 * File Editor process that handles file operations and events
 */
class FileEditorProcess extends EventEmitter {
	constructor({ cwd, options, onEvent }) {
		super();
		this.cwd = cwd;
		this.options = options;
		this.onEvent = onEvent;
		this.isActive = false;
	}

	async initialize() {
		this.isActive = true;

		// Emit initialization event
		this.onEvent({
			channel: 'file-editor:system',
			type: 'initialized',
			payload: {
				cwd: this.cwd,
				timestamp: Date.now()
			}
		});

		logger.info('FILE_EDITOR_ADAPTER', `File editor session initialized in: ${this.cwd}`);
	}

	/**
	 * Send file operation result
	 * @param {Object} data - Operation data
	 */
	sendResult(data) {
		if (!this.isActive) return;

		this.onEvent({
			channel: 'file-editor:result',
			type: 'operation',
			payload: data
		});
	}

	/**
	 * Send file content
	 * @param {Object} data - File content data
	 */
	sendFileContent(data) {
		if (!this.isActive) return;

		this.onEvent({
			channel: 'file-editor:content',
			type: 'file',
			payload: data
		});
	}

	/**
	 * Send error
	 * @param {Object} error - Error data
	 */
	sendError(error) {
		if (!this.isActive) return;

		this.onEvent({
			channel: 'file-editor:error',
			type: 'error',
			payload: {
				message: error.message || 'Unknown error',
				stack: error.stack,
				timestamp: Date.now()
			}
		});
	}

	/**
	 * Handle input data (for compatibility with unified session architecture)
	 * File editor doesn't process streaming input, but this provides the interface
	 * @param {string|Uint8Array} data - Input data
	 */
	handleInput(data) {
		if (!this.isActive) return;

		// Convert to string if needed
		const text = typeof data === 'string' ? data : new TextDecoder().decode(data);

		// File editor could potentially handle commands via input
		// For now, just log that we received input
		logger.debug('FILE_EDITOR_ADAPTER', `Received input: ${text.substring(0, 100)}`);

		// Emit an event to show input was received
		this.onEvent({
			channel: 'file-editor:input',
			type: 'received',
			payload: {
				data: text,
				timestamp: Date.now()
			}
		});
	}

	/**
	 * Close the file editor session
	 */
	close() {
		if (!this.isActive) return;

		this.isActive = false;
		this.onEvent({
			channel: 'file-editor:system',
			type: 'closed',
			payload: {
				timestamp: Date.now()
			}
		});

		this.removeAllListeners();
		logger.info('FILE_EDITOR_ADAPTER', 'File editor session closed');
	}

	/**
	 * Get current working directory
	 */
	getCwd() {
		return this.cwd;
	}

	/**
	 * Check if session is active
	 */
	isAlive() {
		return this.isActive;
	}
}
