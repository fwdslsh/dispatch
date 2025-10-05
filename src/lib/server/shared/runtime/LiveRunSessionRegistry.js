import { logger } from '../utils/logger.js';

/**
 * Registry that tracks active RunSession processes and sequencing state.
 */
export class LiveRunSessionRegistry {
	constructor() {
		/** @type {Map<string, import('./runSessionTypes.js').RunSessionLiveEntry>} */
		this.runSessions = new Map();
	}

	/**
	 * Register a new live RunSession.
	 * @param {string} runSessionId
	 * @param {{ kind: string, nextSequenceNumber: number }} options
	 * @returns {import('./runSessionTypes.js').RunSessionLiveEntry}
	 */
	start(runSessionId, { kind, nextSequenceNumber }) {
		const entry = {
			runSessionId,
			kind,
			nextSequenceNumber,
			proc: null,
			initializing: true,
			eventQueue: Promise.resolve()
		};
		this.runSessions.set(runSessionId, entry);
		logger.info(
			'LIVE_RUN_SESSION_REGISTRY',
			`Tracking live run session ${runSessionId} of kind ${kind}`
		);
		return entry;
	}

	/**
	 * Attach the adapter process to a live session entry.
	 * @param {string} runSessionId
	 * @param {any} proc
	 */
	setProcess(runSessionId, proc) {
		const entry = this.runSessions.get(runSessionId);
		if (!entry) {
			throw new Error(`Live run session ${runSessionId} not found when setting process`);
		}
		entry.proc = proc;
	}

	/**
	 * Mark a session as ready to emit events to subscribers.
	 * @param {string} runSessionId
	 * @returns {import('./runSessionTypes.js').RunSessionLiveEntry | undefined}
	 */
	markReady(runSessionId) {
		const entry = this.runSessions.get(runSessionId);
		if (entry) {
			entry.initializing = false;
		}
		return entry;
	}

	/**
	 * Retrieve a live session entry.
	 * @param {string} runSessionId
	 * @returns {import('./runSessionTypes.js').RunSessionLiveEntry | null}
	 */
	get(runSessionId) {
		return this.runSessions.get(runSessionId) || null;
	}

	/**
	 * Determine if a session is currently tracked.
	 * @param {string} runSessionId
	 * @returns {boolean}
	 */
	has(runSessionId) {
		return this.runSessions.has(runSessionId);
	}

	/**
	 * Stop tracking a live session.
	 * @param {string} runSessionId
	 * @returns {import('./runSessionTypes.js').RunSessionLiveEntry | null}
	 */
	remove(runSessionId) {
		const entry = this.runSessions.get(runSessionId) || null;
		this.runSessions.delete(runSessionId);
		if (entry) {
			logger.info('LIVE_RUN_SESSION_REGISTRY', `Stopped tracking live run session ${runSessionId}`);
		}
		return entry;
	}

	/**
	 * List currently tracked sessions.
	 * @returns {import('./runSessionTypes.js').RunSessionLiveEntry[]}
	 */
	list() {
		return Array.from(this.runSessions.values());
	}

	/**
	 * Queue a task that must run sequentially for the session.
	 * @template T
	 * @param {string} runSessionId
	 * @param {() => Promise<T>} task
	 * @returns {Promise<T>}
	 */
	queue(runSessionId, task) {
		const entry = this.runSessions.get(runSessionId);
		if (!entry) {
			throw new Error(`Cannot queue task for non-existent run session ${runSessionId}`);
		}
		const next = entry.eventQueue.then(() => task());
		entry.eventQueue = next.catch((error) => {
			logger.error(
				'LIVE_RUN_SESSION_REGISTRY',
				`Task queue error for run session ${runSessionId}:`,
				error
			);
		});
		return next;
	}

	/**
	 * Clear all tracked sessions (used during shutdown/cleanup).
	 */
	clear() {
		this.runSessions.clear();
	}
}
