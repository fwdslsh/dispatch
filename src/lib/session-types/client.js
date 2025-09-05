/**
 * Client-side Session Types - UI metadata only
 * 
 * This module provides session type metadata for client-side UI purposes
 * without importing any server-side code that would leak into the browser bundle.
 */

import { CLIENT_SESSION_TYPES, getAllSessionTypes, getSessionType, hasSessionType, getSessionTypesByCategory } from './simple-session-types.js';
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
 * Initialize client-side session types (simplified)
 * No complex registry needed - just validates configuration
 */
export function initializeClientSessionTypes() {
  console.log('Initializing client-side session types with simple static configuration...');
  
  const types = getAllSessionTypes();
  const typeCount = types.length;
  console.log(`Client session types initialized: ${typeCount} types available`);
  
  // Log available types for debugging
  if (typeCount > 0) {
    const typeNames = types.map(t => `${t.name} (${t.id})`).join(', ');
    console.log(`Available client session types: ${typeNames}`);
  }
  
  return true;
}

// Re-export utility functions from simple-session-types
export { getAllSessionTypes, getSessionType, getSessionTypesByCategory, hasSessionType };

/**
 * Get available categories
 * @returns {Array<string>} Unique categories
 */
export function getAvailableCategories() {
  const categories = new Set();
  getAllSessionTypes().forEach(type => {
    if (type.category) categories.add(type.category);
  });
  return Array.from(categories);
}