import { logger } from '../utils/logger.js';
import { EventEmitter } from 'node:events';

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
		return proc;
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