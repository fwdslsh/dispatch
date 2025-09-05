/**
 * Terminal History Service for Dispatch
 * Centralized history management with caching and performance optimizations
 */

import { STORAGE_CONFIG } from '$lib/shared/utils/constants.js';
import { SafeStorage, ErrorHandler } from '$lib/shared/utils/error-handling.js';
import { TERMINAL_CONFIG } from '../config.js';
import { TerminalBufferCache } from './terminal-buffer-cache.js';

/**
 * Terminal History Service class
 * Handles all terminal history operations with caching and persistence
 */
export class TerminalHistoryService {
	constructor(sessionId, config = TERMINAL_CONFIG) {
		this.sessionId = sessionId;
		this.config = config;
		this.history = [];
		this.currentBuffer = '';
		this.lastSaveTime = 0;
		this.saveDebounceTimer = null;

		// Use optimized buffer cache
		this.bufferCache = new TerminalBufferCache(sessionId, config);

		// Subscribe to buffer changes
		this.bufferUnsubscribe = this.bufferCache.onBufferChange((content) => {
			this.currentBuffer = content;
			this.saveIfNeeded();
		});
	}

	/**
	 * Add entry to history
	 * @param {string} content - Content to add
	 * @param {string} type - Entry type ('input', 'output')
	 * @param {number} timestamp - Entry timestamp (optional)
	 */
	addEntry(content, type = 'output', timestamp = Date.now()) {
		if (!content || typeof content !== 'string') {
			return;
		}

		this.history.push({
			content,
			type,
			timestamp
		});

		this.trimIfNeeded();
		this.saveIfNeeded();
	}

	/**
	 * Trim history to stay within limits
	 */
	trimIfNeeded() {
		// Trim by number of entries
		if (this.history.length > this.config.MAX_HISTORY_ENTRIES) {
			const entriesToRemove = this.history.length - this.config.MAX_HISTORY_ENTRIES;
			this.history = this.history.slice(entriesToRemove);
			console.debug(
				`[TerminalHistory] Trimmed ${entriesToRemove} entries, now have ${this.history.length}`
			);
		}

		// Trim by total content size
		let totalSize = this.history.reduce((size, entry) => size + entry.content.length, 0);
		if (totalSize > this.config.MAX_BUFFER_LENGTH) {
			// Remove entries from beginning until under limit
			while (totalSize > this.config.MAX_BUFFER_LENGTH && this.history.length > 0) {
				const removed = this.history.shift();
				totalSize -= removed.content.length;
			}
			console.debug(
				`[TerminalHistory] Trimmed by size, now have ${this.history.length} entries, ${totalSize} chars`
			);
		}
	}

	/**
	 * Update buffer with terminal content (optimized with caching)
	 * @param {object} terminal - Terminal instance
	 */
	updateBuffer(terminal) {
		if (!terminal?.buffer?.active) {
			return;
		}

		try {
			// Use optimized buffer cache for extraction
			this.currentBuffer = this.bufferCache.extractBuffer(terminal);
		} catch (error) {
			ErrorHandler.handle(error, 'TerminalHistory.updateBuffer', false);
		}
	}

	/**
	 * Get current buffer content from cache
	 * @returns {string} Current buffer content
	 */
	getCurrentBuffer() {
		return this.bufferCache.getCurrentBuffer();
	}

	/**
	 * Force refresh buffer cache
	 * @param {object} terminal - Terminal instance
	 * @returns {string} Refreshed buffer content
	 */
	refreshBuffer(terminal) {
		this.currentBuffer = this.bufferCache.refreshBuffer(terminal);
		return this.currentBuffer;
	}

	/**
	 * Reconstruct terminal buffer from history entries
	 * @returns {string} Reconstructed buffer
	 */
	reconstructTerminalBuffer() {
		if (this.history.length === 0) {
			return '';
		}

		// Combine all output entries in chronological order
		return this.history
			.filter((entry) => entry.type === 'output')
			.map((entry) => entry.content)
			.join('');
	}

	/**
	 * Get storage key for this session
	 * @returns {string} Storage key
	 */
	getStorageKey() {
		return `${STORAGE_CONFIG.SESSION_HISTORY_PREFIX}${this.sessionId}`;
	}

	/**
	 * Save history if enough time has passed (debounced)
	 */
	saveIfNeeded() {
		const now = Date.now();

		// Clear existing timer
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer);
		}

		// Set new debounced save
		this.saveDebounceTimer = setTimeout(() => {
			this.save();
		}, this.config.SAVE_DEBOUNCE_MS || 500);
	}

	/**
	 * Save history to storage immediately
	 * @returns {boolean} Success status
	 */
	save() {
		try {
			const data = {
				history: this.history,
				buffer: this.currentBuffer,
				timestamp: Date.now(),
				version: 1 // For future migration compatibility
			};

			const success = SafeStorage.setItem(this.getStorageKey(), data);
			if (success) {
				this.lastSaveTime = Date.now();
				console.debug(
					`[TerminalHistory] Saved ${this.history.length} entries for session ${this.sessionId}`
				);
			}
			return success;
		} catch (error) {
			ErrorHandler.handle(error, 'TerminalHistory.save', true);
			return false;
		}
	}

	/**
	 * Load history from storage
	 * @returns {string} Reconstructed terminal buffer
	 */
	load() {
		try {
			const data = SafeStorage.getItem(this.getStorageKey(), null);

			if (data && typeof data === 'object') {
				// Handle versioned data format
				if (data.version === 1) {
					this.history = Array.isArray(data.history) ? data.history : [];
					this.currentBuffer = typeof data.buffer === 'string' ? data.buffer : '';
				} else {
					// Legacy format - array of entries
					this.history = Array.isArray(data) ? data : [];
					this.currentBuffer = this.reconstructTerminalBuffer();
				}

				console.debug(
					`[TerminalHistory] Loaded ${this.history.length} entries for session ${this.sessionId}`
				);
				return this.currentBuffer;
			}
		} catch (error) {
			ErrorHandler.handle(error, 'TerminalHistory.load', false);
		}

		return '';
	}

	/**
	 * Clear all history for this session
	 */
	clear() {
		this.history = [];
		this.currentBuffer = '';
		this.bufferCache.clear();
		this.lastBufferHash = null;

		// Clear storage
		SafeStorage.removeItem(this.getStorageKey());

		// Clear debounce timer
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer);
			this.saveDebounceTimer = null;
		}

		console.debug(`[TerminalHistory] Cleared history for session ${this.sessionId}`);
	}

	/**
	 * Get history statistics
	 * @returns {object} History stats
	 */
	getStats() {
		const totalSize = this.history.reduce((size, entry) => size + entry.content.length, 0);
		const inputCount = this.history.filter((entry) => entry.type === 'input').length;
		const outputCount = this.history.filter((entry) => entry.type === 'output').length;

		return {
			sessionId: this.sessionId,
			totalEntries: this.history.length,
			inputEntries: inputCount,
			outputEntries: outputCount,
			totalSize,
			bufferSize: this.currentBuffer.length,
			cacheSize: this.bufferCache.size,
			lastSaveTime: this.lastSaveTime
		};
	}

	/**
	 * Export history for debugging or migration
	 * @returns {object} Exportable history data
	 */
	export() {
		return {
			sessionId: this.sessionId,
			history: this.history,
			buffer: this.currentBuffer,
			stats: this.getStats(),
			exportTime: Date.now()
		};
	}

	/**
	 * Import history from exported data
	 * @param {object} data - Exported history data
	 * @returns {boolean} Success status
	 */
	import(data) {
		try {
			if (!data || typeof data !== 'object') {
				throw new Error('Invalid import data');
			}

			if (Array.isArray(data.history)) {
				this.history = data.history;
			}

			if (typeof data.buffer === 'string') {
				this.currentBuffer = data.buffer;
			}

			// Clear cache after import
			this.bufferCache.clear();
			this.lastBufferHash = null;

			console.debug(
				`[TerminalHistory] Imported ${this.history.length} entries for session ${this.sessionId}`
			);
			return true;
		} catch (error) {
			ErrorHandler.handle(error, 'TerminalHistory.import', false);
			return false;
		}
	}

	/**
	 * Cleanup resources
	 */
	destroy() {
		if (this.saveDebounceTimer) {
			clearTimeout(this.saveDebounceTimer);
			this.saveDebounceTimer = null;
		}

		// Unsubscribe from buffer changes
		if (this.bufferUnsubscribe) {
			this.bufferUnsubscribe();
			this.bufferUnsubscribe = null;
		}

		// Destroy optimized buffer cache
		if (this.bufferCache) {
			this.bufferCache.destroy();
		}

		this.history = [];
		this.currentBuffer = '';

		console.debug(`[TerminalHistory] Destroyed service for session ${this.sessionId}`);
	}
}

/**
 * Terminal History Manager
 * Manages multiple history services for different sessions
 */
export class TerminalHistoryManager {
	constructor() {
		this.services = new Map();
	}

	/**
	 * Get or create history service for session
	 * @param {string} sessionId - Session ID
	 * @returns {TerminalHistoryService} History service
	 */
	getService(sessionId) {
		if (!this.services.has(sessionId)) {
			this.services.set(sessionId, new TerminalHistoryService(sessionId));
		}
		return this.services.get(sessionId);
	}

	/**
	 * Remove history service for session
	 * @param {string} sessionId - Session ID
	 */
	removeService(sessionId) {
		const service = this.services.get(sessionId);
		if (service) {
			service.destroy();
			this.services.delete(sessionId);
			console.debug(`[TerminalHistoryManager] Removed service for session ${sessionId}`);
		}
	}

	/**
	 * Get all active services
	 * @returns {TerminalHistoryService[]} Array of services
	 */
	getAllServices() {
		return Array.from(this.services.values());
	}

	/**
	 * Get statistics for all services
	 * @returns {object[]} Array of service statistics
	 */
	getAllStats() {
		return this.getAllServices().map((service) => service.getStats());
	}

	/**
	 * Cleanup all services
	 */
	cleanup() {
		for (const service of this.services.values()) {
			service.destroy();
		}
		this.services.clear();
		console.debug('[TerminalHistoryManager] Cleaned up all services');
	}
}

// Export singleton instance for global use
export const terminalHistoryManager = new TerminalHistoryManager();
