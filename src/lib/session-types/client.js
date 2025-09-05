/**
 * Client-side Session Types - UI metadata only
 * 
 * This module provides session type metadata for client-side UI purposes
 * without importing any server-side code that would leak into the browser bundle.
 */

import { sessionTypeRegistry } from './registry.js';
import { BaseSessionType } from './shared/BaseSessionType.js';

/**
 * Client-side shell session type metadata
 */
class ClientShellSessionType extends BaseSessionType {
  constructor() {
    super({
      id: 'shell',
      name: 'Shell Terminal',
      description: 'Standard shell terminal session with PTY support',
      category: 'terminal',
      namespace: '/shell',
      requiresProject: false,
      supportsAttachment: true,
      defaultOptions: {
        shell: '/bin/bash',
        cols: 80,
        rows: 24,
        env: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      }
    });
  }

  // Client-side validation only - no server operations
  validate(options) {
    const errors = [];
    
    if (options.cols && (options.cols < 10 || options.cols > 500)) {
      errors.push('Terminal columns must be between 10 and 500');
    }
    
    if (options.rows && (options.rows < 5 || options.rows > 200)) {
      errors.push('Terminal rows must be between 5 and 200');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  supportsCapability(capability) {
    const shellCapabilities = ['create', 'attach', 'destroy', 'resize', 'input'];
    return shellCapabilities.includes(capability);
  }
}

/**
 * Client-side claude session type metadata
 */
class ClientClaudeSessionType extends BaseSessionType {
  constructor() {
    super({
      id: 'claude',
      name: 'Claude Code Session',
      description: 'AI-assisted development with Claude',
      category: 'ai',
      namespace: '/claude',
      requiresProject: true,
      supportsAttachment: true,
      defaultOptions: {
        cols: 100,
        rows: 30,
        env: {
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor'
        }
      }
    });
  }

  validate(options) {
    const errors = [];
    
    if (this.requiresProject && !options.projectId) {
      errors.push('Claude sessions require a project');
    }
    
    if (options.cols && (options.cols < 10 || options.cols > 500)) {
      errors.push('Terminal columns must be between 10 and 500');
    }
    
    if (options.rows && (options.rows < 5 || options.rows > 200)) {
      errors.push('Terminal rows must be between 5 and 200');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  supportsCapability(capability) {
    const claudeCapabilities = ['create', 'attach', 'destroy', 'resize', 'input'];
    return claudeCapabilities.includes(capability);
  }
}

// Create client-side instances
export const clientShellSessionType = new ClientShellSessionType();
export const clientClaudeSessionType = new ClientClaudeSessionType();

/**
 * Initialize session types registry for client-side use
 * This function registers only metadata without server-side functionality
 */
export function initializeClientSessionTypes() {
  console.log('Initializing client-side session type registry...');
  
  // Register client-side session types (metadata only)
  sessionTypeRegistry.register(clientShellSessionType);
  sessionTypeRegistry.register(clientClaudeSessionType);
  
  sessionTypeRegistry.initialized = true;
  
  const typeCount = sessionTypeRegistry.list().length;
  console.log(`Client session type registry initialized with ${typeCount} types`);
  
  // Log registered types for debugging
  if (typeCount > 0) {
    const types = sessionTypeRegistry.list().map(t => `${t.name} (${t.id})`).join(', ');
    console.log(`Registered client session types: ${types}`);
  }
}

/**
 * Client-side registry utility functions
 */

/**
 * Get session type by ID
 * @param {string} typeId - Session type identifier
 * @returns {BaseSessionType|undefined} Session type or undefined
 */
export function getSessionType(typeId) {
  return sessionTypeRegistry.get(typeId);
}

/**
 * Get all registered session types
 * @returns {Array<BaseSessionType>} All registered session types
 */
export function getAllSessionTypes() {
  return sessionTypeRegistry.list();
}

/**
 * Get session types by category
 * @param {string} category - Category to filter by
 * @returns {Array<BaseSessionType>} Session types in category
 */
export function getSessionTypesByCategory(category) {
  return sessionTypeRegistry.getByCategory(category);
}

/**
 * Check if a session type is registered
 * @param {string} typeId - Session type identifier
 * @returns {boolean} True if registered
 */
export function hasSessionType(typeId) {
  return sessionTypeRegistry.has(typeId);
}

/**
 * Get available categories
 * @returns {Array<string>} Unique categories
 */
export function getAvailableCategories() {
  return sessionTypeRegistry.getCategories();
}