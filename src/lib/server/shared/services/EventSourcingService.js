import { logger } from '../utils/logger.js';

/**
 * EventSourcingService - Reusable event sourcing implementation
 *
 * Extracted from RunSessionManager to provide reusable event sourcing capabilities.
 * Manages event streams with monotonic sequence numbers, event replay, and persistence.
 */
export class EventSourcingService {
	constructor(database, io = null) {
		this.db = database;
		this.io = io;
		this.sequenceCounters = new Map(); // streamId -> nextSequence
		this.eventQueues = new Map(); // streamId -> Promise chain for serialized operations
	}

	/**
	 * Set Socket.IO instance for real-time event emission
	 * @param {Object} io - Socket.IO instance
	 */
	setSocketIO(io) {
		this.io = io;
		logger.info('EVENT_SOURCING', 'Socket.IO instance configured');
	}

	/**
	 * Initialize event stream tracking for a stream ID
	 * @param {string} streamId - Unique stream identifier
	 * @param {number} [startingSequence] - Optional starting sequence number
	 */
	async initializeStream(streamId, startingSequence = null) {
		await this.db.init();

		// Get the next sequence number from database or use provided value
		let nextSeq;
		if (startingSequence !== null) {
			nextSeq = startingSequence;
		} else {
			const result = await this.db.get(
				`SELECT COALESCE(MAX(seq), 0) as maxSeq FROM session_events WHERE run_id = ?`,
				[streamId]
			);
			nextSeq = (result?.maxSeq ?? 0) + 1;
		}

		// Track sequence counter for this stream
		this.sequenceCounters.set(streamId, nextSeq);

		// Initialize event queue for serialized operations
		this.eventQueues.set(streamId, Promise.resolve());

		logger.debug('EVENT_SOURCING', `Initialized stream ${streamId} with next sequence: ${nextSeq}`);
	}

	/**
	 * Append event to event stream with monotonic sequence number
	 * @param {string} streamId - Stream identifier
	 * @param {string} channel - Event channel (e.g., 'pty:stdout', 'claude:delta')
	 * @param {string} type - Event type (e.g., 'chunk', 'text', 'json')
	 * @param {any} payload - Event payload
	 * @param {Object} [options] - Additional options
	 * @param {boolean} [options.emitRealtime=true] - Whether to emit real-time event
	 * @param {string} [options.roomName] - Custom Socket.IO room name
	 * @returns {Promise<Object>} Appended event data
	 */
	async appendEvent(streamId, channel, type, payload, options = {}) {
		const { emitRealtime = true, roomName } = options;

		// Ensure stream is initialized
		if (!this.sequenceCounters.has(streamId)) {
			await this.initializeStream(streamId);
		}

		// Get sequence counter for this stream
		let nextSeq = this.sequenceCounters.get(streamId);

		// Get event queue for serialized operations
		let eventQueue = this.eventQueues.get(streamId) || Promise.resolve();

		// Queue this event operation to maintain order
		eventQueue = eventQueue.then(async () => {
			try {
				const seq = nextSeq++;

				// Update sequence counter
				this.sequenceCounters.set(streamId, nextSeq);

				// Persist event to database
				const eventData = await this.db.appendSessionEvent(streamId, seq, channel, type, payload);

				// Emit real-time event if requested and Socket.IO is available
				if (emitRealtime && this.io) {
					const room = roomName || `run:${streamId}`;
					this.io.to(room).emit('run:event', eventData);
				}

				logger.debug(
					'EVENT_SOURCING',
					`Appended event to stream ${streamId}, seq: ${seq}, channel: ${channel}`
				);
				return eventData;
			} catch (error) {
				logger.error('EVENT_SOURCING', `Failed to append event to stream ${streamId}:`, error);
				throw error;
			}
		});

		// Update event queue
		this.eventQueues.set(streamId, eventQueue);

		// Return the promise
		return eventQueue;
	}

	/**
	 * Get events from stream since a specific sequence number
	 * @param {string} streamId - Stream identifier
	 * @param {number} [afterSeq=0] - Get events after this sequence number
	 * @param {number} [limit] - Maximum number of events to return
	 * @returns {Promise<Array>} Array of events
	 */
	async getEventsSince(streamId, afterSeq = 0, limit = null) {
		await this.db.init();

		let sql = `SELECT run_id as runId, seq, channel, type, payload, ts
				   FROM session_events
				   WHERE run_id = ? AND seq > ?
				   ORDER BY seq ASC`;

		const params = [streamId, afterSeq];

		if (limit) {
			sql += ' LIMIT ?';
			params.push(limit);
		}

		const rows = await this.db.all(sql, params);

		return rows.map((row) => {
			// Decode payload based on type
			if (row.payload) {
				try {
					const text = new TextDecoder().decode(row.payload);
					row.payload = JSON.parse(text);
				} catch (e) {
					// Keep as raw buffer if not JSON
					row.payload = row.payload;
				}
			}
			return row;
		});
	}

	/**
	 * Get all events for a stream
	 * @param {string} streamId - Stream identifier
	 * @param {number} [limit] - Maximum number of events to return
	 * @returns {Promise<Array>} Array of all events
	 */
	async getAllEvents(streamId, limit = null) {
		return await this.getEventsSince(streamId, 0, limit);
	}

	/**
	 * Get event count for a stream
	 * @param {string} streamId - Stream identifier
	 * @returns {Promise<number>} Number of events in stream
	 */
	async getEventCount(streamId) {
		await this.db.init();

		const result = await this.db.get(
			'SELECT COUNT(*) as count FROM session_events WHERE run_id = ?',
			[streamId]
		);

		return result?.count || 0;
	}

	/**
	 * Get the latest sequence number for a stream
	 * @param {string} streamId - Stream identifier
	 * @returns {Promise<number>} Latest sequence number (0 if no events)
	 */
	async getLatestSequence(streamId) {
		await this.db.init();

		const result = await this.db.get(
			'SELECT COALESCE(MAX(seq), 0) as maxSeq FROM session_events WHERE run_id = ?',
			[streamId]
		);

		return result?.maxSeq ?? 0;
	}

	/**
	 * Get the next sequence number for a stream
	 * @param {string} streamId - Stream identifier
	 * @returns {Promise<number>} Next sequence number
	 */
	async getNextSequence(streamId) {
		// Use cached counter if available
		if (this.sequenceCounters.has(streamId)) {
			return this.sequenceCounters.get(streamId);
		}

		// Otherwise get from database
		const latestSeq = await this.getLatestSequence(streamId);
		const nextSeq = latestSeq + 1;

		// Cache the counter
		this.sequenceCounters.set(streamId, nextSeq);

		return nextSeq;
	}

	/**
	 * Replay events to rebuild state from event stream
	 * @param {string} streamId - Stream identifier
	 * @param {Function} eventHandler - Function to handle each event: (event) => void
	 * @param {number} [fromSequence=0] - Start replay from this sequence
	 * @param {number} [toSequence] - End replay at this sequence (inclusive)
	 * @returns {Promise<Object>} Replay statistics
	 */
	async replayEvents(streamId, eventHandler, fromSequence = 0, toSequence = null) {
		if (typeof eventHandler !== 'function') {
			throw new Error('Event handler must be a function');
		}

		const startTime = Date.now();
		let eventsProcessed = 0;

		try {
			// Get events in the specified range
			let sql = `SELECT run_id as runId, seq, channel, type, payload, ts
					   FROM session_events
					   WHERE run_id = ? AND seq >= ?`;

			const params = [streamId, fromSequence];

			if (toSequence !== null) {
				sql += ' AND seq <= ?';
				params.push(toSequence);
			}

			sql += ' ORDER BY seq ASC';

			const events = await this.db.all(sql, params);

			// Process each event
			for (const event of events) {
				// Decode payload
				if (event.payload) {
					try {
						const text = new TextDecoder().decode(event.payload);
						event.payload = JSON.parse(text);
					} catch (e) {
						// Keep as raw buffer if not JSON
					}
				}

				// Call event handler
				await eventHandler(event);
				eventsProcessed++;
			}

			const duration = Date.now() - startTime;

			logger.info(
				'EVENT_SOURCING',
				`Replayed ${eventsProcessed} events for stream ${streamId} in ${duration}ms`
			);

			return {
				streamId,
				eventsProcessed,
				duration,
				fromSequence,
				toSequence: toSequence || events[events.length - 1]?.seq || fromSequence
			};
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error(
				'EVENT_SOURCING',
				`Failed to replay events for stream ${streamId} after ${duration}ms:`,
				error
			);
			throw error;
		}
	}

	/**
	 * Create event stream snapshot at specific sequence
	 * @param {string} streamId - Stream identifier
	 * @param {number} sequenceNumber - Sequence number for snapshot
	 * @param {any} snapshotData - Snapshot state data
	 * @param {string} [snapshotType='state'] - Type of snapshot
	 * @returns {Promise<Object>} Snapshot record
	 */
	async createSnapshot(streamId, sequenceNumber, snapshotData, snapshotType = 'state') {
		await this.db.init();

		const timestamp = Date.now();
		const snapshotJson = JSON.stringify(snapshotData);

		// Store snapshot in a dedicated table (would need to be created)
		// For now, we'll store as a special event type
		const snapshotEvent = await this.appendEvent(
			streamId,
			'system:snapshot',
			'snapshot',
			{
				sequenceNumber,
				snapshotType,
				data: snapshotData,
				timestamp
			},
			{ emitRealtime: false } // Don't emit snapshots as real-time events
		);

		logger.info(
			'EVENT_SOURCING',
			`Created snapshot for stream ${streamId} at sequence ${sequenceNumber}`
		);

		return snapshotEvent;
	}

	/**
	 * Delete events from stream (for cleanup)
	 * @param {string} streamId - Stream identifier
	 * @param {number} [beforeSequence] - Delete events before this sequence
	 * @param {number} [maxAge] - Delete events older than this (milliseconds)
	 * @returns {Promise<number>} Number of deleted events
	 */
	async deleteEvents(streamId, beforeSequence = null, maxAge = null) {
		await this.db.init();

		let sql = 'DELETE FROM session_events WHERE run_id = ?';
		const params = [streamId];

		if (beforeSequence !== null) {
			sql += ' AND seq < ?';
			params.push(beforeSequence);
		}

		if (maxAge !== null) {
			const cutoffTime = Date.now() - maxAge;
			sql += ' AND ts < ?';
			params.push(cutoffTime);
		}

		const result = await this.db.run(sql, params);
		const deletedCount = result.changes || 0;

		// Update sequence counter if we deleted events
		if (deletedCount > 0) {
			await this.initializeStream(streamId);
		}

		logger.info('EVENT_SOURCING', `Deleted ${deletedCount} events from stream ${streamId}`);

		return deletedCount;
	}

	/**
	 * Get stream statistics
	 * @param {string} streamId - Stream identifier
	 * @returns {Promise<Object>} Stream statistics
	 */
	async getStreamStats(streamId) {
		await this.db.init();

		const eventCount = await this.getEventCount(streamId);
		const latestSequence = await this.getLatestSequence(streamId);

		// Get event type distribution
		const typeStats = await this.db.all(
			`SELECT type, COUNT(*) as count
			 FROM session_events
			 WHERE run_id = ?
			 GROUP BY type
			 ORDER BY count DESC`,
			[streamId]
		);

		// Get channel distribution
		const channelStats = await this.db.all(
			`SELECT channel, COUNT(*) as count
			 FROM session_events
			 WHERE run_id = ?
			 GROUP BY channel
			 ORDER BY count DESC`,
			[streamId]
		);

		// Get time range
		const timeRange = await this.db.get(
			`SELECT MIN(ts) as firstEvent, MAX(ts) as lastEvent
			 FROM session_events
			 WHERE run_id = ?`,
			[streamId]
		);

		return {
			streamId,
			eventCount,
			latestSequence,
			nextSequence: this.sequenceCounters.get(streamId) || latestSequence + 1,
			typeDistribution: typeStats,
			channelDistribution: channelStats,
			timeRange: {
				firstEvent: timeRange?.firstEvent ? new Date(timeRange.firstEvent).toISOString() : null,
				lastEvent: timeRange?.lastEvent ? new Date(timeRange.lastEvent).toISOString() : null,
				duration:
					timeRange?.firstEvent && timeRange?.lastEvent
						? timeRange.lastEvent - timeRange.firstEvent
						: 0
			}
		};
	}

	/**
	 * Clean up stream resources
	 * @param {string} streamId - Stream identifier
	 */
	cleanupStream(streamId) {
		this.sequenceCounters.delete(streamId);
		this.eventQueues.delete(streamId);
		logger.debug('EVENT_SOURCING', `Cleaned up stream resources for ${streamId}`);
	}

	/**
	 * Get all active streams
	 * @returns {Array<string>} Array of active stream IDs
	 */
	getActiveStreams() {
		return Array.from(this.sequenceCounters.keys());
	}

	/**
	 * Batch append multiple events to stream
	 * @param {string} streamId - Stream identifier
	 * @param {Array<Object>} events - Array of events {channel, type, payload}
	 * @param {Object} [options] - Batch options
	 * @returns {Promise<Array<Object>>} Array of appended event data
	 */
	async batchAppendEvents(streamId, events, options = {}) {
		const results = [];

		// Ensure stream is initialized
		if (!this.sequenceCounters.has(streamId)) {
			await this.initializeStream(streamId);
		}

		// Process events sequentially to maintain order
		for (const event of events) {
			const result = await this.appendEvent(
				streamId,
				event.channel,
				event.type,
				event.payload,
				options
			);
			results.push(result);
		}

		logger.info('EVENT_SOURCING', `Batch appended ${events.length} events to stream ${streamId}`);
		return results;
	}

	/**
	 * Cleanup resources and close connections
	 */
	cleanup() {
		this.sequenceCounters.clear();
		this.eventQueues.clear();
		this.io = null;
		logger.info('EVENT_SOURCING', 'EventSourcingService cleanup complete');
	}
}
