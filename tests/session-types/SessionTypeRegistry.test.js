import { describe, it, expect, beforeEach } from 'vitest';
import { SessionTypeRegistry } from '../../src/lib/session-types/registry.js';
import { BaseSessionType } from '../../src/lib/session-types/base/BaseSessionType.js';

describe('SessionTypeRegistry', () => {
  let registry;
  let mockSessionType;

  beforeEach(() => {
    registry = new SessionTypeRegistry();
    mockSessionType = new BaseSessionType({
      id: 'test-type',
      name: 'Test Type',
      description: 'Test session type',
      category: 'testing',
      namespace: '/test'
    });
  });

  describe('constructor', () => {
    it('should initialize with empty types map', () => {
      expect(registry.types.size).toBe(0);
      expect(registry.initialized).toBe(false);
    });
  });

  describe('register', () => {
    it('should register a valid session type', () => {
      registry.register(mockSessionType);
      expect(registry.types.has('test-type')).toBe(true);
      expect(registry.get('test-type')).toBe(mockSessionType);
    });

    it('should throw error for invalid session type', () => {
      const invalidType = { id: 'invalid' }; // Missing required fields
      expect(() => registry.register(invalidType)).toThrow('Invalid session type: invalid');
    });

    it('should allow re-registration of same session type', () => {
      registry.register(mockSessionType);
      expect(() => registry.register(mockSessionType)).not.toThrow();
      expect(registry.types.size).toBe(1);
    });
  });

  describe('get', () => {
    it('should return registered session type', () => {
      registry.register(mockSessionType);
      expect(registry.get('test-type')).toBe(mockSessionType);
    });

    it('should return undefined for unregistered type', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should return empty array when no types registered', () => {
      expect(registry.list()).toEqual([]);
    });

    it('should return all registered session types', () => {
      const type2 = new BaseSessionType({
        id: 'type2',
        name: 'Type 2',
        description: 'Second type',
        category: 'testing',
        namespace: '/type2'
      });

      registry.register(mockSessionType);
      registry.register(type2);

      const types = registry.list();
      expect(types).toHaveLength(2);
      expect(types).toContain(mockSessionType);
      expect(types).toContain(type2);
    });
  });

  describe('getByCategory', () => {
    it('should return session types filtered by category', () => {
      const terminalType = new BaseSessionType({
        id: 'shell',
        name: 'Shell',
        description: 'Shell terminal',
        category: 'terminal',
        namespace: '/shell'
      });

      const devType = new BaseSessionType({
        id: 'claude',
        name: 'Claude',
        description: 'AI development',
        category: 'development',
        namespace: '/claude'
      });

      registry.register(terminalType);
      registry.register(devType);
      registry.register(mockSessionType); // testing category

      const terminalTypes = registry.getByCategory('terminal');
      expect(terminalTypes).toHaveLength(1);
      expect(terminalTypes[0]).toBe(terminalType);

      const devTypes = registry.getByCategory('development');
      expect(devTypes).toHaveLength(1);
      expect(devTypes[0]).toBe(devType);

      const testTypes = registry.getByCategory('testing');
      expect(testTypes).toHaveLength(1);
      expect(testTypes[0]).toBe(mockSessionType);
    });

    it('should return empty array for nonexistent category', () => {
      registry.register(mockSessionType);
      expect(registry.getByCategory('nonexistent')).toEqual([]);
    });
  });

  describe('validateSessionType', () => {
    it('should validate session type with all required fields', () => {
      expect(registry.validateSessionType(mockSessionType)).toBe(true);
    });

    it('should reject session type missing id', () => {
      const invalid = { name: 'Test', namespace: '/test' };
      expect(registry.validateSessionType(invalid)).toBe(false);
    });

    it('should reject session type missing name', () => {
      const invalid = { id: 'test', namespace: '/test' };
      expect(registry.validateSessionType(invalid)).toBe(false);
    });

    it('should reject session type missing namespace', () => {
      const invalid = { id: 'test', name: 'Test' };
      expect(registry.validateSessionType(invalid)).toBe(false);
    });

    it('should accept session type with extra fields', () => {
      const extended = {
        ...mockSessionType,
        extraField: 'extra value'
      };
      expect(registry.validateSessionType(extended)).toBe(true);
    });
  });

  describe('initialization tracking', () => {
    it('should track initialization state', () => {
      expect(registry.initialized).toBe(false);
      registry.register(mockSessionType);
      // Registry doesn't auto-set initialized, but tracks state for external use
      registry.initialized = true;
      expect(registry.initialized).toBe(true);
    });
  });
});