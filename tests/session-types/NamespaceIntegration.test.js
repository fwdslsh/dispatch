import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as Client } from 'socket.io-client';
import { SessionTypeRegistry } from '../../src/lib/session-types/registry.js';
import { BaseSessionType } from '../../src/lib/session-types/base/BaseSessionType.js';

describe('WebSocket Namespace Integration', () => {
  let httpServer;
  let io;
  let registry;
  let testSessionType;
  let clientSocket;
  let serverPort;

  beforeEach(async () => {
    // Setup HTTP server and Socket.IO
    httpServer = createServer();
    io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*"
      }
    });

    // Get available port
    await new Promise((resolve) => {
      httpServer.listen(() => {
        serverPort = httpServer.address().port;
        resolve();
      });
    });

    // Setup session type registry
    registry = new SessionTypeRegistry();
    
    // Create test session type
    testSessionType = new BaseSessionType({
      id: 'test-namespace',
      name: 'Test Namespace Type',
      description: 'Test session type for namespace testing',
      category: 'testing',
      namespace: '/test-namespace'
    });

    registry.register(testSessionType);
  });

  afterEach((done) => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    
    io.close();
    httpServer.close(() => done());
  });

  describe('Namespace Creation', () => {
    it('should create isolated namespace for session type', (done) => {
      // Create namespace for test session type
      const testNamespace = io.of(testSessionType.namespace);
      
      expect(testNamespace).toBeDefined();
      expect(testNamespace.name).toBe('/test-namespace');
      
      testNamespace.on('connection', (socket) => {
        expect(socket.nsp.name).toBe('/test-namespace');
        done();
      });

      // Connect client to the namespace
      clientSocket = Client(`http://localhost:${serverPort}/test-namespace`);
    });

    it('should isolate events between namespaces', (done) => {
      let mainNamespaceReceived = false;
      let testNamespaceReceived = false;
      
      // Setup main namespace handler
      io.on('connection', (socket) => {
        socket.on('main-event', () => {
          mainNamespaceReceived = true;
        });
      });

      // Setup test namespace handler
      const testNamespace = io.of('/test-namespace');
      testNamespace.on('connection', (socket) => {
        socket.on('test-event', () => {
          testNamespaceReceived = true;
          
          // Verify isolation - only test namespace should receive test-event
          expect(testNamespaceReceived).toBe(true);
          expect(mainNamespaceReceived).toBe(false);
          done();
        });
      });

      // Connect to test namespace and emit test event
      clientSocket = Client(`http://localhost:${serverPort}/test-namespace`);
      clientSocket.on('connect', () => {
        clientSocket.emit('test-event');
      });
    });

    it('should handle multiple session type namespaces', (done) => {
      // Create second session type
      const secondSessionType = new BaseSessionType({
        id: 'test-second',
        name: 'Second Test Type',
        namespace: '/test-second'
      });
      
      registry.register(secondSessionType);
      
      // Create namespaces for both types
      const firstNamespace = io.of('/test-namespace');
      const secondNamespace = io.of('/test-second');
      
      let firstConnected = false;
      let secondConnected = false;
      
      firstNamespace.on('connection', () => {
        firstConnected = true;
        checkBothConnected();
      });
      
      secondNamespace.on('connection', () => {
        secondConnected = true;
        checkBothConnected();
      });
      
      function checkBothConnected() {
        if (firstConnected && secondConnected) {
          expect(firstNamespace.name).toBe('/test-namespace');
          expect(secondNamespace.name).toBe('/test-second');
          done();
        }
      }
      
      // Connect clients to both namespaces
      const client1 = Client(`http://localhost:${serverPort}/test-namespace`);
      const client2 = Client(`http://localhost:${serverPort}/test-second`);
      
      // Cleanup clients after test
      setTimeout(() => {
        client1.disconnect();
        client2.disconnect();
      }, 100);
    });
  });

  describe('Handler Registration', () => {
    it('should register session type-specific handlers', (done) => {
      const testHandlers = {
        'test-create': (data, callback) => {
          expect(data.type).toBe('test');
          callback({ success: true, sessionId: 'test-session' });
        },
        'test-attach': (sessionId, callback) => {
          expect(sessionId).toBe('test-session');
          callback({ success: true });
        }
      };

      const testNamespace = io.of('/test-namespace');
      testNamespace.on('connection', (socket) => {
        // Register handlers dynamically
        Object.entries(testHandlers).forEach(([event, handler]) => {
          socket.on(event, handler);
        });
      });

      clientSocket = Client(`http://localhost:${serverPort}/test-namespace`);
      clientSocket.on('connect', () => {
        // Test create handler
        clientSocket.emit('test-create', { type: 'test' }, (response) => {
          expect(response.success).toBe(true);
          expect(response.sessionId).toBe('test-session');
          
          // Test attach handler
          clientSocket.emit('test-attach', 'test-session', (response) => {
            expect(response.success).toBe(true);
            done();
          });
        });
      });
    });

    it('should handle handler registration errors gracefully', (done) => {
      const testNamespace = io.of('/test-namespace');
      testNamespace.on('connection', (socket) => {
        socket.on('error-handler', () => {
          throw new Error('Handler error');
        });

        socket.on('error', (error) => {
          expect(error.message).toBe('Handler error');
          done();
        });
      });

      clientSocket = Client(`http://localhost:${serverPort}/test-namespace`);
      clientSocket.on('connect', () => {
        clientSocket.emit('error-handler');
      });
    });
  });

  describe('Session Type Handler Factory Pattern', () => {
    it('should create handlers using factory pattern', (done) => {
      // Mock handler factory
      const createTestHandlers = (sessionType, namespace, socket) => {
        expect(sessionType.id).toBe('test-namespace');
        expect(namespace.name).toBe('/test-namespace');
        expect(socket).toBeDefined();

        return {
          'create-session': (options, callback) => {
            const sessionData = {
              id: 'sess_123',
              name: options.name || 'Test Session',
              type: sessionType.id,
              status: 'active',
              created: new Date().toISOString()
            };
            callback({ success: true, session: sessionData });
          },
          
          'attach-session': (sessionId, callback) => {
            if (sessionId === 'sess_123') {
              callback({ success: true });
            } else {
              callback({ success: false, error: 'Session not found' });
            }
          }
        };
      };

      const testNamespace = io.of('/test-namespace');
      testNamespace.on('connection', (socket) => {
        const handlers = createTestHandlers(testSessionType, testNamespace, socket);
        
        Object.entries(handlers).forEach(([event, handler]) => {
          socket.on(event, handler);
        });
      });

      clientSocket = Client(`http://localhost:${serverPort}/test-namespace`);
      clientSocket.on('connect', () => {
        // Test session creation
        clientSocket.emit('create-session', { name: 'My Test Session' }, (response) => {
          expect(response.success).toBe(true);
          expect(response.session.name).toBe('My Test Session');
          expect(response.session.type).toBe('test-namespace');
          
          // Test session attachment
          clientSocket.emit('attach-session', response.session.id, (attachResponse) => {
            expect(attachResponse.success).toBe(true);
            done();
          });
        });
      });
    });
  });

  describe('Namespace Authentication', () => {
    it('should handle authentication before handler registration', (done) => {
      let isAuthenticated = false;
      
      const testNamespace = io.of('/test-namespace');
      testNamespace.on('connection', (socket) => {
        socket.on('auth', (key, callback) => {
          if (key === 'test-key') {
            isAuthenticated = true;
            callback({ success: true });
          } else {
            callback({ success: false, error: 'Invalid key' });
          }
        });

        socket.on('protected-action', (data, callback) => {
          if (!isAuthenticated) {
            callback({ success: false, error: 'Not authenticated' });
            return;
          }
          callback({ success: true, data: 'Protected data' });
        });
      });

      clientSocket = Client(`http://localhost:${serverPort}/test-namespace`);
      clientSocket.on('connect', () => {
        // Try protected action without auth
        clientSocket.emit('protected-action', {}, (response) => {
          expect(response.success).toBe(false);
          expect(response.error).toBe('Not authenticated');
          
          // Authenticate
          clientSocket.emit('auth', 'test-key', (authResponse) => {
            expect(authResponse.success).toBe(true);
            
            // Retry protected action
            clientSocket.emit('protected-action', {}, (response) => {
              expect(response.success).toBe(true);
              expect(response.data).toBe('Protected data');
              done();
            });
          });
        });
      });
    });
  });

  describe('Namespace Cleanup', () => {
    it('should clean up namespace resources on disconnect', (done) => {
      let connectionCount = 0;
      let disconnectionCount = 0;
      
      const testNamespace = io.of('/test-namespace');
      testNamespace.on('connection', (socket) => {
        connectionCount++;
        
        socket.on('disconnect', () => {
          disconnectionCount++;
          
          // Verify cleanup
          expect(disconnectionCount).toBe(connectionCount);
          done();
        });
      });

      clientSocket = Client(`http://localhost:${serverPort}/test-namespace`);
      clientSocket.on('connect', () => {
        expect(connectionCount).toBe(1);
        clientSocket.disconnect();
      });
    });
  });
});