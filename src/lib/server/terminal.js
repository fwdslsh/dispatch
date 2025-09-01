// src/lib/server/terminal.js
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
// randomUUID import removed - now handled by DirectoryManager
import { spawn } from 'node-pty';
import { createSymlink, removeSymlinkByName, cleanupOrphanedSymlinks } from './symlink-manager.js';
import { validateSessionName, generateFallbackName, resolveNameConflict } from './name-validation.js';
import { getAllSessionNames } from './session-store.js';
import { TERMINAL_CONFIG } from '../config/constants.js';
import DirectoryManager from './directory-manager.js';

/**
 * @typedef {Object} SessionOpts
 * @property {number} [cols]
 * @property {number} [rows]
 * @property {"claude"|"shell"} [mode]
 * @property {string} [name]
 * @property {string} [parentSessionId]
 * @property {string} [projectId]
 * @property {string} [workingDirectory]
 * @property {boolean} [createSubfolder]
 * @property {string} [purpose]
 * @property {Object} [metadata]
 */

export class TerminalManager {
  constructor() {
    /** @type {Map<string, import('node-pty').IPty>} */
    this.sessions = new Map();
    /** @type {Map<string, string[]>} */
    this.buffers = new Map();
    /** @type {Map<string, Set<Function>>} */
    this.subscribers = new Map();
    /** @type {Map<string, {name: string, symlinkName: string, projectId?: string, workingDir?: string, hasSubfolder?: boolean}>} */
    this.sessionMetadata = new Map();
    this.defaultMode = process.env.PTY_MODE || 'shell';
    this.maxBufferSize = TERMINAL_CONFIG.MAX_HISTORY_ENTRIES;
    
    // Initialize DirectoryManager
    this.directoryManager = new DirectoryManager();
    this.directoryManager.initialize().catch(err => {
      console.error('Failed to initialize DirectoryManager:', err);
    });
    
    // Cleanup orphaned symlinks on startup
    try {
      cleanupOrphanedSymlinks();
    } catch (err) {
      console.warn('Failed to cleanup orphaned symlinks:', err.message);
    }
  }

  /**
   * CRITICAL: Set up a SINGLE data handler for a PTY session
   * This prevents duplicate keystroke output by ensuring only ONE handler per PTY
   * @param {import('node-pty').IPty} pty - The PTY instance
   * @param {string} sessionId - The session ID
   */
  setupDataHandler(pty, sessionId) {
    // ONLY SET UP ONE DATA HANDLER PER PTY
    pty.onData((data) => {
      console.debug(`PTY data for session ${sessionId}:`, JSON.stringify(data));
      
      // Buffer the data
      this.appendToBuffer(sessionId, data);
      
      // Notify all subscribers
      const subscribers = this.subscribers.get(sessionId);
      console.debug(`Session ${sessionId} has ${subscribers ? subscribers.size : 0} subscribers`);
      
      if (subscribers) {
        subscribers.forEach(callback => {
          try {
            callback(data);
          } catch (err) {
            console.warn('Subscriber callback error:', err);
          }
        });
      }
    });
    
    console.debug(`Set up SINGLE data handler for session ${sessionId}`);
  }

  /**
   * List directories within a project folder
   * @param {string} projectId - The project ID
   * @param {string} [relativePath=''] - Relative path within the project (optional)
   * @returns {Promise<Array<{name: string, path: string, isDirectory: boolean}>>} Array of directory entries
   */
  async listProjectDirectories(projectId, relativePath = '') {
    const project = await this.directoryManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project does not exist: ${projectId}`);
    }
    
    const projectDir = project.path;
    
    // Construct the target directory path
    const targetDir = path.join(projectDir, relativePath);
    
    // Security check: ensure the target path is within the project directory
    const resolvedProjectDir = path.resolve(projectDir);
    const resolvedTargetDir = path.resolve(targetDir);
    
    if (!resolvedTargetDir.startsWith(resolvedProjectDir)) {
      throw new Error('Invalid path: Directory must be within the project folder');
    }
    
    // Check if target directory exists
    if (!fs.existsSync(targetDir)) {
      throw new Error(`Directory does not exist: ${path.join(projectId, relativePath)}`);
    }
    
    try {
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      
      return entries
        .filter(entry => {
          // Filter out hidden files/directories and common undesirable directories
          const name = entry.name;
          return !name.startsWith('.') && 
                 !['node_modules', 'sessions', '__pycache__', 'dist', 'build'].includes(name);
        })
        .map(entry => ({
          name: entry.name,
          path: path.join(relativePath, entry.name).replace(/\\/g, '/'), // Normalize path separators
          isDirectory: entry.isDirectory()
        }))
        .sort((a, b) => {
          // Sort directories first, then files, alphabetically within each group
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });
    } catch (err) {
      throw new Error(`Failed to list directory contents: ${err.message}`);
    }
  }

  /**
   * Create a new PTY session within a project directory
   * @param {string} projectId - The project ID where the session will be created
   * @param {SessionOpts} [opts={}] - Session options
   * @returns {Promise<{sessionId: string, pty: import('node-pty').IPty, name: string, projectId: string}>}
   */
  async createSessionInProject(projectId, opts = {}) {
    const { cols = 80, rows = 24, mode = this.defaultMode, name, workingDirectory } = opts;
    
    // Create session through DirectoryManager
    const sessionData = await this.directoryManager.createSession(projectId, {
      mode,
      purpose: opts.purpose || 'Terminal session',
      ...opts.metadata
    });
    
    const sessionId = sessionData.id;
    const sessionPath = sessionData.path;
    
    // Validate and generate session name
    const sessionName = name || generateFallbackName(sessionId);
    
    // Get project info for the working directory
    const project = await this.directoryManager.getProject(projectId);
    const projectDir = project.path;
    
    // Determine session working directory
    // Sessions start in their own directory, but have access to the entire project
    let sessionWorkingDir = sessionPath;
    
    if (workingDirectory) {
      // Use the specified working directory within the project
      const targetDir = path.join(projectDir, workingDirectory);
      
      // Use DirectoryManager's path validation
      this.directoryManager.validatePath(targetDir, projectDir);
      
      // Check if the working directory exists
      if (!fs.existsSync(targetDir)) {
        // Create it if it doesn't exist
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Verify it's actually a directory
      const stats = fs.statSync(targetDir);
      if (!stats.isDirectory()) {
        throw new Error(`Working directory path is not a directory: ${workingDirectory}`);
      }
      
      sessionWorkingDir = targetDir;
      console.log(`Using custom working directory: ${sessionWorkingDir}`);
    }
    
    // Determine command based on mode
    let command, args, env;
    if (mode === 'claude') {
      command = 'claude';
      args = [];
      env = {
        ...process.env,
        TERM: 'xterm-256color',
        HOME: projectDir,  // Set HOME to project root for access to entire project
        // Additional sandboxing environment variables
        PWD: sessionWorkingDir,
        USER: 'appuser',
        //PATH: '/usr/local/bin:/usr/bin:/bin',
        // Session stays within project directory
        PROJECT_ROOT: projectDir,
        SESSION_DIR: sessionPath,
        // Clear any potentially problematic env vars
        OLDPWD: sessionWorkingDir
      };
    } else {
      // Default to shell mode
      command = process.env.SHELL || '/bin/bash';
      args = [];
      env = {
        ...process.env,
        TERM: 'xterm-256color',
        HOME: projectDir,  // Set HOME to project root for access to entire project
        // Additional sandboxing environment variables
        PWD: sessionWorkingDir,
        USER: 'appuser',
        //PATH: '/usr/local/bin:/usr/bin:/bin',
        // Session stays within project directory
        PROJECT_ROOT: projectDir,
        SESSION_DIR: sessionPath,
        // Clear any potentially problematic env vars
        OLDPWD: sessionWorkingDir
      };
    }
    
    // Create PTY with the session working directory as cwd
    const pty = spawn(command, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: sessionWorkingDir,
      env
    });

    this.sessions.set(sessionId, pty);
    this.buffers.set(sessionId, []);
    this.subscribers.set(sessionId, new Set());
    
    // Create symlink for readable directory name (project-based)
    let symlinkName;
    try {
      symlinkName = createSymlink(projectId, sessionName);
    } catch (err) {
      console.warn(`Failed to create symlink for project ${projectId}:`, err.message);
      symlinkName = null;
    }

    // Store session metadata with project reference
    this.sessionMetadata.set(sessionId, { 
      name: sessionName, 
      symlinkName,
      projectId: projectId
    });

    console.log(`Created session ${sessionId} (${sessionName}) in project ${projectId} at ${sessionWorkingDir}`);

    // Setup SINGLE data handler
    this.setupDataHandler(pty, sessionId);
    
    // Update session metadata with PID
    await this.directoryManager.updateSession(projectId, sessionId, {
      pid: pty.pid,
      status: 'active'
    });

    return { sessionId, pty, name: sessionName, projectId };
  }

  /**
   * Get the project ID for a given session
   * @param {string} sessionId - The session ID
   * @returns {string|null} Project ID or null if not found
   */
  getSessionProject(sessionId) {
    const metadata = this.sessionMetadata.get(sessionId);
    return metadata?.projectId || null;
  }

  /**
   * Get all sessions for a specific project
   * @param {string} projectId - The project ID
   * @returns {Array<{sessionId: string, name: string, active: boolean}>} Array of session info
   */
  getProjectSessions(projectId) {
    const projectSessions = [];
    
    for (const [sessionId, metadata] of this.sessionMetadata.entries()) {
      if (metadata.projectId === projectId) {
        projectSessions.push({
          sessionId,
          name: metadata.name,
          active: this.sessions.has(sessionId)
        });
      }
    }
    
    return projectSessions;
  }

  /**
   * Create a simple PTY session directly (without DirectoryManager)
   * @param {string} sessionId - The session ID
   * @param {SessionOpts} [opts={}] - Session options
   * @returns {import('node-pty').IPty} The created PTY instance
   */
  createSimpleSession(sessionId, opts = {}) {
    const { cols = 80, rows = 24, mode = this.defaultMode, name, workingDirectory } = opts;
    
    // Use current working directory or project-specific directory
    const sessionWorkingDir = workingDirectory || process.cwd();
    
    // Determine command based on mode
    let command, args, env;
    if (mode === 'claude') {
      command = 'claude';
      args = [];
      env = {
        ...process.env,
        TERM: 'xterm-256color',
        PWD: sessionWorkingDir,
        USER: process.env.USER || 'appuser'
      };
    } else {
      // Default to shell mode
      command = process.env.SHELL || '/bin/bash';
      args = [];
      env = {
        ...process.env,
        TERM: 'xterm-256color',
        PWD: sessionWorkingDir,
        USER: process.env.USER || 'appuser'
      };
    }
    
    // Create PTY
    const pty = spawn(command, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: sessionWorkingDir,
      env
    });

    this.sessions.set(sessionId, pty);
    this.buffers.set(sessionId, []);
    this.subscribers.set(sessionId, new Set());

    // Set up data handler
    this.setupDataHandler(pty, sessionId);

    // Store session metadata
    this.sessionMetadata.set(sessionId, {
      name: name || `session-${Date.now()}`,
      symlinkName: '',
      projectId: opts.projectId,
      workingDir: sessionWorkingDir
    });

    console.log(`Created simple session ${sessionId} in mode ${mode} at ${sessionWorkingDir}`);
    
    // Force initial output to test PTY connectivity
    setTimeout(() => {
      try {
        if (mode === 'shell') {
          // Send a simple command to trigger shell output
          pty.write('echo "Shell session ready"\r');
        }
      } catch (err) {
        console.error(`Failed to send initial command to session ${sessionId}:`, err);
      }
    }, 500);
    
    return pty;
  }

  // Legacy createSessionWithId method removed - use createSessionInProject instead

  // Legacy createSession method removed - use createSessionInProject instead

  /**
   * Get an existing session
   * @param {string} sessionId
   * @returns {import('node-pty').IPty | null}
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Resize a session
   * @param {string} sessionId
   * @param {number} cols
   * @param {number} rows
   */
  resizeSession(sessionId, cols, rows) {
    const pty = this.getSession(sessionId);
    if (pty) {
      try {
        pty.resize(cols, rows);
      } catch (err) {
        console.error(`Failed to resize session ${sessionId}:`, err.message);
      }
    }
  }

  /**
   * End a session
   * @param {string} sessionId
   */
  endSession(sessionId) {
    const pty = this.getSession(sessionId);
    if (pty) {
      try {
        pty.kill();
      } catch (err) {
        console.error(`Failed to kill session ${sessionId}:`, err.message);
      }
    } else {
      console.warn(`Session ${sessionId} not found or already ended - performing cleanup anyway`);
    }
    
    // Always perform cleanup, even if PTY already exited
    this.sessions.delete(sessionId);
    this.buffers.delete(sessionId);
    this.subscribers.delete(sessionId);
    
    // Clean up symlink
    const metadata = this.sessionMetadata.get(sessionId);
    if (metadata && metadata.symlinkName) {
      try {
        removeSymlinkByName(metadata.symlinkName);
      } catch (err) {
        console.warn(`Failed to remove symlink for session ${sessionId}:`, err.message);
      }
    }
    this.sessionMetadata.delete(sessionId);
    
    console.log(`Session ${sessionId} cleanup completed`);
  }

  /**
   * Write data to a session
   * @param {string} sessionId
   * @param {string} data
   */
  writeToSession(sessionId, data) {
    const pty = this.getSession(sessionId);
    if (pty) {
      try {
        pty.write(data);
      } catch (err) {
        console.error(`Failed to write to session ${sessionId}:`, err.message);
      }
    }
  }

  /**
   * Append data to session buffer
   * @param {string} sessionId
   * @param {string} data
   */
  appendToBuffer(sessionId, data) {
    const buffer = this.buffers.get(sessionId);
    if (buffer) {
      buffer.push(data);
      
      // Trim buffer if it gets too large
      const totalSize = buffer.reduce((sum, chunk) => sum + chunk.length, 0);
      if (totalSize > this.maxBufferSize) {
        // Remove oldest chunks until we're under the limit
        while (buffer.length > 0 && buffer.reduce((sum, chunk) => sum + chunk.length, 0) > this.maxBufferSize * TERMINAL_CONFIG.BUFFER_TRIM_RATIO) {
          buffer.shift();
        }
      }
    }
  }

  /**
   * Get buffered data for a session
   * @param {string} sessionId
   * @returns {string}
   */
  getBufferedData(sessionId) {
    const buffer = this.buffers.get(sessionId);
    return buffer ? buffer.join('') : '';
  }

  /**
   * Subscribe to session data
   * @param {string} sessionId
   * @param {Function} callback
   * @returns {Function} unsubscribe function
   */
  subscribeToSession(sessionId, callback) {
    const subs = this.subscribers.get(sessionId);
    if (subs) {
      subs.add(callback);
      return () => subs.delete(callback);
    }
    return () => {};
  }

  /**
   * Unsubscribe from session data
   * @param {string} sessionId
   * @param {Function} callback
   */
  unsubscribeFromSession(sessionId, callback) {
    const subs = this.subscribers.get(sessionId);
    if (subs) {
      subs.delete(callback);
    }
  }

  /**
   * Rename a session and update its symlink
   * @param {string} sessionId - The session ID to rename
   * @param {string} newName - The new session name
   * @returns {string} The actual name used (may be modified for conflicts)
   */
  renameSession(sessionId, newName) {
    if (!validateSessionName(newName)) {
      throw new Error('Invalid session name');
    }

    const metadata = this.sessionMetadata.get(sessionId);
    if (!metadata) {
      throw new Error('Session not found');
    }

    // Check if session exists and is active
    const pty = this.getSession(sessionId);
    if (!pty) {
      throw new Error('Session not found');
    }

    // Resolve name conflicts with existing sessions
    const existingNames = getAllSessionNames().filter(name => name !== metadata.name);
    const resolvedName = resolveNameConflict(newName.trim(), existingNames);

    // Update symlink
    let newSymlinkName = metadata.symlinkName;
    if (metadata.symlinkName) {
      try {
        removeSymlinkByName(metadata.symlinkName);
        newSymlinkName = createSymlink(sessionId, resolvedName);
      } catch (err) {
        console.warn(`Failed to update symlink for session ${sessionId}:`, err.message);
        // Try to recreate the old symlink
        try {
          createSymlink(sessionId, metadata.name);
        } catch (restoreErr) {
          console.error(`Failed to restore symlink for session ${sessionId}:`, restoreErr.message);
        }
        throw new Error(`Failed to update session symlink: ${err.message}`);
      }
    }

    // Update metadata
    this.sessionMetadata.set(sessionId, {
      name: resolvedName,
      symlinkName: newSymlinkName
    });

    console.log(`Renamed session ${sessionId} from "${metadata.name}" to "${resolvedName}"`);
    return resolvedName;
  }

  /**
   * Get session metadata including name
   * @param {string} sessionId - The session ID
   * @returns {{name: string, symlinkName: string} | null} Session metadata or null if not found
   */
  getSessionMetadata(sessionId) {
    return this.sessionMetadata.get(sessionId) || null;
  }
  
  /**
   * Create a new project using DirectoryManager
   * @param {string} name - Project name
   * @param {Object} metadata - Project metadata
   * @returns {Promise<Object>} Created project info
   */
  async createProject(name, metadata = {}) {
    return this.directoryManager.createProject(name, metadata);
  }
  
  /**
   * List all projects
   * @param {Object} options - Filter options
   * @returns {Promise<Array>} List of projects
   */
  async listProjects(options = {}) {
    return this.directoryManager.listProjects(options);
  }
  
  /**
   * Get project by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object|null>} Project info or null if not found
   */
  async getProject(projectId) {
    return this.directoryManager.getProject(projectId);
  }
  
  /**
   * Get sessions for a project using DirectoryManager
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Sessions map
   */
  async getDirectoryManagerProjectSessions(projectId) {
    return this.directoryManager.getProjectSessions(projectId);
  }
}