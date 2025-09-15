/**
 * SessionViewModel.svelte.js
 *
 * ViewModel for session management using Svelte 5 runes.
 * Handles all session-related state and business logic.
 */

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
	 * @param {import('../services/LayoutService.js').LayoutService} layoutService
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
			return this.sessions.filter(s => s.pinned);
		});
		this.unpinnedSessions = $derived.by(() => {
			return this.sessions.filter(s => !s.pinned);
		});
		this.visibleSessions = $derived.by(() => {
			if (this.layoutService.isMobile()) {
				// Mobile: show current session from all sessions
				const allSessions = this.sessions.filter(s => s && s.id);
				if (allSessions.length === 0) return [];
				const validIndex = Math.min(this.currentMobileSession, allSessions.length - 1);
				return allSessions.slice(validIndex, validIndex + 1);
			} else {
				// Desktop: map displayed slots to sessions
				const maxVisible = this.layoutService.maxVisible;
				const ids = this.displayed.slice(0, maxVisible);
				return ids.map(id => this.getSession(id)).filter(Boolean);
			}
		});
		this.sessionCount = $derived(this.sessions.length);
		this.activeSessionCount = $derived(this.activeSessions.size);
		this.hasActiveSessions = $derived(this.activeSessions.size > 0);

		// Session activity tracking
		this.sessionActivity = $state(new Map()); // id -> activity state

		// Initialize
		this.initialize();
	}

	/**
	 * Initialize the view model
	 */
	async initialize() {
		await this.loadSessions();
		this.restoreDisplayState();
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
				includeAll: !this.showOnlyPinned
			};

			const result = await this.sessionApi.list(options);
			this.sessions = result.sessions || [];

			// Update active sessions map
			this.updateActiveSessionsMap();

			// Sort sessions
			this.sortSessions();
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
				options
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
				resume: true,
				sessionId,
				workspacePath
			});

			// Update session state
			const session = this.sessions.find(s => s.id === sessionId);
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
				this.sessions = this.sessions.filter(s => s.id !== sessionId);
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
	 * Add session to display
	 * @param {string} sessionId
	 */
	addToDisplay(sessionId) {
		if (this.layoutService.isMobile()) {
			// Find session index and set as current
			const index = this.sessions.findIndex(s => s.id === sessionId);
			if (index !== -1) {
				this.currentMobileSession = index;
			}
		} else {
			// Desktop: add to displayed array
			if (!this.displayed.includes(sessionId)) {
				const maxVisible = this.layoutService.maxVisible;
				const without = this.displayed.filter(id => id !== sessionId);
				const head = without.slice(0, Math.max(0, maxVisible - 1));
				this.displayed = [...head, sessionId];
			}
		}

		this.saveDisplayState();
	}

	/**
	 * Remove session from display
	 * @param {string} sessionId
	 */
	removeFromDisplay(sessionId) {
		this.displayed = this.displayed.filter(id => id !== sessionId);
		this.saveDisplayState();
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
	}

	/**
	 * Navigate to next mobile session
	 */
	nextMobileSession() {
		if (this.sessions.length > 0) {
			this.currentMobileSession = (this.currentMobileSession + 1) % this.sessions.length;
			this.saveDisplayState();
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
		}
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
		this.displayed = this.persistence.get('dispatch-displayed-sessions', []);
		this.currentMobileSession = this.persistence.get('dispatch-mobile-index', 0);
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
			return dateB - dateA;
		});
	}

	/**
	 * Get a session by ID
	 * @param {string} sessionId
	 * @returns {Session|null}
	 */
	getSession(sessionId) {
		return this.sessions.find(s => s.id === sessionId) || null;
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