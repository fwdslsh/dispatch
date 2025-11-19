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
 * @property {string} id
 * @property {string} workspacePath
 * @property {string} sessionType
 * @property {boolean} isActive
 * @property {boolean} inLayout
 * @property {string|null} [tileId]
 * @property {string} title
 * @property {string} createdAt
 * @property {string} lastActivity
 * @property {string} activityState
 */

export class SessionViewModel {
	/**
	 * @param {import('../state/AppState.svelte.js').AppState} appStateManager
	 * @param {import('../services/SessionApiClient.js').SessionApiClient} sessionApi
	 * @param {import('../services/SettingsService.svelte.js').SettingsService} [settingsService] - Settings service for accessing configuration
	 */
	constructor(appStateManager, sessionApi, settingsService = null) {
		this.appStateManager = appStateManager;
		this.sessionApi = sessionApi;
		this.settingsService = settingsService;

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
		this.inLayoutSessions = $derived(this.appStateManager.sessions.inLayoutSessions);
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
	 * @param {Object} params Session creation parameters
	 * @param {string} params.type Session type
	 * @param {string} params.workspacePath Workspace path
	 * @param {Object} [params.options={}] Additional session options
	 */
	async createSession({ type, workspacePath, options = {} }) {
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
				workspacePath,
				...options
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
	 * Toggle session layout state (add/remove from layout)
	 * @param {string} sessionId - Session ID
	 */
	async toggleSessionPin(sessionId) {
		const session = this.getSession(sessionId);
		if (!session) {
			log.warn('Session not found for layout toggle', sessionId);
			return;
		}

		if (session.inLayout) {
			await this.removeFromLayout(sessionId);
		} else {
			// Add to first available tile - this would need tile management
			log.info('Adding session to layout would require tile selection', sessionId);
		}
	}

	/**
	 * Remove a session from layout
	 * @param {string} sessionId - Session ID
	 */
	async removeFromLayout(sessionId) {
		const session = this.getSession(sessionId);
		if (!session) {
			log.warn('Session not found for layout removal', sessionId);
			return;
		}

		if (!session.inLayout) {
			log.debug('Session already not in layout', sessionId);
			return;
		}

		try {
			await this.sessionApi.removeLayout(sessionId);

			// Update session in state via AppStateManager
			const updatedSession = { ...session, inLayout: false };
			this.appStateManager.sessions.updateSession(sessionId, updatedSession);

			log.info('Session removed from layout successfully', sessionId);
		} catch (error) {
			log.error('Failed to remove session from layout', error);
			this.operationState.error = error.message || 'Failed to remove session from layout';

			// Dispatch error
			this.appStateManager.sessions.setError(error.message);
		}
	}

	/**
	 * Add a session to a specific tile layout
	 * @param {string} sessionId - Session ID
	 * @param {string} tileId - Tile ID (e.g., 'tile-1', 'tile-2')
	 * @param {number} position - Position within tile
	 */
	async addToLayout(sessionId, tileId, position = 0) {
		const session = this.getSession(sessionId);
		if (!session) {
			log.warn('Session not found for layout addition', sessionId);
			return;
		}

		try {
			// Get the actual clientId from localStorage (same as RunSessionClient)
			const clientId = getClientId();

			await this.sessionApi.setLayout(sessionId, tileId, position, clientId);

			// Update session in state via AppStateManager
			const updatedSession = { ...session, inLayout: true, tileId, position };
			this.appStateManager.sessions.updateSession(sessionId, updatedSession);

			log.info('Session added to layout successfully', { sessionId, tileId, position });
		} catch (error) {
			log.error('Failed to add session to layout', error);
			this.operationState.error = error.message || 'Failed to add session to layout';

			// Dispatch error
			this.appStateManager.sessions.setError(error.message);
		}
	}

	/**
	 * Close/terminate a session
	 * @param {string} sessionId - Session ID
	 */
	async closeSession(sessionId) {
		try {
			log.info('Closing session', sessionId);

			// Mark session operation as in progress
			this.sessionOperations.set(sessionId, { operation: 'closing', timestamp: Date.now() });

			// Get session to obtain workspacePath for API call
			const session = this.getSession(sessionId);
			if (!session) {
				this.operationState.error = `Session ${sessionId} not found`;
				log.error('Session not found for close operation', sessionId);
				this.appStateManager.sessions.setError(this.operationState.error);
				return false;
			}

			// Ensure workspacePath is valid
			const workspacePath = session.workspacePath || '';
			if (!workspacePath) {
				log.warn('Session has missing workspacePath, attempting fallback', sessionId);
				// Try to get from current workspace selection as fallback
				const currentWorkspace = this.appStateManager.workspaces.selectedWorkspace;
				let fallbackPath = currentWorkspace?.path || '';

				// If still no valid workspace path, use a default or force cleanup
				if (!fallbackPath) {
					log.warn('No valid workspace path available, forcing session cleanup', sessionId);
					// Use a placeholder path for corrupted sessions
					fallbackPath = '/tmp/corrupted-session-cleanup';
				}

				await this.sessionApi.delete(sessionId);
			} else {
				await this.sessionApi.delete(sessionId);
			}

			// Dispatch session removal to AppStateManager
			// Cleanup socket manager registration
			// Socket cleanup handled automatically by RunSessionClient when detaching
			this.appStateManager.removeSession(sessionId);

			log.info('Session closed successfully', sessionId);
			return true;
		} catch (error) {
			log.error('Failed to close session', error);
			this.operationState.error = error.message || 'Failed to close session';

			// Dispatch error
			this.appStateManager.sessions.setError(error.message);
			return false;
		} finally {
			this.sessionOperations.delete(sessionId);
		}
	}

	/**
	 * Handle external session creation (e.g., from Socket.IO events)
	 * @param {Object} sessionData - Session data
	 * @param {string} sessionData.id - Session ID
	 * @param {string} sessionData.type - Session type
	 * @param {string} sessionData.workspacePath - Workspace path
	 */
	handleSessionCreated(sessionData) {
		const { id, type, workspacePath } = sessionData;

		// Validate required fields
		if (!id || !type) {
			log.error('Invalid session data - missing id or type:', sessionData);
			return;
		}

		// Create normalized session object
		const newSession = {
			id,
			workspacePath,
			sessionType: type,
			type,
			isActive: true,
			inLayout: false,
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
	 * @param {Object} sessionData - Session data from UI component
	 * @param {string} sessionData.id - Session ID
	 * @param {string} sessionData.type - Session type
	 * @param {string} sessionData.workspacePath - Workspace path
	 * @param {boolean} sessionData.shouldResume - Whether this is a resume operation
	 */
	async handleSessionSelected(sessionData) {
		const { id, type: _type, workspacePath, shouldResume } = sessionData;

		try {
			if (shouldResume) {
				// This is a session resume operation
				await this.resumeSession(id, workspacePath);

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
	 * @param {string} sessionId - Session ID
	 * @param {string} workspacePath - Workspace path
	 */
	async resumeSession(sessionId, workspacePath) {
		try {
			log.info('Resuming session', sessionId);

			const existingSession = this.appStateManager.sessions.getSession(sessionId);
			const sessionType = existingSession?.sessionType || existingSession?.type || SESSION_TYPE.PTY;
			const resolvedWorkspace = existingSession?.workspacePath || workspacePath || '';

			// Resume is handled via create with resume flag
			const result = await this.sessionApi.create({
				type: sessionType,
				workspacePath: resolvedWorkspace,
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
	 * Get sessions by workspace
	 * @param {string} workspacePath - Workspace path
	 * @returns {Session[]}
	 */
	getSessionsByWorkspace(workspacePath) {
		return this.appStateManager.sessions.getSessionsByWorkspace(workspacePath);
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
	 * @param {Object} session - Raw session from API
	 * @returns {Session}
	 */
	validateAndNormalizeSession(session) {
		// In simplified architecture, sessions don't need workspacePath
		// They manage their own working directories once created
		return {
			id: session.id,
			workspacePath: session.workingDirectory || session.workspacePath || '',
			sessionType: session.type || session.sessionType,
			isActive: session.isActive !== undefined ? session.isActive : true,
			inLayout: session.inLayout !== undefined ? session.inLayout : !!session.tileId,
			tileId: session.tileId ?? session.layout?.tileId ?? null,
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
	// SETTINGS AND DEFAULTS
	// =================================================================

	/**
	 * Get the default workspace directory from settings
	 * @returns {string} Default workspace path
	 */
	getDefaultWorkspace() {
		if (!this.settingsService) {
			log.warn('Settings service not available, returning empty string');
			return '';
		}
		return this.settingsService.get('global.defaultWorkspaceDirectory', '');
	}

	/**
	 * Get default session options for a given session type
	 * Processes settings the same way session-specific settings components do
	 * @param {string} sessionType - Session type (e.g., 'claude', 'pty')
	 * @returns {Object} Processed session options
	 */
	getDefaultSessionOptions(sessionType) {
		if (!this.settingsService) {
			log.warn('Settings service not available, returning empty options');
			return {};
		}

		switch (sessionType) {
			case SESSION_TYPE.CLAUDE: {
				// Get raw values from settings service
				const model = this.settingsService.get('claude.model', '');
				const customSystemPrompt = this.settingsService.get('claude.customSystemPrompt', '');
				const appendSystemPrompt = this.settingsService.get('claude.appendSystemPrompt', '');
				const maxTurns = this.settingsService.get('claude.maxTurns', null);
				const maxThinkingTokens = this.settingsService.get('claude.maxThinkingTokens', null);
				const fallbackModel = this.settingsService.get('claude.fallbackModel', '');
				const includePartialMessages = this.settingsService.get(
					'claude.includePartialMessages',
					false
				);
				const continueConversation = this.settingsService.get('claude.continueConversation', false);
				const permissionMode = this.settingsService.get('claude.permissionMode', 'default');
				const executable = this.settingsService.get('claude.executable', 'auto');
				const executableArgs = this.settingsService.get('claude.executableArgs', '');
				const allowedTools = this.settingsService.get('claude.allowedTools', '');
				const disallowedTools = this.settingsService.get('claude.disallowedTools', '');
				const additionalDirectories = this.settingsService.get('claude.additionalDirectories', '');
				const strictMcpConfig = this.settingsService.get('claude.strictMcpConfig', false);

				// Process settings the same way ClaudeSettings component does for session mode
				const cleanSettings = {
					model: model.trim() || undefined,
					customSystemPrompt: customSystemPrompt.trim() || undefined,
					appendSystemPrompt: appendSystemPrompt.trim() || undefined,
					maxTurns: maxTurns || undefined,
					maxThinkingTokens: maxThinkingTokens || undefined,
					fallbackModel: fallbackModel.trim() || undefined,
					includePartialMessages: includePartialMessages || undefined,
					continue: continueConversation || undefined,
					permissionMode: permissionMode !== 'default' ? permissionMode : undefined,
					executable: executable !== 'auto' ? executable : undefined,
					executableArgs: executableArgs.trim()
						? executableArgs
								.split(',')
								.map((arg) => arg.trim())
								.filter(Boolean)
						: undefined,
					allowedTools: allowedTools.trim()
						? allowedTools
								.split(',')
								.map((tool) => tool.trim())
								.filter(Boolean)
						: undefined,
					disallowedTools: disallowedTools.trim()
						? disallowedTools
								.split(',')
								.map((tool) => tool.trim())
								.filter(Boolean)
						: undefined,
					additionalDirectories: additionalDirectories.trim()
						? additionalDirectories
								.split(',')
								.map((dir) => dir.trim())
								.filter(Boolean)
						: undefined,
					strictMcpConfig: strictMcpConfig || undefined
				};

				// Filter out undefined values to keep payload clean
				return Object.fromEntries(Object.entries(cleanSettings).filter(([_, v]) => v !== undefined));
			}

			default:
				return {};
		}
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
