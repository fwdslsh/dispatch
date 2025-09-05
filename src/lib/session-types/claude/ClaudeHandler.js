/**
 * ClaudeHandler - WebSocket handlers for Claude session type
 * 
 * Provides Claude-specific Socket.IO event handlers for the Claude namespace.
 * Integrates with existing TerminalManager and Claude API for AI-assisted development.
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
 * Create Claude-specific WebSocket handlers
 * @param {BaseSessionType} sessionType - Claude session type instance
 * @param {Namespace} namespace - Socket.IO namespace
 * @param {Socket} socket - Individual socket connection
 * @returns {Object} Event handler map
 */
export function createClaudeHandlers(sessionType, namespace, socket) {
  const manager = getTerminalManager();
  
  return {
    /**
     * Create new Claude session with authentication
     */
    'create-session': async (options, callback) => {
      try {
        console.log(`Creating Claude session in ${sessionType.namespace}:`, {
          ...options,
          customOptions: options.customOptions ? { 
            ...options.customOptions,
            authToken: options.customOptions.authToken ? '***masked***' : undefined
          } : undefined
        });
        
        // Validate required fields
        if (!options.projectId) {
          callback({
            success: false,
            error: 'Project ID is required for Claude sessions',
            code: 'PROJECT_REQUIRED'
          });
          return;
        }
        
        if (!options.customOptions?.authToken) {
          callback({
            success: false,
            error: 'Claude authentication token is required',
            code: 'AUTH_REQUIRED'
          });
          return;
        }
        
        const sessionData = await manager.createSessionInProject(options.projectId, {
          cols: options.cols || 120,
          rows: options.rows || 30,
          mode: 'claude',
          name: options.name || 'Claude AI Session',
          workingDirectory: options.workingDirectory,
          claudeModel: options.customOptions.claudeModel || 'claude-3.5-sonnet',
          maxTokens: options.customOptions.maxTokens || 8192,
          temperature: options.customOptions.temperature || 0.7,
          env: {
            CLAUDE_API_KEY: options.customOptions.authToken,
            CLAUDE_MODEL: options.customOptions.claudeModel || 'claude-3.5-sonnet',
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor'
          }
        });
        
        // Store session association
        socket.sessionId = sessionData.id;
        socket.projectId = options.projectId;
        socket.claudeAuth = true;
        
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
            name: options.name || 'Claude AI Session',
            status: 'active',
            projectId: options.projectId,
            customData: {
              claudeModel: options.customOptions.claudeModel || 'claude-3.5-sonnet',
              maxTokens: options.customOptions.maxTokens || 8192,
              temperature: options.customOptions.temperature || 0.7,
              pid: sessionData.pid,
              authToken: '***masked***',
              capabilities: {
                codeExecution: options.customOptions.enableCodeExecution ?? true,
                fileAccess: options.customOptions.enableFileAccess ?? true
              }
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
        console.error('Failed to create Claude session:', error);
        callback({
          success: false,
          error: error.message,
          code: 'CREATE_FAILED'
        });
      }
    },
    
    /**
     * Attach to existing Claude session
     */
    'attach-session': async (sessionId, callback) => {
      try {
        console.log(`Attaching to Claude session ${sessionId} in ${sessionType.namespace}`);
        
        // Verify authentication is still valid
        if (!sessionType.isAuthValid(sessionId)) {
          callback({
            success: false,
            error: 'Claude session authentication expired or invalid',
            code: 'AUTH_EXPIRED'
          });
          return;
        }
        
        const success = await manager.attachToSession(socket, { sessionId });
        
        if (success) {
          socket.sessionId = sessionId;
          socket.claudeAuth = true;
          
          // Notify session type of attachment
          await sessionType.onAttach(sessionId, socket);
          
          callback({
            success: true,
            sessionId,
            message: 'Attached to Claude session'
          });
          
        } else {
          callback({
            success: false,
            error: 'Claude session not found or already attached',
            code: 'ATTACH_FAILED'
          });
        }
        
      } catch (error) {
        console.error('Failed to attach to Claude session:', error);
        callback({
          success: false,
          error: error.message,
          code: 'ATTACH_ERROR'
        });
      }
    },
    
    /**
     * Detach from Claude session
     */
    'detach-session': (callback) => {
      try {
        const sessionId = socket.sessionId;
        
        if (sessionId) {
          socket.sessionId = null;
          socket.projectId = null;
          socket.claudeAuth = false;
          
          console.log(`Detached from Claude session ${sessionId} in ${sessionType.namespace}`);
          
          callback({
            success: true,
            sessionId,
            message: 'Detached from Claude session'
          });
        } else {
          callback({
            success: false,
            error: 'No active Claude session to detach from',
            code: 'NO_ACTIVE_SESSION'
          });
        }
        
      } catch (error) {
        console.error('Failed to detach from Claude session:', error);
        callback({
          success: false,
          error: error.message,
          code: 'DETACH_ERROR'
        });
      }
    },
    
    /**
     * End Claude session
     */
    'end-session': async (sessionId, callback) => {
      try {
        const targetSessionId = sessionId || socket.sessionId;
        
        if (!targetSessionId) {
          callback({
            success: false,
            error: 'No Claude session to end',
            code: 'NO_SESSION'
          });
          return;
        }
        
        console.log(`Ending Claude session ${targetSessionId} in ${sessionType.namespace}`);
        
        await manager.endSession(targetSessionId);
        
        // Notify session type of destruction
        await sessionType.onDestroy(targetSessionId);
        
        // Clear socket association
        if (socket.sessionId === targetSessionId) {
          socket.sessionId = null;
          socket.projectId = null;
          socket.claudeAuth = false;
        }
        
        callback({
          success: true,
          sessionId: targetSessionId,
          message: 'Claude session ended'
        });
        
        // Broadcast session end to namespace
        namespace.emit('session-ended', {
          sessionId: targetSessionId,
          sessionType: sessionType.id
        });
        
      } catch (error) {
        console.error('Failed to end Claude session:', error);
        callback({
          success: false,
          error: error.message,
          code: 'END_FAILED'
        });
      }
    },
    
    /**
     * Send Claude AI message
     */
    'claude-message': async (data, callback) => {
      try {
        const sessionId = socket.sessionId;
        
        if (!sessionId) {
          callback({
            success: false,
            error: 'No active Claude session',
            code: 'NO_ACTIVE_SESSION'
          });
          return;
        }
        
        if (!socket.claudeAuth) {
          callback({
            success: false,
            error: 'Claude authentication required',
            code: 'AUTH_REQUIRED'
          });
          return;
        }
        
        const { message, options } = data;
        
        if (!message || typeof message !== 'string') {
          callback({
            success: false,
            error: 'Message is required',
            code: 'MESSAGE_REQUIRED'
          });
          return;
        }
        
        // Add to conversation history
        sessionType.addToConversationHistory(sessionId, {
          role: 'user',
          content: message
        });
        
        // Send to Claude terminal (this would integrate with actual Claude API)
        manager.sendInput(sessionId, message + '\n');
        
        callback({
          success: true,
          message: 'Message sent to Claude'
        });
        
      } catch (error) {
        console.error('Failed to send Claude message:', error);
        callback({
          success: false,
          error: error.message,
          code: 'MESSAGE_FAILED'
        });
      }
    },
    
    /**
     * Get Claude session metadata
     */
    'get-session-metadata': (callback) => {
      try {
        const sessionId = socket.sessionId;
        
        if (!sessionId) {
          callback({
            success: false,
            error: 'No active Claude session',
            code: 'NO_ACTIVE_SESSION'
          });
          return;
        }
        
        const metadata = sessionType.getSessionMetadata(sessionId);
        
        if (!metadata) {
          callback({
            success: false,
            error: 'Session metadata not found',
            code: 'METADATA_NOT_FOUND'
          });
          return;
        }
        
        callback({
          success: true,
          metadata: {
            ...metadata,
            // Don't include sensitive data in response
            conversationHistory: metadata.conversationHistory.slice(-10) // Last 10 messages
          }
        });
        
      } catch (error) {
        console.error('Failed to get Claude session metadata:', error);
        callback({
          success: false,
          error: error.message,
          code: 'METADATA_ERROR'
        });
      }
    },
    
    /**
     * Update Claude model settings
     */
    'update-model-settings': async (settings, callback) => {
      try {
        const sessionId = socket.sessionId;
        
        if (!sessionId) {
          callback({
            success: false,
            error: 'No active Claude session',
            code: 'NO_ACTIVE_SESSION'
          });
          return;
        }
        
        // Validate settings
        const validation = sessionType._validateClaudeOptions(settings);
        if (!validation.valid) {
          callback({
            success: false,
            error: `Invalid settings: ${validation.errors.join(', ')}`,
            code: 'INVALID_SETTINGS'
          });
          return;
        }
        
        // Update session metadata
        const metadata = sessionType.getSessionMetadata(sessionId);
        if (metadata) {
          metadata.modelSettings = {
            ...metadata.modelSettings,
            ...settings
          };
          sessionType.setSessionMetadata(sessionId, metadata);
        }
        
        callback({
          success: true,
          message: 'Model settings updated',
          settings: metadata?.modelSettings
        });
        
      } catch (error) {
        console.error('Failed to update Claude model settings:', error);
        callback({
          success: false,
          error: error.message,
          code: 'SETTINGS_UPDATE_FAILED'
        });
      }
    },
    
    /**
     * Clear Claude conversation history
     */
    'clear-conversation': (callback) => {
      try {
        const sessionId = socket.sessionId;
        
        if (!sessionId) {
          callback({
            success: false,
            error: 'No active Claude session',
            code: 'NO_ACTIVE_SESSION'
          });
          return;
        }
        
        const metadata = sessionType.getSessionMetadata(sessionId);
        if (metadata) {
          metadata.conversationHistory = [];
          sessionType.setSessionMetadata(sessionId, metadata);
        }
        
        // Send clear command to terminal
        manager.sendInput(sessionId, '\u001b[2J\u001b[H'); // Clear screen
        
        callback({
          success: true,
          message: 'Conversation history cleared'
        });
        
      } catch (error) {
        console.error('Failed to clear Claude conversation:', error);
        callback({
          success: false,
          error: error.message,
          code: 'CLEAR_FAILED'
        });
      }
    },
    
    /**
     * Get Claude token usage
     */
    'get-token-usage': (callback) => {
      try {
        const sessionId = socket.sessionId;
        
        if (!sessionId) {
          callback({
            success: false,
            error: 'No active Claude session',
            code: 'NO_ACTIVE_SESSION'
          });
          return;
        }
        
        const metadata = sessionType.getSessionMetadata(sessionId);
        
        callback({
          success: true,
          usage: metadata?.tokenUsage || { total: 0, input: 0, output: 0 }
        });
        
      } catch (error) {
        console.error('Failed to get token usage:', error);
        callback({
          success: false,
          error: error.message,
          code: 'USAGE_ERROR'
        });
      }
    },
    
    /**
     * List Claude sessions
     */
    'list-sessions': (callback) => {
      try {
        const sessions = manager.listSessions();
        const claudeSessions = sessions.filter(session => 
          session.type === 'claude' || session.mode === 'claude'
        );
        
        callback({
          success: true,
          sessions: claudeSessions
        });
        
      } catch (error) {
        console.error('Failed to list Claude sessions:', error);
        callback({
          success: false,
          error: error.message,
          code: 'LIST_FAILED'
        });
      }
    }
  };
}

export default createClaudeHandlers;