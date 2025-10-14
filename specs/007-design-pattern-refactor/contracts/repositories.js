/**
 * Repository Contracts (Simplified - Constructor Injection)
 * @file Interface definitions for database repositories
 */

/* eslint-disable no-unused-vars */

/**
 * SessionRepository - Session metadata CRUD
 * @class
 */
class SessionRepository {
	/**
	 * @param {DatabaseManager} db - Database connection manager
	 */
	constructor(db) {}

	/**
	 * Create new session
	 * @param {Object} sessionData - Session creation data
	 * @param {string} sessionData.kind - Session type (pty, claude, file-editor)
	 * @param {string} sessionData.workspacePath - Workspace path
	 * @param {Object} [sessionData.metadata] - Additional metadata
	 * @returns {Promise<Session>} Created session
	 */
	async create(sessionData) {}

	/**
	 * Find session by ID
	 * @param {string} id - Session ID
	 * @returns {Promise<Session|null>} Session or null if not found
	 */
	async findById(id) {}

	/**
	 * Find sessions by workspace
	 * @param {string} workspacePath - Workspace path
	 * @returns {Promise<Session[]>} Sessions in workspace
	 */
	async findByWorkspace(workspacePath) {}

	/**
	 * Update session status
	 * @param {string} id - Session ID
	 * @param {string} status - New status (active, stopped, failed)
	 * @returns {Promise<void>}
	 */
	async updateStatus(id, status) {}

	/**
	 * Delete session
	 * @param {string} id - Session ID
	 * @returns {Promise<void>}
	 */
	async delete(id) {}
}

/**
 * EventStore - Append-only event log
 * @class
 */
class EventStore {
	/**
	 * @param {DatabaseManager} db - Database connection manager
	 */
	constructor(db) {}

	/**
	 * Append event to session log
	 * @param {string} sessionId - Session ID
	 * @param {Object} event - Event data
	 * @param {string} event.type - Event type
	 * @param {Object} event.payload - Event payload
	 * @returns {Promise<{seq: number}>} Sequence number assigned
	 */
	async append(sessionId, event) {}

	/**
	 * Get events for session from sequence number
	 * @param {string} sessionId - Session ID
	 * @param {number} [fromSeq=0] - Starting sequence number
	 * @returns {Promise<Event[]>} Events ordered by sequence
	 */
	async getEvents(sessionId, fromSeq = 0) {}

	/**
	 * Get latest sequence number for session
	 * @param {string} sessionId - Session ID
	 * @returns {Promise<number>} Latest sequence number
	 */
	async getLatestSeq(sessionId) {}
}

/**
 * SettingsRepository - Application settings CRUD
 * @class
 */
class SettingsRepository {
	/**
	 * @param {DatabaseManager} db - Database connection manager
	 */
	constructor(db) {}

	/**
	 * Get setting by key
	 * @param {string} key - Setting key
	 * @returns {Promise<any>} Setting value
	 */
	async get(key) {}

	/**
	 * Set setting value
	 * @param {string} key - Setting key
	 * @param {any} value - Setting value (will be JSON-stringified)
	 * @returns {Promise<void>}
	 */
	async set(key, value) {}

	/**
	 * Get all settings
	 * @returns {Promise<Object>} All settings as key-value pairs
	 */
	async getAll() {}
}

/**
 * WorkspaceRepository - Workspace metadata CRUD
 * @class
 */
class WorkspaceRepository {
	/**
	 * @param {DatabaseManager} db - Database connection manager
	 */
	constructor(db) {}

	/**
	 * Create workspace
	 * @param {Object} workspaceData - Workspace creation data
	 * @param {string} workspaceData.path - Absolute workspace path
	 * @param {string} workspaceData.name - Display name
	 * @returns {Promise<Workspace>} Created workspace
	 */
	async create(workspaceData) {}

	/**
	 * Find workspace by path (ID)
	 * @param {string} path - Workspace path
	 * @returns {Promise<Workspace|null>} Workspace or null if not found
	 */
	async findById(path) {}

	/**
	 * List all workspaces
	 * @returns {Promise<Workspace[]>} All workspaces
	 */
	async findAll() {}

	/**
	 * Update workspace metadata
	 * @param {string} path - Workspace path
	 * @param {Object} updates - Fields to update
	 * @returns {Promise<void>}
	 */
	async update(path, updates) {}

	/**
	 * Delete workspace
	 * @param {string} path - Workspace path
	 * @returns {Promise<void>}
	 */
	async delete(path) {}

	/**
	 * Update last active timestamp
	 * @param {string} path - Workspace path
	 * @returns {Promise<void>}
	 */
	async updateLastActive(path) {}
}

/* eslint-enable no-unused-vars */

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
 * @typedef {Object} Workspace
 * @property {string} id - Workspace path (primary key)
 * @property {string} name - Display name
 * @property {string} status - Workspace status (new, active, archived)
 * @property {string} createdAt - ISO timestamp
 * @property {string} updatedAt - ISO timestamp
 * @property {string|null} lastActive - ISO timestamp or null
 */

/**
 * Example Usage:
 *
 * // Repositories receive db via constructor (explicit dependency)
 * const db = new DatabaseManager(config);
 * const sessionRepo = new SessionRepository(db);
 * const eventStore = new EventStore(db);
 *
 * // Use in application
 * const session = await sessionRepo.create({ kind: 'pty', workspacePath: '/workspace/test' });
 * await eventStore.append(session.id, { type: 'created', payload: {} });
 *
 * // Mock in tests
 * const mockDb = { prepare: vi.fn() };
 * const repo = new SessionRepository(mockDb);
 */
