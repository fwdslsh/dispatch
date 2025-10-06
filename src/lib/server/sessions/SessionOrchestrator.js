/**
 * SessionOrchestrator - Session lifecycle coordinator
 * @file Coordinates session lifecycle using repositories and adapters
 */

import { SessionRepository } from "../database/SessionRepository";
import { AdapterRegistry } from "./AdapterRegistry";
import { EventRecorder } from "./EventRecorder";

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
	 * Create new session
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
			// Create session process using adapter
			const process = await adapter.create(adapterOptions);

			// Store active session
			this.#activeSessions.set(session.id, { adapter, process });

			// Record creation event
			await this.#eventRecorder.record(session.id, {
				channel: 'system:status',
				type: 'created',
				payload: {
					kind,
					workspacePath,
					timestamp: Date.now()
				}
			});

			// Update session status to running
			await this.#sessionRepository.updateStatus(session.id, 'running');

			return {
				...session,
				status: 'running'
			};
		} catch (error) {
			// Cleanup on error
			await this.#sessionRepository.updateStatus(session.id, 'error');
			await this.#eventRecorder.record(session.id, {
				channel: 'system:error',
				type: 'error',
				payload: {
					message: error.message,
					stack: error.stack
				}
			});
			throw error;
		}
	}

	/**
	 * Attach to existing session
	 * @param {string} sessionId - Session ID
	 * @param {number} [fromSeq=0] - Starting sequence number for replay
	 * @returns {Promise<{session: Object, events: Array}>} Session and events
	 */
	async attachToSession(sessionId, fromSeq = 0) {
		// Get session metadata
		const session = await this.#sessionRepository.findById(sessionId);
		if (!session) {
			throw new Error(`Session not found: ${sessionId}`);
		}

		// Get events since sequence number
		const events = await this.#eventRecorder.eventStore.getEvents(sessionId, fromSeq);

		// If session has active process, return it
		const activeSession = this.#activeSessions.get(sessionId);
		if (activeSession) {
			return { session, events, process: activeSession.process };
		}

		// Try to reattach to existing process if adapter supports it
		if (session.status === 'running') {
			try {
				const adapter = this.#adapterRegistry.getAdapter(session.kind);
				const process = await adapter.attach(sessionId);
				this.#activeSessions.set(sessionId, { adapter, process });
				return { session, events, process };
			} catch (error) {
				// Reattachment failed - mark as stopped
				await this.#sessionRepository.updateStatus(sessionId, 'stopped');
			}
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
		const activeSession = this.#activeSessions.get(sessionId);
		if (!activeSession) {
			throw new Error(`Session not active: ${sessionId}`);
		}

		const { adapter, process } = activeSession;

		// Send input to process via adapter
		await adapter.sendInput(process, input);

		// Record input event
		await this.#eventRecorder.record(sessionId, {
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
			const { adapter, process } = activeSession;

			// Close process via adapter
			try {
				await adapter.close(process);
			} catch (error) {
				console.warn(`Error closing session ${sessionId}:`, error);
			}

			// Remove from active sessions
			this.#activeSessions.delete(sessionId);
		}

		// Update session status
		await this.#sessionRepository.updateStatus(sessionId, 'stopped');

		// Record close event
		await this.#eventRecorder.record(sessionId, {
			channel: 'system:status',
			type: 'closed',
			payload: { timestamp: Date.now() }
		});
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
	 * Cleanup all active sessions (useful for shutdown)
	 * @returns {Promise<void>}
	 */
	async cleanup() {
		const sessionIds = Array.from(this.#activeSessions.keys());

		await Promise.all(
			sessionIds.map(sessionId =>
				this.closeSession(sessionId).catch(err =>
					console.warn(`Error closing session ${sessionId} during cleanup:`, err)
				)
			)
		);
	}
}
