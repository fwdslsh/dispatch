import { createDbErrorHandler, safeExecute } from './utils/error-handling.js';
import { sanitizeData as sanitizeDataUtil } from './utils/data-utils.js';
import { SESSION_TYPE } from '../shared/session-types.js';

class HistoryManager {
	constructor(databaseManager) {
		this.databaseManager = databaseManager;
		this.socketHistories = new Map(); // In-memory cache for active sockets
		// Database already initialized by the time this is called
		this.dbReady = Promise.resolve();

		// Create standardized error handlers
		this.handleDbError = createDbErrorHandler('HISTORY');
	}

	/**
	 * Initialize history tracking for a new socket
	 */
	async initializeSocket(socketId, metadata = {}) {
		await this.dbReady;
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
		await safeExecute(
			() => this.databaseManager.createSession(socketId, socketId, historyEntry.metadata),
			'HISTORY',
			'Failed to create session in database'
		);
	}

	/**
	 * Add an event to socket history
	 */
	async addEvent(socketId, eventType, direction = 'unknown', data = null) {
		await this.dbReady;
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
		await this.dbReady;
		await safeExecute(
			() => this.databaseManager.addSessionEvent(socketId, socketId, eventType, direction, data),
			'HISTORY',
			`Failed to save event to database for socket ${socketId}`
		);
	}

	/**
	 * Update socket metadata based on events
	 */
	updateMetadataFromEvent(historyEntry, eventType, data) {
		if (eventType === 'run:attach' && data) {
			historyEntry.metadata.sessionType = data.kind || 'unknown';
			if (data.cwd) historyEntry.metadata.cwd = data.cwd;
			if (data.name) historyEntry.metadata.sessionName = data.name;
		} else if (eventType.startsWith('run:')) {
			// Unified session events
			if (data && data.kind) {
				historyEntry.metadata.sessionType = data.kind;
			}
			if (data && data.cwd) {
				historyEntry.metadata.cwd = data.cwd;
			}
		} else if (eventType.startsWith('claude.auth')) {
			// Claude authentication events are still valid
			historyEntry.metadata.sessionType = SESSION_TYPE.CLAUDE;
		}
	}

	/**
	 * Sanitize sensitive data before storing
	 */
	sanitizeData(data) {
		return sanitizeDataUtil(data);
	}

	/**
	 * Clean up history for disconnected socket
	 */
	async finalizeSocket(socketId) {
		await this.dbReady;
		await this.addEvent(socketId, 'disconnect', 'system');

		// Mark session as disconnected in database
		await safeExecute(
			() => this.databaseManager.disconnectSession(socketId),
			'HISTORY',
			`Failed to mark session as disconnected for socket ${socketId}`
		);

		// Keep the history in memory for a short time in case of reconnection
		setTimeout(() => {
			this.socketHistories.delete(socketId);
		}, 60000); // 1 minute
	}

	/**
	 * Get history for a specific socket
	 */
	async getSocketHistory(socketId) {
		await this.dbReady;
		// Try memory first
		const memoryHistory = this.socketHistories.get(socketId);
		if (memoryHistory) {
			return memoryHistory;
		}

		// Try database
		const handler = this.handleDbError(async () => {
			const session = await this.databaseManager.getSession(socketId);
			if (!session) return null;

			const events = await this.databaseManager.getSessionHistory(socketId);

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
		}, `Failed to get socket history for ${socketId}`);
		return await handler();
	}

	/**
	 * List all available socket histories
	 */
	async listSocketHistories() {
		await this.dbReady;
		const handler = this.handleDbError(
			() => this.databaseManager.listSessionHistories(),
			'Failed to list socket histories'
		);
		return (await handler()) || [];
	}

	/**
	 * Delete old history data (cleanup)
	 */
	async cleanup(maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
		// 7 days default
		await this.dbReady;
		await safeExecute(
			() => this.databaseManager.cleanupOldData(maxAgeMs),
			'HISTORY',
			'Failed to cleanup old histories'
		);
	}
}

// Export factory function
export function createHistoryManager(databaseManager) {
	return new HistoryManager(databaseManager);
}
