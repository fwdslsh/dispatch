/**
 * Project Service
 * 
 * Straightforward project management without unnecessary complexity.
 * Follows clean service patterns with minimal dependencies.
 */

/**
 * Project Service
 */
export class ProjectService {
  constructor() {
    this.socket = null;
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
      this.socket = io();

      // Wait for connection
      return new Promise((resolve) => {
        this.socket.on('connect', () => {
          resolve(true);
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
      const response = await this.socket.emit('create-project', {
        name: data.name || 'Untitled Project',
        description: data.description || ''
      });

      if (response.success) {
        return { success: true, data: response.project };
      } else {
        return { success: false, error: response.error || 'Failed to create project' };
      }
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
      const response = await this.socket.emit('get-project', { projectId });

      if (response.success) {
        return { success: true, data: response.project };
      } else {
        return { success: false, error: response.error || 'Failed to get project' };
      }
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
      const response = await this.socket.emit('list-projects');

      if (response.success) {
        this.projects = response.projects || [];
        return { success: true, data: this.projects };
      } else {
        return { success: false, error: response.error || 'Failed to get projects' };
      }
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
      const response = await this.socket.emit('update-project', {
        projectId,
        updates
      });

      if (response.success) {
        // Update current project if it was updated
        if (this.currentProject && this.currentProject.id === projectId) {
          this.currentProject = response.project;
        }
        
        return { success: true, data: response.project };
      } else {
        return { success: false, error: response.error || 'Failed to update project' };
      }
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
      const response = await this.socket.emit('delete-project', { projectId });

      if (response.success) {
        // Clear current project if it was deleted
        if (this.currentProject && this.currentProject.id === projectId) {
          this.currentProject = null;
        }
        
        return { success: true };
      } else {
        return { success: false, error: response.error || 'Failed to delete project' };
      }
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
   * Simple cleanup
   */
  destroy() {
    this.currentProject = null;
    this.projects = [];
  }
}