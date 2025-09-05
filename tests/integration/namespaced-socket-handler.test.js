/**
 * Integration tests for namespaced socket handler
 * Tests session type namespace isolation and handler loading
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'node:http';
import { io as Client } from 'socket.io-client';

import { createNamespacedSocketHandler, validateSessionTypeRegistration } from '../../src/lib/server/namespaced-socket-handler.js';
import { sessionTypeRegistry } from '../../src/lib/session-types/registry.js';
import { shellSessionType } from '../../src/lib/session-types/shell/index.js';
import { initializeSessionTypes } from '../../src/lib/session-types/index.js';

describe('Namespaced Socket Handler Integration', () => {
  let httpServer;
  let io;
  let serverSocket;
  let clientSocket;
  let port;

  beforeEach(async () => {
    // Create HTTP server and Socket.IO server
    httpServer = createServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    // Start server on random port
    await new Promise((resolve) => {
      httpServer.listen(() => {
        port = httpServer.address().port;
        resolve(void 0);
      });
    });

    // Clear registry and initialize session types for testing
    sessionTypeRegistry.types.clear();
    initializeSessionTypes();
  });

  afterEach(() => {
    // Cleanup
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (io) {
      io.close();
    }
    if (httpServer) {
      httpServer.close();
    }
    sessionTypeRegistry.types.clear();
  });

  describe('Namespace Creation', () => {
    it('should create namespaces for registered session types', () => {
      // Create namespaced handler
      createNamespacedSocketHandler(io);

      // Check that shell namespace was created
      const shellNamespace = io.of('/shell');
      expect(shellNamespace).toBeTruthy();
      expect(shellNamespace.name).toBe('/shell');
    });

    it('should handle empty session type registry gracefully', () => {
      // Clear registry
      sessionTypeRegistry.types.clear();
      
      // Should not throw and should log warning
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      createNamespacedSocketHandler(io);
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '⚠️  No session types registered - only main namespace will be available'
      );
      
      consoleSpy.mockRestore();
    });

    it('should validate session type registration', () => {
      // Should pass validation with shell session type
      expect(() => validateSessionTypeRegistration()).not.toThrow();
    });
  });

  describe('Namespace Connection Handling', () => {
    beforeEach(() => {
      createNamespacedSocketHandler(io);
    });

    it('should handle connections to shell namespace', (done) => {
      const timeout = setTimeout(() => {
        done(new Error('Connection timeout'));
      }, 2000);

      const shellNamespace = io.of('/shell');
      
      shellNamespace.on('connection', (socket) => {
        clearTimeout(timeout);
        expect(socket).toBeTruthy();
        expect(socket.sessionTypeId).toBe('shell');
        done();
      });

      // Connect client to shell namespace
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect_error', (error) => {
        clearTimeout(timeout);
        done(error);
      });
    });

    it('should emit namespace-ready event on connection', (done) => {
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('namespace-ready', (data) => {
        expect(data.sessionType).toBe('shell');
        expect(data.namespace).toBe('/shell');
        expect(data.authRequired).toBeDefined();
        expect(data.serverTime).toBeTruthy();
        done();
      });
    });

    it('should handle authentication in shell namespace', (done) => {
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect', () => {
        clientSocket.emit('auth', 'test-key', (response) => {
          expect(response.success).toBe(true);
          expect(response.message).toContain('Authentication');
          done();
        });
      });
    });
  });

  describe('Handler Loading and Registration', () => {
    beforeEach(() => {
      createNamespacedSocketHandler(io);
    });

    it('should load and register shell handlers', (done) => {
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect', () => {
        // Test that shell-specific events are available
        clientSocket.emit('get-session-type-info', (response) => {
          expect(response.success).toBe(true);
          expect(response.sessionType.id).toBe('shell');
          expect(response.sessionType.name).toBe('Shell Terminal');
          expect(response.sessionType.namespace).toBe('/shell');
          done();
        });
      });
    });

    it('should handle ping event in namespace', (done) => {
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect', () => {
        clientSocket.emit('ping', (response) => {
          expect(response.success).toBe(true);
          expect(response.timestamp).toBeTruthy();
          expect(response.sessionType).toBe('shell');
          done();
        });
      });
    });

    it('should handle session type specific errors gracefully', (done) => {
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect', () => {
        // Try to create session without proper data to trigger error
        clientSocket.emit('create-session', {}, (response) => {
          expect(response.success).toBe(false);
          expect(response.error).toBeTruthy();
          expect(response.code).toBeTruthy();
          done();
        });
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      createNamespacedSocketHandler(io);
    });

    it('should emit namespace-error events for unhandled errors', (done) => {
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('namespace-error', (error) => {
        expect(error.code).toBeTruthy();
        expect(error.sessionType).toBe('shell');
        expect(error.recoverable).toBeDefined();
        done();
      });

      // Trigger error by sending malformed data
      clientSocket.on('connect', () => {
        clientSocket.emit('create-session', 'invalid-data');
      });
    });

    it('should handle authentication errors', (done) => {
      // Set up environment to require authentication
      const originalTerminalKey = process.env.TERMINAL_KEY;
      process.env.TERMINAL_KEY = 'test-secure-key';
      
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect', () => {
        clientSocket.emit('auth', 'wrong-key', (response) => {
          expect(response.success).toBe(false);
          expect(response.error).toBe('Invalid terminal key');
          
          // Restore original
          process.env.TERMINAL_KEY = originalTerminalKey;
          done();
        });
      });
    });
  });

  describe('Connection Lifecycle', () => {
    beforeEach(() => {
      createNamespacedSocketHandler(io);
    });

    it('should track connection duration on disconnect', (done) => {
      const shellNamespace = io.of('/shell');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect', () => {
        setTimeout(() => {
          clientSocket.disconnect();
          
          setTimeout(() => {
            // Check that disconnect was logged with duration
            expect(consoleSpy).toHaveBeenCalledWith(
              expect.stringContaining('Socket disconnected from /shell')
            );
            expect(consoleSpy).toHaveBeenCalledWith(
              expect.stringContaining('Duration:')
            );
            
            consoleSpy.mockRestore();
            done();
          }, 10);
        }, 50);
      });
    });

    it('should emit socket-disconnected event to namespace', (done) => {
      const shellNamespace = io.of('/shell');
      
      shellNamespace.on('socket-disconnected', (data) => {
        expect(data.socketId).toBeTruthy();
        expect(data.sessionType).toBe('shell');
        expect(data.reason).toBeTruthy();
        expect(data.connectionDuration).toBeGreaterThan(0);
        done();
      });
      
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect', () => {
        setTimeout(() => {
          clientSocket.disconnect();
        }, 50);
      });
    });
  });

  describe('Session Type Information', () => {
    beforeEach(() => {
      createNamespacedSocketHandler(io);
    });

    it('should provide session type capabilities', (done) => {
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect', () => {
        clientSocket.emit('get-session-type-info', (response) => {
          expect(response.success).toBe(true);
          expect(response.sessionType.capabilities).toContain('create');
          expect(response.sessionType.capabilities).toContain('destroy');
          expect(response.sessionType.capabilities).toContain('attach');
          done();
        });
      });
    });

    it('should provide correct session type metadata', (done) => {
      clientSocket = Client(`http://localhost:${port}/shell`);
      
      clientSocket.on('connect', () => {
        clientSocket.emit('get-session-type-info', (response) => {
          const sessionType = response.sessionType;
          expect(sessionType.id).toBe('shell');
          expect(sessionType.name).toBe('Shell Terminal');
          expect(sessionType.description).toContain('terminal session');
          expect(sessionType.category).toBe('terminal');
          expect(sessionType.namespace).toBe('/shell');
          done();
        });
      });
    });
  });
});