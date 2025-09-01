// src/lib/server/terminal.js
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node-pty';
import { createSymlink, removeSymlinkByName, updateSymlink, cleanupOrphanedSymlinks } from './symlink-manager.js';
import { validateSessionName, generateFallbackName, resolveNameConflict } from './name-validation.js';
import { getAllSessionNames } from './session-store.js';
import { TERMINAL_CONFIG } from '../config/constants.js';

/**
 * @typedef {Object} SessionOpts
 * @property {number} [cols]
 * @property {number} [rows]
 * @property {"claude"|"shell"} [mode]
 * @property {string} [name]
 * @property {string} [parentSessionId]
 */

export class TerminalManager {
  constructor() {
    /** @type {Map<string, import('node-pty').IPty>} */
    this.sessions = new Map();
    /** @type {Map<string, string[]>} */
    this.buffers = new Map();
    /** @type {Map<string, Set<Function>>} */
    this.subscribers = new Map();
    /** @type {Map<string, {name: string, symlinkName: string}>} */
    this.sessionMetadata = new Map();
    this.ptyRoot = process.env.PTY_ROOT || '/tmp/dispatch-sessions';
    this.defaultMode = process.env.PTY_MODE || 'shell';
    this.maxBufferSize = TERMINAL_CONFIG.MAX_HISTORY_ENTRIES;
    
    // Ensure sessions directory exists
    try {
      fs.mkdirSync(this.ptyRoot, { recursive: true });
    } catch (err) {
      console.warn(`Could not create PTY root ${this.ptyRoot}:`, err.message);
    }
    
    // Cleanup orphaned symlinks on startup
    try {
      cleanupOrphanedSymlinks();
    } catch (err) {
      console.warn('Failed to cleanup orphaned symlinks:', err.message);
    }
  }

  /**
   * Create a new PTY session with a specific session ID
   * @param {string} sessionId - The session ID to use
   * @param {SessionOpts} [opts={}] - Session options
   * @returns {{sessionId: string, pty: import('node-pty').IPty, name: string}}
   */
  createSessionWithId(sessionId, opts = {}) {
    const { cols = 80, rows = 24, mode = this.defaultMode, name, parentSessionId } = opts;
    
    // Validate and generate session name
    const sessionName = name || generateFallbackName(sessionId);
    
    // Determine session directory - use parent session's directory if specified
    let sessionDir;
    if (parentSessionId && this.sessions.has(parentSessionId)) {
      // Use the same directory as the parent session
      sessionDir = path.join(this.ptyRoot, parentSessionId);
      console.log(`Creating new session ${sessionId} in existing directory: ${sessionDir}`);
    } else {
      // Create new session directory
      sessionDir = path.join(this.ptyRoot, sessionId);
      try {
        fs.mkdirSync(sessionDir, { recursive: true });
      } catch (err) {
        throw new Error(`Failed to create session directory: ${err.message}`);
      }
    }
    
    // Determine command based on mode
    let command, args, env;
    if (mode === 'claude') {
      command = 'claude';
      args = [];
      env = {
        ...process.env,
        TERM: 'xterm-256color',
        HOME: sessionDir
      };
    } else {
      // Default to shell mode
      command = process.env.SHELL || '/bin/bash';
      args = [];
      env = {
        ...process.env,
        TERM: 'xterm-256color',
        HOME: sessionDir
      };
    }
    
    // Create PTY with the provided session ID
    const pty = spawn(command, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: sessionDir,
      env
    });

    this.sessions.set(sessionId, pty);
    this.buffers.set(sessionId, []);
    this.subscribers.set(sessionId, new Set());
    
    // Create symlink for readable directory name
    let symlinkName;
    try {
      symlinkName = createSymlink(sessionId, sessionName);
    } catch (err) {
      console.warn(`Failed to create symlink for session ${sessionId}:`, err.message);
      symlinkName = null;
    }
    
    // Store session metadata
    this.sessionMetadata.set(sessionId, {
      name: sessionName,
      symlinkName: symlinkName
    });
    
    // Set up data handling
    pty.onData((data) => {
      // Buffer the data
      this.appendToBuffer(sessionId, data);
      
      // Notify all subscribers
      const subs = this.subscribers.get(sessionId);
      if (subs) {
        subs.forEach(callback => {
          try {
            callback(data);
          } catch (err) {
            console.error('Error in subscriber callback:', err);
          }
        });
      }
    });
    
    // Clean up on exit (but don't remove from persistent storage)
    pty.onExit(() => {
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
    });
    
    return {
      sessionId,
      pty,
      name: sessionName
    };
  }

  /**
   * Create a new PTY session
   * @param {SessionOpts} opts
   * @returns {{ sessionId: string, pty: import('node-pty').IPty, name: string }}
   */
  createSession(opts = {}) {
    const sessionId = randomUUID();
    
    // If parentSessionId is provided, use the existing session directory
    const { parentSessionId } = opts;
    let sessionDir;
    if (parentSessionId && this.sessions.has(parentSessionId)) {
      sessionDir = path.join(this.ptyRoot, parentSessionId);
      console.log(`Creating new session ${sessionId} in existing directory: ${sessionDir}`);
    } else {
      sessionDir = path.join(this.ptyRoot, sessionId);
    }
    
    // Handle session name
    let sessionName;
    if (opts.name && validateSessionName(opts.name)) {
      // Use custom name, resolving conflicts with existing sessions
      const existingNames = getAllSessionNames();
      sessionName = resolveNameConflict(opts.name.trim(), existingNames);
    } else {
      // Generate fallback name
      sessionName = generateFallbackName(sessionId);
    }
    
    // Create session directory (only if not using parent session directory)
    if (!parentSessionId || !this.sessions.has(parentSessionId)) {
      try {
        fs.mkdirSync(sessionDir, { recursive: true });
      } catch (err) {
        console.error(`Failed to create session dir ${sessionDir}:`, err.message);
        throw new Error(`Could not create session directory: ${err.message}`);
      }
    }

    const mode = opts.mode || this.defaultMode;
    const cols = opts.cols || 80;
    const rows = opts.rows || 24;

    let command, args;
    
    if (mode === 'claude') {
      // Start Claude Code
      command = 'claude';
      args = [];
    } else {
      // Start shell
      command = process.env.SHELL || '/bin/bash';
      args = [];
    }

    const pty = spawn(command, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: sessionDir,
      env: {
        ...process.env,
        TERM: 'xterm-256color',
        HOME: sessionDir
      }
    });

    this.sessions.set(sessionId, pty);
    this.buffers.set(sessionId, []);
    this.subscribers.set(sessionId, new Set());
    
    // Create symlink for readable directory name
    let symlinkName;
    try {
      symlinkName = createSymlink(sessionId, sessionName);
    } catch (err) {
      console.warn(`Failed to create symlink for session ${sessionId}:`, err.message);
      symlinkName = null;
    }
    
    // Store session metadata
    this.sessionMetadata.set(sessionId, {
      name: sessionName,
      symlinkName: symlinkName
    });
    
    // Set up data handling
    pty.onData((data) => {
      // Buffer the data
      this.appendToBuffer(sessionId, data);
      
      // Notify all subscribers
      const subs = this.subscribers.get(sessionId);
      if (subs) {
        subs.forEach(callback => {
          try {
            callback(data);
          } catch (err) {
            console.error('Error in subscriber callback:', err);
          }
        });
      }
    });
    
    // Clean up on exit
    pty.onExit(() => {
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
      
      console.log(`Session ${sessionId} ended`);
    });

    console.log(`Created ${mode} session ${sessionId} "${sessionName}" in ${sessionDir}`);
    return { sessionId, pty, name: sessionName };
  }

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
      
      // Manual cleanup (the onExit handler will also run, but this ensures cleanup)
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
    }
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
}