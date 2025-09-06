import { BaseHandler } from '../../shared/io/BaseHandler.js';
import directoryManager from '../../shared/utils/directory-manager.server.js';

export class ProjectHandler extends BaseHandler {
    constructor(io, authHandler) {
        super(io, '/projects');
        this.authHandler = authHandler;
        this.ensureStorageInitialized();
    }

    async ensureStorageInitialized() {
        try {
            await directoryManager.initialize();
            console.log('[PROJECT] Directory manager initialized');
        } catch (err) {
            console.error('[PROJECT] Failed to initialize directory manager:', err);
            throw err;
        }
    }

    setupEventHandlers(socket) {
        // Add auth event handler for namespace-specific authentication
        socket.on('auth', (key, callback) => {
            console.log(`[PROJECT] Auth request from socket ${socket.id} with key: ${key ? 'present' : 'missing'}`);
            this.authHandler.handleLogin(socket, key, callback);
        });

        socket.on('projects:list', this.authHandler.withAuth(this.handleList.bind(this, socket), socket));
        socket.on('projects:create', this.authHandler.withAuth(this.handleCreate.bind(this, socket), socket));
        socket.on('projects:get', this.authHandler.withAuth(this.handleGet.bind(this, socket), socket));
        socket.on('projects:update', this.authHandler.withAuth(this.handleUpdate.bind(this, socket), socket));
        socket.on('projects:delete', this.authHandler.withAuth(this.handleDelete.bind(this, socket), socket));
    }

    async handleList(socket, callback) {
        try {
            console.log(`[PROJECT] Listing projects for socket ${socket.id}`);
            const projectData = directoryManager.getProjects();
            const projects = projectData?.projects || [];
            console.log(`[PROJECT] Listing ${projects.length} projects for socket ${socket.id}`);

            const response = { success: true, projects };
            
            if (callback && typeof callback === 'function') {
                callback(response);
            }
            
            this.emitToSocket(socket, 'projects:updated', response);
        } catch (error) {
            console.error('[PROJECT] Error listing projects:', error);
            const errorResponse = { success: false, error: error.message };
            
            if (callback && typeof callback === 'function') {
                callback(errorResponse);
            }
        }
    }

    async handleCreate(socket, data, callback) {
        try {
            console.log('[PROJECT] Creating project:', data);

            const project = await directoryManager.createProjectLegacy({
                name: data.name || 'Untitled Project',
                description: data.description || ''
            });

            console.log('[PROJECT] Project created:', project);

            // Get updated project list
            const projectData = directoryManager.getProjects();
            const allProjects = projectData?.projects || [];

            // Broadcast to all sockets in this namespace
            this.emitToNamespace('projects:updated', { success: true, projects: allProjects });
            this.emitToNamespace('projects:created', { success: true, project });

            const response = { success: true, project };
            if (callback) callback(response);
        } catch (error) {
            console.error('[PROJECT] Error creating project:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }

    async handleGet(socket, data, callback) {
        try {
            if (!data.projectId) {
                const errorResponse = { success: false, error: 'Project ID is required' };
                if (callback) callback(errorResponse);
                return;
            }

            const project = directoryManager.getProject(data.projectId);
            if (!project) {
                const errorResponse = { success: false, error: 'Project not found' };
                if (callback) callback(errorResponse);
                return;
            }

            console.log(`[PROJECT] Retrieved project ${data.projectId} for socket ${socket.id}`);
            const response = { success: true, project };
            if (callback) callback(response);
        } catch (error) {
            console.error('[PROJECT] Error getting project:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }

    async handleUpdate(socket, data, callback) {
        try {
            if (!data.projectId) {
                const errorResponse = { success: false, error: 'Project ID is required' };
                if (callback) callback(errorResponse);
                return;
            }

            console.log('[PROJECT] Updating project:', data);

            const updated = await directoryManager.updateProject(data.projectId, data.updates);

            // Get updated project list and broadcast
            const projectData = directoryManager.getProjects();
            const allProjects = projectData?.projects || [];

            this.emitToNamespace('projects:updated', { success: true, projects: allProjects });
            this.emitToNamespace('projects:project-updated', { success: true, project: updated });

            const response = { success: true, project: updated };
            if (callback) callback(response);
        } catch (error) {
            console.error('[PROJECT] Error updating project:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }

    async handleDelete(socket, data, callback) {
        try {
            if (!data.projectId) {
                const errorResponse = { success: false, error: 'Project ID is required' };
                if (callback) callback(errorResponse);
                return;
            }

            console.log('[PROJECT] Deleting project:', data.projectId);

            await directoryManager.deleteProject(data.projectId);

            // Get updated project list and broadcast
            const projectData = directoryManager.getProjects();
            const allProjects = projectData?.projects || [];

            this.emitToNamespace('projects:updated', { success: true, projects: allProjects });
            this.emitToNamespace('projects:deleted', { success: true, projectId: data.projectId });

            console.log(`[PROJECT] Project ${data.projectId} deleted successfully`);
            const response = { success: true };
            if (callback) callback(response);
        } catch (error) {
            console.error('[PROJECT] Error deleting project:', error);
            const errorResponse = { success: false, error: error.message };
            if (callback) callback(errorResponse);
        }
    }
}