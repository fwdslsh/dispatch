/**
 * Simple Project Service
 * 
 * Straightforward project management without unnecessary complexity.
 * Follows the simple service patterns defined in ServicePatterns.md
 */

/**
 * Simple Project Service
 */
export class SimpleProjectService {
  constructor(socketService) {
    this.socket = socketService;
    this.currentProject = $state(null);
    this.projects = $state([]);
  }

  /**
   * Create a new project
   */
  async createProject(data) {
    try {
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
      console.error('SimpleProjectService: Create project failed:', error);
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
      console.error('SimpleProjectService: Get project failed:', error);
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
      console.error('SimpleProjectService: Get projects failed:', error);
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
      console.error('SimpleProjectService: Update project failed:', error);
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
      console.error('SimpleProjectService: Delete project failed:', error);
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
      console.error('SimpleProjectService: Set current project failed:', error);
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