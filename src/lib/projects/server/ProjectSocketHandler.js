/**
 * Project Socket Handler
 * 
 * Handles project-related socket events in isolation.
 * Provides clean separation of project management from other handlers.
 */

import storageManager from '../../server/services/storage-manager.js';

/**
 * Initialize storage manager (should be called once on startup)
 */
let storageInitialized = false;
async function ensureStorageInitialized() {
  if (!storageInitialized) {
    try {
      await storageManager.initialize();
      console.log('Project storage manager initialized');
      storageInitialized = true;
    } catch (err) {
      console.error('Failed to initialize project storage manager:', err);
      throw err;
    }
  }
}

/**
 * Create project socket handlers
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 * @param {Function} requireAuth - Authentication check function
 * @returns {Object} Project handler functions
 */
export function createProjectSocketHandlers(io, socket, requireAuth) {
  // Ensure storage is initialized
  ensureStorageInitialized().catch(err => {
    console.error('Storage initialization failed in ProjectSocketHandler:', err);
  });

  /**
   * List all projects
   */
  const listProjectsHandler = (callback) => {
    try {
      const projectData = storageManager.getProjects();
      const projects = projectData?.projects || [];
      console.log(`[PROJECT] Listing ${projects.length} projects for socket ${socket.id}`);
      
      if (callback && typeof callback === 'function') {
        callback({ success: true, projects });
      }
      socket.emit('projects-updated', { projects });
    } catch (error) {
      console.error('[PROJECT] Error listing projects:', error);
      if (callback && typeof callback === 'function') {
        callback({ success: false, error: error.message });
      }
    }
  };

  /**
   * Create a new project
   */
  const createProjectHandler = async (data, callback) => {
    try {
      console.log('[PROJECT] Creating project:', data);
      
      const project = await storageManager.createProject({
        name: data.name || 'Untitled Project',
        description: data.description || ''
      });

      console.log('[PROJECT] Project created:', project);

      // Broadcast to all sockets including current one
      const projectData = storageManager.getProjects();
      const allProjects = projectData?.projects || [];
      
      socket.emit('projects-updated', { projects: allProjects });
      socket.broadcast.emit('projects-updated', { projects: allProjects });
      
      // Emit specific creation event
      io.emit('project-created', { project });

      if (callback) callback({ success: true, project });
    } catch (error) {
      console.error('[PROJECT] Error creating project:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  /**
   * Get a specific project by ID
   */
  const getProjectHandler = (data, callback) => {
    try {
      if (!data.projectId) {
        if (callback) callback({ success: false, error: 'Project ID is required' });
        return;
      }

      const project = storageManager.getProject(data.projectId);
      if (!project) {
        if (callback) callback({ success: false, error: 'Project not found' });
        return;
      }

      console.log(`[PROJECT] Retrieved project ${data.projectId} for socket ${socket.id}`);
      if (callback) callback({ success: true, project });
    } catch (error) {
      console.error('[PROJECT] Error getting project:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  /**
   * Update an existing project
   */
  const updateProjectHandler = async (data, callback) => {
    try {
      if (!data.projectId) {
        if (callback) callback({ success: false, error: 'Project ID is required' });
        return;
      }

      console.log('[PROJECT] Updating project:', data);
      
      const updated = await storageManager.updateProject(data.projectId, data.updates);
      
      // Broadcast to all sockets
      const projectData = storageManager.getProjects();
      const allProjects = projectData?.projects || [];
      
      socket.emit('projects-updated', { projects: allProjects });
      socket.broadcast.emit('projects-updated', { projects: allProjects });
      
      // Emit specific update event
      io.emit('project-updated', { project: updated });

      if (callback) callback({ success: true, project: updated });
    } catch (error) {
      console.error('[PROJECT] Error updating project:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  /**
   * Delete a project
   */
  const deleteProjectHandler = async (data, callback) => {
    try {
      if (!data.projectId) {
        if (callback) callback({ success: false, error: 'Project ID is required' });
        return;
      }

      console.log('[PROJECT] Deleting project:', data.projectId);
      
      const success = await storageManager.deleteProject(data.projectId);
      
      if (success) {
        // Broadcast to all sockets
        const projectData = storageManager.getProjects();
        const allProjects = projectData?.projects || [];
        
        socket.emit('projects-updated', { projects: allProjects });
        socket.broadcast.emit('projects-updated', { projects: allProjects });
        
        // Emit specific deletion event
        io.emit('project-deleted', { projectId: data.projectId });
        
        console.log(`[PROJECT] Project ${data.projectId} deleted successfully`);
        if (callback) callback({ success: true });
      } else {
        if (callback) callback({ success: false, error: 'Failed to delete project' });
      }
    } catch (error) {
      console.error('[PROJECT] Error deleting project:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  /**
   * Get sessions for a specific project
   */
  const getProjectSessionsHandler = async (data, callback) => {
    try {
      if (!data.projectId) {
        if (callback) callback({ success: false, error: 'Project ID is required' });
        return;
      }

      // Get project sessions (implementation depends on session storage)
      // This is a placeholder - actual implementation would query session storage
      const sessions = []; // TODO: Implement session retrieval for project
      
      console.log(`[PROJECT] Retrieved ${sessions.length} sessions for project ${data.projectId}`);
      if (callback) callback({ success: true, sessions });
    } catch (error) {
      console.error('[PROJECT] Error getting project sessions:', error);
      if (callback) callback({ success: false, error: error.message });
    }
  };

  return {
    // Event handlers
    'list-projects': listProjectsHandler,
    'listProjects': listProjectsHandler, // Alias for consistency with client services
    'create-project': createProjectHandler,
    'createProject': createProjectHandler, // Alias for consistency with client services
    'get-project': getProjectHandler,
    'getProject': getProjectHandler, // Alias for consistency with client services
    'update-project': updateProjectHandler,
    'updateProject': updateProjectHandler, // Alias for consistency with client services
    'delete-project': deleteProjectHandler,
    'deleteProject': deleteProjectHandler, // Alias for consistency with client services
    'get-project-sessions': getProjectSessionsHandler,
    'getProjectSessions': getProjectSessionsHandler // Alias for consistency with client services
  };
}

/**
 * Register project socket handlers with authentication
 * @param {Object} socket - Socket instance
 * @param {Object} handlers - Project handlers object
 * @param {Function} requireAuth - Authentication check function
 */
export function registerProjectHandlers(socket, handlers, requireAuth) {
  for (const [eventName, handler] of Object.entries(handlers)) {
    socket.on(eventName, (...args) => {
      if (!requireAuth()) {
        const callback = args[args.length - 1];
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Authentication required' });
        }
        return;
      }
      handler(...args);
    });
  }
}

/**
 * Project handler factory for easy integration
 * @param {Object} io - Socket.IO instance
 * @param {Object} socket - Socket instance
 * @param {Function} requireAuth - Authentication check function
 * @returns {Object} Configured and registered project handlers
 */
export function createAndRegisterProjectHandlers(io, socket, requireAuth) {
  const handlers = createProjectSocketHandlers(io, socket, requireAuth);
  registerProjectHandlers(socket, handlers, requireAuth);
  
  console.log(`[PROJECT] Registered ${Object.keys(handlers).length} project handlers for socket ${socket.id}`);
  
  return handlers;
}