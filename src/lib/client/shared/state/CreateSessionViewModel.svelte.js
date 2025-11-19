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
		this.sessionType = $state(SESSION_TYPE.CLAUDE);
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
	 * Initialize the ViewModel
	 * Sets default workspace if not already set
	 */
	initialize() {
		if (!this.workspacePath && this.sessionViewModel) {
			this.workspacePath = this.sessionViewModel.getDefaultWorkspace();
		}
	}

	/**
	 * Reset to initial state
	 * @param {string} [sessionType] - Optional session type to reset to
	 */
	reset(sessionType = SESSION_TYPE.CLAUDE) {
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
			console.error('Session creation validation failed:', this.error);
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

			console.log('[CreateSessionViewModel] Session created successfully:', session.id);

			// Return success data for the View to handle
			return {
				id: session.id,
				type: this.sessionType,
				workspacePath: this.workspacePath,
				typeSpecificId: session.typeSpecificId,
				session
			};
		} catch (err) {
			this.error = `Error creating session: ${err.message}`;
			console.error('[CreateSessionViewModel] Failed to create session:', err);
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
