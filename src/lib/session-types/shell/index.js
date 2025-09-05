/**
 * Shell Session Type - Terminal session implementation
 * 
 * Provides standard shell terminal functionality with PTY support.
 * This serves as a reference implementation for other session types.
 */

import { BaseSessionType } from '../shared/BaseSessionType.js';
import { generateSessionId, createSessionMetadata, mergeSessionOptions } from '../shared/SessionTypeUtils.js';
import { createSessionValidator } from '../shared/ValidationUtils.js';
import fs from 'fs';
import path from 'path';

export class ShellSessionType extends BaseSessionType {
  constructor(terminalManager = null) {
    super({
      id: 'shell',
      name: 'Shell Terminal',
      description: 'Standard shell terminal session with PTY support',
      category: 'terminal',
      namespace: '/shell',
      requiresProject: false,
      supportsAttachment: true,
      defaultOptions: {
        shell: '/bin/bash',
        cols: 80,
        rows: 24,
        env: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      }
    });
    
    this.terminalManager = terminalManager;
    this.validator = createSessionValidator({
      requiresProject: false,
      customValidators: [this._validateShellOptions.bind(this)]
    });
  }
  
  /**
   * Set the terminal manager instance
   */
  setTerminalManager(terminalManager) {
    this.terminalManager = terminalManager;
  }
  
  /**
   * Get terminal manager, create if needed
   */
  async getTerminalManager() {
    if (!this.terminalManager) {
      try {
        // Dynamic import to avoid circular dependency
        const module = await import('./server/terminal.server.js');
        const { TerminalManager } = module;
        this.terminalManager = new TerminalManager();
        console.log('Created TerminalManager instance for shell session type');
      } catch (err) {
        console.error('Failed to load TerminalManager:', err);
        throw new Error('TerminalManager unavailable');
      }
    }
    return this.terminalManager;
  }

  /**
   * Create a new shell session
   */
  async onCreate(options, socket) {
    try {
      // Generate session ID
      const sessionId = generateSessionId();
      
      // Merge options with defaults
      const mergedOptions = mergeSessionOptions(options, this.defaultOptions);
      
      // Extract shell-specific options
      const terminalOptions = {
        cols: mergedOptions.cols,
        rows: mergedOptions.rows,
        shell: mergedOptions.customOptions?.shell || mergedOptions.shell,
        env: {
          ...this.defaultOptions.env,
          ...(mergedOptions.customOptions?.env || {})
        }
      };

      // Get TerminalManager and create terminal session
      const terminalManager = await this.getTerminalManager();
      const terminalSession = await terminalManager.createSessionInProject(
        options.projectId, 
        {
          ...terminalOptions,
          mode: 'shell',
          name: mergedOptions.name || `Shell Session ${Date.now()}`
        }
      );
      
      // Configure socket for this session
      socket.sessionId = sessionId;
      socket.join(sessionId);
      
      // Setup terminal event handlers
      this._setupTerminalHandlers(terminalSession, socket);
      
      // Setup socket disconnect handler
      socket.on('disconnect', () => {
        if (socket.sessionId) {
          this.terminalManager.endSession(socket.sessionId).catch(err => {
            console.error('Error cleaning up shell session on disconnect:', err);
          });
        }
      });

      // Create session metadata
      const sessionMetadata = createSessionMetadata({
        id: sessionId,
        name: mergedOptions.name,
        type: this.id,
        customData: {
          shell: terminalOptions.shell,
          pid: terminalSession.pid,
          env: terminalOptions.env
        }
      });

      console.log(`Created shell session: ${sessionId} (PID: ${terminalSession.pid})`);
      
      return sessionMetadata;
      
    } catch (error) {
      console.error('Failed to create shell session:', error);
      throw new Error(`Failed to create shell session: ${error.message}`);
    }
  }

  /**
   * Attach to an existing shell session
   */
  async onAttach(sessionId, socket) {
    try {
      const terminalManager = await this.getTerminalManager();
      const attached = await terminalManager.attachToSession(socket, { sessionId });
      
      if (attached) {
        socket.sessionId = sessionId;
        socket.join(sessionId);
        console.log(`Attached to shell session: ${sessionId}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`Failed to attach to shell session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up shell session
   */
  async onDestroy(sessionId) {
    try {
      const terminalManager = await this.getTerminalManager();
      await terminalManager.endSession(sessionId);
      console.log(`Cleaned up shell session: ${sessionId}`);
    } catch (error) {
      // Log error but don't throw - cleanup should be graceful
      console.error(`Error cleaning up shell session ${sessionId}:`, error);
    }
  }

  /**
   * Validate shell session options
   */
  validate(options) {
    return this.validator(options);
  }

  /**
   * Handle terminal input
   */
  handleInput(sessionId, data) {
    this.terminalManager.sendInput(sessionId, data);
  }

  /**
   * Handle terminal resize
   */
  handleResize(sessionId, dimensions) {
    // Validate dimensions
    if (dimensions.cols < 10 || dimensions.cols > 500 || 
        dimensions.rows < 5 || dimensions.rows > 200) {
      throw new Error('Invalid terminal dimensions');
    }
    
    this.terminalManager.resize(sessionId, dimensions.cols, dimensions.rows);
  }

  /**
   * Get supported capabilities
   */
  supportsCapability(capability) {
    const shellCapabilities = ['create', 'attach', 'destroy', 'resize', 'input'];
    return shellCapabilities.includes(capability);
  }

  /**
   * Setup terminal event handlers
   */
  _setupTerminalHandlers(terminalSession, socket) {
    if (terminalSession.on) {
      terminalSession.on('data', (data) => {
        socket.emit('output', data);
      });

      terminalSession.on('exit', (code, signal) => {
        socket.emit('ended', { exitCode: code, signal });
        socket.leave(socket.sessionId);
        socket.sessionId = null;
      });

      terminalSession.on('error', (error) => {
        socket.emit('error', { message: error.message });
      });
    }
  }

  /**
   * Custom validation for shell-specific options
   */
  _validateShellOptions(options) {
    const errors = [];
    
    if (options.customOptions?.shell) {
      const shell = options.customOptions.shell;
      
      // Must be absolute path
      if (!path.isAbsolute(shell)) {
        errors.push('Shell must be an absolute path to an executable');
      } else {
        // Check if shell exists and is executable
        try {
          const stats = fs.statSync(shell);
          if (!stats.isFile()) {
            errors.push(`Invalid shell: ${shell}`);
          }
        } catch (err) {
          errors.push(`Invalid shell: ${shell}`);
        }
      }
    }

    // Validate environment variables
    if (options.customOptions?.env) {
      const env = options.customOptions.env;
      
      if (typeof env !== 'object' || Array.isArray(env)) {
        errors.push('Environment variables must be an object');
      } else {
        // Check for dangerous environment variables
        const dangerousVars = ['LD_PRELOAD', 'DYLD_INSERT_LIBRARIES'];
        for (const dangerous of dangerousVars) {
          if (env[dangerous]) {
            errors.push(`Environment variable ${dangerous} is not allowed`);
          }
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Create and export singleton instance
// Initialize immediately for testing - will be enhanced when TerminalManager is available
export const shellSessionType = new ShellSessionType();

export function createShellSessionType(terminalManager) {
  return new ShellSessionType(terminalManager);
}