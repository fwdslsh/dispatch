/**
 * ProjectService - Socket.IO integration for project management
 * Handles project CRUD operations and validation with custom logic
 */

export class ProjectService {
	constructor() {
		this.socket = null;
		this.authenticated = false;
	}

	/**
	 * Initialize socket connection and authenticate
	 * @param {number} timeout - Connection timeout in milliseconds
	 * @returns {Promise<boolean>} - Success status
	 */
	async initialize(timeout = 5000) {
		try {
			const { io } = await import('socket.io-client');
			this.socket = io();

			return new Promise((resolve) => {
				const timeoutId = setTimeout(() => {
					resolve(false);
				}, timeout);

				this.socket.on('connect', () => {
					const authToken = (typeof localStorage !== 'undefined' ? localStorage.getItem('dispatch-auth-token') : null) || 'testkey12345';
					
					this.socket.emit('auth', authToken, (response) => {
						clearTimeout(timeoutId);
						
						if (response?.success) {
							this.authenticated = true;
							this.setupEventListeners();
							resolve(true);
						} else {
							this.authenticated = false;
							resolve(false);
						}
					});
				});

				this.socket.on('connect_error', () => {
					clearTimeout(timeoutId);
					resolve(false);
				});
			});
		} catch (error) {
			console.error('Failed to initialize ProjectService:', error);
			return false;
		}
	}

	/**
	 * Set up socket event listeners
	 */
	setupEventListeners() {
		if (!this.socket) return;

		this.socket.on('disconnect', () => {
			this.authenticated = false;
			console.log('ProjectService disconnected from server');
		});

		this.socket.on('projects-updated', (data) => {
			// Projects updated event - handled by components/ViewModels
			console.log('Projects updated:', data);
		});
	}

	/**
	 * Ensure service is authenticated before operations
	 */
	ensureAuthenticated() {
		if (!this.authenticated || !this.socket) {
			throw new Error('Service not authenticated');
		}
	}

	/**
	 * Get all projects
	 * @returns {Promise<Object>} - Response with projects array and activeProject
	 */
	async getProjects() {
		this.ensureAuthenticated();

		return new Promise((resolve) => {
			this.socket.emit('list-projects', {}, (response) => {
				resolve(response || { success: false, error: 'No response received' });
			});
		});
	}

	/**
	 * Create a new project
	 * @param {Object} projectData - Project data {name, description}
	 * @returns {Promise<Object>} - Response with created project
	 */
	async createProject(projectData) {
		this.ensureAuthenticated();

		// Validate project data
		const validation = this.validateProject(projectData.name);
		if (!validation.isValid) {
			throw new Error(validation.message);
		}

		return new Promise((resolve) => {
			this.socket.emit('create-project', projectData, (response) => {
				resolve(response || { success: false, error: 'No response received' });
			});
		});
	}

	/**
	 * Update an existing project
	 * @param {string} projectId - Project ID
	 * @param {Object} updates - Updates to apply {name?, description?}
	 * @returns {Promise<Object>} - Response object
	 */
	async updateProject(projectId, updates) {
		this.ensureAuthenticated();

		// Validate updates if name is being changed
		if (updates.name !== undefined) {
			const validation = this.validateProject(updates.name);
			if (!validation.isValid) {
				throw new Error(validation.message);
			}
		}

		return new Promise((resolve) => {
			this.socket.emit('update-project', {
				projectId,
				updates
			}, (response) => {
				resolve(response || { success: false, error: 'No response received' });
			});
		});
	}

	/**
	 * Delete a project
	 * @param {string} projectId - Project ID to delete
	 * @returns {Promise<Object>} - Response object
	 */
	async deleteProject(projectId) {
		this.ensureAuthenticated();

		if (!projectId || typeof projectId !== 'string' || projectId.trim().length === 0) {
			throw new Error('Project ID is required');
		}

		return new Promise((resolve) => {
			this.socket.emit('delete-project', {
				projectId: projectId.trim()
			}, (response) => {
				resolve(response || { success: false, error: 'No response received' });
			});
		});
	}

	/**
	 * Set active project
	 * @param {string} projectId - Project ID to set as active
	 * @returns {Promise<Object>} - Response object
	 */
	async setActiveProject(projectId) {
		this.ensureAuthenticated();

		return new Promise((resolve) => {
			this.socket.emit('set-active-project', {
				projectId
			}, (response) => {
				resolve(response || { success: false, error: 'No response received' });
			});
		});
	}

	/**
	 * Validate project name with custom validation logic
	 * @param {string} name - Project name to validate
	 * @returns {Object} - Validation result {isValid, message, severity}
	 */
	validateProject(name) {
		// Check if name is provided and not empty
		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return {
				isValid: false,
				message: 'Project name is required',
				severity: 'error'
			};
		}

		const trimmed = name.trim();

		// Check maximum length
		if (trimmed.length > 50) {
			return {
				isValid: false,
				message: 'Project name must be 50 characters or less',
				severity: 'error'
			};
		}

		// Check valid characters (letters, numbers, spaces, hyphens, underscores)
		const validPattern = /^[a-zA-Z0-9\s_-]+$/;
		if (!validPattern.test(trimmed)) {
			return {
				isValid: false,
				message: 'Project name can only contain letters, numbers, spaces, hyphens, and underscores',
				severity: 'error'
			};
		}

		// Warning for very short names
		if (trimmed.length < 3) {
			return {
				isValid: true,
				message: 'Very short name',
				severity: 'warning'
			};
		}

		// Warning for long names (but still valid)
		if (trimmed.length > 30) {
			return {
				isValid: true,
				message: 'Long name (max 50)',
				severity: 'warning'
			};
		}

		// Valid name
		return {
			isValid: true,
			message: '',
			severity: 'info'
		};
	}

	/**
	 * Clean up resources and disconnect
	 */
	dispose() {
		if (this.socket) {
			this.socket.removeAllListeners();
			this.socket.disconnect();
			this.socket = null;
		}
		this.authenticated = false;
	}
}