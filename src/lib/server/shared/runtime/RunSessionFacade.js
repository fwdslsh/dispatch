import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { logger } from '../utils/logger.js';
import { RunSessionAdapterRegistry } from './RunSessionAdapterRegistry.js';
import { LiveRunSessionRegistry } from './LiveRunSessionRegistry.js';
import { SessionEventRecorder } from './SessionEventRecorder.js';

const DOMAIN = 'RUN_SESSION';

/**
 * @typedef {import('./runSessionTypes.js').SessionEventPayload} SessionEventPayload
 * @typedef {import('./runSessionTypes.js').RunSessionLiveEntry} RunSessionLiveEntry
 */

/**
 * Facade coordinating RunSession lifecycle, adapters, and event persistence.
 */
export class RunSessionFacade extends EventEmitter {
	/**
	 * @param {import('../db/DatabaseManager.js').DatabaseManager} database
	 * @param {{
	 *  adapterRegistry?: RunSessionAdapterRegistry,
	 *  liveRunSessionRegistry?: LiveRunSessionRegistry,
	 *  sessionEventRecorder?: SessionEventRecorder
	 * }} [options]
	 */
	constructor(database, options = {}) {
		super();
		if (!database) {
			throw new Error('RunSessionFacade requires a database instance');
		}

		this.db = database;
		this.sessions = database.sessions;
		this.eventStore = database.eventStore;
		this.adapters = options.adapterRegistry || new RunSessionAdapterRegistry();
		this.liveRunSessions = options.liveRunSessionRegistry || new LiveRunSessionRegistry();
		this.eventRecorder =
			options.sessionEventRecorder || new SessionEventRecorder(database.eventStore, this);

		logger.info(DOMAIN, 'RunSessionFacade initialized with event emitter support');
	}

	/**
	 * Register a RunSession adapter.
	 * @param {string} kind
	 * @param {any} adapter
	 */
	registerAdapter(kind, adapter) {
		this.adapters.register(kind, adapter);
	}

	/**
	 * Create a new RunSession instance and start its adapter.
	 * @param {{ kind: string, meta?: Record<string, any>, ownerUserId?: string | null }} input
	 * @returns {Promise<{ runSessionId: string, runId: string }>}
	 */
	async createRunSession({ kind, meta, ownerUserId = null }) {
		const runSessionId = randomUUID();
		const bufferedEvents = [];

		try {
			await this.sessions.create({ runSessionId, kind, meta, ownerUserId });

			const adapter = this.adapters.get(kind);
			if (!adapter) {
				throw new Error(`No adapter registered for kind: ${kind}`);
			}

			const nextSequenceNumber = await this.eventRecorder.getNextSequence(runSessionId);
			const liveRunSession = this.liveRunSessions.start(runSessionId, {
				kind,
				nextSequenceNumber
			});

			const proc = await adapter.create({
				...meta,
				onEvent: (event) => this.#handleAdapterEvent(runSessionId, event, bufferedEvents)
			});

			this.liveRunSessions.setProcess(runSessionId, proc);
			await this.sessions.updateStatus(runSessionId, 'running');

			await this.#flushBufferedEvents(runSessionId, bufferedEvents, liveRunSession);
			this.liveRunSessions.markReady(runSessionId);

			logger.info(
				DOMAIN,
				`Created ${kind} run session: ${runSessionId} with ${bufferedEvents.length} buffered events`
			);
			this.#emit(
				'runSession:started',
				{ runSessionId, kind, ownerUserId, meta },
				'session:started'
			);
			return { runSessionId, runId: runSessionId };
		} catch (error) {
			logger.error(DOMAIN, `Failed to create run session ${runSessionId}:`, error);
			this.liveRunSessions.remove(runSessionId);

			try {
				await this.eventStore.deleteForRun(runSessionId);
				logger.info(DOMAIN, `Cleaned up events for failed session ${runSessionId}`);
			} catch (cleanupError) {
				logger.warn(DOMAIN, `Failed to clean up events for ${runSessionId}:`, cleanupError.message);
			}

			try {
				await this.sessions.updateStatus(runSessionId, 'error');
			} catch {
				// ignore update failures
			}

			this.#emit('runSession:error', { runSessionId, error }, 'session:error');
			throw error;
		}
	}

	/**
	 * Append an event to the session event stream.
	 * @param {string} runSessionId
	 * @param {string} channel
	 * @param {string} type
	 * @param {any} payload
	 */
	async appendEvent(runSessionId, channel, type, payload) {
		const liveRunSession = this.liveRunSessions.get(runSessionId);
		return await this.eventRecorder.record(
			runSessionId,
			{ channel, type, payload },
			{ liveRunSession }
		);
	}

	/**
	 * Retrieve events for a session since a specific sequence number.
	 * @param {string} runSessionId
	 * @param {number} [afterSequence=0]
	 */
	async getEventsSince(runSessionId, afterSequence = 0) {
		return await this.eventRecorder.getEventsSince(runSessionId, afterSequence);
	}

	/**
	 * Obtain the live session entry if tracked.
	 * @param {string} runSessionId
	 * @returns {RunSessionLiveEntry | null}
	 */
	getRunSession(runSessionId) {
		return this.liveRunSessions.get(runSessionId);
	}

	/**
	 * Forward input to an interactive adapter.
	 * @param {string} runSessionId
	 * @param {string} data
	 */
	async sendInput(runSessionId, data) {
		const live = this.liveRunSessions.get(runSessionId);
		if (!live) {
			throw new Error(`Run session not found: ${runSessionId}`);
		}

		if (!live.proc?.input?.write) {
			throw new Error(`Run session ${runSessionId} does not support input`);
		}

		try {
			live.proc.input.write(data);
		} catch (error) {
			logger.error(DOMAIN, `Failed to send input to ${runSessionId}:`, error);
			throw error;
		}

		this.#recordLiveEvent(runSessionId, live, {
			channel: `${live.kind}:input`,
			type: 'data',
			payload: data
		});
	}

	/**
	 * Perform an adapter-specific operation such as resize.
	 * @param {string} runSessionId
	 * @param {string} operation
	 * @param {any[]} params
	 */
	async performOperation(runSessionId, operation, params) {
		const live = this.liveRunSessions.get(runSessionId);
		if (!live) {
			throw new Error(`Run session not found: ${runSessionId}`);
		}

		const proc = live.proc;
		if (typeof proc[operation] !== 'function') {
			logger.warn(
				DOMAIN,
				`Operation ${operation} not supported by ${live.kind} adapter for run session ${runSessionId}`
			);
			return null;
		}

		try {
			return await proc[operation](...(params || []));
		} catch (error) {
			logger.error(DOMAIN, `Failed to perform ${operation} on ${runSessionId}:`, error.message);
			return null;
		}
	}

	/**
	 * Close a run session and clean up resources.
	 * @param {string} runSessionId
	 */
	async closeRunSession(runSessionId) {
		try {
			const live = this.liveRunSessions.remove(runSessionId);
			if (live?.proc && typeof live.proc.close === 'function') {
				try {
					live.proc.close();
				} catch (error) {
					logger.warn(
						DOMAIN,
						`Error closing process for ${runSessionId}:`,
						error.message || 'Unknown error'
					);
				}
			}

			try {
				await this.sessions.updateStatus(runSessionId, 'stopped');
				logger.info(DOMAIN, `Closed run session: ${runSessionId}`);
			} catch (error) {
				logger.error(
					DOMAIN,
					`Failed to update status for closed session ${runSessionId}:`,
					error.message || 'Unknown error'
				);
			}

			this.#emit('runSession:closed', { runSessionId }, 'session:closed');
		} catch (error) {
			logger.error(
				DOMAIN,
				`Unexpected error closing run session ${runSessionId}:`,
				error.message || 'Unknown error'
			);
			this.#emit('runSession:error', { runSessionId, error }, 'session:error');
		}
	}

	/**
	 * List known run sessions with live status metadata.
	 * @param {string | null} kind
	 */
	async listRunSessions(kind = null) {
		const sessions = await this.sessions.list(kind);
		return sessions.map((session) => ({
			...session,
			runSessionId: session.run_id,
			runId: session.run_id,
			isLive: this.liveRunSessions.has(session.run_id)
		}));
	}

	/**
	 * Retrieve run session status details.
	 * @param {string} runSessionId
	 */
	async getSessionStatus(runSessionId) {
		const session = await this.sessions.findById(runSessionId);
		if (!session) {
			return null;
		}

		const live = this.liveRunSessions.get(runSessionId);
		const nextSequenceNumber =
			live?.nextSequenceNumber || (await this.eventRecorder.getNextSequence(runSessionId));
		return {
			...session,
			runSessionId,
			runId: runSessionId,
			isLive: !!live,
			nextSequenceNumber,
			nextSeq: nextSequenceNumber
		};
	}

	/**
	 * Attempt to resume a previously stopped run session.
	 * @param {string} runSessionId
	 */
	async resumeRunSession(runSessionId) {
		const bufferedEvents = [];

		try {
			const session = await this.sessions.findById(runSessionId);
			if (!session) {
				throw new Error(`Session ${runSessionId} not found`);
			}

			if (this.liveRunSessions.has(runSessionId)) {
				logger.info(DOMAIN, `Session ${runSessionId} already live, no need to resume`);
				return { runSessionId, runId: runSessionId, resumed: false, reason: 'Already live' };
			}

			const adapter = this.adapters.get(session.kind);
			if (!adapter) {
				throw new Error(`No adapter registered for kind: ${session.kind}`);
			}

			const meta = typeof session.meta === 'string' ? JSON.parse(session.meta) : session.meta;
			logger.info(DOMAIN, `Resume metadata for ${runSessionId}:`, {
				kind: session.kind,
				meta
			});

			const nextSequenceNumber = await this.eventRecorder.getNextSequence(runSessionId);
			const liveRunSession = this.liveRunSessions.start(runSessionId, {
				kind: session.kind,
				nextSequenceNumber
			});

			try {
				const proc = await adapter.create({
					...meta,
					onEvent: (event) => this.#handleAdapterEvent(runSessionId, event, bufferedEvents)
				});
				this.liveRunSessions.setProcess(runSessionId, proc);
			} catch (adapterError) {
				logger.error(
					DOMAIN,
					`Adapter creation failed for ${session.kind} session ${runSessionId}:`,
					adapterError
				);
				this.liveRunSessions.remove(runSessionId);
				throw adapterError;
			}

			await this.sessions.updateStatus(runSessionId, 'running');
			await this.#flushBufferedEvents(runSessionId, bufferedEvents, liveRunSession);
			this.liveRunSessions.markReady(runSessionId);

			const recentEvents = await this.getEventsSince(runSessionId, 0);
			const last10Events = recentEvents.slice(-10);
			last10Events.forEach((event) => {
				this.#emit('runSession:event', { runSessionId, event }, 'session:event');
			});

			logger.info(DOMAIN, `Resumed ${session.kind} run session: ${runSessionId}`);
			this.#emit(
				'runSession:resumed',
				{
					runSessionId,
					runId: runSessionId,
					kind: session.kind,
					recentEventsCount: last10Events.length
				},
				'session:resumed'
			);
			return {
				runSessionId,
				runId: runSessionId,
				resumed: true,
				kind: session.kind,
				recentEventsCount: last10Events.length
			};
		} catch (error) {
			logger.error(DOMAIN, `Failed to resume ${runSessionId}:`, error);
			this.#emit('runSession:error', { runSessionId, error }, 'session:error');
			throw error;
		}
	}

	/**
	 * Close all live sessions (used during shutdown).
	 */
	async cleanup() {
		logger.info(DOMAIN, 'Cleaning up RunSessionFacade...');
		const runSessionIds = this.liveRunSessions.list().map((run) => run.runSessionId);
		for (const runSessionId of runSessionIds) {
			try {
				await this.closeRunSession(runSessionId);
			} catch (error) {
				logger.warn(DOMAIN, `Failed to close ${runSessionId} during cleanup:`, error);
			}
		}
		logger.info(DOMAIN, 'RunSessionFacade cleanup complete');
	}

	/**
	 * Provide operational statistics for observability endpoints.
	 */
	getStats() {
		return {
			liveRuns: this.liveRunSessions.list().length,
			registeredAdapters: this.adapters.listKinds().length,
			supportedKinds: this.adapters.listKinds()
		};
	}

	/**
	 * Handle events emitted while adapters are initializing.
	 * @param {string} runSessionId
	 * @param {SessionEventPayload} event
	 * @param {SessionEventPayload[]} buffer
	 */
	#handleAdapterEvent(runSessionId, event, buffer) {
		const liveRunSession = this.liveRunSessions.get(runSessionId);
		if (!liveRunSession) {
			logger.warn(
				DOMAIN,
				`Received event for unknown run session ${runSessionId}`,
				event?.type || 'unknown'
			);
			return;
		}

		if (liveRunSession.initializing) {
			buffer.push(event);
			return;
		}

		this.#recordLiveEvent(runSessionId, liveRunSession, event);
	}

	/**
	 * Queue event persistence while preserving sequence guarantees.
	 * @param {string} runSessionId
	 * @param {RunSessionLiveEntry} liveRunSession
	 * @param {SessionEventPayload} event
	 */
	#recordLiveEvent(runSessionId, liveRunSession, event) {
		this.liveRunSessions
			.queue(runSessionId, () => this.eventRecorder.record(runSessionId, event, { liveRunSession }))
			.catch((error) => {
				logger.error(DOMAIN, `Event queue error for ${runSessionId}:`, error);
				this.#emit('runSession:error', { runSessionId, error }, 'session:error');
			});
	}

	/**
	 * Flush buffered events that accumulated during initialization.
	 * @param {string} runSessionId
	 * @param {SessionEventPayload[]} buffer
	 * @param {RunSessionLiveEntry} liveRunSession
	 */
	async #flushBufferedEvents(runSessionId, buffer, liveRunSession) {
		for (const event of buffer) {
			try {
				await this.eventRecorder.record(runSessionId, event, { liveRunSession });
			} catch (error) {
				logger.error(DOMAIN, `Failed to flush buffered event for ${runSessionId}:`, error);
				this.#emit('runSession:error', { runSessionId, error }, 'session:error');
			}
		}
	}

	/**
	 * Emit both domain-driven and legacy event names for compatibility.
	 * @param {string} eventName
	 * @param {any} payload
	 * @param {string | null} legacyName
	 * @param {boolean} [skipFacadeEmit=false]
	 */
	#emit(eventName, payload, legacyName = null, skipFacadeEmit = false) {
		if (!skipFacadeEmit) {
			this.emit(eventName, payload);
		}
		if (legacyName) {
			const legacyPayload = { ...payload };
			if (payload?.runSessionId && !legacyPayload.runId) {
				legacyPayload.runId = payload.runSessionId;
			}
			this.emit(legacyName, legacyPayload);
		}
	}
}
