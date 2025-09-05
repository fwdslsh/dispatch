/**
 * Shell Session Type WebSocket Handlers
 * 
 * Provides WebSocket event handlers specific to shell terminal sessions.
 */

export function createShellHandlers(sessionType, namespace, socket) {
  console.log(`Creating shell handlers for socket: ${socket.id}`);

  return {
    'create-session': async (options, callback) => {
      try {
        const session = await sessionType.onCreate(options, socket);
        callback({ success: true, session });
      } catch (error) {
        console.error('Shell session creation failed:', error);
        callback({ 
          success: false, 
          error: error.message,
          code: 'CREATION_ERROR'
        });
      }
    },

    'attach-session': async (sessionId, callback) => {
      try {
        const attached = await sessionType.onAttach(sessionId, socket);
        if (attached) {
          callback({ success: true, sessionId });
        } else {
          callback({ 
            success: false, 
            error: 'Failed to attach to session',
            code: 'ATTACHMENT_ERROR'
          });
        }
      } catch (error) {
        console.error('Shell session attachment failed:', error);
        callback({ 
          success: false, 
          error: error.message,
          code: 'ATTACHMENT_ERROR'
        });
      }
    },

    'detach-session': (callback) => {
      try {
        if (socket.sessionId) {
          socket.leave(socket.sessionId);
          const sessionId = socket.sessionId;
          socket.sessionId = null;
          
          callback({ 
            success: true, 
            sessionId,
            detachedAt: new Date().toISOString()
          });
        } else {
          callback({ 
            success: false, 
            error: 'No session attached',
            code: 'NO_SESSION'
          });
        }
      } catch (error) {
        console.error('Shell session detachment failed:', error);
        callback({ 
          success: false, 
          error: error.message,
          code: 'DETACHMENT_ERROR'
        });
      }
    },

    'end-session': async (sessionId, callback) => {
      try {
        const targetSessionId = sessionId || socket.sessionId;
        
        if (!targetSessionId) {
          callback({ 
            success: false, 
            error: 'No session to end',
            code: 'NO_SESSION'
          });
          return;
        }

        await sessionType.onDestroy(targetSessionId);
        
        // Clean up socket if it's the attached session
        if (socket.sessionId === targetSessionId) {
          socket.leave(targetSessionId);
          socket.sessionId = null;
        }
        
        // Notify all clients in the session that it ended
        namespace.to(targetSessionId).emit('session-ended', { 
          sessionId: targetSessionId,
          endedAt: new Date().toISOString()
        });

        callback({ success: true, sessionId: targetSessionId });
        
      } catch (error) {
        console.error('Shell session termination failed:', error);
        callback({ 
          success: false, 
          error: error.message,
          code: 'TERMINATION_ERROR'
        });
      }
    },

    'shell-input': (data) => {
      try {
        if (!socket.sessionId) {
          socket.emit('error', { 
            message: 'No session attached',
            code: 'NO_SESSION'
          });
          return;
        }

        sessionType.handleInput(socket.sessionId, data);
        
      } catch (error) {
        console.error('Shell input handling failed:', error);
        socket.emit('error', { 
          message: error.message,
          code: 'INPUT_ERROR'
        });
      }
    },

    'shell-resize': (dimensions) => {
      try {
        if (!socket.sessionId) {
          socket.emit('error', { 
            message: 'No session attached',
            code: 'NO_SESSION'
          });
          return;
        }

        if (!dimensions || !dimensions.cols || !dimensions.rows) {
          socket.emit('error', { 
            message: 'Invalid dimensions',
            code: 'VALIDATION_ERROR'
          });
          return;
        }

        sessionType.handleResize(socket.sessionId, dimensions);
        
      } catch (error) {
        console.error('Shell resize handling failed:', error);
        socket.emit('error', { 
          message: error.message,
          code: 'RESIZE_ERROR'
        });
      }
    },

    'get-session-info': (callback) => {
      try {
        if (!socket.sessionId) {
          callback({ 
            success: false, 
            error: 'No session attached',
            code: 'NO_SESSION'
          });
          return;
        }

        // Get session information
        // Note: In a real implementation, this would query the session store
        const sessionInfo = {
          id: socket.sessionId,
          type: sessionType.id,
          namespace: sessionType.namespace,
          status: 'active',
          attachedAt: new Date().toISOString()
        };

        callback({ success: true, session: sessionInfo });
        
      } catch (error) {
        console.error('Failed to get shell session info:', error);
        callback({ 
          success: false, 
          error: error.message,
          code: 'INFO_ERROR'
        });
      }
    },

    'validate-options': (options, callback) => {
      try {
        const validation = sessionType.validate(options);
        callback({ 
          success: true, 
          validation: validation
        });
      } catch (error) {
        console.error('Shell options validation failed:', error);
        callback({ 
          success: false, 
          error: error.message,
          code: 'VALIDATION_ERROR'
        });
      }
    },

    // Handle shell-specific commands
    'shell-command': (command, callback) => {
      try {
        if (!socket.sessionId) {
          callback({ 
            success: false, 
            error: 'No session attached',
            code: 'NO_SESSION'
          });
          return;
        }

        // Handle special shell commands
        switch (command.type) {
          case 'clear':
            sessionType.handleInput(socket.sessionId, '\x1b[2J\x1b[H');
            callback({ success: true });
            break;
            
          case 'interrupt':
            sessionType.handleInput(socket.sessionId, '\x03'); // Ctrl+C
            callback({ success: true });
            break;
            
          case 'eof':
            sessionType.handleInput(socket.sessionId, '\x04'); // Ctrl+D
            callback({ success: true });
            break;
            
          default:
            callback({ 
              success: false, 
              error: `Unknown shell command: ${command.type}`,
              code: 'UNKNOWN_COMMAND'
            });
        }
        
      } catch (error) {
        console.error('Shell command handling failed:', error);
        callback({ 
          success: false, 
          error: error.message,
          code: 'COMMAND_ERROR'
        });
      }
    }
  };
}

/**
 * Shell-specific utility functions
 */
export const ShellHandlerUtils = {
  /**
   * Validate shell session data
   */
  validateSessionData(data) {
    if (typeof data !== 'string' && !Buffer.isBuffer(data)) {
      throw new Error('Shell input must be string or Buffer');
    }
    
    // Limit input size to prevent abuse
    if (data.length > 10000) {
      throw new Error('Shell input too large');
    }
    
    return true;
  },

  /**
   * Sanitize shell command for logging
   */
  sanitizeForLogging(command) {
    // Remove potential passwords or sensitive data
    return command.replace(/(-p\s+|--password[=\s]+|password[=\s]+)\S+/gi, '$1***');
  },

  /**
   * Check if command is potentially dangerous
   */
  isDangerousCommand(command) {
    const dangerous = [
      'rm -rf /',
      'format',
      'del /f /s /q c:\\',
      ':(){ :|:& };:',  // Fork bomb
      'chmod -R 000 /',
      'dd if=/dev/zero of='
    ];
    
    return dangerous.some(danger => command.includes(danger));
  }
};