import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ShellSessionType } from '../../src/lib/session-types/shell/index.js';
import { TerminalManager } from '../../src/lib/server/terminal.js';
import { generateSessionId, createSessionMetadata } from '../../src/lib/session-types/shared/SessionTypeUtils.js';

// Mock TerminalManager
vi.mock('../../server/terminal.js', () => ({
  TerminalManager: vi.fn(() => ({
    createSession: vi.fn(),
    attachToSession: vi.fn(),
    endSession: vi.fn(),
    sendInput: vi.fn(),
    resize: vi.fn()
  }))
}));

// Mock session utilities
vi.mock('../../session-types/shared/SessionTypeUtils.js', () => ({
  generateSessionId: vi.fn(() => 'sess_shell_123'),
  createSessionMetadata: vi.fn((params) => ({
    id: params.id,
    name: params.name,
    type: params.type,
    status: 'active',
    created: '2025-09-05T12:00:00Z',
    customData: params.customData || {}
  }))
}));

describe('ShellSessionType', () => {
  let shellSessionType;
  let mockTerminalManager;
  let mockSocket;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup mock terminal manager
    mockTerminalManager = new TerminalManager();
    
    // Setup mock socket
    mockSocket = {
      id: 'socket_123',
      sessionId: null,
      on: vi.fn(),
      emit: vi.fn(),
      join: vi.fn(),
      leave: vi.fn()
    };
    
    // Create shell session type instance
    shellSessionType = new ShellSessionType(mockTerminalManager);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Configuration', () => {
    it('should have correct session type configuration', () => {
      expect(shellSessionType.id).toBe('shell');
      expect(shellSessionType.name).toBe('Shell Terminal');
      expect(shellSessionType.description).toBe('Standard shell terminal session with PTY support');
      expect(shellSessionType.category).toBe('terminal');
      expect(shellSessionType.namespace).toBe('/shell');
      expect(shellSessionType.requiresProject).toBe(false);
      expect(shellSessionType.supportsAttachment).toBe(true);
    });

    it('should have default shell options', () => {
      const defaults = shellSessionType.getDefaultOptions();
      expect(defaults.shell).toBe('/bin/bash');
      expect(defaults.cols).toBe(80);
      expect(defaults.rows).toBe(24);
      expect(defaults.env).toEqual({
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor'
      });
    });

    it('should support terminal capabilities', () => {
      expect(shellSessionType.supportsCapability('create')).toBe(true);
      expect(shellSessionType.supportsCapability('attach')).toBe(true);
      expect(shellSessionType.supportsCapability('destroy')).toBe(true);
      expect(shellSessionType.supportsCapability('resize')).toBe(true);
      expect(shellSessionType.supportsCapability('input')).toBe(true);
      expect(shellSessionType.supportsCapability('history')).toBe(false);
    });
  });

  describe('Session Creation', () => {
    it('should create a new shell session successfully', async () => {
      const sessionOptions = {
        name: 'Test Shell',
        cols: 120,
        rows: 30,
        customOptions: {
          shell: '/bin/zsh',
          env: { EDITOR: 'vim' }
        }
      };

      mockTerminalManager.createSession.mockResolvedValue({
        id: 'sess_shell_123',
        pid: 12345
      });

      const result = await shellSessionType.onCreate(sessionOptions, mockSocket);

      // Verify terminal manager was called correctly
      expect(mockTerminalManager.createSession).toHaveBeenCalledWith({
        cols: 120,
        rows: 30,
        shell: '/bin/zsh',
        env: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          EDITOR: 'vim'
        }
      });

      // Verify session metadata was created
      expect(createSessionMetadata).toHaveBeenCalledWith({
        id: 'sess_shell_123',
        name: 'Test Shell',
        type: 'shell',
        customData: {
          shell: '/bin/zsh',
          pid: 12345,
          env: {
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            EDITOR: 'vim'
          }
        }
      });

      // Verify socket was configured
      expect(mockSocket.sessionId).toBe('sess_shell_123');
      expect(mockSocket.join).toHaveBeenCalledWith('sess_shell_123');

      // Verify return value
      expect(result.id).toBe('sess_shell_123');
      expect(result.type).toBe('shell');
      expect(result.status).toBe('active');
    });

    it('should use default options when none provided', async () => {
      const sessionOptions = {
        name: 'Default Shell'
      };

      mockTerminalManager.createSession.mockResolvedValue({
        id: 'sess_shell_123',
        pid: 12345
      });

      await shellSessionType.onCreate(sessionOptions, mockSocket);

      expect(mockTerminalManager.createSession).toHaveBeenCalledWith({
        cols: 80,
        rows: 24,
        shell: '/bin/bash',
        env: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      });
    });

    it('should handle terminal creation failures', async () => {
      const sessionOptions = {
        name: 'Failing Shell'
      };

      mockTerminalManager.createSession.mockRejectedValue(
        new Error('Failed to spawn terminal')
      );

      await expect(shellSessionType.onCreate(sessionOptions, mockSocket))
        .rejects.toThrow('Failed to create shell session: Failed to spawn terminal');
    });

    it('should register terminal output handlers', async () => {
      const sessionOptions = { name: 'Handler Test' };
      
      mockTerminalManager.createSession.mockResolvedValue({
        id: 'sess_shell_123',
        pid: 12345,
        on: vi.fn()
      });

      await shellSessionType.onCreate(sessionOptions, mockSocket);

      // Verify terminal manager was set up with event handlers
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
    });
  });

  describe('Session Attachment', () => {
    it('should attach to existing shell session', async () => {
      const sessionId = 'sess_existing_123';

      mockTerminalManager.attachToSession.mockResolvedValue(true);

      const result = await shellSessionType.onAttach(sessionId, mockSocket);

      expect(mockTerminalManager.attachToSession).toHaveBeenCalledWith(
        sessionId, 
        mockSocket
      );
      expect(mockSocket.sessionId).toBe(sessionId);
      expect(mockSocket.join).toHaveBeenCalledWith(sessionId);
      expect(result).toBe(true);
    });

    it('should handle attachment failures', async () => {
      const sessionId = 'sess_nonexistent_123';

      mockTerminalManager.attachToSession.mockResolvedValue(false);

      const result = await shellSessionType.onAttach(sessionId, mockSocket);

      expect(result).toBe(false);
      expect(mockSocket.sessionId).toBeNull();
    });

    it('should handle attachment errors', async () => {
      const sessionId = 'sess_error_123';

      mockTerminalManager.attachToSession.mockRejectedValue(
        new Error('Session not found')
      );

      await expect(shellSessionType.onAttach(sessionId, mockSocket))
        .rejects.toThrow('Session not found');
    });
  });

  describe('Session Destruction', () => {
    it('should clean up shell session properly', async () => {
      const sessionId = 'sess_cleanup_123';

      mockTerminalManager.endSession.mockResolvedValue();

      await shellSessionType.onDestroy(sessionId);

      expect(mockTerminalManager.endSession).toHaveBeenCalledWith(sessionId);
    });

    it('should handle cleanup errors gracefully', async () => {
      const sessionId = 'sess_cleanup_error_123';

      mockTerminalManager.endSession.mockRejectedValue(
        new Error('Process already terminated')
      );

      // Should not throw - cleanup errors are handled gracefully
      await expect(shellSessionType.onDestroy(sessionId)).resolves.toBeUndefined();
    });
  });

  describe('Option Validation', () => {
    it('should validate session options successfully', () => {
      const validOptions = {
        name: 'Valid Shell',
        cols: 120,
        rows: 30,
        customOptions: {
          shell: '/bin/zsh'
        }
      };

      const result = shellSessionType.validate(validOptions);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject invalid shell paths', () => {
      const invalidOptions = {
        name: 'Invalid Shell',
        customOptions: {
          shell: '/nonexistent/shell'
        }
      };

      const result = shellSessionType.validate(invalidOptions);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid shell: /nonexistent/shell');
    });

    it('should reject dangerous shell commands', () => {
      const dangerousOptions = {
        name: 'Dangerous Shell',
        customOptions: {
          shell: 'rm -rf /'
        }
      };

      const result = shellSessionType.validate(dangerousOptions);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Shell must be an absolute path to an executable');
    });

    it('should validate terminal dimensions', () => {
      const invalidDimensions = {
        name: 'Invalid Dimensions',
        cols: 5,
        rows: 2
      };

      const result = shellSessionType.validate(invalidDimensions);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Terminal Operations', () => {
    it('should handle terminal input', () => {
      const sessionId = 'sess_input_123';
      const inputData = 'echo "hello world"\n';

      shellSessionType.handleInput(sessionId, inputData);

      expect(mockTerminalManager.sendInput).toHaveBeenCalledWith(sessionId, inputData);
    });

    it('should handle terminal resize', () => {
      const sessionId = 'sess_resize_123';
      const dimensions = { cols: 120, rows: 40 };

      shellSessionType.handleResize(sessionId, dimensions);

      expect(mockTerminalManager.resize).toHaveBeenCalledWith(
        sessionId, 
        dimensions.cols, 
        dimensions.rows
      );
    });

    it('should validate resize dimensions', () => {
      const sessionId = 'sess_resize_invalid_123';
      const invalidDimensions = { cols: 5, rows: 2 };

      expect(() => shellSessionType.handleResize(sessionId, invalidDimensions))
        .toThrow('Invalid terminal dimensions');
    });
  });

  describe('Environment Management', () => {
    it('should merge custom environment variables', async () => {
      const sessionOptions = {
        name: 'Custom Env Shell',
        customOptions: {
          env: {
            CUSTOM_VAR: 'custom_value',
            PATH: '/custom/bin:$PATH'
          }
        }
      };

      mockTerminalManager.createSession.mockResolvedValue({
        id: 'sess_shell_123',
        pid: 12345
      });

      await shellSessionType.onCreate(sessionOptions, mockSocket);

      expect(mockTerminalManager.createSession).toHaveBeenCalledWith({
        cols: 80,
        rows: 24,
        shell: '/bin/bash',
        env: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          CUSTOM_VAR: 'custom_value',
          PATH: '/custom/bin:$PATH'
        }
      });
    });

    it('should preserve default terminal environment variables', async () => {
      const sessionOptions = {
        name: 'Env Preserve Shell',
        customOptions: {
          env: {
            TERM: 'vt100'  // Should be overridden by default
          }
        }
      };

      mockTerminalManager.createSession.mockResolvedValue({
        id: 'sess_shell_123',
        pid: 12345
      });

      await shellSessionType.onCreate(sessionOptions, mockSocket);

      const calledWith = mockTerminalManager.createSession.mock.calls[0][0];
      expect(calledWith.env.TERM).toBe('xterm-256color'); // Default preserved
      expect(calledWith.env.COLORTERM).toBe('truecolor');
    });
  });
});