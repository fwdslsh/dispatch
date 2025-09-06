import { BaseClient } from '../../shared/io/BaseClient.js';
import { PROJECT_VALIDATION } from '../config.js';

export class ProjectClient extends BaseClient {
    constructor(io, config = {}) {
        super(io, '/projects', config);
        this.currentProject = null;
        this.projects = [];
        this.authenticated = false;
        this.terminalKey = config.terminalKey;
    }

    async onConnect() {
        console.log('[PROJECT-CLIENT] Connected, attempting authentication with key:', this.terminalKey ? 'present' : 'missing');
        // Authenticate with the server when connecting
        if (this.terminalKey) {
            try {
                await this.authenticate();
                // After successful authentication, trigger initial project load if callback is set
                if (this.onAuthenticated) {
                    this.onAuthenticated();
                }
            } catch (error) {
                console.error('[PROJECT-CLIENT] Authentication failed:', error);
            }
        } else {
            console.warn('[PROJECT-CLIENT] No terminal key provided');
        }
    }

    async authenticate() {
        console.log('[PROJECT-CLIENT] Sending auth request with key:', this.terminalKey);
        return new Promise((resolve, reject) => {
            this.emit('auth', this.terminalKey, (response) => {
                console.log('[PROJECT-CLIENT] Auth response received:', response);
                if (response?.success) {
                    this.authenticated = true;
                    console.log('[PROJECT-CLIENT] Authenticated successfully');
                    resolve(response);
                } else {
                    this.authenticated = false;
                    console.error('[PROJECT-CLIENT] Authentication failed:', response?.error || 'No response');
                    reject(new Error(response?.error || 'Authentication failed'));
                }
            });
        });
    }

    setupEventListeners() {
        this.on('projects:updated', this.handleProjectsUpdated.bind(this));
        this.on('projects:created', this.handleProjectCreated.bind(this));
        this.on('projects:project-updated', this.handleProjectUpdated.bind(this));
        this.on('projects:deleted', this.handleProjectDeleted.bind(this));
    }

    handleProjectsUpdated(data) {
        console.log('[PROJECT-CLIENT] Projects updated event received:', data);
        if (data.success && data.projects) {
            this.projects = data.projects;
            if (this.onProjectsUpdated) {
                this.onProjectsUpdated(data.projects);
            }
        }
    }

    handleProjectCreated(data) {
        if (data.success && data.project) {
            if (this.onProjectCreated) {
                this.onProjectCreated(data.project);
            }
        }
    }

    handleProjectUpdated(data) {
        console.log('handleProjectUpdated', data);
        if (data.success && data.project) {
            // Update current project if it was updated
            if (this.currentProject && this.currentProject.id === data.project.id) {
                this.currentProject = data.project;
            }
            
            if (this.onProjectUpdated) {
                this.onProjectUpdated(data.project);
            }
        }
    }

    handleProjectDeleted(data) {
        if (data.success && data.projectId) {
            // Clear current project if it was deleted
            if (this.currentProject && this.currentProject.id === data.projectId) {
                this.currentProject = null;
            }
            
            if (this.onProjectDeleted) {
                this.onProjectDeleted(data.projectId);
            }
        }
    }

    async list() {
        console.log('[PROJECT-CLIENT] Requesting project list...');
        return new Promise((resolve, reject) => {
            this.emit('projects:list', (response) => {
                console.log('[PROJECT-CLIENT] Project list response:', response);
                if (response?.success) {
                    this.projects = response.projects || [];
                    console.log('[PROJECT-CLIENT] Projects loaded:', this.projects.length);
                    resolve(response);
                } else {
                    console.error('[PROJECT-CLIENT] Failed to list projects:', response?.error);
                    reject(new Error(response?.error || 'Failed to list projects'));
                }
            });
        });
    }

    async create(data) {
        return new Promise((resolve, reject) => {
            this.emit('projects:create', {
                name: data.name || 'Untitled Project',
                description: data.description || ''
            }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to create project'));
                }
            });
        });
    }

    async get(projectId) {
        return new Promise((resolve, reject) => {
            this.emit('projects:get', { projectId }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to get project'));
                }
            });
        });
    }

    async update(projectId, updates) {
        return new Promise((resolve, reject) => {
            this.emit('projects:update', { projectId, updates }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to update project'));
                }
            });
        });
    }

    async delete(projectId) {
        return new Promise((resolve, reject) => {
            this.emit('projects:delete', { projectId }, (response) => {
                if (response.success) {
                    resolve(response);
                } else {
                    reject(new Error(response.error || 'Failed to delete project'));
                }
            });
        });
    }

    async setCurrentProject(projectId) {
        try {
            const result = await this.get(projectId);
            if (result.success) {
                this.currentProject = result.project;
                return result;
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('[PROJECT-CLIENT] Set current project failed:', error);
            throw error;
        }
    }

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

    // Event callback setters
    setOnProjectsUpdated(callback) {
        this.onProjectsUpdated = callback;
    }

    setOnProjectCreated(callback) {
        this.onProjectCreated = callback;
    }

    setOnProjectUpdated(callback) {
        this.onProjectUpdated = callback;
    }

    setOnProjectDeleted(callback) {
        this.onProjectDeleted = callback;
    }

    setOnAuthenticated(callback) {
        this.onAuthenticated = callback;
    }

    getCurrentProject() {
        return this.currentProject;
    }

    getProjects() {
        return this.projects;
    }
}