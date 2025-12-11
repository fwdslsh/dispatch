/**
 * CreateSessionViewModel.svelte.js
 *
 * ViewModel for CreateSessionModal component.
 * Handles session creation business logic, validation, and state management.
 *
 * MVVM ARCHITECTURE:
 * - Pure business logic (no UI concerns)
 * - Manages form state and validation
 * - Coordinates between SessionApiClient and SessionViewModel
 * - Returns success/failure (never throws)
 */

import { SESSION_TYPE } from '$lib/shared/session-types.js';

const LAST_WORKSPACE_KEY = 'dispatch-last-workspace-path';

/**
 * CreateSessionViewModel
 * Manages the business logic for creating new sessions
 */
export class CreateSessionViewModel {
	/**
	 * @param {import('./SessionViewModel.svelte.js').SessionViewModel} sessionViewModel - Session management ViewModel
	 * @param {import('../services/SessionApiClient.js').SessionApiClient} sessionApi - Session API client
	 */
	constructor(sessionViewModel, sessionApi) {
		this.sessionViewModel = sessionViewModel;
		this.sessionApi = sessionApi;

		// Form state
		this.sessionType = $state(SESSION_TYPE.AI);
		this.workspacePath = $state('');
		this.sessionSettings = $state({});

		// Operation state
		this.loading = $state(false);
		this.error = $state(null);

		// Derived state
		this.canSubmit = $derived.by(() => {
			return !this.loading && !!this.workspacePath.trim() && !!this.sessionApi;
		});

		this.defaultWorkspace = $derived(this.sessionViewModel?.getDefaultWorkspace() || '');
	}

	/**
	 * Get last selected workspace path from localStorage
	 * @returns {string|null} Last workspace path or null
	 */
	getLastWorkspacePath() {
		if (typeof localStorage === 'undefined') return null;
		try {
			return localStorage.getItem(LAST_WORKSPACE_KEY);
		} catch (e) {
			console.warn('Failed to get last workspace path:', e);
			return null;
		}
	}

	/**
	 * Save workspace path to localStorage
	 * @param {string} path - Workspace path to save
	 */
	saveLastWorkspacePath(path) {
		if (typeof localStorage === 'undefined' || !path) return;
		try {
			localStorage.setItem(LAST_WORKSPACE_KEY, path);
		} catch (e) {
			console.warn('Failed to save last workspace path:', e);
		}
	}

	/**
	 * Initialize the ViewModel
	 * Sets workspace path from last selected or default
	 */
	initialize() {
		if (!this.workspacePath) {
			// Try to use last selected workspace first
			const lastPath = this.getLastWorkspacePath();
			if (lastPath) {
				this.workspacePath = lastPath;
			} else if (this.sessionViewModel) {
				// Fall back to default workspace
				this.workspacePath = this.sessionViewModel.getDefaultWorkspace();
			}
		}
	}

	/**
	 * Reset to initial state
	 * @param {string} [sessionType] - Optional session type to reset to
	 */
	reset(sessionType = SESSION_TYPE.AI) {
		this.sessionType = sessionType;
		this.workspacePath = '';
		this.sessionSettings = {};
		this.loading = false;
		this.error = null;
	}

	/**
	 * Update session type
	 * @param {string} type - New session type
	 */
	setSessionType(type) {
		this.sessionType = type;
		// Reset settings when type changes
		this.sessionSettings = {};
		this.error = null;
	}

	/**
	 * Update workspace path
	 * @param {string} path - New workspace path
	 */
	setWorkspacePath(path) {
		this.workspacePath = path;
		this.error = null;
		// Save for future sessions
		this.saveLastWorkspacePath(path);
	}

	/**
	 * Update session settings
	 * @param {Object} settings - Session-specific settings
	 */
	setSessionSettings(settings) {
		this.sessionSettings = settings;
	}

	/**
	 * Validate form data
	 * @returns {boolean} Whether form is valid
	 */
	validate() {
		this.error = null;

		if (!this.workspacePath.trim()) {
			this.error = 'Please select a workspace';
			return false;
		}

		if (!this.sessionApi) {
			this.error = 'API client not initialized';
			return false;
		}

		return true;
	}

	/**
	 * Create a new session
	 * Validates input, calls API, handles errors
	 *
	 * @returns {Promise<Object|null>} Created session object or null on failure
	 */
	async createSession() {

		// Validate before attempting creation
		if (!this.validate()) {
			console.error('[CreateSessionViewModel] Validation failed:', this.error);
			return null;
		}

		this.loading = true;
		this.error = null;

		try {
			// Create the session using SessionApiClient
			const session = await this.sessionApi.create({
				type: this.sessionType,
				workspacePath: this.workspacePath,
				options: this.sessionSettings
			});


			// Return success data for the View to handle
			return {
				id: session.id,
				type: this.sessionType,
				workspacePath: this.workspacePath,
				typeSpecificId: session.typeSpecificId,
				session
			};
		} catch (err) {
			console.error('[CreateSessionViewModel] Error caught:', err);
			this.error = `Error creating session: ${err.message}`;
			return null;
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Get current state for debugging
	 * @returns {Object} Current state snapshot
	 */
	getState() {
		return {
			sessionType: this.sessionType,
			workspacePath: this.workspacePath,
			loading: this.loading,
			error: this.error,
			canSubmit: this.canSubmit,
			hasSettings: Object.keys(this.sessionSettings).length > 0
		};
	}
}
