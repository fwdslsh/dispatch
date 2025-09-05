import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BaseSessionType } from '../../src/lib/session-types/base/BaseSessionType.js';

describe('BaseSessionType', () => {
  let config;
  let sessionType;

  beforeEach(() => {
    config = {
      id: 'test-session',
      name: 'Test Session',
      description: 'A test session type',
      category: 'testing',
      namespace: '/test',
      requiresProject: true,
      supportsAttachment: true,
      defaultOptions: {
        option1: 'value1',
        option2: 42
      }
    };
    sessionType = new BaseSessionType(config);
  });

  describe('constructor', () => {
    it('should initialize with provided config', () => {
      expect(sessionType.id).toBe('test-session');
      expect(sessionType.name).toBe('Test Session');
      expect(sessionType.description).toBe('A test session type');
      expect(sessionType.category).toBe('testing');
      expect(sessionType.namespace).toBe('/test');
      expect(sessionType.requiresProject).toBe(true);
      expect(sessionType.supportsAttachment).toBe(true);
      expect(sessionType.defaultOptions).toEqual({ option1: 'value1', option2: 42 });
    });

    it('should use default values for optional fields', () => {
      const minimalConfig = {
        id: 'minimal',
        name: 'Minimal Type'
      };
      const minimal = new BaseSessionType(minimalConfig);

      expect(minimal.description).toBe('');
      expect(minimal.version).toBe('1.0.0');
      expect(minimal.category).toBe('general');
      expect(minimal.namespace).toBe('/minimal'); // Defaults to /${id}
      expect(minimal.requiresProject).toBe(true);
      expect(minimal.supportsAttachment).toBe(true);
      expect(minimal.defaultOptions).toEqual({});
    });

    it('should handle custom namespace', () => {
      const customConfig = {
        id: 'custom',
        name: 'Custom Type',
        namespace: '/custom-namespace'
      };
      const custom = new BaseSessionType(customConfig);
      expect(custom.namespace).toBe('/custom-namespace');
    });

    it('should handle boolean configuration options', () => {
      const boolConfig = {
        id: 'bool-test',
        name: 'Bool Test',
        requiresProject: false,
        supportsAttachment: false
      };
      const boolType = new BaseSessionType(boolConfig);
      expect(boolType.requiresProject).toBe(false);
      expect(boolType.supportsAttachment).toBe(false);
    });
  });

  describe('lifecycle hooks', () => {
    describe('onCreate', () => {
      it('should throw error by default (must be implemented)', async () => {
        const options = { name: 'test' };
        const socket = { id: 'socket123' };

        await expect(sessionType.onCreate(options, socket))
          .rejects
          .toThrow('onCreate must be implemented by session type');
      });
    });

    describe('onAttach', () => {
      it('should return false by default (attachment not supported)', async () => {
        const sessionId = 'sess123';
        const socket = { id: 'socket123' };

        const result = await sessionType.onAttach(sessionId, socket);
        expect(result).toBe(false);
      });
    });

    describe('onDestroy', () => {
      it('should not throw error by default', async () => {
        const sessionId = 'sess123';
        await expect(sessionType.onDestroy(sessionId)).resolves.toBeUndefined();
      });
    });

    describe('validate', () => {
      it('should return valid result by default', () => {
        const options = { name: 'test' };
        const result = sessionType.validate(options);
        
        expect(result).toEqual({
          valid: true,
          errors: []
        });
      });
    });
  });

  describe('lifecycle hook overrides', () => {
    it('should allow onCreate to be overridden', async () => {
      class CustomSessionType extends BaseSessionType {
        async onCreate(options, socket) {
          return {
            id: 'sess123',
            name: options.name || 'Custom Session',
            type: this.id,
            status: 'active',
            created: new Date().toISOString()
          };
        }
      }

      const custom = new CustomSessionType({
        id: 'custom',
        name: 'Custom Type'
      });

      const options = { name: 'My Session' };
      const socket = { id: 'socket123' };

      const result = await custom.onCreate(options, socket);
      expect(result.id).toBe('sess123');
      expect(result.name).toBe('My Session');
      expect(result.type).toBe('custom');
      expect(result.status).toBe('active');
    });

    it('should allow onAttach to be overridden', async () => {
      class AttachableSessionType extends BaseSessionType {
        async onAttach(sessionId, socket) {
          return sessionId === 'valid-session';
        }
      }

      const attachable = new AttachableSessionType({
        id: 'attachable',
        name: 'Attachable Type'
      });

      const socket = { id: 'socket123' };

      expect(await attachable.onAttach('valid-session', socket)).toBe(true);
      expect(await attachable.onAttach('invalid-session', socket)).toBe(false);
    });

    it('should allow validate to be overridden', () => {
      class ValidatingSessionType extends BaseSessionType {
        validate(options) {
          const errors = [];
          
          if (!options.name) {
            errors.push('Name is required');
          }
          
          if (options.name && options.name.length < 3) {
            errors.push('Name must be at least 3 characters');
          }

          return {
            valid: errors.length === 0,
            errors
          };
        }
      }

      const validating = new ValidatingSessionType({
        id: 'validating',
        name: 'Validating Type'
      });

      // Valid options
      expect(validating.validate({ name: 'Valid Name' })).toEqual({
        valid: true,
        errors: []
      });

      // Invalid options - missing name
      expect(validating.validate({})).toEqual({
        valid: false,
        errors: ['Name is required']
      });

      // Invalid options - name too short
      expect(validating.validate({ name: 'Hi' })).toEqual({
        valid: false,
        errors: ['Name must be at least 3 characters']
      });
    });
  });

  describe('version handling', () => {
    it('should accept custom version', () => {
      const versionedConfig = {
        id: 'versioned',
        name: 'Versioned Type',
        version: '2.1.0'
      };
      const versioned = new BaseSessionType(versionedConfig);
      expect(versioned.version).toBe('2.1.0');
    });

    it('should default to 1.0.0 when not specified', () => {
      expect(sessionType.version).toBe('1.0.0');
    });
  });

  describe('configuration edge cases', () => {
    it('should handle null/undefined values gracefully', () => {
      const edgeCaseConfig = {
        id: 'edge-case',
        name: 'Edge Case',
        description: null,
        version: undefined,
        defaultOptions: null
      };

      const edgeCase = new BaseSessionType(edgeCaseConfig);
      expect(edgeCase.description).toBe('');
      expect(edgeCase.version).toBe('1.0.0');
      expect(edgeCase.defaultOptions).toEqual({});
    });
  });
});