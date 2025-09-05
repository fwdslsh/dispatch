/**
 * ProjectViewModel - MVVM pattern for project management
 * Extends BaseViewModel with Svelte 5 runes for reactive state management
 */
import { BaseViewModel } from '../contexts/BaseViewModel.svelte.js';
import { ValidationError } from '../services/foundation/ValidationError.js';
import { goto } from '$app/navigation';

export class ProjectViewModel extends BaseViewModel {
	// Project state using Svelte 5 $state runes
	projects = $state([]);
	activeProject = $state(null);

	// Form state
	formData = $state({
		name: '',
		description: ''
	});

	formValidation = $state({
		isValid: true,
		message: '',
		severity: 'info'
	});

	// UI state
	showCreateForm = $state(false);
	renamingProjectId = $state(null);
	renameValue = $state('');
	renameValidation = $state({
		isValid: true,
		message: '',
		severity: 'info'
	});
	showDeleteDialog = $state(false);
	projectToDelete = $state(null);

	// Derived state using $derived rune
	hasProjects = $derived(this.projects.length > 0);
	
	canCreateProject = $derived(
		this.formData.name.trim().length > 0 && this.formValidation.isValid && !this.loading
	);
	
	// Optimize expensive validation with $derived.by
	nameValidation = $derived.by(() => {
		// Only recompute when name changes
		const name = this.formData.name;
		return this.validateNameRealtime(name);
	});
	
	// Optimize expensive map operation with $derived.by
	projectsWithSessionCount = $derived.by(() => {
		// Only recompute when projects array changes
		const projects = this.projects;
		return projects.map(project => ({
			...project,
			sessionCount: project.sessions?.length || 0
		}));
	});

	constructor(projectService, services = {}) {
		// Create a model-like object for BaseViewModel
		const model = {
			state: {
				projects: [],
				activeProject: null,
				formData: { name: '', description: '' },
				loading: false,
				error: null
			},
			onChange: null
		};

		super(model, { projectService, ...services });
		
		// Initialize reactive state
		this.projects = model.state.projects;
		this.activeProject = model.state.activeProject;
		this.formData = model.state.formData;

		this.service = projectService;

		// Optional navigation function for testing
		this.goto = services.goto || goto;

		// Set up reactive effects
		this.setupEffects();
	}

	/**
	 * Set up Svelte 5 effects for reactive behavior
	 */
	setupEffects() {
		// Real-time form validation effect
		$effect(() => {
			this.formValidation = this.validateNameRealtime(this.formData.name);
		});

		// Socket event handling effect
		$effect(() => {
			if (this.socket) {
				this.setupSocketListeners();
			}
		});
	}

	/**
	 * Initialize socket connection and authentication
	 */
	async initializeSocket() {
		if (this.socket) return;

		try {
			const { io } = await import('socket.io-client');
			this.socket = io();

			return new Promise((resolve) => {
				this.socket.on('connect', () => {
					const authToken = localStorage.getItem('dispatch-auth-token') || 'testkey12345';
					
					this.socket.emit('auth', authToken, (response) => {
						if (response?.success) {
							this.clearError();
							this.loadProjects().then(() => resolve(true));
						} else {
							this.setError('Authentication failed');
							resolve(false);
						}
					});
				});

				this.setupSocketListeners();
			});
		} catch (error) {
			this.setError('Failed to connect to server');
			return false;
		}
	}

	/**
	 * Set up Socket.IO event listeners
	 */
	setupSocketListeners() {
		if (!this.socket) return;

		this.socket.on('projects-updated', (data) => {
			this.handleProjectsUpdated(data);
		});

		this.socket.on('disconnect', () => {
			console.log('Disconnected from server');
		});

		// Add cleanup for socket listeners
		this.addCleanup(() => {
			if (this.socket) {
				this.socket.removeAllListeners();
				this.socket.disconnect();
				this.socket = null;
			}
		});
	}

	/**
	 * Handle projects updated event from socket
	 */
	handleProjectsUpdated(data) {
		this.projects = data.projects || [];
		this.activeProject = data.activeProject;
	}

	/**
	 * Load all projects from the service
	 */
	async loadProjects() {
		return await this.withLoading(async () => {
			try {
				const response = await this.service.getProjects();
				
				if (response.success) {
					this.projects = response.projects || [];
					this.activeProject = response.activeProject;
					return response;
				} else {
					throw new Error(response.error || 'Failed to load projects');
				}
			} catch (error) {
				this.setError(error.message);
				throw error;
			}
		});
	}

	/**
	 * Create a new project
	 */
	async createProject() {
		if (!this.validateBeforeSubmit()) {
			return;
		}

		const projectData = {
			name: this.formData.name.trim(),
			description: this.formData.description.trim()
		};

		try {
			const result = await this.withLoading(async () => {
				const response = await this.service.createProject(projectData);
				
				if (response.success) {
					this.clearForm();
					this.showCreateForm = false;
					
					// Navigate to the new project if ID is provided
					if (response.project?.id) {
						this.goto(`/projects/${response.project.id}`);
					}
					
					return response;
				} else {
					throw new Error(response.error || 'Failed to create project');
				}
			});

			return result;
		} catch (error) {
			this.formValidation = {
				isValid: false,
				message: error.message,
				severity: 'error'
			};
			throw error;
		}
	}

	/**
	 * Delete a project
	 */
	async deleteProject() {
		if (!this.projectToDelete) return;

		try {
			await this.withLoading(async () => {
				const response = await this.service.deleteProject(this.projectToDelete.id);
				
				if (response.success) {
					this.showDeleteDialog = false;
					this.projectToDelete = null;
					// Projects will be updated via socket event
				} else {
					throw new Error(response.error || 'Failed to delete project');
				}
			});
		} catch (error) {
			this.setError(error.message);
		}
	}

	/**
	 * Start renaming a project
	 */
	startRenaming(projectId, currentName) {
		this.renamingProjectId = projectId;
		this.renameValue = currentName;
		this.renameValidation = { isValid: true, message: '', severity: 'info' };
	}

	/**
	 * Cancel renaming
	 */
	cancelRenaming() {
		this.renamingProjectId = null;
		this.renameValue = '';
		this.renameValidation = { isValid: true, message: '', severity: 'info' };
	}

	/**
	 * Confirm project rename
	 */
	async confirmRename() {
		if (!this.renamingProjectId) return;

		// Validate rename
		const validation = this.service.validateProject(this.renameValue);
		this.renameValidation = validation;

		if (!validation.isValid) {
			return;
		}

		try {
			const response = await this.service.updateProject(this.renamingProjectId, {
				name: this.renameValue.trim()
			});

			if (response.success) {
				this.cancelRenaming();
			} else {
				throw new Error(response.error || 'Failed to rename project');
			}
		} catch (error) {
			this.renameValidation = {
				isValid: false,
				message: error.message,
				severity: 'error'
			};
		}
	}

	/**
	 * Validate project name in real-time
	 */
	validateNameRealtime(name) {
		if (!name || name.length === 0) {
			return { isValid: true, message: '', severity: 'info' };
		}

		if (name.length > 45) {
			const remaining = 50 - name.length;
			return {
				isValid: remaining >= 0,
				message: remaining >= 0 ? `${remaining} characters remaining` : 'Name too long',
				severity: remaining >= 0 ? 'warning' : 'error'
			};
		}

		const validPattern = /^[a-zA-Z0-9\s_-]*$/;
		if (!validPattern.test(name)) {
			return {
				isValid: false,
				message: 'Invalid characters detected',
				severity: 'error'
			};
		}

		return { isValid: true, message: '', severity: 'info' };
	}

	/**
	 * Validate before form submission
	 */
	validateBeforeSubmit() {
		const validation = this.service.validateProject(this.formData.name);
		this.formValidation = validation;
		return validation.isValid;
	}

	/**
	 * Open a project (navigate to project page)
	 */
	openProject(projectId) {
		this.goto(`/projects/${projectId}`);
	}

	/**
	 * Set active project
	 */
	async setActiveProject(projectId) {
		try {
			const response = await this.service.setActiveProject(projectId);
			if (response.success) {
				this.activeProject = projectId;
			}
			return response;
		} catch (error) {
			this.setError(error.message);
			throw error;
		}
	}

	/**
	 * Confirm project deletion (show dialog)
	 */
	confirmDeleteProject(project) {
		this.projectToDelete = project;
		this.showDeleteDialog = true;
	}

	/**
	 * Cancel project deletion
	 */
	cancelDeleteProject() {
		this.showDeleteDialog = false;
		this.projectToDelete = null;
	}

	/**
	 * Clear form data
	 */
	clearForm() {
		this.formData.name = '';
		this.formData.description = '';
		this.formValidation = { isValid: true, message: '', severity: 'info' };
	}

	/**
	 * Toggle create form visibility
	 */
	toggleCreateForm() {
		this.showCreateForm = !this.showCreateForm;
		if (this.showCreateForm) {
			this.clearForm();
		}
	}
}