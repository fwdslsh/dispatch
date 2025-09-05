/**
 * Claude Session Type - AI-assisted development session implementation
 * 
 * Provides Claude AI integration with authentication, conversation management,
 * and specialized development assistance capabilities.
 */

import { BaseSessionType } from '../shared/BaseSessionType.js';
import { generateSessionId, createSessionMetadata, mergeSessionOptions, validateSessionOptions } from '../../shared/utils/session-utils.js';
import { TerminalManager } from '../shell/server/terminal.server.js';

export class ClaudeSessionType extends BaseSessionType {
  constructor(terminalManager = null) {
    super({
      id: 'claude',
      name: 'Claude Code Session',
      description: 'AI-assisted development session with Claude integration',
      category: 'ai-assistant',
      namespace: '/claude',
      requiresProject: true,
      supportsAttachment: true,
      defaultOptions: {
        claudeModel: 'claude-3.5-sonnet',
        maxTokens: 8192,
        temperature: 0.7,
        cols: 120,
        rows: 30,
        systemPrompt: 'You are Claude, an AI assistant created by Anthropic. You are helping with software development.',
        conversationHistory: [],
        enableCodeExecution: true,
        enableFileAccess: true
      }
    });
    
    this.terminalManager = terminalManager;
    this.validator = createSessionValidator({
      requiresProject: true,
      customValidators: [this._validateClaudeOptions.bind(this)]
    });
    
    // Claude-specific storage
    this.claudeAuthStorage = new Map(); // sessionId -> auth data
    this.sessionMetadataStorage = new Map(); // sessionId -> conversation metadata
    this.supportedModels = [
      'claude-3.5-sonnet',
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku'
    ];
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
        
        this.terminalManager = new TerminalManager();
        console.log('Created TerminalManager instance for Claude session type');
      } catch (err) {
        console.error('Failed to load TerminalManager:', err);
        throw new Error('TerminalManager unavailable');
      }
    }
    return this.terminalManager;
  }

  /**
   * Create a new Claude session
   */
  async onCreate(options, socket) {
    try {
      // Validate project requirement
      if (!options.projectId) {
        throw new Error('Project required for Claude sessions');
      }
      
      // Get TerminalManager instance
      const terminalManager = await this.getTerminalManager();
      
      // Generate session ID
      const sessionId = generateSessionId();
      
      // Merge options with defaults
      const mergedOptions = mergeSessionOptions(options, this.defaultOptions);
      
      // Validate authentication
      const authToken = mergedOptions.customOptions?.authToken;
      if (!authToken || !this._validateClaudeAuth(authToken)) {
        throw new Error('Claude authentication required');
      }
      
      // Extract Claude-specific options
      const claudeOptions = {
        cols: mergedOptions.cols || this.defaultOptions.cols,
        rows: mergedOptions.rows || this.defaultOptions.rows,
        mode: 'claude',
        name: mergedOptions.name || `Claude Session ${Date.now()}`,
        workingDirectory: mergedOptions.workingDirectory,
        claudeModel: mergedOptions.customOptions?.claudeModel || this.defaultOptions.claudeModel,
        maxTokens: mergedOptions.customOptions?.maxTokens || this.defaultOptions.maxTokens,
        temperature: mergedOptions.customOptions?.temperature || this.defaultOptions.temperature,
        systemPrompt: mergedOptions.customOptions?.systemPrompt || this.defaultOptions.systemPrompt,
        enableCodeExecution: mergedOptions.customOptions?.enableCodeExecution ?? this.defaultOptions.enableCodeExecution,
        enableFileAccess: mergedOptions.customOptions?.enableFileAccess ?? this.defaultOptions.enableFileAccess
      };
      
      // Validate Claude options
      const validation = this._validateClaudeOptions(claudeOptions);
      if (!validation.valid) {
        throw new Error(`Claude validation failed: ${validation.errors.join(', ')}`);
      }
      
      // Store authentication data
      await this.setClaudeAuth(sessionId, {
        token: authToken,
        userId: mergedOptions.customOptions?.userId,
        organizationId: mergedOptions.customOptions?.organizationId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      });
      
      // Create terminal session using TerminalManager
      const terminalSession = await terminalManager.createSessionInProject(
        options.projectId, 
        {
          ...claudeOptions,
          env: {
            CLAUDE_API_KEY: authToken,
            CLAUDE_MODEL: claudeOptions.claudeModel,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor'
          }
        }
      );
      
      // Initialize session metadata
      this.setSessionMetadata(sessionId, {
        conversationHistory: [],
        modelSettings: {
          model: claudeOptions.claudeModel,
          temperature: claudeOptions.temperature,
          maxTokens: claudeOptions.maxTokens
        },
        tokenUsage: {
          total: 0,
          input: 0,
          output: 0
        },
        capabilities: {
          codeExecution: claudeOptions.enableCodeExecution,
          fileAccess: claudeOptions.enableFileAccess
        }
      });
      
      // Configure socket for this session
      socket.sessionId = sessionId;
      socket.join(sessionId);
      socket.claudeAuth = true;
      
      // Setup cleanup on disconnect
      socket.on('disconnect', () => {
        if (socket.sessionId) {
          this.onDestroy(socket.sessionId).catch(err => {
            console.error('Error cleaning up Claude session on disconnect:', err);
          });
        }
      });

      // Create session metadata
      const sessionMetadata = createSessionMetadata({
        id: terminalSession.id,
        type: this.id,
        name: claudeOptions.name,
        projectId: options.projectId,
        workingDirectory: claudeOptions.workingDirectory,
        createdAt: new Date().toISOString(),
        status: 'active',
        customData: {
          claudeModel: claudeOptions.claudeModel,
          maxTokens: claudeOptions.maxTokens,
          temperature: claudeOptions.temperature,
          pid: terminalSession.pid,
          authToken: '***masked***', // Don't store actual token in metadata
          capabilities: {
            codeExecution: claudeOptions.enableCodeExecution,
            fileAccess: claudeOptions.enableFileAccess
          }
        }
      });

      console.log(`Created Claude session: ${terminalSession.id} (PID: ${terminalSession.pid})`);
      
      return sessionMetadata;
      
    } catch (error) {
      console.error('Failed to create Claude session:', error);
      throw new Error(`Failed to create Claude session: ${error.message}`);
    }
  }

  /**
   * Attach to an existing Claude session
   */
  async onAttach(sessionId, socket) {
    try {
      // Verify authentication is still valid
      if (!this.isAuthValid(sessionId)) {
        throw new Error('Claude session authentication expired or invalid');
      }
      
      const terminalManager = await this.getTerminalManager();
      const attached = await terminalManager.attachToSession(socket, { sessionId });
      
      if (attached) {
        socket.sessionId = sessionId;
        socket.join(sessionId);
        socket.claudeAuth = true;
        console.log(`Attached to Claude session: ${sessionId}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error(`Failed to attach to Claude session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Clean up Claude session
   */
  async onDestroy(sessionId) {
    try {
      const terminalManager = await this.getTerminalManager();
      await terminalManager.endSession(sessionId);
      
      // Clean up Claude-specific data
      this.claudeAuthStorage.delete(sessionId);
      this.sessionMetadataStorage.delete(sessionId);
      
      console.log(`Cleaned up Claude session: ${sessionId}`);
    } catch (error) {
      // Log error but don't throw - cleanup should be graceful
      console.error(`Error cleaning up Claude session ${sessionId}:`, error);
    }
  }

  /**
   * Validate session options
   */
  validate(options) {
    return this.validator(options);
  }

  /**
   * Validate Claude authentication token
   */
  _validateClaudeAuth(token) {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // Claude API keys start with 'sk-ant-api03-' and follow specific format
    const claudeApiKeyPattern = /^sk-ant-api03-[A-Za-z0-9_-]+$/;
    return claudeApiKeyPattern.test(token);
  }

  /**
   * Validate Claude-specific options
   */
  _validateClaudeOptions(options) {
    const errors = [];
    
    // Validate model
    if (options.claudeModel && !this._isValidClaudeModel(options.claudeModel)) {
      errors.push('Invalid Claude model');
    }
    
    // Validate temperature
    if (options.temperature !== undefined && (options.temperature < 0 || options.temperature > 1)) {
      errors.push('Temperature must be between 0 and 1');
    }
    
    // Validate max tokens
    if (options.maxTokens !== undefined && (options.maxTokens <= 0 || options.maxTokens > 100000)) {
      errors.push('Max tokens must be positive and reasonable');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if Claude model is supported
   */
  _isValidClaudeModel(model) {
    return this.supportedModels.includes(model);
  }

  /**
   * Validate Claude command
   */
  _validateClaudeCommand(command) {
    if (!command || typeof command !== 'string') {
      return false;
    }
    
    // Allow Claude-specific commands
    const allowedCommands = [
      '/help', '/model', '/temperature', '/tokens', '/clear', '/history',
      '/save', '/load', '/export', '/settings'
    ];
    
    // Block dangerous commands
    const dangerousPatterns = [
      '/exec', '/system', '/token', '/key', '/auth', '/admin'
    ];
    
    const cmd = command.toLowerCase().split(' ')[0];
    
    if (dangerousPatterns.some(pattern => cmd.includes(pattern))) {
      return false;
    }
    
    if (command.startsWith('/')) {
      return allowedCommands.some(allowed => cmd.startsWith(allowed));
    }
    
    return true; // Non-command text is allowed
  }

  /**
   * Validate conversation context
   */
  _validateConversationContext(context) {
    if (!context || !context.messages || !Array.isArray(context.messages)) {
      return false;
    }
    
    // Limit conversation history size
    if (context.messages.length > 100) {
      return false;
    }
    
    // Validate message structure
    for (const message of context.messages) {
      if (!message.role || !message.content) {
        return false;
      }
      
      // Only allow user and assistant roles
      if (!['user', 'assistant'].includes(message.role)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Format messages for Claude API
   */
  _formatMessagesForClaude(messages) {
    return messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
    }));
  }

  /**
   * Process Claude API response
   */
  _processClaudeResponse(response) {
    if (!response || !response.content) {
      throw new Error('Invalid Claude API response');
    }
    
    const text = response.content.map(c => c.text || c.content || '').join('');
    
    return {
      text,
      id: response.id,
      model: response.model,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      }
    };
  }

  /**
   * Process Claude API errors
   */
  _processClaudeError(error) {
    if (!error || !error.error) {
      return { type: 'unknown_error', message: 'Unknown Claude API error', recoverable: false };
    }
    
    const { error: apiError } = error;
    
    const errorTypeMap = {
      'invalid_request_error': 'request_error',
      'authentication_error': 'authentication_error',
      'permission_error': 'permission_error',
      'not_found_error': 'not_found_error',
      'rate_limit_error': 'rate_limit_error',
      'api_error': 'api_error',
      'overloaded_error': 'overloaded_error'
    };
    
    const processedError = {
      type: errorTypeMap[apiError.type] || 'unknown_error',
      message: apiError.message || 'Unknown error occurred',
      recoverable: ['rate_limit_error', 'overloaded_error', 'api_error'].includes(apiError.type)
    };
    
    return processedError;
  }

  /**
   * Store Claude authentication data
   */
  async setClaudeAuth(sessionId, authData) {
    this.claudeAuthStorage.set(sessionId, authData);
  }

  /**
   * Get Claude authentication data
   */
  getClaudeAuth(sessionId) {
    return this.claudeAuthStorage.get(sessionId) || null;
  }

  /**
   * Check if authentication is valid
   */
  isAuthValid(sessionId) {
    const auth = this.getClaudeAuth(sessionId);
    if (!auth || !auth.token) {
      return false;
    }
    
    if (auth.expiresAt) {
      const expiryDate = new Date(auth.expiresAt);
      if (expiryDate < new Date()) {
        return false;
      }
    }
    
    return this._validateClaudeAuth(auth.token);
  }

  /**
   * Store session metadata
   */
  setSessionMetadata(sessionId, metadata) {
    this.sessionMetadataStorage.set(sessionId, metadata);
  }

  /**
   * Get session metadata
   */
  getSessionMetadata(sessionId) {
    return this.sessionMetadataStorage.get(sessionId) || null;
  }

  /**
   * Update conversation history
   */
  addToConversationHistory(sessionId, message) {
    const metadata = this.getSessionMetadata(sessionId);
    if (metadata) {
      metadata.conversationHistory.push({
        ...message,
        timestamp: new Date().toISOString()
      });
      
      // Limit history size
      if (metadata.conversationHistory.length > 100) {
        metadata.conversationHistory = metadata.conversationHistory.slice(-50);
      }
      
      this.setSessionMetadata(sessionId, metadata);
    }
  }

  /**
   * Update token usage
   */
  updateTokenUsage(sessionId, usage) {
    const metadata = this.getSessionMetadata(sessionId);
    if (metadata) {
      metadata.tokenUsage.input += usage.inputTokens || 0;
      metadata.tokenUsage.output += usage.outputTokens || 0;
      metadata.tokenUsage.total = metadata.tokenUsage.input + metadata.tokenUsage.output;
      
      this.setSessionMetadata(sessionId, metadata);
    }
  }
}

// Create and export singleton instance
// Initialize immediately for testing - will be enhanced when TerminalManager is available
export const claudeSessionType = new ClaudeSessionType();

export function createClaudeSessionType(terminalManager) {
  return new ClaudeSessionType(terminalManager);
}