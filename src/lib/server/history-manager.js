import { databaseManager } from './db/DatabaseManager.js';

class HistoryManager {
	constructor() {
		this.socketHistories = new Map(); // In-memory cache for active sockets
		this._saveQueues = new Map(); // Per-socket save queues to serialize writes
		this.initializeDatabase();
	}

	async initializeDatabase() {
		try {
			await databaseManager.init();
		} catch (error) {
			console.error('[HISTORY] Failed to initialize database:', error);
		}
	}

	/**
	 * Initialize history tracking for a new socket
	 */
	async initializeSocket(socketId, metadata = {}) {
		const historyEntry = {
			socketId,
			metadata: {
				connectedAt: Date.now(),
				ip: metadata.ip || 'Unknown',
				userAgent: metadata.userAgent || 'Unknown',
				sessionType: null,
				sessionName: null,
				cwd: null,
				...metadata
			},
			events: []
		};

		this.socketHistories.set(socketId, historyEntry);

		// Save to database
		try {
			await databaseManager.createSession(socketId, socketId, historyEntry.metadata);
		} catch (error) {
			console.error('[HISTORY] Failed to create session in database:', error);
		}
	}

	/**
	 * Add an event to socket history
	 */
	async addEvent(socketId, eventType, direction = 'unknown', data = null) {
		let historyEntry = this.socketHistories.get(socketId);

		// If socket not initialized, create minimal entry
		if (!historyEntry) {
			await this.initializeSocket(socketId, {});
			historyEntry = this.socketHistories.get(socketId);
		}

		const event = {
			timestamp: Date.now(),
			type: eventType,
			direction, // 'in', 'out', 'system'
			data: data ? this.sanitizeData(data) : null
		};

		historyEntry.events.push(event);

		// Update metadata based on event type
		this.updateMetadataFromEvent(historyEntry, eventType, data);

		// Save to database (async, don't block)
		setImmediate(() => this.saveEventToDatabase(socketId, eventType, direction, data));
	}

	/**
	 * Save event to database
	 */
	async saveEventToDatabase(socketId, eventType, direction, data) {
		try {
			await databaseManager.addSessionEvent(socketId, socketId, eventType, direction, data);
		} catch (error) {
			console.error(`[HISTORY] Failed to save event to database for socket ${socketId}:`, error);
		}
	}

	/**
	 * Update socket metadata based on events
	 */
	updateMetadataFromEvent(historyEntry, eventType, data) {
		if (eventType === 'terminal.start' && data) {
			historyEntry.metadata.sessionType = 'terminal';
			if (data.cwd) historyEntry.metadata.cwd = data.cwd;
			if (data.name) historyEntry.metadata.sessionName = data.name;
		} else if (eventType === 'claude.send') {
			historyEntry.metadata.sessionType = 'claude';
			if (data && data.cwd) historyEntry.metadata.cwd = data.cwd;
		} else if (eventType.startsWith('terminal.')) {
			historyEntry.metadata.sessionType = 'terminal';
		} else if (eventType.startsWith('claude.')) {
			historyEntry.metadata.sessionType = 'claude';
		}
	}

	/**
	 * Sanitize sensitive data before storing
	 */
	sanitizeData(data) {
		if (!data) return null;

		// Deep clone to avoid modifying original
		const sanitized = JSON.parse(JSON.stringify(data));

		// Remove or redact sensitive fields
		if (sanitized.key) sanitized.key = '[REDACTED]';
		if (sanitized.password) sanitized.password = '[REDACTED]';
		if (sanitized.token) sanitized.token = '[REDACTED]';

		return sanitized;
	}

	/**
	 * Save socket history to database (deprecated - now handled by saveEventToDatabase)
	 */
	async saveSocketHistory(socketId) {
		// This method is now deprecated but kept for compatibility
		// Individual events are saved in saveEventToDatabase
		const historyEntry = this.socketHistories.get(socketId);
		if (historyEntry) {
			try {
				await databaseManager.updateSession(socketId, historyEntry.metadata);
			} catch (error) {
				console.error(`[HISTORY] Failed to update session metadata for socket ${socketId}:`, error);
			}
		}
	}

	/**
	 * Clean up history for disconnected socket
	 */
	async finalizeSocket(socketId) {
		await this.addEvent(socketId, 'disconnect', 'system');

		// Mark session as disconnected in database
		try {
			await databaseManager.disconnectSession(socketId);
		} catch (error) {
			console.error(
				`[HISTORY] Failed to mark session as disconnected for socket ${socketId}:`,
				error
			);
		}

		// Keep the history in memory for a short time in case of reconnection
		setTimeout(() => {
			this.socketHistories.delete(socketId);
		}, 60000); // 1 minute
	}

	/**
	 * Get history for a specific socket
	 */
	async getSocketHistory(socketId) {
		// Try memory first
		const memoryHistory = this.socketHistories.get(socketId);
		if (memoryHistory) {
			return memoryHistory;
		}

		// Try database
		try {
			const session = await databaseManager.getSession(socketId);
			if (!session) return null;

			const events = await databaseManager.getSessionHistory(socketId);

			return {
				socketId,
				metadata: session.metadata || {},
				events: events.map((event) => ({
					timestamp: event.timestamp,
					type: event.event_type,
					direction: event.direction,
					data: event.data
				}))
			};
		} catch (error) {
			console.error(`[HISTORY] Failed to get socket history for ${socketId}:`, error);
			return null;
		}
	}

	/**
	 * List all available socket histories
	 */
	async listSocketHistories() {
		try {
			return await databaseManager.listSessionHistories();
		} catch (error) {
			console.error('[HISTORY] Failed to list socket histories:', error);
			return [];
		}
	}

	/**
	 * Delete old history data (cleanup)
	 */
	async cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
		// 7 days default
		try {
			await databaseManager.cleanupOldData(maxAgeMs);
		} catch (error) {
			console.error('[HISTORY] Failed to cleanup old histories:', error);
		}
	}
}

// Export singleton instance
export const historyManager = new HistoryManager();
