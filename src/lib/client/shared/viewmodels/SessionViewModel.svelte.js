/**
 * SessionViewModel.svelte.js
 *
 * ViewModel for session management using Svelte 5 runes.
 * Handles all session-related state and business logic.
 */

import {
	sessionState,
	setAllSessions,
	setDisplayedSessions,
	addSession,
	removeSession
} from '../state/session-state.svelte.js';

/**
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} typeSpecificId
 * @property {string} workspacePath
 * @property {'pty'|'claude'} sessionType
 * @property {boolean} isActive
 * @property {boolean} pinned
 * @property {string} title
 * @property {string} createdAt
 * @property {string} lastActivity
 */

export class SessionViewModel {
	/**
	 * @param {import('../services/SessionApiClient.js').SessionApiClient} sessionApi
	 * @param {import('../services/PersistenceService.js').PersistenceService} persistence
	 * @param {import('../services/LayoutService.svelte.js').LayoutService} layoutService
	 */
	constructor(sessionApi, persistence, layoutService) {
		this.sessionApi = sessionApi;
		this.persistence = persistence;
		this.layoutService = layoutService;

		// Observable state using Svelte 5 runes
		this.sessions = $state([]);
		this.activeSessions = $state(new Map()); // id -> session
		this.loading = $state(false);
		this.error = $state(null);

		// Session display state
		this.displayed = $state([]); // Array of session IDs to display
		this.currentMobileSession = $state(0);

		// Session operation state
		this.creatingSession = $state(false);
		this.selectedSessionId = $state(null);

		// Filter state
		this.showOnlyPinned = $state(true);
		this.filterByWorkspace = $state(null);

		// Derived state
		this.pinnedSessions = $derived.by(() => {
			return this.sessions.filter((s) => s.pinned);
		});
		this.unpinnedSessions = $derived.by(() => {
			return this.sessions.filter((s) => !s.pinned);
		});
		this.visibleSessions = $derived.by(() => {
			if (this.layoutService.isMobile()) {
				// Mobile: show current session from all sessions
				const allSessions = this.sessions.filter((s) => s && s.id);
				if (allSessions.length === 0) return [];
				const validIndex = Math.min(this.currentMobileSession, allSessions.length - 1);
				return allSessions.slice(validIndex, validIndex + 1);
			} else {
				// Desktop: map displayed slots to sessions
				const maxVisible = this.layoutService.maxVisible;
				const ids = this.displayed.slice(0, maxVisible);
				return ids.map((id) => this.getSession(id)).filter(Boolean);
			}
		});
		this.sessionCount = $derived(this.sessions.length);
		this.activeSessionCount = $derived(this.activeSessions.size);
		this.hasActiveSessions = $derived(this.activeSessions.size > 0);

		// Session activity tracking
		this.sessionActivity = $state(new Map()); // id -> activity state

		// Session history loading state
		this.historyLoadingState = $state(new Map()); // id -> { loading: boolean, timestamp: number }
		this.lastMessageTimestamps = $state(new Map()); // id -> timestamp

		// Initialize
		this.initialize();
	}

	/**
	 * Initialize the view model
	 */
	async initialize() {
		await this.loadSessions();
		// restoreDisplayState is now called at the end of loadSessions to ensure proper sync
	}

	/**
	 * Load sessions from API
	 */
	async loadSessions() {
		this.loading = true;
		this.error = null;

		try {
			const options = {
				workspace: this.filterByWorkspace,
				includeAll: true // Always include all sessions initially, filter client-side if needed
			};

			const result = await this.sessionApi.list(options);
			console.log('[SessionViewModel] Loaded sessions from API:', result.sessions);

			// Filter and normalize sessions to ensure they have all required fields
			this.sessions = (result.sessions || [])
				.filter((s) => s && s.id)
				.map((session) => ({
					id: session.id,
					typeSpecificId: session.typeSpecificId,
					workspacePath: session.workspacePath,
					sessionType: session.type, // API uses 'type', we use 'sessionType' internally
					type: session.type, // Keep both for compatibility
					isActive: session.isActive !== undefined ? session.isActive : true,
					pinned: session.pinned !== undefined ? session.pinned : true,
					title: session.title || `${session.type} session`,
					createdAt: session.createdAt || new Date().toISOString(),
					lastActivity: session.lastActivity || new Date().toISOString(),
					activityState: session.activityState || 'idle',
					resumeSession: session.resumeSession || false
				}));
			console.log('[SessionViewModel] Normalized sessions:', this.sessions.length, 'sessions loaded');

			// Update active sessions map
			this.updateActiveSessionsMap();

			// Sort sessions
			this.sortSessions();

			// Restore display state after loading sessions
			this.restoreDisplayState();
			// Note: restoreDisplayState calls syncToGlobalState at the end
		} catch (error) {
			this.error = error.message || 'Failed to load sessions';
			console.error('[SessionViewModel] Load error:', error);
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Create a new session
	 * @param {'pty'|'claude'} type
	 * @param {string} workspacePath
	 * @param {Object} options
	 */
	async createSession(type, workspacePath, options = {}) {
		this.creatingSession = true;
		this.error = null;

		try {
			const result = await this.sessionApi.create({
				type,
				workspacePath,
				options,
				resume: false,
				sessionId: null
			});

			// Create session object
			const newSession = {
				id: result.id,
				typeSpecificId: result.typeSpecificId,
				workspacePath,
				sessionType: type,
				isActive: true,
				pinned: true,
				title: options.title || `New ${type} session`,
				createdAt: new Date().toISOString(),
				lastActivity: new Date().toISOString()
			};

			// Add to sessions
			this.sessions.push(newSession);
			this.activeSessions.set(result.id, newSession);

			// Update display
			this.addToDisplay(result.id);

			// Sort sessions
			this.sortSessions();

			return result;
		} catch (error) {
			this.error = error.message || 'Failed to create session';
			throw error;
		} finally {
			this.creatingSession = false;
		}
	}

	/**
	 * Resume an existing session
	 * @param {string} sessionId
	 * @param {string} workspacePath
	 */
	async resumeSession(sessionId, workspacePath) {
		this.loading = true;
		this.error = null;

		try {
			const result = await this.sessionApi.create({
				type: 'pty', // Default to pty for resume, could be made configurable
				workspacePath,
				options: {},
				resume: true,
				sessionId
			});

			// Update session state
			const session = this.sessions.find((s) => s.id === sessionId);
			if (session) {
				session.isActive = true;
				session.lastActivity = new Date().toISOString();
				this.activeSessions.set(sessionId, session);
			}

			// Update display
			this.addToDisplay(sessionId);

			return result;
		} catch (error) {
			this.error = error.message || 'Failed to resume session';
			throw error;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Close/terminate a session
	 * @param {string} sessionId
	 */
	async closeSession(sessionId) {
		const session = this.getSession(sessionId);
		if (!session) return;

		this.error = null;

		try {
			await this.sessionApi.delete(sessionId, session.workspacePath);

			// Remove from active sessions
			this.activeSessions.delete(sessionId);

			// Update session state
			session.isActive = false;

			// Remove from display if on mobile
			if (this.layoutService.isMobile()) {
				this.sessions = this.sessions.filter((s) => s.id !== sessionId);
				this.adjustMobileIndex();
			} else {
				// Remove from displayed array for desktop
				this.removeFromDisplay(sessionId);
			}
		} catch (error) {
			this.error = error.message || 'Failed to close session';
			throw error;
		}
	}

	/**
	 * Pin a session
	 * @param {string} sessionId
	 */
	async pinSession(sessionId) {
		const session = this.getSession(sessionId);
		if (!session || session.pinned) return;

		try {
			await this.sessionApi.pin(sessionId, session.workspacePath);
			session.pinned = true;
		} catch (error) {
			this.error = error.message || 'Failed to pin session';
			throw error;
		}
	}

	/**
	 * Unpin a session
	 * @param {string} sessionId
	 */
	async unpinSession(sessionId) {
		const session = this.getSession(sessionId);
		if (!session || !session.pinned) return;

		try {
			await this.sessionApi.unpin(sessionId, session.workspacePath);
			session.pinned = false;

			// Remove from display if showing only pinned
			if (this.showOnlyPinned) {
				this.removeFromDisplay(sessionId);
			}
		} catch (error) {
			this.error = error.message || 'Failed to unpin session';
			throw error;
		}
	}

	/**
	 * Rename a session
	 * @param {string} sessionId
	 * @param {string} newTitle
	 */
	async renameSession(sessionId, newTitle) {
		const session = this.getSession(sessionId);
		if (!session) return;

		try {
			await this.sessionApi.rename(sessionId, session.workspacePath, newTitle);
			session.title = newTitle;
			session.lastActivity = new Date().toISOString();
		} catch (error) {
			this.error = error.message || 'Failed to rename session';
			throw error;
		}
	}

	/**
	 * Handle session created from external source (like modal)
	 * @param {Object} sessionData
	 * @param {string} sessionData.id
	 * @param {string} sessionData.type
	 * @param {string} sessionData.workspacePath
	 * @param {string} sessionData.typeSpecificId
	 */
	handleSessionCreated(sessionData) {
		const { id, type, workspacePath, typeSpecificId } = sessionData;

		// Validate required fields
		if (!id || !type) {
			console.error('[SessionViewModel] Invalid session data - missing id or type:', sessionData);
			return;
		}

		// Create session object
		const newSession = {
			id,
			typeSpecificId,
			workspacePath,
			sessionType: type,
			type: type, // Add type field for compatibility with global state
			isActive: true,
			pinned: true,
			title: `New ${type} session`,
			createdAt: new Date().toISOString(),
			lastActivity: new Date().toISOString()
		};

		// Add to sessions if not already present
		const existingSession = this.getSession(id);
		if (!existingSession) {
			this.sessions.push(newSession);
			this.activeSessions.set(id, newSession);

			// Sort sessions
			this.sortSessions();
		}

		// Update display
		this.addToDisplay(id);

		// Update global session state
		this.syncToGlobalState();
	}

	/**
	 * Add session to display
	 * @param {string} sessionId
	 */
	addToDisplay(sessionId) {
		if (this.layoutService.isMobile()) {
			// Find session index and set as current
			const index = this.sessions.findIndex((s) => s.id === sessionId);
			if (index !== -1) {
				this.currentMobileSession = index;
			}
		} else {
			// Desktop: add to displayed array
			if (!this.displayed.includes(sessionId)) {
				const maxVisible = this.layoutService.maxVisible;
				const without = this.displayed.filter((id) => id !== sessionId);
				const head = without.slice(0, Math.max(0, maxVisible - 1));
				this.displayed = [...head, sessionId];
			}
		}

		this.saveDisplayState();
		this.syncToGlobalState();
	}

	/**
	 * Remove session from display
	 * @param {string} sessionId
	 */
	removeFromDisplay(sessionId) {
		this.displayed = this.displayed.filter((id) => id !== sessionId);
		this.saveDisplayState();
		this.syncToGlobalState();
	}

	/**
	 * Adjust mobile session index after removal
	 */
	adjustMobileIndex() {
		const sessionCount = this.sessions.length;
		if (sessionCount === 0) {
			this.currentMobileSession = 0;
		} else if (this.currentMobileSession >= sessionCount) {
			this.currentMobileSession = sessionCount - 1;
		}
		this.saveDisplayState();
		this.syncToGlobalState();
	}

	/**
	 * Navigate to next mobile session
	 */
	nextMobileSession() {
		if (this.sessions.length > 0) {
			this.currentMobileSession = (this.currentMobileSession + 1) % this.sessions.length;
			this.saveDisplayState();
			this.syncToGlobalState();
		}
	}

	/**
	 * Navigate to previous mobile session
	 */
	previousMobileSession() {
		if (this.sessions.length > 0) {
			this.currentMobileSession =
				(this.currentMobileSession - 1 + this.sessions.length) % this.sessions.length;
			this.saveDisplayState();
			this.syncToGlobalState();
		}
	}

	/**
	 * Navigate to next session (alias for mobile navigation)
	 */
	navigateToNextSession() {
		this.nextMobileSession();
	}

	/**
	 * Navigate to previous session (alias for mobile navigation)
	 */
	navigateToPrevSession() {
		this.previousMobileSession();
	}

	/**
	 * Handle session selected from UI
	 * @param {Object} sessionData
	 * @param {string} sessionData.id
	 */
	handleSessionSelected(sessionData) {
		const { id } = sessionData;
		if (!id) return;

		// Update display to show this session
		this.addToDisplay(id);

		// Set as selected
		this.selectedSessionId = id;
	}

	/**
	 * Save display state to persistence
	 */
	saveDisplayState() {
		this.persistence.set('dispatch-displayed-sessions', this.displayed);
		this.persistence.set('dispatch-mobile-index', this.currentMobileSession);
	}

	/**
	 * Restore display state from persistence
	 */
	restoreDisplayState() {
		const savedDisplayed = this.persistence.get('dispatch-displayed-sessions', []);
		// Only restore session IDs that actually exist in loaded sessions
		this.displayed = savedDisplayed.filter((id) => this.sessions.some((s) => s.id === id));
		this.currentMobileSession = this.persistence.get('dispatch-mobile-index', 0);

		console.log('[SessionViewModel] Restored display state - valid IDs:', $state.snapshot(this.displayed));

		// If no displayed sessions but we have pinned sessions, auto-display them for desktop
		if (this.displayed.length === 0 && !this.layoutService.isMobile()) {
			const pinnedSessions = this.sessions.filter((s) => s.pinned);
			if (pinnedSessions.length > 0) {
				// Auto-display up to maxVisible pinned sessions
				const maxVisible = this.layoutService.maxVisible || 4;
				this.displayed = pinnedSessions.slice(0, maxVisible).map((s) => s.id);
				console.log('[SessionViewModel] Auto-displaying pinned sessions:', $state.snapshot(this.displayed));
				this.saveDisplayState();
			}
		}

		// Sync after restoring to ensure UI gets valid sessions
		this.syncToGlobalState();
	}

	/**
	 * Update active sessions map
	 */
	updateActiveSessionsMap() {
		this.activeSessions.clear();
		for (const session of this.sessions) {
			if (session.isActive) {
				this.activeSessions.set(session.id, session);
			}
		}
	}

	/**
	 * Sort sessions by last activity
	 */
	sortSessions() {
		this.sessions.sort((a, b) => {
			const dateA = new Date(a.lastActivity || 0);
			const dateB = new Date(b.lastActivity || 0);
			return dateB.getTime() - dateA.getTime();
		});
	}

	/**
	 * Get a session by ID
	 * @param {string} sessionId
	 * @returns {Session|null}
	 */
	getSession(sessionId) {
		return this.sessions.find((s) => s.id === sessionId) || null;
	}

	/**
	 * Check if session is active
	 * @param {string} sessionId
	 * @returns {boolean}
	 */
	isSessionActive(sessionId) {
		return this.activeSessions.has(sessionId);
	}

	/**
	 * Set session activity state
	 * @param {string} sessionId
	 * @param {'idle'|'processing'|'streaming'} state
	 */
	setSessionActivity(sessionId, state) {
		this.sessionActivity.set(sessionId, state);
	}

	/**
	 * Get session activity state
	 * @param {string} sessionId
	 * @returns {'idle'|'processing'|'streaming'|null}
	 */
	getSessionActivity(sessionId) {
		return this.sessionActivity.get(sessionId) || 'idle';
	}

	/**
	 * Set history loading state for a session
	 * @param {string} sessionId
	 * @param {boolean} isLoading
	 */
	setHistoryLoadingState(sessionId, isLoading) {
		const currentState = this.historyLoadingState.get(sessionId) || {};
		this.historyLoadingState.set(sessionId, {
			loading: isLoading,
			timestamp: isLoading ? Date.now() : currentState.timestamp
		});
	}

	/**
	 * Check if session is loading history
	 * @param {string} sessionId
	 * @returns {boolean}
	 */
	isLoadingHistory(sessionId) {
		const state = this.historyLoadingState.get(sessionId);
		return state?.loading || false;
	}

	/**
	 * Update last message timestamp for a session
	 * @param {string} sessionId
	 * @param {number} timestamp
	 */
	updateLastMessageTimestamp(sessionId, timestamp) {
		this.lastMessageTimestamps.set(sessionId, timestamp);
	}

	/**
	 * Get last message timestamp for a session
	 * @param {string} sessionId
	 * @returns {number|null}
	 */
	getLastMessageTimestamp(sessionId) {
		return this.lastMessageTimestamps.get(sessionId) || null;
	}

	/**
	 * Check if any sessions are loading history
	 * @returns {boolean}
	 */
	hasAnyLoadingHistory() {
		for (const [_, state] of this.historyLoadingState) {
			if (state?.loading) return true;
		}
		return false;
	}

	/**
	 * Filter sessions by workspace
	 * @param {string|null} workspacePath
	 */
	setWorkspaceFilter(workspacePath) {
		this.filterByWorkspace = workspacePath;
		this.loadSessions();
	}

	/**
	 * Toggle pinned filter
	 */
	togglePinnedFilter() {
		this.showOnlyPinned = !this.showOnlyPinned;
		this.loadSessions();
	}

	/**
	 * Refresh sessions
	 */
	async refresh() {
		await this.loadSessions();
	}

	/**
	 * Reset all state
	 */
	reset() {
		this.sessions = [];
		this.activeSessions.clear();
		this.displayed = [];
		this.currentMobileSession = 0;
		this.selectedSessionId = null;
		this.loading = false;
		this.error = null;
		this.creatingSession = false;
		this.sessionActivity.clear();
	}

	/**
	 * Sync local state to global session state
	 */
	syncToGlobalState() {
		try {
			console.log('[SessionViewModel] Starting syncToGlobalState...');

			// Filter sessions to ensure they have valid IDs
			const validSessions = this.sessions.filter((s) => s && s.id);
			console.log('[SessionViewModel] Valid sessions count:', validSessions.length);

			// Update global all sessions
			console.log('[SessionViewModel] Calling setAllSessions...');
			setAllSessions([...validSessions]);
			console.log('[SessionViewModel] setAllSessions completed');

			// Update global displayed sessions - use sessions that should be visible
			const displayedSessions = this.layoutService.isMobile()
				? this.visibleSessions.filter((s) => s && s.id) // Mobile: use the derived visible sessions
				: this.displayed.map((id) => this.getSession(id)).filter((s) => s && s.id); // Desktop: use displayed IDs

			// Use $state.snapshot for proper logging without Svelte warnings
			console.log('[SessionViewModel] Syncing to global state:');
			console.log('- All sessions count:', validSessions.length);
			console.log('- Displayed session IDs:', $state.snapshot(this.displayed));
			console.log('- Displayed sessions count:', displayedSessions.length);
			console.log('- Sample session structure:', validSessions[0] ? {
				id: validSessions[0].id,
				title: validSessions[0].title,
				type: validSessions[0].type || validSessions[0].sessionType,
				pinned: validSessions[0].pinned,
				isActive: validSessions[0].isActive
			} : 'No sessions');

			console.log('[SessionViewModel] Calling setDisplayedSessions...');
			setDisplayedSessions([...displayedSessions]);
			console.log('[SessionViewModel] setDisplayedSessions completed - syncToGlobalState finished successfully');
		} catch (error) {
			console.error('[SessionViewModel] ERROR in syncToGlobalState:', error);
			console.error('[SessionViewModel] Error stack:', error.stack);
		}
	}

	/**
	 * Get state summary for debugging
	 * @returns {Object}
	 */
	getState() {
		return {
			sessions: this.sessions.length,
			active: this.activeSessions.size,
			displayed: this.displayed.length,
			currentMobile: this.currentMobileSession,
			loading: this.loading,
			error: this.error,
			pinned: this.pinnedSessions.length,
			unpinned: this.unpinnedSessions.length
		};
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		this.reset();
	}
}
