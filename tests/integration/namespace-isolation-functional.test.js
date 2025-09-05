/**
 * Functional tests for namespace isolation
 * Tests core namespace functionality without socket connections
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Server as SocketIOServer } from 'socket.io';
import { createServer } from 'node:http';

import { 
  createNamespacedSocketHandler, 
  validateSessionTypeRegistration,
  getNamespaceStats 
} from '../../src/lib/server/namespaced-socket-handler.js';
import { sessionTypeRegistry } from '../../src/lib/session-types/registry.js';
import { initializeSessionTypes, SESSION_TYPE_HANDLERS } from '../../src/lib/session-types/index.js';

describe('Namespace Isolation Functional Tests', () => {
  let httpServer;
  let io;

  beforeEach(() => {
    // Create HTTP server and Socket.IO server
    httpServer = createServer();
    io = new SocketIOServer(httpServer);

    // Clear registry and initialize session types
    sessionTypeRegistry.types.clear();
    initializeSessionTypes();
  });

  afterEach(() => {
    if (io) {
      io.close();
    }
    if (httpServer) {
      httpServer.close();
    }
    sessionTypeRegistry.types.clear();
  });

  describe('Session Type Registration', () => {
    it('should register shell session type', () => {
      const types = sessionTypeRegistry.list();
      expect(types.length).toBe(1);
      expect(types[0].id).toBe('shell');
      expect(types[0].name).toBe('Shell Terminal');
      expect(types[0].namespace).toBe('/shell');
    });

    it('should validate session type registration', () => {
      expect(() => validateSessionTypeRegistration()).not.toThrow();
    });

    it('should have handler for shell session type', () => {
      expect(SESSION_TYPE_HANDLERS['shell']).toBeDefined();
      expect(typeof SESSION_TYPE_HANDLERS['shell']).toBe('function');
    });
  });

  describe('Namespace Creation', () => {
    it('should create isolated namespaces', () => {
      createNamespacedSocketHandler(io);

      // Verify namespace was created
      const shellNamespace = io.of('/shell');
      expect(shellNamespace).toBeDefined();
      expect(shellNamespace.name).toBe('/shell');
    });

    it('should create multiple namespaces if multiple session types exist', () => {
      // Add a mock second session type for testing
      const mockSessionType = {
        id: 'test',
        name: 'Test Session',
        description: 'Test session type',
        category: 'test',
        namespace: '/test',
        supportsCapability: true,
        supportsAttachment: true,
        onCreate: async () => ({}),
        onAttach: async () => true,
        onDestroy: async () => {}
      };

      sessionTypeRegistry.register(mockSessionType);
      
      createNamespacedSocketHandler(io);

      // Verify both namespaces exist
      const shellNamespace = io.of('/shell');
      const testNamespace = io.of('/test');
      
      expect(shellNamespace).toBeDefined();
      expect(testNamespace).toBeDefined();
      expect(shellNamespace.name).toBe('/shell');
      expect(testNamespace.name).toBe('/test');
    });

    it('should handle empty registry gracefully', () => {
      // Clear all session types
      sessionTypeRegistry.types.clear();
      
      // Should not throw
      expect(() => createNamespacedSocketHandler(io)).not.toThrow();
    });
  });

  describe('Handler Registration', () => {
    it('should register handlers for each session type', () => {
      createNamespacedSocketHandler(io);
      
      const shellNamespace = io.of('/shell');
      
      // Verify namespace exists and has event listeners
      expect(shellNamespace).toBeDefined();
      expect(shellNamespace.eventNames()).toContain('connection');
    });

    it('should use static handler imports', () => {
      // Verify shell handlers are statically imported
      expect(SESSION_TYPE_HANDLERS).toHaveProperty('shell');
      expect(typeof SESSION_TYPE_HANDLERS.shell).toBe('function');
    });
  });

  describe('Namespace Statistics', () => {
    it('should provide namespace statistics', () => {
      createNamespacedSocketHandler(io);
      
      const stats = getNamespaceStats(io);
      
      expect(stats).toHaveProperty('totalNamespaces');
      expect(stats).toHaveProperty('totalConnections'); 
      expect(stats).toHaveProperty('sessionTypes');
      expect(stats).toHaveProperty('mainNamespaceConnections');
      
      expect(stats.totalNamespaces).toBe(1); // shell namespace
      expect(stats.sessionTypes.length).toBe(1);
      expect(stats.sessionTypes[0].id).toBe('shell');
      expect(stats.sessionTypes[0].namespace).toBe('/shell');
    });
  });

  describe('Error Handling', () => {
    it('should validate against duplicate namespaces', () => {
      // Create duplicate namespace scenario
      const duplicateSessionType = {
        id: 'duplicate',
        name: 'Duplicate Session',
        description: 'Duplicate namespace test',
        category: 'test',
        namespace: '/shell', // Same as shell session type
        supportsCapability: true,
        supportsAttachment: false,
        onCreate: async () => ({}),
        onDestroy: async () => {}
      };

      sessionTypeRegistry.register(duplicateSessionType);
      
      // Should throw validation error
      expect(() => validateSessionTypeRegistration()).toThrow('Duplicate namespace');
    });

    it('should validate handler existence', () => {
      // Create session type without handler
      const noHandlerSessionType = {
        id: 'no-handler',
        name: 'No Handler Session',
        description: 'Session type without handler',
        category: 'test',
        namespace: '/no-handler',
        supportsCapability: false,
        supportsAttachment: false,
        onCreate: async () => ({}),
        onDestroy: async () => {}
      };

      sessionTypeRegistry.register(noHandlerSessionType);
      
      // Should throw validation error
      expect(() => validateSessionTypeRegistration()).toThrow('No handler registered for session type: no-handler');
    });

    it('should validate against reserved namespaces', () => {
      // Create session type with reserved namespace
      const reservedSessionType = {
        id: 'admin',
        name: 'Admin Session',
        description: 'Admin session type',
        category: 'system',
        namespace: '/admin', // Reserved namespace
        supportsCapability: false,
        supportsAttachment: false,
        onCreate: async () => ({}),
        onDestroy: async () => {}
      };

      sessionTypeRegistry.register(reservedSessionType);
      
      // Should throw validation error
      expect(() => validateSessionTypeRegistration()).toThrow('Reserved namespace not allowed: /admin');
    });
  });

  describe('Session Type Capabilities', () => {
    it('should expose session type capabilities correctly', () => {
      const shellType = sessionTypeRegistry.get('shell');
      
      expect(shellType).toBeDefined();
      expect(typeof shellType.supportsCapability).toBe('function');
      expect(shellType.supportsAttachment).toBe(true);
      expect(shellType.category).toBe('terminal');
    });

    it('should support session type enumeration', () => {
      const allTypes = sessionTypeRegistry.list();
      const terminalTypes = sessionTypeRegistry.getByCategory('terminal');
      const categories = sessionTypeRegistry.getCategories();
      
      expect(allTypes.length).toBe(1);
      expect(terminalTypes.length).toBe(1);
      expect(categories).toContain('terminal');
      expect(terminalTypes[0].id).toBe('shell');
    });
  });
});