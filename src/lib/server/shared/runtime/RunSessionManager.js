import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';

/**
 * Unified session management class that replaces the complex SessionManager + SessionRouter pattern
 * Implements event-sourced session history with adapter pattern for different session types
 */
export class RunSessionManager {
	constructor(database, io) {
		this.db = database;
		this.io = io;
		this.liveRuns = new Map(); // runId -> { proc, nextSeq }
		this.adapters = new Map(); // kind -> adapter instance

		logger.info('RUNSESSION', 'RunSessionManager initialized with resume capability');
	}

	/**
	 * Register an adapter for a specific session kind
	 */
	registerAdapter(kind, adapter) {
		this.adapters.set(kind, adapter);
		logger.info('RUNSESSION', `Registered adapter for kind: ${kind}`);
	}

	/**
	 * Set Socket.IO instance for real-time event emission
	 */
	setSocketIO(io) {
		this.io = io;
		logger.info('RUNSESSION', 'Socket.IO instance set for real-time events');
	}

	/**
	 * Create a new run session
	 */
	async createRunSession({ kind, meta, ownerUserId = null }) {
		const runId = randomUUID();
		const created = Date.now();
		const eventBuffer = []; // Buffer events during initialization

		try {
			// Persist session to database
			await this.db.createRunSession(runId, kind, meta, ownerUserId);

			// Get the appropriate adapter
			const adapter = this.adapters.get(kind);
			if (!adapter) {
				throw new Error(`No adapter registered for kind: ${kind}`);
			}

			// Track live run with next sequence number BEFORE creating adapter
			// Buffer events during initialization to prevent database conflicts
			const nextSeq = await this.db.getNextSequenceNumber(runId);
			this.liveRuns.set(runId, {
				proc: null, // Will be set after adapter creation
				nextSeq,
				kind,
				initializing: true, // Flag to indicate we're still initializing
				eventQueue: Promise.resolve() // Event queue to serialize async operations
			});

			// Create process adapter with event buffering callback
			const proc = await adapter.create({
				...meta,
				onEvent: (ev) => {
					// Buffer events during initialization
					const liveRun = this.liveRuns.get(runId);
					if (liveRun?.initializing) {
						eventBuffer.push(ev);
					} else if (liveRun) {
						// Queue events to be processed serially
						liveRun.eventQueue = liveRun.eventQueue.then(() =>
							this.recordAndEmit(runId, ev).catch((err) =>
								logger.error('RUNSESSION', `Event queue error for ${runId}:`, err)
							)
						);
					}
				}
			});

			// Update the live run record with the actual process
			const liveRun = this.liveRuns.get(runId);
			liveRun.proc = proc;

			// Update status to running
			await this.db.updateRunSessionStatus(runId, 'running');

			// Flush all buffered events BEFORE removing the initializing flag
			for (const ev of eventBuffer) {
				await this.recordAndEmit(runId, ev);
			}

			// NOW remove initialization flag after all buffered events are flushed
			delete liveRun.initializing;

			logger.info(
				'RUNSESSION',
				`Created ${kind} run session: ${runId} with ${eventBuffer.length} buffered events`
			);
			return { runId };
		} catch (error) {
			logger.error('RUNSESSION', `Failed to create run session ${runId}:`, error);

			// Clean up live run entry if it was added
			this.liveRuns.delete(runId);

			// Clean up any events that may have been written during failed initialization
			// This prevents sequence number conflicts on retry
			try {
				await this.db.deleteSessionEvents(runId);
				logger.info('RUNSESSION', `Cleaned up events for failed session ${runId}`);
			} catch (cleanupError) {
				logger.warn('RUNSESSION', `Failed to clean up events for ${runId}:`, cleanupError.message);
			}

			// Update status to error if session was created
			try {
				await this.db.updateRunSessionStatus(runId, 'error');
			} catch (e) {
				// Ignore
			}
			throw error;
		}
	}

	/**
	 * Record event and emit to all clients attached to this run
	 */
	async recordAndEmit(runId, ev) {
		try {
			const row = await this.appendEvent(runId, ev.channel, ev.type, ev.payload);
			// Emit to all clients attached to this run
			this.io?.to(`run:${runId}`).emit('run:event', row);
		} catch (error) {
			logger.error('RUNSESSION', `Failed to record/emit event for ${runId}:`, error);
		}
	}

	/**
	 * Append event to session event log with monotonic sequence number
	 * IMPORTANT: This must be called serially, not concurrently, to maintain sequence order
	 */
	async appendEvent(runId, channel, type, payload) {
		const rec = this.liveRuns.get(runId);
		if (!rec) {
			// Session not live, get next sequence from database
			const nextSeq = await this.db.getNextSequenceNumber(runId);
			const row = await this.db.appendSessionEvent(runId, nextSeq, channel, type, payload);
			return row;
		}

		// Use live session's sequence counter - atomic increment
		const seq = rec.nextSeq++;
		try {
			const row = await this.db.appendSessionEvent(runId, seq, channel, type, payload);
			return row;
		} catch (error) {
			// If we get a constraint error, it means another event got the same seq
			// This shouldn't happen if events are properly serialized
			logger.error('RUNSESSION', `Sequence conflict for ${runId} seq ${seq}:`, error.message);
			throw error;
		}
	}

	/**
	 * Get events since a specific sequence number (for client catchup)
	 */
	async getEventsSince(runId, afterSeq = 0) {
		return await this.db.getSessionEventsSince(runId, afterSeq);
	}

	/**
	 * Get live run session process
	 */
	getRunSession(runId) {
		return this.liveRuns.get(runId);
	}

	/**
	 * Send input to a run session
	 */
	async sendInput(runId, data) {
		const live = this.liveRuns.get(runId);
		if (!live) {
			throw new Error(`Run session not found: ${runId}`);
		}

		if (!live.proc.input) {
			throw new Error(`Run session ${runId} does not support input`);
		}

		try {
			live.proc.input.write(data);
			// Optionally log input events
			await this.recordAndEmit(runId, {
				channel: `${live.kind}:input`,
				type: 'data',
				payload: data
			});
		} catch (error) {
			logger.error('RUNSESSION', `Failed to send input to ${runId}:`, error);
			throw error;
		}
	}

	/**
	 * Perform adapter-specific operation (e.g., resize for PTY)
	 */
	async performOperation(runId, operation, params) {
		const live = this.liveRuns.get(runId);
		if (!live) {
			throw new Error(`Run session not found: ${runId}`);
		}

		const proc = live.proc;
		if (typeof proc[operation] !== 'function') {
			// Log the unsupported operation but don't throw - some operations are adapter-specific
			logger.warn(
				'RUNSESSION',
				`Operation ${operation} not supported by ${live.kind} adapter for run ${runId}`
			);
			return null;
		}

		try {
			return proc[operation](...params);
		} catch (error) {
			logger.error('RUNSESSION', `Failed to perform ${operation} on ${runId}:`, error.message);
			// Don't re-throw the error to prevent crashes - log and return null instead
			return null;
		}
	}

	/**
	 * Close a run session
	 */
	async closeRunSession(runId) {
		try {
			const live = this.liveRuns.get(runId);
			if (live) {
				try {
					// Close the process
					if (live.proc && typeof live.proc.close === 'function') {
						live.proc.close();
					}
				} catch (error) {
					logger.warn(
						'RUNSESSION',
						`Error closing process for ${runId}:`,
						error.message || 'Unknown error'
					);
				}

				// Remove from live runs
				this.liveRuns.delete(runId);
			}

			try {
				// Update database status
				await this.db.updateRunSessionStatus(runId, 'stopped');
				logger.info('RUNSESSION', `Closed run session: ${runId}`);
			} catch (error) {
				logger.error(
					'RUNSESSION',
					`Failed to update status for closed session ${runId}:`,
					error.message || 'Unknown error'
				);
			}
		} catch (error) {
			// Ultimate safety net to prevent any unhandled errors from propagating
			logger.error(
				'RUNSESSION',
				`Unexpected error closing run session ${runId}:`,
				error.message || 'Unknown error'
			);
			// Don't re-throw to prevent crashes
		}
	}

	/**
	 * List all run sessions (both live and stopped)
	 */
	async listRunSessions(kind = null) {
		try {
			const sessions = await this.db.listRunSessions(kind);
			// Add live status info
			return sessions.map((session) => ({
				...session,
				isLive: this.liveRuns.has(session.run_id)
			}));
		} catch (error) {
			logger.error('RUNSESSION', 'Failed to list run sessions:', error);
			throw error;
		}
	}

	/**
	 * Get session status and metadata
	 */
	async getSessionStatus(runId) {
		try {
			const session = await this.db.getRunSession(runId);
			if (!session) {
				return null;
			}

			const live = this.liveRuns.get(runId);
			return {
				...session,
				isLive: !!live,
				nextSeq: live?.nextSeq || (await this.db.getNextSequenceNumber(runId))
			};
		} catch (error) {
			logger.error('RUNSESSION', `Failed to get status for ${runId}:`, error);
			throw error;
		}
	}

	/**
	 * Resume a run session (restart the process with the same runId)
	 */
	async resumeRunSession(runId) {
		const eventBuffer = []; // Buffer events during initialization

		try {
			const session = await this.db.getRunSession(runId);
			if (!session) {
				throw new Error(`Session ${runId} not found`);
			}

			// Check if already live
			if (this.liveRuns.has(runId)) {
				logger.info('RUNSESSION', `Session ${runId} already live, no need to resume`);
				return { runId, resumed: false, reason: 'Already live' };
			}

			// Get the appropriate adapter
			const adapter = this.adapters.get(session.kind);
			if (!adapter) {
				throw new Error(`No adapter registered for kind: ${session.kind}`);
			}

			// Parse the meta data
			const meta = typeof session.meta === 'string' ? JSON.parse(session.meta) : session.meta;
			logger.info('RUNSESSION', `Resume metadata for ${runId}:`, { kind: session.kind, meta });

			// Track live run with next sequence number BEFORE creating adapter
			// Buffer events during initialization to prevent database conflicts
			const nextSeq = await this.db.getNextSequenceNumber(runId);
			this.liveRuns.set(runId, {
				proc: null, // Will be set after adapter creation
				nextSeq,
				kind: session.kind,
				initializing: true, // Flag to indicate we're still initializing
				eventQueue: Promise.resolve() // Event queue to serialize async operations
			});

			// Create process adapter with event buffering callback
			let proc;
			try {
				proc = await adapter.create({
					...meta,
					onEvent: (ev) => {
						// Buffer events during initialization
						const liveRun = this.liveRuns.get(runId);
						if (liveRun?.initializing) {
							eventBuffer.push(ev);
						} else if (liveRun) {
							// Queue events to be processed serially
							liveRun.eventQueue = liveRun.eventQueue.then(() =>
								this.recordAndEmit(runId, ev).catch((err) =>
									logger.error('RUNSESSION', `Event queue error for ${runId}:`, err)
								)
							);
						}
					}
				});
				logger.info(
					'RUNSESSION',
					`Successfully created ${session.kind} adapter for resume of ${runId}`
				);
			} catch (adapterError) {
				logger.error(
					'RUNSESSION',
					`Adapter creation failed for ${session.kind} session ${runId}:`,
					adapterError
				);
				// Clean up live run entry if adapter creation failed
				this.liveRuns.delete(runId);
				throw adapterError;
			}

			// Update the live run record with the actual process
			const liveRun = this.liveRuns.get(runId);
			liveRun.proc = proc;

			// Update status to running
			await this.db.updateRunSessionStatus(runId, 'running');

			// Flush all buffered events BEFORE removing the initializing flag
			for (const ev of eventBuffer) {
				await this.recordAndEmit(runId, ev);
			}

			// NOW remove initialization flag after all buffered events are flushed
			delete liveRun.initializing;

			// Get recent history (last 10 events) to replay for context
			const recentEvents = await this.getEventsSince(runId, 0);
			const last10Events = recentEvents.slice(-10);

			// Emit recent events to provide context
			if (last10Events.length > 0) {
				logger.info(
					'RUNSESSION',
					`Replaying ${last10Events.length} recent events for resumed session ${runId}`
				);
				last10Events.forEach((event) => {
					this.io.to(`run:${runId}`).emit('run:event', event);
				});
			}

			logger.info('RUNSESSION', `Resumed ${session.kind} run session: ${runId}`);
			return {
				runId,
				resumed: true,
				kind: session.kind,
				recentEventsCount: last10Events.length
			};
		} catch (error) {
			logger.error('RUNSESSION', `Failed to resume ${runId}:`, error);
			throw error;
		}
	}

	/**
	 * Clean up resources
	 */
	async cleanup() {
		logger.info('RUNSESSION', 'Cleaning up RunSessionManager...');

		// Close all live runs
		const runIds = Array.from(this.liveRuns.keys());
		for (const runId of runIds) {
			try {
				await this.closeRunSession(runId);
			} catch (error) {
				logger.warn('RUNSESSION', `Failed to close ${runId} during cleanup:`, error);
			}
		}

		logger.info('RUNSESSION', 'RunSessionManager cleanup complete');
	}

	/**
	 * Get statistics about current state
	 */
	getStats() {
		const liveCount = this.liveRuns.size;
		const adapterCount = this.adapters.size;
		const kinds = Array.from(this.adapters.keys());

		return {
			liveRuns: liveCount,
			registeredAdapters: adapterCount,
			supportedKinds: kinds
		};
	}
}
