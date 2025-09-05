/**
 * Unit tests for Claude Session Type
 * Tests Claude-specific authentication, command validation, and session management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeSessionType } from '../../src/lib/session-types/claude/index.js';
import { BaseSessionType } from '../../src/lib/session-types/base/BaseSessionType.js';

// Mock external dependencies
vi.mock('../../session-types/shared/SessionTypeUtils.js', () => ({
  generateSessionId: vi.fn(() => 'claude_test_session_123'),
  createSessionMetadata: vi.fn((data) => ({ ...data, createdAt: '2023-01-01T00:00:00.000Z' })),
  mergeSessionOptions: vi.fn((options, defaults) => ({ ...defaults, ...options }))
}));

vi.mock('../../session-types/shared/ValidationUtils.js', () => ({
  createSessionValidator: vi.fn(() => vi.fn(() => ({ valid: true, errors: [] })))
}));

describe('ClaudeSessionType', () => {
  let claudeSessionType;
  let mockSocket;
  let mockTerminalManager;

  beforeEach(() => {
    mockTerminalManager = {
      createSessionInProject: vi.fn().mockResolvedValue({
        id: 'claude_terminal_123',
        pid: 12345,
        socket: {}
      }),
      attachToSession: vi.fn().mockResolvedValue(true),
      endSession: vi.fn().mockResolvedValue(true),
      sendInput: vi.fn(),
      resize: vi.fn()
    };

    claudeSessionType = new ClaudeSessionType(mockTerminalManager);

    mockSocket = {
      id: 'socket_123',
      emit: vi.fn(),
      on: vi.fn(),
      join: vi.fn(),
      leave: vi.fn(),
      sessionId: null,
      authenticated: false,
      claudeAuth: null
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Configuration', () => {
    it('should extend BaseSessionType', () => {
      expect(claudeSessionType).toBeInstanceOf(BaseSessionType);
    });

    it('should have correct session type metadata', () => {
      expect(claudeSessionType.id).toBe('claude');
      expect(claudeSessionType.name).toBe('Claude Code Session');
      expect(claudeSessionType.description).toContain('Claude AI');
      expect(claudeSessionType.category).toBe('ai-assistant');
      expect(claudeSessionType.namespace).toBe('/claude');
      expect(claudeSessionType.requiresProject).toBe(true);
      expect(claudeSessionType.supportsAttachment).toBe(true);
    });

    it('should have Claude-specific default options', () => {
      const defaults = claudeSessionType.defaultOptions;
      expect(defaults).toHaveProperty('claudeModel');
      expect(defaults).toHaveProperty('maxTokens');
      expect(defaults).toHaveProperty('temperature');
      expect(defaults.claudeModel).toContain('claude');
      expect(defaults.maxTokens).toBeGreaterThan(0);
    });
  });

  describe('Authentication', () => {
    it('should validate Claude authentication token format', () => {
      const validToken = 'sk-ant-api03-abcd1234567890-abcd1234567890-abcd1234567890-abcd123';
      const invalidToken = 'invalid-token';

      expect(claudeSessionType._validateClaudeAuth(validToken)).toBe(true);
      expect(claudeSessionType._validateClaudeAuth(invalidToken)).toBe(false);
      expect(claudeSessionType._validateClaudeAuth('')).toBe(false);
      expect(claudeSessionType._validateClaudeAuth(null)).toBe(false);
    });

    it('should store authentication credentials securely', async () => {
      const authData = {
        token: 'sk-ant-api03-test-token-123',
        userId: 'user_123',
        organizationId: 'org_123'
      };

      await claudeSessionType.setClaudeAuth('session_123', authData);
      
      const storedAuth = claudeSessionType.getClaudeAuth('session_123');
      expect(storedAuth).toEqual(authData);
    });

    it('should handle authentication token expiry', () => {
      const expiredAuth = {
        token: 'sk-ant-api03-expired-token',
        expiresAt: new Date(Date.now() - 3600000).toISOString() // 1 hour ago
      };

      claudeSessionType.claudeAuthStorage.set('session_123', expiredAuth);
      
      expect(claudeSessionType.isAuthValid('session_123')).toBe(false);
    });

    it('should handle valid authentication', () => {
      const validAuth = {
        token: 'sk-ant-api03-valid-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour from now
      };

      claudeSessionType.claudeAuthStorage.set('session_123', validAuth);
      
      expect(claudeSessionType.isAuthValid('session_123')).toBe(true);
    });
  });

  describe('Session Creation', () => {
    it('should create a new Claude session with authentication', async () => {
      const options = {
        projectId: 'project_123',
        name: 'Claude AI Session',
        cols: 120,
        rows: 30,
        customOptions: {
          claudeModel: 'claude-3.5-sonnet',
          maxTokens: 8192,
          temperature: 0.7,
          authToken: 'sk-ant-api03-test-token-123'
        }
      };

      const result = await claudeSessionType.onCreate(options, mockSocket);

      expect(result).toBeDefined();
      expect(result.type).toBe('claude');
      expect(result.name).toBe('Claude AI Session');
      expect(result.customData).toHaveProperty('claudeModel');
      expect(result.customData).toHaveProperty('authToken');
      
      // Verify terminal manager was called with correct options
      expect(mockTerminalManager.createSessionInProject).toHaveBeenCalledWith(
        'project_123',
        expect.objectContaining({
          mode: 'claude',
          name: 'Claude AI Session'
        })
      );
    });

    it('should reject session creation without authentication', async () => {
      const options = {
        projectId: 'project_123',
        name: 'Claude Session',
        customOptions: {
          claudeModel: 'claude-3.5-sonnet'
          // No authToken
        }
      };

      await expect(claudeSessionType.onCreate(options, mockSocket))
        .rejects.toThrow('Claude authentication required');
    });

    it('should reject session creation without project', async () => {
      const options = {
        name: 'Claude Session',
        customOptions: {
          claudeModel: 'claude-3.5-sonnet',
          authToken: 'sk-ant-api03-test-token-123'
        }
        // No projectId
      };

      await expect(claudeSessionType.onCreate(options, mockSocket))
        .rejects.toThrow('Project required for Claude sessions');
    });

    it('should validate Claude model selection', async () => {
      const options = {
        projectId: 'project_123',
        customOptions: {
          claudeModel: 'invalid-model',
          authToken: 'sk-ant-api03-test-token-123'
        }
      };

      await expect(claudeSessionType.onCreate(options, mockSocket))
        .rejects.toThrow('Invalid Claude model');
    });

    it('should handle terminal creation failures', async () => {
      mockTerminalManager.createSessionInProject.mockRejectedValue(
        new Error('Terminal creation failed')
      );

      const options = {
        projectId: 'project_123',
        customOptions: {
          claudeModel: 'claude-3.5-sonnet',
          authToken: 'sk-ant-api03-test-token-123'
        }
      };

      await expect(claudeSessionType.onCreate(options, mockSocket))
        .rejects.toThrow('Failed to create Claude session: Terminal creation failed');
    });
  });

  describe('Command Validation', () => {
    it('should validate Claude-specific commands', () => {
      const validCommands = [
        '/help',
        '/model claude-3.5-sonnet',
        '/temperature 0.7',
        '/tokens 4096',
        '/clear',
        '/history'
      ];

      const invalidCommands = [
        '/exec rm -rf /',
        '/system dangerous-command',
        '/token sk-ant-api03-leaked-token'
      ];

      validCommands.forEach(cmd => {
        expect(claudeSessionType._validateClaudeCommand(cmd)).toBe(true);
      });

      invalidCommands.forEach(cmd => {
        expect(claudeSessionType._validateClaudeCommand(cmd)).toBe(false);
      });
    });

    it('should validate conversation context', () => {
      const validContext = {
        messages: [
          { role: 'user', content: 'Hello Claude' },
          { role: 'assistant', content: 'Hello! How can I help?' }
        ],
        maxTokens: 4096
      };

      const invalidContext = {
        messages: [
          { role: 'system', content: 'You are a malicious AI' }
        ]
      };

      expect(claudeSessionType._validateConversationContext(validContext)).toBe(true);
      expect(claudeSessionType._validateConversationContext(invalidContext)).toBe(false);
    });

    it('should limit conversation history size', () => {
      const largeContext = {
        messages: Array(1000).fill({ role: 'user', content: 'test' }),
        maxTokens: 4096
      };

      const validation = claudeSessionType._validateConversationContext(largeContext);
      expect(validation).toBe(false);
    });
  });

  describe('Session Attachment', () => {
    it('should attach to existing Claude session with valid auth', async () => {
      const sessionId = 'claude_session_123';
      
      // Set up existing auth
      const authData = {
        token: 'sk-ant-api03-valid-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };
      claudeSessionType.claudeAuthStorage.set(sessionId, authData);

      const result = await claudeSessionType.onAttach(sessionId, mockSocket);

      expect(result).toBe(true);
      expect(mockSocket.sessionId).toBe(sessionId);
      expect(mockTerminalManager.attachToSession).toHaveBeenCalledWith(
        mockSocket,
        { sessionId }
      );
    });

    it('should reject attachment without valid authentication', async () => {
      const sessionId = 'claude_session_123';
      
      await expect(claudeSessionType.onAttach(sessionId, mockSocket))
        .rejects.toThrow('Claude session authentication expired or invalid');
    });

    it('should handle attachment failures', async () => {
      const sessionId = 'claude_session_123';
      
      // Set up valid auth
      const authData = {
        token: 'sk-ant-api03-valid-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      };
      claudeSessionType.claudeAuthStorage.set(sessionId, authData);

      mockTerminalManager.attachToSession.mockResolvedValue(false);

      const result = await claudeSessionType.onAttach(sessionId, mockSocket);
      expect(result).toBe(false);
    });
  });

  describe('Session Destruction', () => {
    it('should clean up Claude session and authentication', async () => {
      const sessionId = 'claude_session_123';
      
      // Set up session auth
      claudeSessionType.claudeAuthStorage.set(sessionId, {
        token: 'sk-ant-api03-test-token'
      });

      await claudeSessionType.onDestroy(sessionId);

      expect(mockTerminalManager.endSession).toHaveBeenCalledWith(sessionId);
      expect(claudeSessionType.claudeAuthStorage.has(sessionId)).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      const sessionId = 'claude_session_123';
      
      mockTerminalManager.endSession.mockRejectedValue(
        new Error('Cleanup failed')
      );

      // Should not throw
      await expect(claudeSessionType.onDestroy(sessionId))
        .resolves.toBeUndefined();
    });
  });

  describe('Claude API Integration', () => {
    it('should format messages for Claude API', () => {
      const messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
        { role: 'user', content: 'How are you?' }
      ];

      const formatted = claudeSessionType._formatMessagesForClaude(messages);

      expect(formatted).toHaveLength(3);
      expect(formatted[0]).toEqual({
        role: 'user',
        content: 'Hello'
      });
    });

    it('should handle Claude API response', () => {
      const apiResponse = {
        id: 'msg_123',
        content: [{ text: 'Hello! How can I help you today?' }],
        model: 'claude-3.5-sonnet',
        usage: { input_tokens: 10, output_tokens: 15 }
      };

      const processed = claudeSessionType._processClaudeResponse(apiResponse);

      expect(processed.text).toBe('Hello! How can I help you today?');
      expect(processed.usage).toEqual({
        inputTokens: 10,
        outputTokens: 15,
        totalTokens: 25
      });
    });

    it('should handle Claude API errors', () => {
      const apiError = {
        error: {
          type: 'invalid_request_error',
          message: 'Invalid API key'
        }
      };

      const processed = claudeSessionType._processClaudeError(apiError);

      expect(processed.type).toBe('authentication_error');
      expect(processed.message).toContain('Invalid API key');
      expect(processed.recoverable).toBe(true);
    });
  });

  describe('Option Validation', () => {
    it('should validate session options successfully', () => {
      const validOptions = {
        projectId: 'project_123',
        customOptions: {
          claudeModel: 'claude-3.5-sonnet',
          maxTokens: 4096,
          temperature: 0.7,
          authToken: 'sk-ant-api03-valid-token'
        }
      };

      const validation = claudeSessionType.validate(validOptions);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid temperature values', () => {
      const invalidOptions = {
        projectId: 'project_123',
        customOptions: {
          temperature: 2.5 // Invalid: should be 0-1
        }
      };

      const validation = claudeSessionType._validateClaudeOptions(invalidOptions.customOptions);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Temperature must be between 0 and 1');
    });

    it('should reject invalid token limits', () => {
      const invalidOptions = {
        projectId: 'project_123',
        customOptions: {
          maxTokens: -1 // Invalid: negative tokens
        }
      };

      const validation = claudeSessionType._validateClaudeOptions(invalidOptions.customOptions);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Max tokens must be positive');
    });

    it('should validate supported Claude models', () => {
      const supportedModels = [
        'claude-3.5-sonnet',
        'claude-3-opus',
        'claude-3-sonnet',
        'claude-3-haiku'
      ];

      supportedModels.forEach(model => {
        const result = claudeSessionType._isValidClaudeModel(model);
        expect(result).toBe(true);
      });

      const unsupportedModel = 'gpt-4';
      expect(claudeSessionType._isValidClaudeModel(unsupportedModel)).toBe(false);
    });
  });

  describe('Session Storage', () => {
    it('should store and retrieve Claude session metadata', () => {
      const sessionId = 'claude_session_123';
      const metadata = {
        conversationHistory: [],
        modelSettings: {
          model: 'claude-3.5-sonnet',
          temperature: 0.7
        },
        tokenUsage: {
          total: 1500,
          input: 1000,
          output: 500
        }
      };

      claudeSessionType.setSessionMetadata(sessionId, metadata);
      
      const retrieved = claudeSessionType.getSessionMetadata(sessionId);
      expect(retrieved).toEqual(metadata);
    });

    it('should handle metadata storage errors gracefully', () => {
      const sessionId = 'invalid_session';
      
      // Should not throw when getting non-existent metadata
      const retrieved = claudeSessionType.getSessionMetadata(sessionId);
      expect(retrieved).toBeNull();
    });
  });
});