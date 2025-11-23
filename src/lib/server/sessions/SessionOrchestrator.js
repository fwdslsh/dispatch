/**
 * SessionOrchestrator - Session lifecycle coordinator
 * @file Coordinates session lifecycle using repositories and adapters
 * Implements patterns from RunSessionManager: buffering, resume, stats
 */

// eslint-disable-next-line no-unused-vars -- Needed for JSDoc type annotations
import { SessionRepository } from '../database/SessionRepository.js';
// eslint-disable-next-line no-unused-vars -- Needed for JSDoc type annotations
import { AdapterRegistry } from './AdapterRegistry.js';
// eslint-disable-next-line no-unused-vars -- Needed for JSDoc type annotations
import { EventRecorder } from './EventRecorder.js';
import { logger } from '../shared/utils/logger.js';
import { getActiveSocketIO } from '../shared/socket-setup.js';

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

		// Create session metadata in database first
		const session = await this.#sessionRepository.create({
			kind,
			workspacePath,
			metadata,
			ownerUserId
		});

		let adapter = null;
		let process = null;
		let cleanupRequired = false;

		try {
			// Start buffering events during initialization
			this.#eventRecorder.startBuffering(session.id);
			cleanupRequired = true;

			// Get adapter - if this fails, we still have a session in DB that needs cleanup
			adapter = this.#adapterRegistry.getAdapter(kind);

			// Create process with onEvent callback that has error handling
			process = await adapter.create({
				...adapterOptions,
				...metadata,
				onEvent: (ev) => {
					// Events are buffered or queued by EventRecorder
					// Add error handling to prevent callback failures from crashing adapter
					this.#eventRecorder.recordEvent(session.id, ev).catch((err) => {
						logger.error('SESSION', `Event recording failed for ${session.id}:`, err);
					});
				}
			});

			// Store active session
			this.#activeSessions.set(session.id, { adapter, process });

			// Flush buffered events
			await this.#eventRecorder.flushBuffer(session.id);

			// Update status
			await this.#sessionRepository.updateStatus(session.id, 'running');

			// Successfully initialized - no cleanup needed
			cleanupRequired = false;

			logger.info('SESSION', `Created ${kind} session: ${session.id}`);

			return { ...session, status: 'running' };
		} catch (error) {
			logger.error('SESSION', `Failed to create ${kind} session ${session.id}:`, error);
			throw error;
		} finally {
			// Cleanup on error using safe cleanup method
			if (cleanupRequired) {
				await this.#safeCleanup(session.id, process);
			}
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
		const errors = [];
		const activeSession = this.#activeSessions.get(sessionId);

		if (activeSession) {
			const { process } = activeSession;

			// Close process
			try {
				if (typeof process.close === 'function') {
					process.close();
				}
			} catch (error) {
				errors.push({ operation: 'process.close', error });
				logger.warn('SESSION', `Error closing process for ${sessionId}:`, error.message);
			}

			// Remove from active sessions
			this.#activeSessions.delete(sessionId);
		}

		// Clear event recorder buffer
		try {
			this.#eventRecorder.clearBuffer(sessionId);
		} catch (error) {
			errors.push({ operation: 'clearBuffer', error });
			logger.warn('SESSION', `Error clearing buffer for ${sessionId}:`, error.message);
		}

		// Clear sequence counter
		try {
			this.#eventRecorder.eventStore.clearSequence(sessionId);
		} catch (error) {
			errors.push({ operation: 'clearSequence', error });
			logger.warn('SESSION', `Error clearing sequence for ${sessionId}:`, error.message);
		}

		// Update session status
		try {
			await this.#sessionRepository.updateStatus(sessionId, 'stopped');
		} catch (error) {
			errors.push({ operation: 'updateStatus', error });
			logger.error('SESSION', `Failed to update status for ${sessionId}:`, error);
		}

		// Emit session:closed event to all connected clients
		try {
			const io = getActiveSocketIO();
			if (io) {
				io.emit('session:closed', { sessionId });
				logger.debug('SESSION', `Emitted session:closed event for ${sessionId}`);
			}
		} catch (error) {
			errors.push({ operation: 'emitSocketEvent', error });
			logger.warn('SESSION', `Error emitting session:closed event for ${sessionId}:`, error.message);
		}

		if (errors.length > 0) {
			logger.warn('SESSION', `Closed session ${sessionId} with ${errors.length} error(s)`, {
				errors
			});
		} else {
			logger.info('SESSION', `Closed session: ${sessionId}`);
		}
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

		// Check database status to prevent race condition with closeSession
		if (session.status === 'running') {
			return { sessionId, resumed: false, reason: 'Already running in database' };
		}

		if (this.#activeSessions.has(sessionId)) {
			return { sessionId, resumed: false, reason: 'Already active in memory' };
		}

		let process = null;
		let cleanupRequired = false;

		try {
			// Start buffering
			this.#eventRecorder.startBuffering(sessionId);
			cleanupRequired = true;

			const adapter = this.#adapterRegistry.getAdapter(session.kind);

			// Parse metadata
			const metadata =
				typeof session.metadata === 'string' ? JSON.parse(session.metadata) : session.metadata;

			// Create process with error-handled onEvent callback
			process = await adapter.create({
				...metadata,
				onEvent: (/** @type {any} */ ev) => {
					this.#eventRecorder.recordEvent(sessionId, ev).catch((err) => {
						logger.error('SESSION', `Event recording failed for ${sessionId}:`, err);
					});
				}
			});

			this.#activeSessions.set(sessionId, { adapter, process });

			// Flush buffered events
			await this.#eventRecorder.flushBuffer(sessionId);

			// Update status
			await this.#sessionRepository.updateStatus(sessionId, 'running');

			// Successfully resumed - no cleanup needed
			cleanupRequired = false;

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
			logger.error('SESSION', `Failed to resume ${sessionId}:`, error);
			throw error;
		} finally {
			// Cleanup on error using safe cleanup method
			if (cleanupRequired) {
				await this.#safeCleanup(sessionId, process);
			}
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
	 * Safely cleanup resources on error without throwing
	 * Collects all errors and logs them, but never throws
	 * @param {string} sessionId - Session ID to cleanup
	 * @param {Object|null} process - Process to close (if created)
	 * @returns {Promise<void>}
	 */
	async #safeCleanup(sessionId, process) {
		const errors = [];

		// Close process if it was created
		if (process) {
			try {
				if (typeof process.close === 'function') {
					process.close();
				}
			} catch (err) {
				errors.push({ operation: 'process.close', error: err });
			}
		}

		// Remove from active sessions map
		try {
			this.#activeSessions.delete(sessionId);
		} catch (err) {
			errors.push({ operation: 'activeSessions.delete', error: err });
		}

		// Update session status to error
		try {
			await this.#sessionRepository.updateStatus(sessionId, 'error');
		} catch (err) {
			errors.push({ operation: 'updateStatus', error: err });
		}

		// Clear event recorder buffer
		try {
			this.#eventRecorder.clearBuffer(sessionId);
		} catch (err) {
			errors.push({ operation: 'clearBuffer', error: err });
		}

		// Log all errors encountered during cleanup
		if (errors.length > 0) {
			logger.error('SESSION', `Cleanup errors for ${sessionId}:`, errors);
		}
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

	/**
	 * TEST ONLY: Set active sessions for testing
	 * @internal
	 * @param {Map} sessions - Map of sessionId -> { adapter, process }
	 */
	_setActiveSessions(sessions) {
		for (const [sessionId, session] of sessions.entries()) {
			this.#activeSessions.set(sessionId, session);
		}
	}

	/**
	 * TEST ONLY: Clear all active sessions
	 * @internal
	 */
	_clearActiveSessions() {
		this.#activeSessions.clear();
	}
}
