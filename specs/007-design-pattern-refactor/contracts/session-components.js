/**
 * Session Component Contracts (Simplified - Constructor Injection)
 * @file Interface definitions for session management components
 */

/**
 * AdapterRegistry - Session adapter registry
 * @class
 */
class AdapterRegistry {
	/**
	 * No dependencies (adapters registered after construction)
	 */
	constructor() {}

	/**
	 * Register adapter for session type
	 * @param {string} kind - Session type (pty, claude, file-editor)
	 * @param {Adapter} adapter - Adapter instance
	 * @returns {void}
	 */
	register(kind, adapter) {}

	/**
	 * Get adapter for session type
	 * @param {string} kind - Session type
	 * @returns {Adapter} Adapter instance
	 * @throws {Error} If adapter not found
	 */
	getAdapter(kind) {}
}

/**
 * EventRecorder - Event persistence and emission
 * @class
 */
class EventRecorder {
	/**
	 * @param {EventStore} eventStore - Event store repository
	 */
	constructor(eventStore) {}

	/**
	 * Record event (persist and emit)
	 * @param {string} sessionId - Session ID
	 * @param {Object} event - Event data
	 * @param {string} event.type - Event type
	 * @param {Object} event.payload - Event payload
	 * @returns {Promise<void>}
	 */
	async record(sessionId, event) {}

	/**
	 * Subscribe to event stream
	 * @param {Function} listener - Event listener (sessionId, seq, event) => void
	 * @returns {void}
	 */
	subscribe(listener) {}

	/**
	 * Unsubscribe listener
	 * @param {Function} listener - Event listener to remove
	 * @returns {void}
	 */
	unsubscribe(listener) {}
}

/**
 * SessionOrchestrator - Session lifecycle coordinator
 * @class
 */
class SessionOrchestrator {
	/**
	 * @param {SessionRepository} sessionRepository - Session metadata repository
	 * @param {EventRecorder} eventRecorder - Event recorder
	 * @param {AdapterRegistry} adapterRegistry - Adapter registry
	 */
	constructor(sessionRepository, eventRecorder, adapterRegistry) {}

	/**
	 * Create new session
	 * @param {string} kind - Session type (pty, claude, file-editor)
	 * @param {Object} options - Session options
	 * @param {string} options.workspacePath - Workspace path
	 * @param {Object} [options.metadata] - Additional metadata
	 * @returns {Promise<Session>} Created session
	 */
	async createSession(kind, options) {}

	/**
	 * Attach to existing session
	 * @param {string} sessionId - Session ID
	 * @param {number} [fromSeq=0] - Starting sequence number for replay
	 * @returns {Promise<{session: Session, events: Event[]}>} Session and events
	 */
	async attachToSession(sessionId, fromSeq = 0) {}

	/**
	 * Send input to session
	 * @param {string} sessionId - Session ID
	 * @param {string} input - Input data
	 * @returns {Promise<void>}
	 */
	async sendInput(sessionId, input) {}

	/**
	 * Close session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<void>}
	 */
	async closeSession(sessionId) {}

	/**
	 * Get active session process
	 * @param {string} sessionId - Session ID
	 * @returns {Object|null} Active session process or null
	 */
	getActiveProcess(sessionId) {}
}

/**
 * Adapter Interface (all adapters must implement)
 * @interface
 */
class Adapter {
	/**
	 * Create session process
	 * @param {Object} options - Session options
	 * @returns {Process} Session process
	 */
	create(options) {}

	/**
	 * Attach to existing process
	 * @param {string} processId - Process ID
	 * @returns {Process} Session process
	 */
	attach(processId) {}

	/**
	 * Send input to process
	 * @param {Process} process - Session process
	 * @param {string} input - Input data
	 * @returns {void}
	 */
	sendInput(process, input) {}

	/**
	 * Close process
	 * @param {Process} process - Session process
	 * @returns {void}
	 */
	close(process) {}
}

/**
 * TypeDefs
 */

/**
 * @typedef {Object} Session
 * @property {string} id - Session ID
 * @property {string} kind - Session type
 * @property {string} workspacePath - Workspace path
 * @property {string} status - Session status
 * @property {Object} metadata - Additional metadata
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 */

/**
 * @typedef {Object} Event
 * @property {string} sessionId - Session ID
 * @property {number} seq - Sequence number
 * @property {string} type - Event type
 * @property {Object} payload - Event payload
 * @property {string} timestamp - ISO timestamp
 */

/**
 * @typedef {Object} Process
 * @property {string} id - Process ID
 * @property {Object} handle - Underlying process handle (pty, subprocess, etc.)
 * @property {EventEmitter} events - Process event emitter
 */

/**
 * Example Usage:
 *
 * // Components wired via constructor injection in factory function
 * const eventRecorder = new EventRecorder(eventStore);
 * const adapterRegistry = new AdapterRegistry();
 * const sessionOrchestrator = new SessionOrchestrator(
 *   sessionRepository,
 *   eventRecorder,
 *   adapterRegistry
 * );
 *
 * // Register adapters after construction
 * adapterRegistry.register('pty', new PtyAdapter());
 * adapterRegistry.register('claude', new ClaudeAdapter());
 *
 * // Use in application
 * const session = await sessionOrchestrator.createSession('pty', {
 *   workspacePath: '/workspace/test'
 * });
 *
 * // Mock in tests
 * const mockEventRecorder = { record: vi.fn() };
 * const mockAdapterRegistry = { getAdapter: vi.fn() };
 * const orchestrator = new SessionOrchestrator(
 *   mockSessionRepo,
 *   mockEventRecorder,
 *   mockAdapterRegistry
 * );
 */
