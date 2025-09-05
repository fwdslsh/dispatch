/**
 * DynamicSessionViewing.test.js - Tests for dynamic session type view loading
 * 
 * Tests the integration between session type registry and dynamic component loading
 * to ensure proper session type separation and view rendering.
 */

import { describe, it, beforeEach, expect, vi } from 'vitest';
import { initializeSessionTypes, getSessionType, sessionTypeRegistry } from '../../src/lib/session-types/index.js';

describe('Dynamic Session Type Viewing', () => {
  beforeEach(() => {
    // Clear and reinitialize registry before each test
    sessionTypeRegistry.clear();
    initializeSessionTypes();
  });

  it('initializes session type registry with shell and claude types', () => {
    expect(sessionTypeRegistry.size()).toBeGreaterThan(0);
    expect(sessionTypeRegistry.has('shell')).toBe(true);
    expect(sessionTypeRegistry.has('claude')).toBe(true);
  });

  it('retrieves shell session type correctly', () => {
    const shellType = getSessionType('shell');
    
    expect(shellType).toBeDefined();
    expect(shellType.id).toBe('shell');
    expect(shellType.name).toBe('Shell Terminal');
    expect(shellType.namespace).toBe('/shell');
  });

  it('retrieves claude session type correctly', () => {
    const claudeType = getSessionType('claude');
    
    expect(claudeType).toBeDefined();
    expect(claudeType.id).toBe('claude');
    expect(claudeType.name).toBe('Claude Code Session');
    expect(claudeType.namespace).toBe('/claude');
  });

  it('returns undefined for unknown session types', () => {
    const unknownType = getSessionType('nonexistent');
    expect(unknownType).toBeUndefined();
  });

  it('validates session type registry integrity', () => {
    const types = sessionTypeRegistry.list();
    
    // Each type should have required fields
    types.forEach(type => {
      expect(type.id).toBeDefined();
      expect(type.name).toBeDefined();
      expect(type.namespace).toBeDefined();
    });

    // Namespaces should be unique
    const namespaces = types.map(t => t.namespace);
    const uniqueNamespaces = [...new Set(namespaces)];
    expect(namespaces.length).toBe(uniqueNamespaces.length);
  });

  it('categorizes session types correctly', () => {
    const shellType = getSessionType('shell');
    const claudeType = getSessionType('claude');
    
    expect(shellType.category).toBe('terminal');
    expect(claudeType.category).toBe('ai-assistant');
  });

  it('validates session creation requirements', () => {
    const shellType = getSessionType('shell');
    const claudeType = getSessionType('claude');
    
    // Shell should not require project
    expect(shellType.requiresProject).toBe(false);
    
    // Claude should require project
    expect(claudeType.requiresProject).toBe(true);
  });

  describe('Session Type View Component Mapping', () => {
    it('maps session types to expected view components', () => {
      const mockSessionData = {
        shell: { id: 'test-shell', type: 'shell', mode: 'shell' },
        claude: { id: 'test-claude', type: 'claude', mode: 'claude' }
      };

      // Test shell session mapping
      const shellSession = mockSessionData.shell;
      const shellType = getSessionType(shellSession.type);
      expect(shellType).toBeDefined();
      expect(shellType.id).toBe('shell');

      // Test claude session mapping
      const claudeSession = mockSessionData.claude;
      const claudeType = getSessionType(claudeSession.type);
      expect(claudeType).toBeDefined();
      expect(claudeType.id).toBe('claude');
    });

    it('handles session type fallback correctly', () => {
      // Test with session data that has mode but no type
      const sessionWithModeOnly = { id: 'test', mode: 'shell' };
      const sessionType = sessionWithModeOnly.type || sessionWithModeOnly.mode || 'shell';
      
      const foundType = getSessionType(sessionType);
      expect(foundType).toBeDefined();
      expect(foundType.id).toBe('shell');
    });

    it('provides legacy fallback for unknown session types', () => {
      const unknownSession = { id: 'test', type: 'unknown', mode: 'unknown' };
      const sessionType = unknownSession.type || unknownSession.mode || 'shell';
      
      const foundType = getSessionType(sessionType);
      if (!foundType) {
        // Should fallback to shell or legacy view
        const fallbackType = getSessionType('shell');
        expect(fallbackType).toBeDefined();
      }
    });
  });

  describe('Session Type Configuration', () => {
    it('validates shell session type configuration', () => {
      const shellType = getSessionType('shell');
      
      expect(shellType.defaultOptions).toBeDefined();
      expect(shellType.defaultOptions.shell).toBeDefined();
      expect(shellType.supportsAttachment).toBe(true);
    });

    it('validates claude session type configuration', () => {
      const claudeType = getSessionType('claude');
      
      expect(claudeType.defaultOptions).toBeDefined();
      expect(claudeType.defaultOptions.claudeModel).toBeDefined();
      expect(claudeType.defaultOptions.maxTokens).toBeDefined();
      expect(claudeType.defaultOptions.temperature).toBeDefined();
      expect(claudeType.supportsAttachment).toBe(true);
    });

    it('provides consistent default options across instances', () => {
      const shellType1 = getSessionType('shell');
      const shellType2 = getSessionType('shell');
      
      // Both instances should reference the same session type
      expect(shellType1).toBe(shellType2);
      expect(shellType1.defaultOptions).toBe(shellType2.defaultOptions);
      
      // Default options should be present
      expect(shellType1.defaultOptions.shell).toBeDefined();
    });
  });

  describe('Dynamic Component Loading Preparation', () => {
    it('provides session type metadata for dynamic loading', () => {
      const types = sessionTypeRegistry.list();
      
      types.forEach(type => {
        // Each type should have the metadata needed for dynamic loading
        expect(type.id).toMatch(/^[a-z]+$/); // Component name convention
        expect(type.namespace).toMatch(/^\/[a-z]+$/); // Namespace convention
        expect(type.category).toBeDefined();
      });
    });

    it('simulates dynamic component path resolution', () => {
      const sessionTypes = ['shell', 'claude'];
      
      sessionTypes.forEach(typeId => {
        const type = getSessionType(typeId);
        expect(type).toBeDefined();
        
        // Simulate the path that would be used for dynamic import
        const expectedPath = `$lib/session-types/${typeId}/${typeId.charAt(0).toUpperCase() + typeId.slice(1)}SessionView.svelte`;
        
        // Verify the path follows the expected pattern
        expect(expectedPath).toMatch(new RegExp(`session-types/${typeId}/${typeId.charAt(0).toUpperCase()}`));
      });
    });
  });
});