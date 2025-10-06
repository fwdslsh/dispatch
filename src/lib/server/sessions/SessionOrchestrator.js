/**
 * SessionOrchestrator - Session lifecycle coordinator
 * @file Coordinates session lifecycle using repositories and adapters
 * Implements patterns from RunSessionManager: buffering, resume, stats
 */

import { SessionRepository } from '../database/SessionRepository.js';
import { AdapterRegistry } from './AdapterRegistry.js';
import { EventRecorder } from './EventRecorder.js';
import { logger } from '../shared/utils/logger.js';

export class SessionOrchestrator {
	#sessionRepository;
	#eventRecorder;
	#adapterRegistry;
	#activeSessions = new Map(); // sessionId -> { adapter, process }

	/**
	 * @param {SessionRepository} sessionRepository - Session metadata repository
	 * @param {EventRecorder} eventRecorder - Event recorder
	 * @param {AdapterRegistry} adapterRegistry - Adapter registry
	 */
	constructor(sessionRepository, eventRecorder, adapterRegistry) {
		if (!sessionRepository) {
			throw new Error('SessionRepository is required');
		}
		if (!eventRecorder) {
			throw new Error('EventRecorder is required');
		}
		if (!adapterRegistry) {
			throw new Error('AdapterRegistry is required');
		}

		this.#sessionRepository = sessionRepository;
		this.#eventRecorder = eventRecorder;
		this.#adapterRegistry = adapterRegistry;
	}

	/**
	 * Create new session with event buffering
	 * @param {string} kind - Session type (pty, claude, file-editor)
	 * @param {Object} options - Session options
	 * @param {string} options.workspacePath - Workspace path
	 * @param {Object} [options.metadata] - Additional metadata
	 * @param {string} [options.ownerUserId] - Owner user ID
	 * @returns {Promise<Object>} Created session
	 */
	async createSession(kind, options) {
		const { workspacePath, metadata = {}, ownerUserId = null, ...adapterOptions } = options;

		// Get adapter for session type
		const adapter = this.#adapterRegistry.getAdapter(kind);

		// Create session metadata in database
		const session = await this.#sessionRepository.create({
			kind,
			workspacePath,
			metadata,
			ownerUserId
		});

		try {
			// Start buffering events during initialization
			this.#eventRecorder.startBuffering(session.id);

			// Create process with onEvent callback
			const process = await adapter.create({
				...adapterOptions,
				...metadata,
				onEvent: (ev) => {
					// Events are buffered or queued by EventRecorder
					this.#eventRecorder.recordEvent(session.id, ev);
				}
			});

			// Store active session
			this.#activeSessions.set(session.id, { adapter, process });

			// Flush buffered events
			await this.#eventRecorder.flushBuffer(session.id);

			// Update status
			await this.#sessionRepository.updateStatus(session.id, 'running');

			logger.info('SESSION', `Created ${kind} session: ${session.id}`);

			return { ...session, status: 'running' };
		} catch (error) {
			// Cleanup on error
			await this.#sessionRepository.updateStatus(session.id, 'error');
			this.#eventRecorder.clearBuffer(session.id);

			logger.error('SESSION', `Failed to create ${kind} session ${session.id}:`, error);
			throw error;
		}
	}

	/**
	 * Attach to existing session
	 * @param {string} sessionId - Session ID
	 * @param {number} [fromSeq=0] - Starting sequence number for replay
	 * @returns {Promise<{session: Object, events: Array, process: Object|null}>} Session and events
	 */
	async attachToSession(sessionId, fromSeq = 0) {
		// Get session metadata
		const session = await this.#sessionRepository.findById(sessionId);
		if (!session) {
			throw new Error(`Session not found: ${sessionId}`);
		}

		// Get events since sequence number (use EventRecorder method)
		const events = await this.#eventRecorder.getEvents(sessionId, fromSeq);

		// If session has active process, return it
		const activeSession = this.#activeSessions.get(sessionId);
		if (activeSession) {
			return { session, events, process: activeSession.process };
		}

		return { session, events, process: null };
	}

	/**
	 * Send input to session
	 * @param {string} sessionId - Session ID
	 * @param {string} input - Input data
	 * @returns {Promise<void>}
	 */
	async sendInput(sessionId, input) {
		const active = this.#activeSessions.get(sessionId);
		if (!active) {
			throw new Error(`Session not active: ${sessionId}`);
		}

		const { process } = active;

		// Standard interface: process.input?.write()
		if (!process.input?.write) {
			throw new Error(`Session ${sessionId} does not support input`);
		}

		process.input.write(input);

		// Record input event
		await this.#eventRecorder.recordEvent(sessionId, {
			channel: 'system:input',
			type: 'input',
			payload: { data: input }
		});
	}

	/**
	 * Close session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<void>}
	 */
	async closeSession(sessionId) {
		const activeSession = this.#activeSessions.get(sessionId);

		if (activeSession) {
			const { process } = activeSession;

			// Close process
			try {
				if (typeof process.close === 'function') {
					process.close();
				}
			} catch (error) {
				logger.warn('SESSION', `Error closing process for ${sessionId}:`, error.message);
			}

			// Remove from active sessions
			this.#activeSessions.delete(sessionId);
		}

		// Clear event recorder buffer
		this.#eventRecorder.clearBuffer(sessionId);

		// Update session status
		await this.#sessionRepository.updateStatus(sessionId, 'stopped');

		logger.info('SESSION', `Closed session: ${sessionId}`);
	}

	/**
	 * Resume a stopped session (restart the process with same sessionId)
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<Object>} Resume result
	 */
	async resumeSession(sessionId) {
		const session = await this.#sessionRepository.findById(sessionId);
		if (!session) {
			throw new Error(`Session not found: ${sessionId}`);
		}

		if (this.#activeSessions.has(sessionId)) {
			return { sessionId, resumed: false, reason: 'Already active' };
		}

		// Start buffering
		this.#eventRecorder.startBuffering(sessionId);

		try {
			const adapter = this.#adapterRegistry.getAdapter(session.kind);

			// Parse metadata
			const metadata =
				typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;

			const process = await adapter.create({
				...metadata,
				onEvent: (ev) => this.#eventRecorder.recordEvent(sessionId, ev)
			});

			this.#activeSessions.set(sessionId, { adapter, process });

			// Flush buffered events
			await this.#eventRecorder.flushBuffer(sessionId);

			// Update status
			await this.#sessionRepository.updateStatus(sessionId, 'running');

			// Get recent events for replay context
			const recentEvents = await this.#eventRecorder.getEvents(sessionId, 0);
			const last10 = recentEvents.slice(-10);

			logger.info('SESSION', `Resumed ${session.kind} session: ${sessionId}`);

			return {
				sessionId,
				resumed: true,
				kind: session.kind,
				recentEventsCount: last10.length
			};
		} catch (error) {
			this.#eventRecorder.clearBuffer(sessionId);
			logger.error('SESSION', `Failed to resume ${sessionId}:`, error);
			throw error;
		}
	}

	/**
	 * Get active session process
	 * @param {string} sessionId - Session ID
	 * @returns {Object|null} Active session process or null
	 */
	getActiveProcess(sessionId) {
		const activeSession = this.#activeSessions.get(sessionId);
		return activeSession?.process || null;
	}

	/**
	 * Get all active session IDs
	 * @returns {Array<string>} List of active session IDs
	 */
	getActiveSessions() {
		return Array.from(this.#activeSessions.keys());
	}

	/**
	 * Get statistics about current state
	 * @returns {Object} Stats object
	 */
	getStats() {
		return {
			activeSessions: this.#activeSessions.size,
			registeredAdapters: this.#adapterRegistry.getRegisteredTypes().length,
			supportedKinds: this.#adapterRegistry.getRegisteredTypes()
		};
	}

	/**
	 * Cleanup all active sessions (useful for shutdown)
	 * @returns {Promise<void>}
	 */
	async cleanup() {
		const sessionIds = Array.from(this.#activeSessions.keys());

		await Promise.all(
			sessionIds.map((sessionId) =>
				this.closeSession(sessionId).catch((err) =>
					logger.warn('SESSION', `Failed to close ${sessionId} during cleanup:`, err)
				)
			)
		);

		logger.info('SESSION', 'SessionOrchestrator cleanup complete');
	}
}
