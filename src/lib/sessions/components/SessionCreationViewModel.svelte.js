/**
 * Session Creation ViewModel
 *
 * Handles session creation business logic using MVVM pattern.
 * Separates session creation concerns from UI components.
 */

import { BaseViewModel } from '../../shared/contexts/BaseViewModel.svelte.js';

/**
 * Session Creation States
 */
export const SESSION_CREATION_STATES = {
	IDLE: 'idle',
	CREATING: 'creating',
	SUCCESS: 'success',
	ERROR: 'error'
};

/**
 * Session Types
 */
export const SESSION_TYPES = {
	SHELL: 'shell',
	CLAUDE: 'claude'
};

/**
 * Session Creation ViewModel
 */
export class SessionCreationViewModel extends BaseViewModel {
	constructor(sessionService, projectId) {
		super();

		this.sessionService = sessionService;
		this.projectId = projectId;

		// Creation state
		this.creationState = $state(SESSION_CREATION_STATES.IDLE);
		this.selectedSessionType = $state(null);
		this.creationData = $state(null);
		this.lastCreatedSession = $state(null);
		this.creationError = $state(null);

		// Session options
		this.sessionOptions = $state({
			name: '',
			type: SESSION_TYPES.SHELL,
			customOptions: {},
			cols: 80,
			rows: 24
		});

		// Computed states
		this.isCreating = $derived(() => this.creationState === SESSION_CREATION_STATES.CREATING);
		this.hasError = $derived(() => this.creationState === SESSION_CREATION_STATES.ERROR);
		this.canCreate = $derived(
			() =>
				this.creationState === SESSION_CREATION_STATES.IDLE &&
				this.sessionOptions.name.trim().length > 0 &&
				this.sessionOptions.type
		);

		// Available session types for this project
		this.availableTypes = $derived(() => {
			// Shell is always available
			const types = [
				{
					id: SESSION_TYPES.SHELL,
					name: 'Shell Terminal',
					description: 'Standard shell terminal session',
					requiresProject: false
				}
			];

			// Claude is available if we have a project
			if (this.projectId) {
				types.push({
					id: SESSION_TYPES.CLAUDE,
					name: 'Claude Code Session',
					description: 'AI-assisted development with Claude',
					requiresProject: true
				});
			}

			return types;
		});
	}

	/**
	 * Set selected session type
	 * @param {string} typeId - Session type ID
	 */
	setSessionType(typeId) {
		const availableType = this.availableTypes.find((t) => t.id === typeId);
		if (availableType) {
			this.selectedSessionType = availableType;
			this.sessionOptions.type = typeId;

			// Update default options based on type
			if (typeId === SESSION_TYPES.CLAUDE) {
				this.sessionOptions.cols = 120;
				this.sessionOptions.rows = 30;
			} else {
				this.sessionOptions.cols = 80;
				this.sessionOptions.rows = 24;
			}

			console.log('SessionCreationViewModel: Session type set to', typeId);
		}
	}

	/**
	 * Set session creation data (from form)
	 * @param {Object} data - Session creation data
	 */
	setCreationData(data) {
		this.creationData = data;

		// Automatically trigger creation if we have data
		if (data) {
			this.createSessionFromData(data);
		}
	}

	/**
	 * Update session options
	 * @param {Object} updates - Option updates
	 */
	updateOptions(updates) {
		this.sessionOptions = { ...this.sessionOptions, ...updates };
		console.log('SessionCreationViewModel: Options updated', updates);
	}

	/**
	 * Create session from current options
	 * @returns {Promise<Object|null>} Created session or null on error
	 */
	async createSession() {
		if (!this.canCreate) {
			console.warn('SessionCreationViewModel: Cannot create session - invalid state or options');
			return null;
		}

		try {
			this.creationState = SESSION_CREATION_STATES.CREATING;
			this.creationError = null;

			const sessionData = {
				name: this.sessionOptions.name.trim(),
				type: this.sessionOptions.type,
				projectId: this.projectId,
				cols: this.sessionOptions.cols,
				rows: this.sessionOptions.rows,
				customOptions: this.sessionOptions.customOptions
			};

			console.log('SessionCreationViewModel: Creating session:', sessionData);

			const response = await this.sessionService.createSession(sessionData);

			if (response.success) {
				this.lastCreatedSession = response.data;
				this.creationState = SESSION_CREATION_STATES.SUCCESS;

				// Reset form after successful creation
				this.resetForm();

				// Emit success event
				this.emit('session-created', {
					session: response.data,
					timestamp: new Date().toISOString()
				});

				console.log('SessionCreationViewModel: Session created successfully:', response.data);
				return response.data;
			} else {
				this.creationError = response.error || 'Failed to create session';
				this.creationState = SESSION_CREATION_STATES.ERROR;

				// Emit error event
				this.emit('session-creation-error', {
					error: this.creationError,
					sessionData,
					timestamp: new Date().toISOString()
				});

				console.error('SessionCreationViewModel: Session creation failed:', this.creationError);
				return null;
			}
		} catch (error) {
			this.creationError = error.message;
			this.creationState = SESSION_CREATION_STATES.ERROR;

			console.error('SessionCreationViewModel: Error creating session:', error);
			return null;
		}
	}

	/**
	 * Create session from form data
	 * @param {Object} data - Form data
	 * @returns {Promise<Object|null>} Created session or null on error
	 */
	async createSessionFromData(data) {
		try {
			console.log('SessionCreationViewModel: Creating session from data:', data);

			// Extract session options from data
			const sessionType = data.sessionType || this.selectedSessionType?.id || SESSION_TYPES.SHELL;
			const sessionName = data.name || 'Terminal Session';

			// Update our options
			this.updateOptions({
				name: sessionName,
				type: sessionType,
				customOptions: data.customOptions || {},
				cols: data.cols || 80,
				rows: data.rows || 24
			});

			// Create the session
			return await this.createSession();
		} catch (error) {
			console.error('SessionCreationViewModel: Error creating session from data:', error);
			this.creationError = error.message;
			this.creationState = SESSION_CREATION_STATES.ERROR;
			return null;
		}
	}

	/**
	 * Reset the creation form
	 */
	resetForm() {
		this.sessionOptions = {
			name: '',
			type: this.selectedSessionType?.id || SESSION_TYPES.SHELL,
			customOptions: {},
			cols: this.selectedSessionType?.id === SESSION_TYPES.CLAUDE ? 120 : 80,
			rows: this.selectedSessionType?.id === SESSION_TYPES.CLAUDE ? 30 : 24
		};

		this.creationData = null;
		console.log('SessionCreationViewModel: Form reset');
	}

	/**
	 * Clear error state
	 */
	clearError() {
		if (this.hasError) {
			this.creationState = SESSION_CREATION_STATES.IDLE;
			this.creationError = null;
			console.log('SessionCreationViewModel: Error cleared');
		}
	}

	/**
	 * Validate session options
	 * @returns {Object} Validation result
	 */
	validateOptions() {
		const errors = [];

		if (!this.sessionOptions.name.trim()) {
			errors.push('Session name is required');
		}

		if (this.sessionOptions.name.length > 100) {
			errors.push('Session name must be 100 characters or less');
		}

		if (!this.sessionOptions.type) {
			errors.push('Session type is required');
		}

		if (!this.availableTypes.find((t) => t.id === this.sessionOptions.type)) {
			errors.push('Invalid session type');
		}

		if (this.sessionOptions.cols < 10 || this.sessionOptions.cols > 500) {
			errors.push('Terminal columns must be between 10 and 500');
		}

		if (this.sessionOptions.rows < 5 || this.sessionOptions.rows > 200) {
			errors.push('Terminal rows must be between 5 and 200');
		}

		// Type-specific validation
		if (this.sessionOptions.type === SESSION_TYPES.CLAUDE && !this.projectId) {
			errors.push('Claude sessions require a project');
		}

		return {
			valid: errors.length === 0,
			errors
		};
	}

	/**
	 * Get creation summary
	 */
	getCreationSummary() {
		return {
			state: this.creationState,
			isCreating: this.isCreating,
			hasError: this.hasError,
			canCreate: this.canCreate,
			selectedType: this.selectedSessionType,
			options: this.sessionOptions,
			lastSession: this.lastCreatedSession,
			error: this.creationError,
			availableTypes: this.availableTypes
		};
	}

	/**
	 * Cleanup resources
	 */
	destroy() {
		super.destroy();
		this.resetForm();
		this.selectedSessionType = null;
		this.lastCreatedSession = null;
		this.creationError = null;
		console.log('SessionCreationViewModel: Destroyed');
	}
}
