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

    onConnect() {
        console.log('[PROJECT-CLIENT] Connected, attempting authentication with key:', this.terminalKey ? 'present' : 'missing');
        // Authenticate with the server when connecting
        if (this.terminalKey) {
            this.authenticate((error, response) => {
                if (error) {
                    console.error('[PROJECT-CLIENT] Authentication failed:', error);
                    return;
                }
                
                // After successful authentication, trigger initial project load if callback is set
                if (this.onAuthenticated) {
                    this.onAuthenticated();
                }
            });
        } else {
            console.warn('[PROJECT-CLIENT] No terminal key provided');
        }
    }

    authenticate(callback) {
        console.log('[PROJECT-CLIENT] Sending auth request with key:', this.terminalKey);
        this.emit('auth', this.terminalKey, (response) => {
            console.log('[PROJECT-CLIENT] Auth response received:', response);
            if (response?.success) {
                this.authenticated = true;
                console.log('[PROJECT-CLIENT] Authenticated successfully');
            } else {
                this.authenticated = false;
                console.error('[PROJECT-CLIENT] Authentication failed:', response?.error || 'No response');
            }
            this._handleResponse(callback)(response);
        });
    }

    // Optional Promise version for backward compatibility
    authenticateAsync() {
        return this._promisify(this.authenticate.bind(this));
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

    list(callback) {
        console.log('[PROJECT-CLIENT] Requesting project list...');
        this.emit('projects:list', (response) => {
            console.log('[PROJECT-CLIENT] Project list response:', response);
            if (response?.success) {
                this.projects = response.projects || [];
                console.log('[PROJECT-CLIENT] Projects loaded:', this.projects.length);
            } else {
                console.error('[PROJECT-CLIENT] Failed to list projects:', response?.error);
            }
            this._handleResponse(callback)(response);
        });
    }

    // Optional Promise version for backward compatibility
    listAsync() {
        return this._promisify(this.list.bind(this));
    }

    create(data, callback) {
        this.emit('projects:create', {
            name: data.name || 'Untitled Project',
            description: data.description || ''
        }, this._handleResponse(callback));
    }

    // Optional Promise version for backward compatibility
    createAsync(data) {
        return this._promisify(this.create.bind(this), data);
    }

    get(projectId, callback) {
        this.emit('projects:get', { projectId }, this._handleResponse(callback));
    }

    // Optional Promise version for backward compatibility
    getAsync(projectId) {
        return this._promisify(this.get.bind(this), projectId);
    }

    update(projectId, updates, callback) {
        this.emit('projects:update', { projectId, updates }, this._handleResponse(callback));
    }

    // Optional Promise version for backward compatibility
    updateAsync(projectId, updates) {
        return this._promisify(this.update.bind(this), projectId, updates);
    }

    delete(projectId, callback) {
        this.emit('projects:delete', { projectId }, this._handleResponse(callback));
    }

    // Optional Promise version for backward compatibility
    deleteAsync(projectId) {
        return this._promisify(this.delete.bind(this), projectId);
    }

    setCurrentProject(projectId, callback) {
        this.get(projectId, (error, result) => {
            if (error) {
                console.error('[PROJECT-CLIENT] Set current project failed:', error);
                callback(error, null);
                return;
            }
            
            if (result.success) {
                this.currentProject = result.project;
                callback(null, result);
            } else {
                const err = new Error(result.error);
                console.error('[PROJECT-CLIENT] Set current project failed:', err);
                callback(err, null);
            }
        });
    }

    // Optional Promise version for backward compatibility
    setCurrentProjectAsync(projectId) {
        return this._promisify(this.setCurrentProject.bind(this), projectId);
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