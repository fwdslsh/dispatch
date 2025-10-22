/**
 * SessionViewModel.svelte.js
 *
 * Session management ViewModel using Svelte 5 runes and direct state management.
 * Handles session business logic and coordinates with AppState.
 *
 * ARCHITECTURE PRINCIPLES:
 * - Pure business logic (no UI concerns)
 * - Direct state mutations via focused state managers
 * - Single responsibility (session CRUD operations)
 * - No complex action dispatching or bidirectional dependencies
 */

import { createLogger } from '../utils/logger.js';
import { SESSION_TYPE } from '../../../shared/session-types.js';
import { getClientId } from '../utils/uuid.js';
import { SvelteMap, SvelteDate } from 'svelte/reactivity';

const log = createLogger('session:viewmodel');

/**
 * @typedef {Object} Session
 * Sessions are completely self-contained - just ID, type, and state
 * Working directories are managed internally by session adapters
 * @property {string} id
 * @property {string} sessionType
 * @property {boolean} isActive
 * @property {string} title
 * @property {string} createdAt
 * @property {string} lastActivity
 * @property {string} activityState
 */

export class SessionViewModel {
	/**
	 * @param {import('../state/AppState.svelte.js').AppState} appStateManager
	 * @param {import('../services/SessionApiClient.js').SessionApiClient} sessionApi
	 */
	constructor(appStateManager, sessionApi) {
		this.appStateManager = appStateManager;
		this.sessionApi = sessionApi;

		// Pure business state - no UI concerns
		this.operationState = $state({
			loading: false,
			creating: false,
			error: null,
			lastOperation: null
		});

		// Session lifecycle tracking
		this.sessionOperations = $state(new SvelteMap()); // id -> operation state

		// Derived business logic state from AppState
		this.sessions = $derived(this.appStateManager.sessions.sessions);
		this.activeSessions = $derived(this.appStateManager.sessions.activeSessions);
		this.sessionCount = $derived(this.appStateManager.sessions.sessionCount);
		this.hasActiveSessions = $derived(this.appStateManager.sessions.hasActiveSessions);

		// Initialize business logic
		this.initialize();
	}

	// =================================================================
	// INITIALIZATION
	// =================================================================

	/**
	 * Initialize the ViewModel
	 */
	async initialize() {
		await this.loadSessions();
	}

	// =================================================================
	// SESSION BUSINESS OPERATIONS
	// =================================================================

	/**
	 * Load sessions from API and dispatch to AppStateManager
	 */
	async loadSessions(filters = {}) {
		this.operationState.loading = true;
		this.operationState.error = null;
		this.operationState.lastOperation = 'load';

		// Set loading state
		this.appStateManager.sessions.setLoading(true);

		try {
			// Always include all active sessions by default to ensure resumed sessions appear
			// The UI will handle filtering and display - this ensures data availability
			const shouldIncludeAll = filters.includeAll ?? true;
			const requestOptions = { includeAll: shouldIncludeAll };
			if (filters.workspace) {
				requestOptions.workspace = filters.workspace;
			}

			const result = await this.sessionApi.list(requestOptions);
			log.info('Loaded sessions from API', result.sessions?.length || 0);
			console.log('[SessionViewModel] Raw API response:', result.sessions);

			// Validate and normalize sessions
			const validatedSessions = this.validateAndNormalizeSessions(result.sessions || []);
			console.log('[SessionViewModel] Validated sessions:', validatedSessions);

			// Sessions now manage their own socket connections
			// No need to register with socket manager

			// Load sessions into AppState
			this.appStateManager.loadSessions(validatedSessions);

			log.info('Successfully loaded sessions');
		} catch (error) {
			log.error('Failed to load sessions', error);

			this.operationState.error = error.message || 'Failed to load sessions';
			this.appStateManager.sessions.setError(error.message);
		} finally {
			this.operationState.loading = false;
			this.appStateManager.sessions.setLoading(false);
		}
	}

	/**
	 * Create a new session
	 * Sessions are self-contained - just type and options
	 * Working directory is passed in options, managed internally by adapter
	 * @param {Object} params Session creation parameters
	 * @param {string} params.type Session type
	 * @param {Object} [params.options={}] Session options (may include cwd for adapter)
	 */
	async createSession({ type, options = {} }) {
		if (this.operationState.creating) {
			log.warn('Session creation already in progress');
			return null;
		}

		this.operationState.creating = true;
		this.operationState.error = null;
		this.operationState.lastOperation = 'create';

		// Dispatch creating state
		this.appStateManager.ui.setLoading('creatingSession', true);

		try {
			const sessionData = {
				type,
				options
			};

			log.info('Creating session', sessionData);
			const result = await this.sessionApi.create(sessionData);

			const newSession = this.validateAndNormalizeSession(result);
			log.info('Session created successfully', newSession.id);

			// Automatically register session with socket manager
			// Socket registration handled automatically by RunSessionClient when attaching

			// Add session to AppState
			this.appStateManager.createSession(newSession);

			return newSession;
		} catch (error) {
			log.error('Failed to create session', error);

			this.operationState.error = error.message || 'Failed to create session';
			this.appStateManager.sessions.setError(error.message);

			return null;
		} finally {
			this.operationState.creating = false;
			this.appStateManager.ui.setLoading('creatingSession', false);
		}
	}

	/**
	 * Update session properties
	 * @param {string} sessionId - Session ID
	 * @param {Object} updates - Updates to apply
	 */
	async updateSession(sessionId, updates) {
		try {
			log.info('Updating session', sessionId, updates);

			// Convert to API client format - only support rename now
			const result = await this.sessionApi.update({
				action: 'rename',
				sessionId,
				newTitle: updates.title
			});
			const updatedSession = this.validateAndNormalizeSession(result);

			// Dispatch update to AppStateManager
			this.appStateManager.sessions.updateSession(sessionId, updatedSession);

			log.info('Session updated successfully', sessionId);
			return updatedSession;
		} catch (error) {
			log.error('Failed to update session', error);
			this.operationState.error = error.message || 'Failed to update session';

			// Dispatch error
			this.appStateManager.sessions.setError(error.message);

			return null;
		}
	}

	/**
	 * Close/terminate a session
	 * Sessions are self-contained - no workspace coupling needed
	 * @param {string} sessionId - Session ID
	 */
	async closeSession(sessionId) {
		try {
			log.info('Closing session', sessionId);

			// Mark session operation as in progress
			this.sessionOperations.set(sessionId, { operation: 'closing', timestamp: Date.now() });

			// Sessions are self-contained - just delete by ID
			await this.sessionApi.delete(sessionId);

			// Dispatch session removal to AppStateManager
			// Socket cleanup handled automatically by RunSessionClient when detaching
			this.appStateManager.removeSession(sessionId);

			log.info('Session closed successfully', sessionId);
		} catch (error) {
			log.error('Failed to close session', error);
			this.operationState.error = error.message || 'Failed to close session';

			// Dispatch error
			this.appStateManager.sessions.setError(error.message);
		} finally {
			this.sessionOperations.delete(sessionId);
		}
	}

	/**
	 * Handle external session creation (e.g., from Socket.IO events)
	 * Sessions are self-contained - just ID, type, and state
	 * @param {Object} sessionData - Session data
	 * @param {string} sessionData.id - Session ID
	 * @param {string} sessionData.type - Session type
	 */
	handleSessionCreated(sessionData) {
		const { id, type } = sessionData;

		// Validate required fields
		if (!id || !type) {
			log.error('Invalid session data - missing id or type:', sessionData);
			return;
		}

		// Create normalized session object
		const newSession = {
			id,
			sessionType: type,
			type,
			isActive: true,
			title: `New ${type} session`,
			createdAt: new SvelteDate().toISOString(),
			lastActivity: new SvelteDate().toISOString(),
			activityState: 'idle'
		};

		// RunSessionClient handles session registration automatically

		// Dispatch session creation to AppStateManager
		this.appStateManager.createSession(newSession);

		log.info('Session created externally', id);
	}

	/**
	 * Handle session selection from UI components (like ProjectSessionMenu)
	 * Sessions are self-contained - just ID and type
	 * @param {Object} sessionData - Session data from UI component
	 * @param {string} sessionData.id - Session ID
	 * @param {string} sessionData.type - Session type
	 * @param {boolean} sessionData.shouldResume - Whether this is a resume operation
	 */
	async handleSessionSelected(sessionData) {
		const { id, type: _type, shouldResume } = sessionData;

		try {
			if (shouldResume) {
				// This is a session resume operation
				await this.resumeSession(id);

				// Reload sessions to pick up the updated status from server
				await this.loadSessions();
			} else {
				// This is just selecting an existing active session
				// Update the AppState to focus on this session
				this.appStateManager.sessions.updateSession(id, { isActive: true });

				// Add to display if not already visible
				if (!this.appStateManager.ui.display.displayedSessionIds.includes(id)) {
					this.appStateManager.ui.addToDisplay(id);
				}
			}

			log.info('Session selected successfully', id);
		} catch (error) {
			log.error('Failed to handle session selection', error);
			throw error;
		}
	}

	/**
	 * Resume an existing session
	 * Sessions are self-contained - adapter manages working directory internally
	 * @param {string} sessionId - Session ID
	 */
	async resumeSession(sessionId) {
		try {
			log.info('Resuming session', sessionId);

			const existingSession = this.appStateManager.sessions.getSession(sessionId);
			const sessionType = existingSession?.sessionType || existingSession?.type || SESSION_TYPE.PTY;

			// Resume is handled via create with resume flag
			const result = await this.sessionApi.create({
				type: sessionType,
				options: {},
				resume: true,
				sessionId
			});
			const resumedSession = this.validateAndNormalizeSession(result);

			// Automatically register resumed session with socket manager
			// Socket registration handled automatically by RunSessionClient when attaching

			// Check if session exists in current sessions, if not create it, otherwise update it
			const existingInState = this.appStateManager.sessions.getSession(sessionId);
			if (existingInState) {
				// Update existing session
				log.info('Updating existing session in state', sessionId);
				this.appStateManager.sessions.updateSession(sessionId, {
					...resumedSession,
					isActive: true
				});
			} else {
				// Create new session (this automatically adds it to the UI)
				log.info('Creating new session in state', sessionId);
				this.appStateManager.createSession({ ...resumedSession, isActive: true });
			}

			log.info('Session resumed successfully', sessionId);
			return resumedSession;
		} catch (error) {
			log.error('Failed to resume session', error);
			this.operationState.error = error.message || 'Failed to resume session';

			// Dispatch error
			this.appStateManager.sessions.setError(error.message);

			return null;
		}
	}

	// =================================================================
	// MOBILE NAVIGATION HELPERS
	// =================================================================

	navigateToNextSession() {
		this.appStateManager.navigateMobile('next');
	}

	navigateToPrevSession() {
		this.appStateManager.navigateMobile('prev');
	}

	setMobileSessionIndex(index) {
		this.appStateManager.navigateMobile(Number(index));
	}

	// =================================================================
	// ACTIVITY AND STATUS TRACKING
	// =================================================================

	/**
	 * Update session activity state
	 * @param {string} sessionId - Session ID
	 * @param {string} activityState - New activity state
	 */
	updateSessionActivity(sessionId, activityState) {
		// Update activity in AppState
		this.appStateManager.sessions.updateActivity(sessionId, activityState, Date.now());
	}

	/**
	 * Check if session operation is in progress
	 * @param {string} sessionId - Session ID
	 * @returns {boolean}
	 */
	isSessionOperationInProgress(sessionId) {
		return this.sessionOperations.has(sessionId);
	}

	/**
	 * Get session operation state
	 * @param {string} sessionId - Session ID
	 * @returns {Object|null}
	 */
	getSessionOperationState(sessionId) {
		return this.sessionOperations.get(sessionId) || null;
	}

	// =================================================================
	// QUERY METHODS
	// =================================================================

	/**
	 * Get session by ID
	 * @param {string} sessionId - Session ID
	 * @returns {Session|null}
	 */
	getSession(sessionId) {
		return this.appStateManager.sessions.getSession(sessionId);
	}

	/**
	 * Get sessions by type
	 * @param {string} sessionType - Session type
	 * @returns {Session[]}
	 */
	getSessionsByType(sessionType) {
		return this.appStateManager.sessions.getSessionsByType(sessionType);
	}

	// =================================================================
	// VALIDATION AND NORMALIZATION
	// =================================================================

	/**
	 * Validate and normalize sessions array
	 * @param {Array} sessions - Raw sessions from API
	 * @returns {Session[]}
	 */
	validateAndNormalizeSessions(sessions) {
		return sessions
			.filter((s) => s && s.id)
			.map((session) => this.validateAndNormalizeSession(session));
	}

	/**
	 * Validate and normalize a single session
	 * Sessions are completely self-contained - just ID, type, and state
	 * @param {Object} session - Raw session from API
	 * @returns {Session}
	 */
	validateAndNormalizeSession(session) {
		return {
			id: session.id,
			sessionType: session.type || session.sessionType,
			isActive: session.isActive !== undefined ? session.isActive : true,
			title: session.title || `${session.type || session.sessionType} session`,
			createdAt: session.createdAt || new SvelteDate().toISOString(),
			lastActivity: session.lastActivity || new SvelteDate().toISOString(),
			activityState: session.activityState || 'idle'
		};
	}

	// =================================================================
	// ERROR HANDLING
	// =================================================================

	/**
	 * Clear current error state
	 */
	clearError() {
		this.operationState.error = null;

		// Clear error in AppStateManager
		this.appStateManager.sessions.clearError();
	}

	/**
	 * Get current error state
	 * @returns {string|null}
	 */
	getCurrentError() {
		return this.operationState.error || this.appStateManager.ui.errors.sessions;
	}

	// =================================================================
	// LIFECYCLE AND CLEANUP
	// =================================================================

	/**
	 * Cleanup resources
	 */
	dispose() {
		this.sessionOperations.clear();
		this.operationState.error = null;
		log.debug('Disposed');
	}

	/**
	 * Get state summary for debugging
	 * @returns {Object}
	 */
	getState() {
		return {
			operationState: { ...this.operationState },
			sessionOperations: new SvelteMap(this.sessionOperations),
			sessionCount: this.sessionCount,
			hasActiveSessions: this.hasActiveSessions
		};
	}
}
