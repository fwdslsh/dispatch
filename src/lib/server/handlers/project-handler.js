/**
 * ProjectHandler - Manages project-related socket events
 * 
 * Handles project CRUD operations, project session creation, and directory operations
 * that was previously mixed with session management in socket-handler.js
 */

import { createSuccessResponse, createErrorResponse, ErrorHandler } from '../../utils/error-handling.js';
import { ValidationMiddleware } from '../../utils/validation.js';
import { TerminalManager } from '../terminal.js';
import storageManager from '../storage-manager.js';
import { randomUUID } from 'node:crypto';

/**
 * Project management handler for socket events
 */
export class ProjectHandler {
  /**
   * @param {Object} dependencies Injected dependencies
   * @param {TerminalManager} dependencies.terminalManager Terminal manager instance
   * @param {Object} dependencies.storageManager Storage manager instance
   */
  constructor({ terminalManager, storageManager: storage }) {
    this.terminalManager = terminalManager || new TerminalManager();
    this.storageManager = storage || storageManager;
    
    // Track socket to session mappings for project sessions
    this.socketSessions = new Map();
    this.socketUnsubscribers = new Map();
  }

  /**
   * Create new project
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Project creation options
   * @param {Function} callback Response callback
   */
  async 'create-project'(socket, opts, callback) {
    try {
      const { name, description } = opts || {};
      
      if (!name) {
        if (callback) callback(createErrorResponse('Project name is required'));
        return;
      }

      // Basic name validation (since validateProjectName doesn't exist)
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        if (callback) callback(createErrorResponse('Invalid project name'));
        return;
      }
      
      const cleanName = name.trim();

      // Create project
      const project = this.storageManager.createProject({
        name: cleanName,
        description: description || ''
      });

      if (callback) callback({
        success: true,
        project: project
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.create-project', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * List all projects
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Options (currently unused)
   * @param {Function} callback Response callback
   */
  async 'list-projects'(socket, opts, callback) {
    try {
      const projectsData = this.storageManager.getProjects();
      if (callback) callback({ success: true, projects: projectsData.projects || [] });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  }

  /**
   * Get single project with sessions
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Get project options
   * @param {Function} callback Response callback
   */
  async 'get-project'(socket, opts, callback) {
    try {
      const { projectId } = opts || {};
      
      if (!projectId) {
        if (callback) callback(createErrorResponse('Project ID is required'));
        return;
      }

      const project = this.storageManager.getProject(projectId);
      if (!project) {
        if (callback) callback(createErrorResponse('Project not found'));
        return;
      }

      if (callback) callback({
        success: true,
        project: project
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.get-project', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * Update project details
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Update options
   * @param {Function} callback Response callback
   */
  async 'update-project'(socket, opts, callback) {
    try {
      const { projectId, name, description } = opts || {};
      
      if (!projectId) {
        if (callback) callback(createErrorResponse('Project ID is required'));
        return;
      }

      // Get current project
      const project = this.storageManager.getProject(projectId);
      if (!project) {
        if (callback) callback(createErrorResponse('Project not found'));
        return;
      }

      // Validate new name if provided
      if (name && (typeof name !== 'string' || name.trim().length === 0)) {
        if (callback) callback(createErrorResponse('Invalid project name'));
        return;
      }

      // Update project
      const updates = {};
      if (name) updates.name = name;
      if (description !== undefined) updates.description = description;

      const updatedProject = this.storageManager.updateProject(projectId, updates);

      if (callback) callback({
        success: true,
        project: updatedProject
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.update-project', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * Delete project
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Delete options
   * @param {Function} callback Response callback
   */
  async 'delete-project'(socket, opts, callback) {
    try {
      const { projectId } = opts || {};
      
      if (!projectId) {
        if (callback) callback(createErrorResponse('Project ID is required'));
        return;
      }

      // Check if project exists
      const project = this.storageManager.getProject(projectId);
      if (!project) {
        if (callback) callback(createErrorResponse('Project not found'));
        return;
      }

      // End any active sessions in this project
      const sessions = project.sessions || [];
      for (const session of sessions) {
        try {
          await this.terminalManager.endSession(session.id);
        } catch (err) {
          console.warn(`Failed to end session ${session.id}:`, err.message);
        }
      }

      // Delete the project
      this.storageManager.deleteProject(projectId);

      if (callback) callback(createSuccessResponse('Project deleted successfully'));
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.delete-project', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * Create session within a specific project
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Session creation options
   * @param {Function} callback Response callback
   */
  async 'create-session-in-project'(socket, opts, callback) {
    try {
      const { projectId, cols, rows, mode, meta } = opts || {};
      
      if (!projectId) {
        if (callback) callback(createErrorResponse('Project ID is required'));
        return;
      }

      // Validate project exists
      const project = this.storageManager.getProject(projectId);
      if (!project) {
        if (callback) callback(createErrorResponse('Project not found'));
        return;
      }

      // Validate session options
      const sessionOpts = { cols, rows, mode, meta, projectId };
      const validation = ValidationMiddleware.validateSessionOptions(sessionOpts);
      if (!validation.success) {
        if (callback) callback(createErrorResponse(validation.error));
        return;
      }

      const sessionId = randomUUID();
      
      try {
        // Create session in project
        await this.terminalManager.createSessionInProject(
          sessionId,
          projectId,
          validation.data.mode || 'shell',
          validation.data.cols || 80,
          validation.data.rows || 24,
          validation.data.meta || {}
        );

        // Set up data handlers for this socket
        this.setupProjectSessionHandlers(socket, sessionId, projectId);

        // Store session association
        if (!this.socketSessions.has(socket.id)) {
          this.socketSessions.set(socket.id, new Set());
        }
        this.socketSessions.get(socket.id).add(sessionId);

        const response = {
          success: true,
          sessionId: sessionId,
          projectId: projectId,
          name: validation.data.meta?.name || `session-${Date.now()}`
        };

        if (callback) callback(response);
      } catch (err) {
        if (callback) callback(createErrorResponse(`Failed to create session in project: ${err.message}`));
      }
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.create-session-in-project', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * Set active project for a socket/user
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Active project options
   * @param {Function} callback Response callback
   */
  async 'set-active-project'(socket, opts, callback) {
    try {
      const { projectId } = opts || {};
      
      if (!projectId) {
        if (callback) callback(createErrorResponse('Project ID is required'));
        return;
      }

      // Validate project exists
      const project = this.storageManager.getProject(projectId);
      if (!project) {
        if (callback) callback(createErrorResponse('Project not found'));
        return;
      }

      // Set as active project (this could be stored per-socket if needed)
      // For now, just acknowledge the request
      if (callback) callback(createSuccessResponse('Active project set'));
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.set-active-project', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * List directories in a project
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Directory listing options
   * @param {Function} callback Response callback
   */
  async 'list-project-directories'(socket, opts, callback) {
    try {
      const { projectId, path } = opts || {};
      
      if (!projectId) {
        if (callback) callback(createErrorResponse('Project ID is required'));
        return;
      }

      // Validate project exists
      const project = this.storageManager.getProject(projectId);
      if (!project) {
        if (callback) callback(createErrorResponse('Project not found'));
        return;
      }

      // List directories (implementation would depend on actual directory structure)
      // For now, return empty list
      if (callback) callback({
        success: true,
        directories: [],
        path: path || '/'
      });
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.list-project-directories', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * Set up session data handlers for a project session
   * @private
   * @param {Socket} socket Socket.IO socket
   * @param {string} sessionId Session ID
   * @param {string} projectId Project ID
   */
  setupProjectSessionHandlers(socket, sessionId, projectId) {
    try {
      // Set up data handler
      const unsubscribe = this.terminalManager.subscribe(sessionId, (data) => {
        socket.emit('output', data);
      });

      // Store unsubscriber
      if (!this.socketUnsubscribers.has(socket.id)) {
        this.socketUnsubscribers.set(socket.id, new Map());
      }
      this.socketUnsubscribers.get(socket.id).set(sessionId, unsubscribe);

      // Set up session end handler
      const onSessionEnd = ({ exitCode, signal }) => {
        socket.emit('ended', { exitCode, signal });
        
        // Clean up associations
        if (this.socketSessions.has(socket.id)) {
          this.socketSessions.get(socket.id).delete(sessionId);
        }
        if (this.socketUnsubscribers.has(socket.id)) {
          this.socketUnsubscribers.get(socket.id).delete(sessionId);
        }
      };

      // Session end events not available in TerminalManager
      
    } catch (error) {
      console.error('Failed to setup project session handlers:', error);
    }
  }

  /**
   * Clean up socket associations on disconnect
   * @param {Socket} socket Socket.IO socket
   */
  handleDisconnect(socket) {
    try {
      // Clean up session associations
      if (this.socketSessions.has(socket.id)) {
        this.socketSessions.delete(socket.id);
      }

      // Clean up unsubscribers
      if (this.socketUnsubscribers.has(socket.id)) {
        const unsubscribers = this.socketUnsubscribers.get(socket.id);
        for (const unsubscribe of unsubscribers.values()) {
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
        }
        this.socketUnsubscribers.delete(socket.id);
      }

      console.log('Project handler cleaned up for socket:', socket.id);
    } catch (error) {
      console.error('Error during project handler disconnect:', error);
    }
  }

  /**
   * Create ProjectHandler with default dependencies
   * @returns {ProjectHandler} Configured ProjectHandler
   */
  static create() {
    return new ProjectHandler({
      terminalManager: new TerminalManager(),
      storageManager: storageManager
    });
  }
}