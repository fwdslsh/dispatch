/**
 * ShellHandler - WebSocket handlers for shell session type
 * 
 * Provides shell-specific Socket.IO event handlers for the shell namespace.
 * Integrates with existing TerminalManager for PTY session management.
 */

import { TerminalManager } from '../../server/terminal.js';

let terminalManager = null;

/**
 * Initialize terminal manager (singleton)
 */
function getTerminalManager() {
  if (!terminalManager) {
    terminalManager = new TerminalManager();
  }
  return terminalManager;
}

/**
 * Create shell-specific WebSocket handlers
 * @param {BaseSessionType} sessionType - Shell session type instance
 * @param {Namespace} namespace - Socket.IO namespace
 * @param {Socket} socket - Individual socket connection
 * @returns {Object} Event handler map
 */
export function createShellHandlers(sessionType, namespace, socket) {
  const manager = getTerminalManager();
  
  return {
    /**
     * Create new shell session
     */
    'create-session': async (options, callback) => {
      try {
        console.log(`Creating shell session in ${sessionType.namespace}:`, options);
        
        const sessionData = await manager.createSessionInProject(options.projectId, {
          cols: options.cols || 80,
          rows: options.rows || 24,
          mode: 'shell',
          name: options.name || 'Shell Session',
          workingDirectory: options.workingDirectory,
          shell: options.customOptions?.shell || '/bin/bash',
          env: options.customOptions?.env || {}
        });
        
        // Store session association
        socket.sessionId = sessionData.id;
        socket.projectId = options.projectId;
        
        // Notify session type of creation
        await sessionType.onCreate({
          sessionId: sessionData.id,
          projectId: options.projectId,
          ...options
        }, socket);
        
        callback({
          success: true,
          session: {
            id: sessionData.id,
            name: options.name || 'Shell Session',
            status: 'active',
            projectId: options.projectId,
            customData: {
              shell: options.customOptions?.shell || '/bin/bash',
              pid: sessionData.pid,
              env: options.customOptions?.env || {}
            }
          }
        });
        
        // Broadcast session creation to namespace
        namespace.emit('session-created', {
          sessionId: sessionData.id,
          projectId: options.projectId,
          sessionType: sessionType.id
        });
        
      } catch (error) {
        console.error('Failed to create shell session:', error);
        callback({
          success: false,
          error: error.message,
          code: 'CREATE_FAILED'
        });
      }
    },
    
    /**
     * Attach to existing shell session
     */
    'attach-session': async (sessionId, callback) => {
      try {
        console.log(`Attaching to shell session ${sessionId} in ${sessionType.namespace}`);
        
        const success = await manager.attachToSession(socket, { sessionId });
        
        if (success) {
          socket.sessionId = sessionId;
          
          // Notify session type of attachment
          await sessionType.onAttach(sessionId, socket);
          
          callback({
            success: true,
            sessionId,
            message: 'Attached to shell session'
          });
          
        } else {
          callback({
            success: false,
            error: 'Session not found or already attached',
            code: 'ATTACH_FAILED'
          });
        }
        
      } catch (error) {
        console.error('Failed to attach to shell session:', error);
        callback({
          success: false,
          error: error.message,
          code: 'ATTACH_ERROR'
        });
      }
    },
    
    /**
     * Detach from shell session
     */
    'detach-session': (callback) => {
      try {
        const sessionId = socket.sessionId;
        
        if (sessionId) {
          socket.sessionId = null;
          socket.projectId = null;
          
          console.log(`Detached from shell session ${sessionId} in ${sessionType.namespace}`);
          
          callback({
            success: true,
            sessionId,
            message: 'Detached from shell session'
          });
        } else {
          callback({
            success: false,
            error: 'No active session to detach from',
            code: 'NO_ACTIVE_SESSION'
          });
        }
        
      } catch (error) {
        console.error('Failed to detach from shell session:', error);
        callback({
          success: false,
          error: error.message,
          code: 'DETACH_ERROR'
        });
      }
    },
    
    /**
     * End shell session
     */
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
        
        console.log(`Ending shell session ${targetSessionId} in ${sessionType.namespace}`);
        
        await manager.endSession(targetSessionId);
        
        // Notify session type of destruction
        await sessionType.onDestroy(targetSessionId);
        
        // Clear socket association
        if (socket.sessionId === targetSessionId) {
          socket.sessionId = null;
          socket.projectId = null;
        }
        
        callback({
          success: true,
          sessionId: targetSessionId,
          message: 'Shell session ended'
        });
        
        // Broadcast session end to namespace
        namespace.emit('session-ended', {
          sessionId: targetSessionId,
          sessionType: sessionType.id
        });
        
      } catch (error) {
        console.error('Failed to end shell session:', error);
        callback({
          success: false,
          error: error.message,
          code: 'END_FAILED'
        });
      }
    },
    
    /**
     * Send input to shell
     */
    'shell-input': (data) => {
      const sessionId = socket.sessionId;
      if (sessionId) {
        manager.sendInput(sessionId, data);
      }
    },
    
    /**
     * Resize shell terminal
     */
    'shell-resize': (dimensions) => {
      const sessionId = socket.sessionId;
      if (sessionId && dimensions && dimensions.cols && dimensions.rows) {
        manager.resize(sessionId, dimensions.cols, dimensions.rows);
      }
    },
    
    /**
     * Shell-specific commands
     */
    'shell-command': async (command, callback) => {
      try {
        const sessionId = socket.sessionId;
        
        if (!sessionId) {
          callback({
            success: false,
            error: 'No active shell session',
            code: 'NO_ACTIVE_SESSION'
          });
          return;
        }
        
        switch (command.type) {
          case 'clear':
            // Send clear command to shell
            manager.sendInput(sessionId, '\u001b[2J\u001b[H');
            callback({ success: true, message: 'Terminal cleared' });
            break;
            
          case 'interrupt':
            // Send Ctrl+C
            manager.sendInput(sessionId, '\u0003');
            callback({ success: true, message: 'Interrupt signal sent' });
            break;
            
          default:
            callback({
              success: false,
              error: `Unknown shell command: ${command.type}`,
              code: 'UNKNOWN_COMMAND'
            });
        }
        
      } catch (error) {
        console.error('Shell command failed:', error);
        callback({
          success: false,
          error: error.message,
          code: 'COMMAND_FAILED'
        });
      }
    },
    
    /**
     * List shell sessions
     */
    'list-sessions': (callback) => {
      try {
        const sessions = manager.listSessions();
        const shellSessions = sessions.filter(session => 
          session.type === 'shell' || session.mode === 'shell'
        );
        
        callback({
          success: true,
          sessions: shellSessions
        });
        
      } catch (error) {
        console.error('Failed to list shell sessions:', error);
        callback({
          success: false,
          error: error.message,
          code: 'LIST_FAILED'
        });
      }
    }
  };
}

export default createShellHandlers;