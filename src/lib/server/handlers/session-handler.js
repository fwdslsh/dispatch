/**
 * SessionHandler - Manages terminal session lifecycle events
 * 
 * Handles session creation, listing, attachment, detachment, and termination
 * that was previously mixed with other responsibilities in socket-handler.js
 * 
 * Now uses dependency injection for loose coupling and testability.
 */

import { createSuccessResponse, createErrorResponse, ErrorHandler } from '../../utils/error-handling.js';
import { ValidationMiddleware, RateLimiter } from '../../utils/validation.js';
import { TerminalManager } from '../terminal.js';
import storageManager from '../storage-manager.js';
import { randomUUID } from 'node:crypto';

/**
 * Session management handler for socket events
 */
export class SessionHandler {
  /**
   * @param {Object} dependencies Injected dependencies
   * @param {ITerminalService} dependencies.terminalService Terminal management service
   * @param {IStorageService} dependencies.storageService Storage service
   * @param {IValidationService} dependencies.validationService Validation service
   * @param {IErrorService} dependencies.errorService Error handling service
   * @param {ILoggingService} dependencies.loggingService Logging service
   * @param {IRateLimitService} dependencies.rateLimitService Rate limiting service
   */
  constructor(dependencies = {}) {
    // Inject dependencies with fallbacks for backward compatibility
    this.terminalService = dependencies.terminalService || dependencies.terminalManager || new TerminalManager();
    this.storageService = dependencies.storageService || dependencies.storageManager || storageManager;
    this.validationService = dependencies.validationService;
    this.errorService = dependencies.errorService;
    this.loggingService = dependencies.loggingService || console;
    this.rateLimitService = dependencies.rateLimitService;
    
    // Legacy support
    this.terminalManager = this.terminalService;
    this.storageManager = this.storageService;
    
    // Track socket to session mappings
    this.socketSessions = new Map();
    this.socketUnsubscribers = new Map();
    
    // Rate limiter for input events (per socket) - use injected service or fallback
    this.inputRateLimiter = this.rateLimitService 
      ? this.rateLimitService.createLimiter(50, 1000)
      : new RateLimiter(1000, 50); // 50 inputs per second per socket
  }

  /**
   * Create new terminal session
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Session options
   * @param {Function} callback Response callback
   */
  async create(socket, opts, callback) {
    try {
      // Validate session options using injected service or fallback
      let validation;
      if (this.validationService) {
        validation = this.validationService.validateSessionOptions(opts || {});
      } else {
        validation = ValidationMiddleware.validateSessionOptions(opts || {});
      }
      
      if (!validation.success) {
        const errorResponse = this.errorService 
          ? this.errorService.createErrorResponse(validation.error)
          : createErrorResponse(validation.error);
        if (callback) callback(errorResponse);
        return;
      }

      // Use specified project or create/get default project
      let targetProject;
      const { projectId } = opts || {};
      
      if (projectId) {
        // Use specified project
        targetProject = this.storageManager.getProject(projectId);
        if (!targetProject) {
          if (callback) callback(createErrorResponse(`Project ${projectId} not found`));
          return;
        }
      } else {
        // Create a default project if none exists or get the default one
        try {
          const projectsData = this.storageManager.getProjects();
          const projects = projectsData.projects || [];
          targetProject = projects.find(p => p.name === 'default');
          
          if (!targetProject) {
            // Create default project
            targetProject = this.storageManager.createProject({
              name: 'default',
              description: 'Default project for legacy sessions'
            });
          }
        } catch (err) {
          if (callback) callback(createErrorResponse(`Failed to create default project: ${err.message}`));
          return;
        }
      }

      // Create PTY session directly
      const sessionOpts = {
        ...validation.data,
        projectId: targetProject.id
      };
      const sessionId = randomUUID();

      try {
        await this.terminalManager.createSimpleSession(
          sessionId,
          sessionOpts.mode || 'shell',
          sessionOpts.cols || 80,
          sessionOpts.rows || 24,
          sessionOpts.meta || {}
        );

        // Set up data handlers for this socket
        this.setupSessionHandlers(socket, sessionId);

        // Store session association
        if (!this.socketSessions.has(socket.id)) {
          this.socketSessions.set(socket.id, new Set());
        }
        this.socketSessions.get(socket.id).add(sessionId);

        // Broadcast updated session list
        socket.server.emit('sessions-updated', this.storageManager.getSessions());

        const response = {
          success: true,
          sessionId: sessionId,
          name: `session-${Date.now()}`
        };

        if (callback) callback(response);
      } catch (err) {
        if (callback) callback(createErrorResponse(`Failed to create session: ${err.message}`));
      }
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.create', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * List terminal sessions
   * @param {Socket} socket Socket.IO socket
   * @param {Object|Function} opts Options or callback (for backward compatibility)
   * @param {Function} callback Response callback
   */
  async list(socket, opts, callback) {
    // Handle both old signature (callback only) and new signature (opts, callback)
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }

    try {
      const { projectId } = opts || {};
      
      if (projectId) {
        // Filter sessions by project
        const project = this.storageManager.getProject(projectId);
        if (!project) {
          if (callback) callback({ success: false, error: 'Project not found' });
          return;
        }
        
        // Get sessions for this project
        const activeSessions = (project.sessions || []).map(session => ({
          ...session,
          sessionId: session.id // Add sessionId alias for frontend compatibility
        }));
        
        if (callback) callback({ 
          success: true, 
          sessions: activeSessions,
          projectId: projectId 
        });
      } else {
        // Return all sessions (legacy behavior)
        if (callback) callback({ success: true, ...this.storageManager.getSessions() });
      }
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  }

  /**
   * Attach to existing session
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Attachment options
   * @param {Function} callback Response callback
   */
  async attach(socket, opts, callback) {
    try {
      const { sessionId, cols, rows } = opts || {};
      
      if (!sessionId) {
        if (callback) callback(createErrorResponse('Session ID is required'));
        return;
      }

      // Check if session exists
      const sessions = this.storageManager.getSessions();
      const sessionExists = sessions.sessions?.some(s => s.id === sessionId);
      
      if (!sessionExists) {
        if (callback) callback(createErrorResponse('Session not found'));
        return;
      }

      // Set up data handlers for this socket
      this.setupSessionHandlers(socket, sessionId);

      // Store session association
      if (!this.socketSessions.has(socket.id)) {
        this.socketSessions.set(socket.id, new Set());
      }
      this.socketSessions.get(socket.id).add(sessionId);

      // Resize if dimensions provided
      if (cols && rows) {
        this.terminalManager.resize(sessionId, cols, rows);
      }

      if (callback) callback(createSuccessResponse('Attached to session'));
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.attach', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * Detach from current session
   * @param {Socket} socket Socket.IO socket
   */
  detach(socket) {
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

      console.log('Socket detached from sessions:', socket.id);
    } catch (error) {
      console.error('Error during detach:', error);
    }
  }

  /**
   * End terminal session
   * @param {Socket} socket Socket.IO socket
   * @param {string} sessionIdArg Session ID to end
   * @param {Function} callback Response callback
   */
  async end(socket, sessionIdArg, callback) {
    try {
      let sessionId = sessionIdArg;
      
      // If no specific session ID, try to end the first associated session
      if (!sessionId && this.socketSessions.has(socket.id)) {
        const sessions = this.socketSessions.get(socket.id);
        if (sessions.size > 0) {
          sessionId = sessions.values().next().value;
        }
      }

      if (!sessionId) {
        if (callback) callback(createErrorResponse('No session to end'));
        return;
      }

      // Get session metadata before ending
      const sessions = this.storageManager.getSessions();
      const session = sessions.sessions?.find(s => s.id === sessionId);
      
      if (!session) {
        if (callback) callback(createErrorResponse('Session not found'));
        return;
      }

      // End the session
      const result = await this.terminalManager.endSession(sessionId);
      
      // Clean up socket associations
      if (this.socketSessions.has(socket.id)) {
        this.socketSessions.get(socket.id).delete(sessionId);
        if (this.socketSessions.get(socket.id).size === 0) {
          this.socketSessions.delete(socket.id);
        }
      }

      // Clean up unsubscribers for this session
      if (this.socketUnsubscribers.has(socket.id)) {
        const unsubscribers = this.socketUnsubscribers.get(socket.id);
        if (unsubscribers.has(sessionId)) {
          const unsubscribe = unsubscribers.get(sessionId);
          if (typeof unsubscribe === 'function') {
            unsubscribe();
          }
          unsubscribers.delete(sessionId);
        }
      }

      // Broadcast updated session list
      socket.server.emit('sessions-updated', this.storageManager.getSessions());

      if (callback) callback(createSuccessResponse('Session ended successfully'));
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.end', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * Rename session
   * @param {Socket} socket Socket.IO socket
   * @param {Object} opts Rename options
   * @param {Function} callback Response callback
   */
  async rename(socket, opts, callback) {
    try {
      const { sessionId, name } = opts || {};
      
      if (!sessionId || !name) {
        if (callback) callback(createErrorResponse('Session ID and name are required'));
        return;
      }

      // Validate name
      const nameValidation = ValidationMiddleware.validateSessionName(name);
      if (!nameValidation.success) {
        if (callback) callback(createErrorResponse(nameValidation.error));
        return;
      }

      // Get current session data
      const sessionData = this.storageManager.getSessions();
      const session = sessionData.sessions?.find(s => s.id === sessionId);
      
      if (!session) {
        if (callback) callback(createErrorResponse('Session not found'));
        return;
      }

      // Update the session name
      session.name = nameValidation.data;
      
      // Save updated session data
      this.storageManager.updateSession(sessionId, { name: nameValidation.data });

      // Broadcast updated session list
      socket.server.emit('sessions-updated', this.storageManager.getSessions());

      if (callback) callback(createSuccessResponse('Session renamed successfully'));
    } catch (error) {
      const errorResponse = ErrorHandler.handle(error.message, 'socket.rename', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
    }
  }

  /**
   * Set up session data handlers for a socket
   * @private
   * @param {Socket} socket Socket.IO socket
   * @param {string} sessionId Session ID
   */
  setupSessionHandlers(socket, sessionId) {
    try {
      // Set up data handler
      const unsubscribe = this.terminalManager.subscribeToSession(sessionId, (data) => {
        socket.emit('output', data);
      });
      
      // Return unsubscribe function
      const actualUnsubscribe = () => {
        this.terminalManager.unsubscribeFromSession(sessionId, (data) => {
          socket.emit('output', data);
        });
      };

      // Store unsubscriber
      if (!this.socketUnsubscribers.has(socket.id)) {
        this.socketUnsubscribers.set(socket.id, new Map());
      }
      this.socketUnsubscribers.get(socket.id).set(sessionId, actualUnsubscribe);

      // Session end handling would need to be implemented differently
      // as the TerminalManager doesn't expose onSessionEnd events
      // For now, rely on the cleanup in the end() method
      
    } catch (error) {
      this.loggingService.error('Failed to setup session handlers:', error);
    }
  }

  /**
   * Clean up socket associations on disconnect
   * @param {Socket} socket Socket.IO socket
   */
  handleDisconnect(socket) {
    this.detach(socket);
  }

  /**
   * Get sessions associated with a socket
   * @param {string} socketId Socket ID
   * @returns {Set<string>} Set of session IDs
   */
  getSocketSessions(socketId) {
    return this.socketSessions.get(socketId) || new Set();
  }

  /**
   * Create SessionHandler with default dependencies (legacy factory)
   * @returns {SessionHandler} Configured SessionHandler
   */
  static create() {
    return new SessionHandler({
      terminalManager: new TerminalManager(),
      storageManager: storageManager
    });
  }

  /**
   * Create SessionHandler with dependency injection
   * @param {Object} dependencies Injected service dependencies
   * @returns {SessionHandler} Handler with injected dependencies
   */
  static createWithDependencies(dependencies) {
    return new SessionHandler(dependencies);
  }
}