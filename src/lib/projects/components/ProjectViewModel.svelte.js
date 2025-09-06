/**
 * ProjectViewModel - MVVM pattern for project management
 * Extends BaseViewModel with Svelte 5 runes for reactive state management
 */
import { BaseViewModel } from '../../shared/contexts/BaseViewModel.svelte.js';
import { goto } from '$app/navigation';
import { PROJECT_VALIDATION } from '../config.js';

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
		return projects.map((project) => ({
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

		// No $effect setup here; must be done in Svelte component
	}

	/**
	 * Set up Svelte 5 effects for reactive behavior
	 */
	// setupEffects removed; effects must be set up in Svelte component

	/**
	 * Set up Socket.IO event listeners for the new namespace-based client
	 */
	setupSocketListeners() {
		if (!this.service) return;

		// Set up event listeners on the project client
		this.service.setOnProjectsUpdated((projects) => {
			this.handleProjectsUpdated({ projects });
		});

		this.service.setOnProjectCreated((project) => {
			// Project will be included in projects updated event
			console.log('Project created:', project);
		});

		this.service.setOnProjectUpdated((project) => {
			// Project will be included in projects updated event
			console.log('Project updated:', project);
		});

		this.service.setOnProjectDeleted((projectId) => {
			// Projects will be updated via projects updated event
			console.log('Project deleted:', projectId);
		});

		// Add cleanup for socket listeners
		this.addCleanup(() => {
			if (this.service && this.service.disconnect) {
				this.service.disconnect();
			}
		});
	}

	/**
	 * Handle projects updated event from socket
	 */
	handleProjectsUpdated(data) {
		this.projects = data.projects || [];
		this.activeProject = data.activeProject;
		// Clear loading state when projects are updated via socket
		this._loading = false;
		console.log('[PROJECT-VIEWMODEL] Projects updated via socket, loading cleared:', this.projects.length);
	}

	/**
	 * Load all projects from the service
	 */
	async loadProjects() {
		return await this.withLoading(async () => {
			try {
				const response = await this.service.list();

				if (response.success) {
					this.projects = response.projects || [];
					return response;
				} else {
					throw new Error('Failed to load projects');
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
				const response = await this.service.create(projectData);

				if (response.success) {
					this.clearForm();
					this.showCreateForm = false;

					// Navigate to the new project if ID is provided
					if (response.project?.id) {
						goto(`/projects/${response.project.id}`);
					}

					return response;
				} else {
					throw new Error('Failed to create project');
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
				const response = await this.service.delete(this.projectToDelete.id);

				if (response.success) {
					this.showDeleteDialog = false;
					this.projectToDelete = null;
					// Projects will be updated via socket event
				} else {
					throw new Error('Failed to delete project');
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
			const response = await this.service.update(this.renamingProjectId, {
				name: this.renameValue.trim()
			});

			if (response.success) {
				this.cancelRenaming();
			} else {
				throw new Error('Failed to rename project');
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

		if (name.length > PROJECT_VALIDATION.NAME_MAX_LENGTH - 5) {
			const remaining = PROJECT_VALIDATION.NAME_MAX_LENGTH - name.length;
			return {
				isValid: remaining >= 0,
				message: remaining >= 0 ? `${remaining} characters remaining` : 'Name too long',
				severity: remaining >= 0 ? 'warning' : 'error'
			};
		}

		if (!PROJECT_VALIDATION.NAME_PATTERN.test(name)) {
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
		goto(`/projects/${projectId}`);
	}

	/**
	 * Set active project
	 */
	async setActiveProject(projectId) {
		try {
			const response = await this.service.get(projectId);
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
