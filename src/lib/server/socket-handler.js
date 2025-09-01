// src/lib/server/socket-handler.js
import { TerminalManager } from './terminal.js';
import { addSession, switchSession, endSession, getSessions, updateSessionName } from './session-store.js';
import { 
  createProject, 
  getProjects, 
  getProject,
  updateProject,
  deleteProject,
  addSessionToProject,
  updateSessionInProject,
  removeSessionFromProject,
  setActiveProject 
} from './project-store.js';
import { createErrorResponse, createSuccessResponse, ErrorHandler } from '../utils/error-handling.js';
import { ValidationMiddleware, RateLimiter } from '../utils/validation.js';
import fs from 'node:fs';

const terminalManager = new TerminalManager();
const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';
const ENABLE_TUNNEL = process.env.ENABLE_TUNNEL === 'true';
const PTY_ROOT = process.env.PTY_ROOT || '/tmp/dispatch-sessions';
const TUNNEL_FILE = process.env.TUNNEL_FILE || `${PTY_ROOT}/tunnel-url.txt`;

// Check if auth key is required
const AUTH_REQUIRED = ENABLE_TUNNEL || TERMINAL_KEY !== 'change-me';

/** @type {Map<string, Set<string>>} */
const socketSessions = new Map();
/** @type {Map<string, Map<string, Function>>} */
const socketUnsubscribers = new Map();

// Rate limiter for input events (per socket)
const inputRateLimiter = new RateLimiter(1000, 50); // 50 inputs per second per socket

export function handleConnection(socket) {
  console.log('Socket connected:', socket.id);
  
  let authenticated = !AUTH_REQUIRED; // Skip auth if not required

  // Authentication
  socket.on('auth', (key, callback) => {
    if (!AUTH_REQUIRED) {
      authenticated = true;
      if (callback) callback(createSuccessResponse());
      console.log('Socket authenticated (no auth required):', socket.id);
    } else if (key === TERMINAL_KEY) {
      authenticated = true;
      if (callback) callback(createSuccessResponse());
      console.log('Socket authenticated:', socket.id);
    } else {
      const errorResponse = ErrorHandler.handle('Invalid authentication key', 'socket.auth', false);
      if (callback) callback(createErrorResponse(errorResponse.error));
      console.log('Socket auth failed:', socket.id);
    }
  });

  // Create new session
  socket.on('create', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }

    // Validate session options
    const validation = ValidationMiddleware.validateSessionOptions(opts || {});
    if (!validation.success) {
      if (callback) callback(createErrorResponse(validation.error));
      return;
    }

    try {
      const createOpts = {
        ...validation.data,
        parentSessionId: opts?.parentSessionId // Pass parent session ID for shared directory
      };
      const { sessionId, pty, name } = terminalManager.createSession(createOpts);
      
      // Add session to this socket's session set
      if (!socketSessions.has(socket.id)) {
        socketSessions.set(socket.id, new Set());
      }
      socketSessions.get(socket.id).add(sessionId);

      // Store session metadata (minimal if not provided)
      try {
        const sessionMeta = opts && opts.meta ? 
          { id: sessionId, name, ...opts.meta } :
          { id: sessionId, name, host: 'local', port: '0', username: 'user' };
        
        addSession(sessionMeta);
        // Broadcast updated sessions list
        socket.server.emit('sessions-updated', getSessions());
      } catch (err) {
        console.warn('Failed to persist session metadata:', err.message);
      }

      // Note: Subscription to session data is handled in the 'attach' handler
      // This allows sessions to be created without immediately consuming output

      // Handle PTY exit
      pty.onExit(({ exitCode, signal }) => {
        socket.emit('ended', { exitCode, signal });
        
        // Clean up this specific session
        const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
        if (sessionUnsubscribers && sessionUnsubscribers.has(sessionId)) {
          const unsubscribe = sessionUnsubscribers.get(sessionId);
          if (unsubscribe) {
            unsubscribe();
            sessionUnsubscribers.delete(sessionId);
          }
        }
        
        // Remove session from socket's session set
        const sessions = socketSessions.get(socket.id);
        if (sessions) {
          sessions.delete(sessionId);
        }
        
        // Note: We don't remove session metadata when PTY exits
        // Sessions persist and can be reconnected to with new PTY processes
      });

      if (callback) callback({ success: true, sessionId, name });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // List sessions (auth required)
  socket.on('list', (callback) => {
    if (!authenticated) {
      if (callback) callback({ success: false, error: 'Not authenticated' });
      return;
    }
    
    try {
      if (callback) callback({ success: true, ...getSessions() });
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Attach to existing session
  socket.on('attach', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const { sessionId } = opts;
    let pty = terminalManager.getSession(sessionId);
    
    if (!pty) {
      // Check if session exists in persistent storage
      const sessions = getSessions();
      const persistentSession = sessions.sessions.find(s => s.id === sessionId);
      
      if (persistentSession) {
        // Session exists but PTY is dead, create a new PTY with existing session ID
        try {
          const result = terminalManager.createSessionWithId(sessionId, {
            mode: terminalManager.defaultMode === 'claude' ? 'claude' : 'shell', // Use default mode for resumed sessions
            cols: opts.cols || 80,
            rows: opts.rows || 24,
            name: persistentSession.name
          });
          pty = result.pty;
          console.log(`Resumed session: ${sessionId} (${persistentSession.name})`);
        } catch (err) {
          if (callback) callback({ success: false, error: `Failed to resume session: ${err.message}` });
          return;
        }
      } else {
        if (callback) callback({ success: false, error: 'Session not found' });
        return;
      }
    }

    // Add session to this socket's session set
    if (!socketSessions.has(socket.id)) {
      socketSessions.set(socket.id, new Set());
    }
    socketSessions.get(socket.id).add(sessionId);

    // Send buffered data first
    const bufferedData = terminalManager.getBufferedData(sessionId);
    if (bufferedData) {
      socket.emit('output', { sessionId, data: bufferedData });
    }

    // Resize if dimensions provided
    if (opts.cols && opts.rows) {
      terminalManager.resizeSession(sessionId, opts.cols, opts.rows);
    }

    // Subscribe to session data
    const unsubscribe = terminalManager.subscribeToSession(sessionId, (data) => {
      socket.emit('output', { sessionId, data });
    });
    
    // Store unsubscriber for this specific session
    if (!socketUnsubscribers.has(socket.id)) {
      socketUnsubscribers.set(socket.id, new Map());
    }
    socketUnsubscribers.get(socket.id).set(sessionId, unsubscribe);

    // Handle PTY exit
    pty.onExit(({ exitCode, signal }) => {
        socket.emit('ended', { exitCode, signal });
        
        // Clean up this specific session
        const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
        if (sessionUnsubscribers && sessionUnsubscribers.has(sessionId)) {
          const unsubscribe = sessionUnsubscribers.get(sessionId);
          if (unsubscribe) {
            unsubscribe();
            sessionUnsubscribers.delete(sessionId);
          }
        }
        
        // Remove session from socket's session set
        const sessions = socketSessions.get(socket.id);
        if (sessions) {
          sessions.delete(sessionId);
        }
        
        // Note: We don't remove session metadata when PTY exits
        // Sessions persist and can be reconnected to with new PTY processes
    });

    if (callback) callback({ success: true });
  });

  // Handle input from client
  socket.on('input', (data, sessionId) => {
    // Rate limiting check
    if (!inputRateLimiter.isAllowed(socket.id)) {
      console.warn(`Rate limit exceeded for socket ${socket.id}`);
      return;
    }
    
    // Validate input data
    const inputValidation = ValidationMiddleware.validateInput(data);
    if (!inputValidation.success) {
      console.warn(`Invalid input from socket ${socket.id}:`, inputValidation.error);
      return;
    }
    const validatedData = inputValidation.data;
    
    // Allow /login command even without authentication
    const isLoginCommand = validatedData && typeof validatedData === 'string' && 
      (validatedData.trim() === '/login' || validatedData.trim().startsWith('claude setup-token') || validatedData.trim().startsWith('npx @anthropic-ai/claude setup-token'));
    
    if (!authenticated && !isLoginCommand) {
      return;
    }
    
    // Use provided sessionId, or fall back to first session in socket's session set
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const sessions = socketSessions.get(socket.id);
      if (sessions && sessions.size > 0) {
        targetSessionId = sessions.values().next().value;
      }
    }
    
    if (targetSessionId) {
      // Handle /login command specially
      if (isLoginCommand && validatedData.trim() === '/login') {
        // Convert /login to the actual claude setup-token command
        terminalManager.writeToSession(targetSessionId, 'npx @anthropic-ai/claude setup-token\r');
      } else {
        terminalManager.writeToSession(targetSessionId, validatedData);
      }
    }
  });

  // Handle resize
  socket.on('resize', (dims) => {
    if (!authenticated) return;
    
    // Validate dimensions
    const validation = ValidationMiddleware.validateDimensions(dims);
    if (!validation.success) {
      console.warn(`Invalid resize dimensions from socket ${socket.id}:`, validation.error);
      return;
    }
    
    const validatedDims = validation.data;
    
    // Resize specific session or all sessions for this socket
    const targetSessionId = dims.sessionId;
    if (targetSessionId) {
      terminalManager.resizeSession(targetSessionId, validatedDims.cols, validatedDims.rows);
    } else {
      // Fall back to resizing first session if no specific session provided
      const sessions = socketSessions.get(socket.id);
      if (sessions && sessions.size > 0) {
        const firstSessionId = sessions.values().next().value;
        terminalManager.resizeSession(firstSessionId, validatedDims.cols, validatedDims.rows);
      }
    }
  });

  // End session
  socket.on('end', (sessionIdArg) => {
    if (!authenticated) return;

    // Use provided sessionId or default to first session in socket's set
    let sessionId = sessionIdArg;
    if (!sessionId) {
      const sessions = socketSessions.get(socket.id);
      if (sessions && sessions.size > 0) {
        sessionId = sessions.values().next().value;
      }
    }
    
    if (sessionId) {
      terminalManager.endSession(sessionId);
      
      // Remove session from socket's session set
      const sessions = socketSessions.get(socket.id);
      if (sessions) {
        sessions.delete(sessionId);
      }
      
      // Clean up unsubscriber for this session
      const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
      if (sessionUnsubscribers && sessionUnsubscribers.has(sessionId)) {
        const unsubscribe = sessionUnsubscribers.get(sessionId);
        if (unsubscribe) {
          unsubscribe();
          sessionUnsubscribers.delete(sessionId);
        }
      }
      
      try {
        endSession(sessionId);
      } catch (err) {
        console.warn('Failed to remove session metadata on end:', err.message);
      }
      // Broadcast update
      socket.server.emit('sessions-updated', getSessions());
      socket.emit('ended');
    }
  });

  // Rename session
  socket.on('rename', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const { sessionId, newName } = opts;

    if (!sessionId || !newName) {
      if (callback) callback({ success: false, error: 'sessionId and newName are required' });
      return;
    }

    try {
      // Get current session metadata to return old name
      const sessionData = getSessions();
      const session = sessionData.sessions.find(s => s.id === sessionId);
      
      if (!session) {
        if (callback) callback({ success: false, error: 'Session not found' });
        return;
      }

      const oldName = session.name;

      // Rename in TerminalManager (handles validation and symlinks)
      const actualNewName = terminalManager.renameSession(sessionId, newName);
      
      // Update persistent session storage
      updateSessionName(sessionId, actualNewName);
      
      // Broadcast updated sessions list
      socket.server.emit('sessions-updated', getSessions());
      
      if (callback) callback({
        success: true,
        sessionId,
        oldName,
        newName: actualNewName
      });
      
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Get public URL (no auth required)
  socket.on('get-public-url', (callback) => {
    try {
      const url = fs.readFileSync(TUNNEL_FILE, 'utf-8').trim();
      if (callback) callback({ success: true, url });
    } catch {
      if (callback) callback({ success: true, url: null });
    }
  });

  // Detach from session (but don't end it)
  socket.on('detach', () => {
    // Clean up all sessions for this socket
    const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
    if (sessionUnsubscribers) {
      sessionUnsubscribers.forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
      socketUnsubscribers.delete(socket.id);
    }
    socketSessions.delete(socket.id);
  });

  // PROJECT-BASED EVENT HANDLERS

  // Create new project
  socket.on('create-project', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }

    try {
      const { name, description } = opts || {};
      
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        if (callback) callback(createErrorResponse('Project name is required'));
        return;
      }

      const project = createProject({ name: name.trim(), description: description || '' });
      
      // Broadcast updated projects list
      socket.server.emit('projects-updated', getProjects());
      
      if (callback) callback({ success: true, project });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // List projects
  socket.on('list-projects', (callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }
    
    try {
      const projects = getProjects();
      if (callback) callback({ success: true, ...projects });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // Get single project with sessions
  socket.on('get-project', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }

    try {
      const { projectId } = opts || {};
      
      if (!projectId) {
        if (callback) callback(createErrorResponse('Project ID is required'));
        return;
      }

      const project = getProject(projectId);
      
      if (!project) {
        if (callback) callback(createErrorResponse('Project not found'));
        return;
      }

      // Get active sessions for this project
      const activeSessions = terminalManager.getProjectSessions(projectId);
      
      if (callback) callback({ 
        success: true, 
        project: {
          ...project,
          activeSessions
        }
      });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // Update project
  socket.on('update-project', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }

    try {
      const { projectId, updates } = opts || {};
      
      if (!projectId || !updates) {
        if (callback) callback(createErrorResponse('Project ID and updates are required'));
        return;
      }

      const updatedProject = updateProject(projectId, updates);
      
      // Broadcast updated projects list
      socket.server.emit('projects-updated', getProjects());
      
      if (callback) callback({ success: true, project: updatedProject });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // Delete project
  socket.on('delete-project', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }

    try {
      const { projectId } = opts || {};
      
      if (!projectId) {
        if (callback) callback(createErrorResponse('Project ID is required'));
        return;
      }

      // End all active sessions in this project first
      const activeSessions = terminalManager.getProjectSessions(projectId);
      activeSessions.forEach(sessionInfo => {
        if (sessionInfo.active) {
          try {
            terminalManager.endSession(sessionInfo.sessionId);
          } catch (err) {
            console.warn(`Failed to end session ${sessionInfo.sessionId}:`, err.message);
          }
        }
      });

      deleteProject(projectId);
      
      // Broadcast updated projects list
      socket.server.emit('projects-updated', getProjects());
      
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // Create session within project
  socket.on('create-session-in-project', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }

    try {
      const { projectId, sessionOpts } = opts || {};
      
      if (!projectId) {
        if (callback) callback(createErrorResponse('Project ID is required'));
        return;
      }

      // Verify project exists
      const project = getProject(projectId);
      if (!project) {
        if (callback) callback(createErrorResponse('Project not found'));
        return;
      }

      // Validate session options
      const validation = ValidationMiddleware.validateSessionOptions(sessionOpts || {});
      if (!validation.success) {
        if (callback) callback(createErrorResponse(validation.error));
        return;
      }

      // Create PTY session in project
      const createOpts = {
        ...validation.data,
        projectId: projectId
      };
      const { sessionId, pty, name } = terminalManager.createSessionInProject(projectId, createOpts);
      
      // Add session to this socket's session set
      if (!socketSessions.has(socket.id)) {
        socketSessions.set(socket.id, new Set());
      }
      socketSessions.get(socket.id).add(sessionId);

      // Add session to project metadata
      try {
        addSessionToProject(projectId, {
          id: sessionId,
          name,
          type: validation.data.mode || 'pty',
          status: 'active'
        });
        
        // Broadcast updated projects list
        socket.server.emit('projects-updated', getProjects());
      } catch (err) {
        console.warn('Failed to persist session metadata:', err.message);
      }

      // Handle PTY exit
      pty.onExit(({ exitCode, signal }) => {
        socket.emit('session-ended', { sessionId, exitCode, signal });
        
        // Update session status in project
        try {
          updateSessionInProject(projectId, sessionId, { status: 'stopped' });
          socket.server.emit('projects-updated', getProjects());
        } catch (err) {
          console.warn('Failed to update session status:', err.message);
        }
        
        // Clean up this specific session
        const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
        if (sessionUnsubscribers && sessionUnsubscribers.has(sessionId)) {
          const unsubscribe = sessionUnsubscribers.get(sessionId);
          if (unsubscribe) {
            unsubscribe();
            sessionUnsubscribers.delete(sessionId);
          }
        }
        
        // Remove session from socket's session set
        const sessions = socketSessions.get(socket.id);
        if (sessions) {
          sessions.delete(sessionId);
        }
      });

      if (callback) callback({ success: true, sessionId, name, projectId });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // Set active project
  socket.on('set-active-project', (opts, callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }

    try {
      const { projectId } = opts || {};
      
      const activeProjectId = setActiveProject(projectId);
      
      // Broadcast updated projects list
      socket.server.emit('projects-updated', getProjects());
      
      if (callback) callback({ success: true, activeProject: activeProjectId });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Socket disconnected:', socket.id);
    
    // Clean up all sessions for this socket
    const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
    if (sessionUnsubscribers) {
      sessionUnsubscribers.forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
      socketUnsubscribers.delete(socket.id);
    }
    socketSessions.delete(socket.id);
  });
}