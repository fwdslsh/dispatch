/**
 * Project Service
 *
 * Straightforward project management without unnecessary complexity.
 * Follows clean service patterns with minimal dependencies.
 */

import { PROJECT_VALIDATION } from '../config.js';

/**
 * Project Service
 */
export class ProjectSocketClient {
	constructor(terminalKey = '') {
		this.socket = null;
		this.terminalKey = terminalKey;
		this.currentProject = null;
		this.projects = [];
	}

	/**
	 * Initialize the service with socket connection
	 */
	async initialize() {
		try {
			// Import and set up socket connection
			const { io } = await import('socket.io-client');
			this.socket = io(); // This is correct if you want a root namespace socket

			// Wait for connection and authentication
			return new Promise((resolve) => {
				this.socket.on('connect', () => {
					// Authenticate with terminal key
					const key = this.terminalKey || 'test'; // Fallback to 'test' for dev
					this.socket.emit('auth', key, (response) => {
						if (response?.success) {
							resolve(true);
						} else {
							console.error('ProjectService: Authentication failed:', response);
							resolve(false);
						}
					});
				});

				this.socket.on('connect_error', () => {
					resolve(false);
				});
			});
		} catch (error) {
			console.error('ProjectService: Initialize failed:', error);
			return false;
		}
	}

	/**
	 * Check if socket is connected
	 */
	_checkConnection() {
		if (!this.socket || !this.socket.connected) {
			throw new Error('Service not initialized or connection lost');
		}
	}

	/**
	 * Create a new project
	 */
	async createProject(data) {
		try {
			this._checkConnection();

			return new Promise((resolve) => {
				this.socket.emit(
					'create-project',
					{
						name: data.name || 'Untitled Project',
						description: data.description || ''
					},
					(response) => {
						if (response?.success) {
							resolve({ success: true, data: response.project });
						} else {
							resolve({ success: false, error: response?.error || 'Failed to create project' });
						}
					}
				);
			});
		} catch (error) {
			console.error('ProjectService: Create project failed:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get a specific project
	 */
	async getProject(projectId) {
		try {
			this._checkConnection();

			return new Promise((resolve) => {
				this.socket.emit('get-project', { projectId }, (response) => {
					if (response?.success) {
						resolve({ success: true, data: response.project });
					} else {
						resolve({ success: false, error: response?.error || 'Failed to get project' });
					}
				});
			});
		} catch (error) {
			console.error('ProjectService: Get project failed:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Get all projects
	 */
	async getProjects() {
		try {
			this._checkConnection();

			return new Promise((resolve) => {
				this.socket.emit('list-projects', (response) => {
					if (response?.success) {
						this.projects = response.projects || [];
						resolve({ success: true, data: this.projects });
					} else {
						resolve({ success: false, error: response?.error || 'Failed to get projects' });
					}
				});
			});
		} catch (error) {
			console.error('ProjectService: Get projects failed:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Update a project
	 */
	async updateProject(projectId, updates) {
		try {
			this._checkConnection();

			return new Promise((resolve) => {
				this.socket.emit(
					'update-project',
					{
						projectId,
						updates
					},
					(response) => {
						if (response?.success) {
							// Update current project if it was updated
							if (this.currentProject && this.currentProject.id === projectId) {
								this.currentProject = response.project;
							}
							resolve({ success: true, data: response.project });
						} else {
							resolve({ success: false, error: response?.error || 'Failed to update project' });
						}
					}
				);
			});
		} catch (error) {
			console.error('ProjectService: Update project failed:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Delete a project
	 */
	async deleteProject(projectId) {
		try {
			this._checkConnection();

			return new Promise((resolve) => {
				this.socket.emit('delete-project', { projectId }, (response) => {
					if (response?.success) {
						// Clear current project if it was deleted
						if (this.currentProject && this.currentProject.id === projectId) {
							this.currentProject = null;
						}
						resolve({ success: true });
					} else {
						console.error('ProjectService: Delete project failed:', response);
						resolve({ success: false, error: response?.error || 'Failed to delete project' });
					}
				});
			});
		} catch (error) {
			console.error('ProjectService: Delete project failed:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Set current project
	 */
	async setCurrentProject(projectId) {
		try {
			const result = await this.getProject(projectId);

			if (result.success) {
				this.currentProject = result.data;
				return { success: true, data: result.data };
			} else {
				return result;
			}
		} catch (error) {
			console.error('ProjectService: Set current project failed:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Validate project data
	 */
	validateProject(name, description = '') {
		if (!name || typeof name !== 'string') {
			return {
				isValid: false,
				message: 'Project name is required',
				severity: 'error'
			};
		}

		const trimmedName = name.trim();

		if (trimmedName.length < PROJECT_VALIDATION.NAME_MIN_LENGTH) {
			return {
				isValid: false,
				message: `Name must be at least ${PROJECT_VALIDATION.NAME_MIN_LENGTH} character(s)`,
				severity: 'error'
			};
		}

		if (trimmedName.length > PROJECT_VALIDATION.NAME_MAX_LENGTH) {
			return {
				isValid: false,
				message: `Name must be ${PROJECT_VALIDATION.NAME_MAX_LENGTH} characters or less`,
				severity: 'error'
			};
		}

		if (!PROJECT_VALIDATION.NAME_PATTERN.test(trimmedName)) {
			return {
				isValid: false,
				message: 'Name can only contain letters, numbers, spaces, hyphens, and underscores',
				severity: 'error'
			};
		}

		// Validate description if provided
		if (description && description.length > PROJECT_VALIDATION.DESCRIPTION_MAX_LENGTH) {
			return {
				isValid: false,
				message: `Description must be ${PROJECT_VALIDATION.DESCRIPTION_MAX_LENGTH} characters or less`,
				severity: 'error'
			};
		}

		return {
			isValid: true,
			message: '',
			severity: 'info'
		};
	}

	/**
	 * Set active project (for compatibility)
	 */
	async setActiveProject(projectId) {
		return await this.setCurrentProject(projectId);
	}

	/**
	 * Simple cleanup
	 */
	destroy() {
		this.currentProject = null;
		this.projects = [];
	}
}
