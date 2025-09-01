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
import { checkClaudeCredentials } from './claude-auth-middleware.js';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';

const terminalManager = new TerminalManager();
const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';
const TUNNEL_FILE = '/tmp/tunnel-url.txt'; // Simplified tunnel file path

// Check if auth key is required
const AUTH_REQUIRED = TERMINAL_KEY !== 'change-me';

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
  socket.on('create', async (opts, callback) => {
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
      // Use specified project or create/get default project
      let targetProject;
      const { projectId } = opts || {};
      
      if (projectId) {
        // Use specified project
        targetProject = getProject(projectId);
        if (!targetProject) {
          if (callback) callback(createErrorResponse(`Project ${projectId} not found`));
          return;
        }
      } else {
        // Create a default project if none exists or get the default one
        try {
          const projectsData = getProjects();
          const projects = projectsData.projects || [];
          targetProject = projects.find(p => p.name === 'default');
          
          if (!targetProject) {
            // Create default project
            targetProject = createProject({
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
      const pty = terminalManager.createSimpleSession(sessionId, sessionOpts);
      const name = sessionOpts.name || `session-${Date.now()}`;
      
      // Add session to project
      addSessionToProject(targetProject.id, {
        id: sessionId,
        name,
        type: sessionOpts.mode || 'shell',
        status: 'active',
        createdAt: new Date().toISOString()
      });
      
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

  // List sessions (auth required) with optional project filtering
  socket.on('list', async (opts, callback) => {
    // Handle both old signature (callback only) and new signature (opts, callback)
    if (typeof opts === 'function') {
      callback = opts;
      opts = {};
    }
    
    if (!authenticated) {
      if (callback) callback({ success: false, error: 'Not authenticated' });
      return;
    }
    
    try {
      const { projectId } = opts || {};
      
      if (projectId) {
        // Filter sessions by project
        const project = getProject(projectId);
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
        if (callback) callback({ success: true, ...getSessions() });
      }
    } catch (err) {
      if (callback) callback({ success: false, error: err.message });
    }
  });

  // Attach to existing session with project validation
  socket.on('attach', async (opts, callback) => {
    if (!authenticated) {
      if (callback) callback({ success: false, error: 'Not authenticated' });
      return;
    }

    const { sessionId, projectId } = opts;
    
    // Validate project if specified
    if (projectId) {
      try {
        const project = getProject(projectId);
        if (!project) {
          if (callback) callback({ success: false, error: 'Project not found' });
          return;
        }
        
        // Verify session belongs to the specified project
        const sessionExists = project.sessions && project.sessions.some(s => s.id === sessionId);
        if (!sessionExists) {
          if (callback) callback({ success: false, error: 'Session not found in specified project' });
          return;
        }
      } catch (err) {
        if (callback) callback({ success: false, error: `Project validation failed: ${err.message}` });
        return;
      }
    }

    let pty = terminalManager.getSession(sessionId);
    
    if (!pty) {
      // Check if session exists in persistent storage (try both old and new stores)
      let persistentSession = null;
      
      // First check the old session store
      const sessions = getSessions();
      persistentSession = sessions.sessions.find(s => s.id === sessionId);
      
      // If not found, check project-based sessions
      if (!persistentSession) {
        const projectsData = getProjects();
        const projects = projectsData.projects || [];
        for (const project of projects) {
          const session = project.sessions?.find(s => s.id === sessionId);
          if (session) {
            persistentSession = session;
            break;
          }
        }
      }
      
      if (persistentSession) {
        // Session exists but PTY is dead, create a new PTY with existing session ID
        try {
          const sessionMode = persistentSession.type === 'claude' ? 'claude' : 'shell';
          
          // Find the project this session belongs to
          let projectId = null;
          const projectsData = getProjects();
          const projects = projectsData.projects || [];
          for (const project of projects) {
            if (project.sessions?.some(s => s.id === sessionId)) {
              projectId = project.id;
              break;
            }
          }
          
          if (!projectId) {
            if (callback) callback({ success: false, error: 'Session project not found' });
            return;
          }
          
          // Create a new PTY for the existing session
          const sessionOpts = {
            mode: sessionMode,
            name: persistentSession.name,
            projectId: projectId
          };
          pty = terminalManager.createSimpleSession(sessionId, sessionOpts);
          
          console.log(`Restored session ${sessionId} with new PTY process`);
          
        } catch (err) {
          if (callback) callback({ success: false, error: `Failed to restore session: ${err.message}` });
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

    // Send buffered data (history) AND set up live subscription for new output
    const bufferedData = terminalManager.getBufferedData(sessionId);
    
    // First, send any buffered/historical data
    if (bufferedData && bufferedData.trim().length > 0) {
      console.debug(`Sending ${bufferedData.length} chars of buffered data for session ${sessionId}`);
      socket.emit('output', { sessionId, data: bufferedData });
    }
    
    // Clean up any existing subscription for this session before creating a new one
    const sessionUnsubscribers = socketUnsubscribers.get(socket.id);
    if (sessionUnsubscribers && sessionUnsubscribers.has(sessionId)) {
      const oldUnsubscribe = sessionUnsubscribers.get(sessionId);
      if (oldUnsubscribe) {
        oldUnsubscribe();
        console.debug(`Cleaned up old subscription for session ${sessionId}`);
      }
    }
    
    // Set up live subscription for new output
    console.debug(`Setting up live subscription for session ${sessionId}`);
    const unsubscribe = terminalManager.subscribeToSession(sessionId, (data) => {
      socket.emit('output', { sessionId, data });
    });
    
    // Store unsubscriber for this specific session
    if (!socketUnsubscribers.has(socket.id)) {
      socketUnsubscribers.set(socket.id, new Map());
    }
    socketUnsubscribers.get(socket.id).set(sessionId, unsubscribe);

    // Resize if dimensions provided
    if (opts.cols && opts.rows) {
      terminalManager.resizeSession(sessionId, opts.cols, opts.rows);
    }

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
  socket.on('end', (sessionIdArg, callback) => {
    if (!authenticated) {
      if (callback) callback({ success: false, error: 'Not authenticated' });
      return;
    }

    // Use provided sessionId or default to first session in socket's set
    let sessionId = sessionIdArg;
    if (!sessionId) {
      const sessions = socketSessions.get(socket.id);
      if (sessions && sessions.size > 0) {
        sessionId = sessions.values().next().value;
      }
    }
    
    if (sessionId) {
      // Get project ID before ending session (metadata will be deleted)
      const sessionMetadata = terminalManager.sessionMetadata.get(sessionId);
      let projectId = sessionMetadata?.projectId;
      
      // If no projectId in terminal metadata, search project store
      if (!projectId) {
        console.log(`DEBUG: No projectId in session metadata, searching project store...`);
        const projectsData = getProjects();
        const projects = projectsData.projects || [];
        
        for (const project of projects) {
          if (project.sessions && project.sessions.some(s => s.id === sessionId)) {
            projectId = project.id;
            console.log(`DEBUG: Found session ${sessionId} in project ${projectId}`);
            break;
          }
        }
      }
      
      console.log(`DEBUG: Ending session ${sessionId}`);
      console.log(`DEBUG: Session metadata:`, sessionMetadata);
      console.log(`DEBUG: Final projectId:`, projectId);
      
      terminalManager.endSession(sessionId);
      console.log(`Ended session: ${sessionId}, projectId: ${projectId}`);
      // Remove session from project if it belongs to one
      if (projectId) {
        try {
          removeSessionFromProject(projectId, sessionId);
          console.log(`Removed session ${sessionId} from project ${projectId}`);
          // Broadcast project updates to all clients
          socket.server.emit('projects-updated', getProjects());
        } catch (err) {
          console.warn(`Failed to remove session from project: ${err.message}`);
        }
      }
      
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
      
      if (callback) callback({ success: true });
    } else {
      if (callback) callback({ success: false, error: 'Session not found' });
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
  socket.on('create-project', async (opts, callback) => {
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

      const project = createProject({ 
        name: name.trim(),
        description: description || '' 
      });
      
      // Broadcast updated projects list
      socket.server.emit('projects-updated', getProjects());
      
      if (callback) callback({ success: true, project });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // List projects
  socket.on('list-projects', async (callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }
    
    try {
      const projectsData = getProjects();
      if (callback) callback({ success: true, projects: projectsData.projects || [] });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // Get single project with sessions
  socket.on('get-project', async (opts, callback) => {
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
      const activeSessions = (project.sessions || []).map(session => ({
        ...session,
        sessionId: session.id  // Add sessionId alias for frontend compatibility
      }));
      
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
      const project = getProject(projectId);
      if (project && project.sessions) {
        project.sessions.forEach(sessionInfo => {
          if (sessionInfo.status === 'active') {
            try {
              terminalManager.endSession(sessionInfo.id);
            } catch (err) {
              console.warn(`Failed to end session ${sessionInfo.id}:`, err.message);
            }
          }
        });
      }

      deleteProject(projectId);
      
      // Broadcast updated projects list
      socket.server.emit('projects-updated', getProjects());
      
      if (callback) callback({ success: true });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // Create session within project
  socket.on('create-session-in-project', async (opts, callback) => {
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

      // Create PTY session directly
      const createOpts = {
        ...validation.data,
        projectId: projectId,
        workingDirectory: sessionOpts?.workingDirectory // Pass through working directory option
      };
      const sessionId = randomUUID();
      const pty = terminalManager.createSimpleSession(sessionId, createOpts);
      const name = createOpts.name || `session-${Date.now()}`;
      
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

  // List directories within a project
  socket.on('list-project-directories', async (opts, callback) => {
    if (!authenticated) {
      if (callback) callback(createErrorResponse('Not authenticated'));
      return;
    }

    try {
      const { projectId, relativePath } = opts || {};
      
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

      // Use TerminalManager to list directories
      const directories = await terminalManager.listProjectDirectories(projectId, relativePath || '');
      
      if (callback) callback({ 
        success: true, 
        projectId,
        relativePath: relativePath || '',
        directories 
      });
    } catch (err) {
      if (callback) callback(createErrorResponse(err.message));
    }
  });

  // Check Claude authentication status for a project
  socket.on('check-claude-auth', async (opts, callback) => {
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

      // Verify project exists
      const project = getProject(projectId);
      if (!project) {
        if (callback) callback(createErrorResponse('Project not found'));
        return;
      }

      // Get project directory and check for Claude credentials
      const projectInfo = await terminalManager.directoryManager.getProject(projectId);
      const isAuthenticated = checkClaudeCredentials(projectInfo.path);
      
      if (callback) callback({ 
        success: true, 
        projectId,
        authenticated: isAuthenticated,
        credentialsPath: `${projectInfo.path}/.claude/credentials.json`
      });
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