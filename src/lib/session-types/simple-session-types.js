/**
 * Simple Session Types Configuration
 * 
 * Static configuration without complex runtime registry.
 * Just imports and exports session types directly.
 */

// Import session type client implementations
import { shellSessionType } from './shell/client.js';
import { claudeSessionType } from './claude/client.js';

/**
 * Available session types (static list)
 */
export const SESSION_TYPES = {
  shell: {
    id: 'shell',
    name: 'Shell Terminal',
    description: 'Standard shell terminal session',
    category: 'terminal',
    namespace: '/shell',
    requiresProject: false,
    icon: 'terminal',
    defaultOptions: {
      shell: '/bin/bash',
      cols: 80,
      rows: 24
    }
  },
  
  claude: {
    id: 'claude',
    name: 'Claude Code Session', 
    description: 'AI-assisted development with Claude',
    category: 'ai',
    namespace: '/claude',
    requiresProject: true,
    icon: 'ai',
    defaultOptions: {
      cols: 120,
      rows: 30
    }
  }
};

/**
 * Simple utilities for session types
 */

// Get all session types as array
export function getAllSessionTypes() {
  return Object.values(SESSION_TYPES);
}

// Get session type by ID
export function getSessionType(id) {
  return SESSION_TYPES[id] || null;
}

// Get session types by category
export function getSessionTypesByCategory(category) {
  return Object.values(SESSION_TYPES).filter(type => type.category === category);
}

// Check if session type exists
export function hasSessionType(id) {
  return id in SESSION_TYPES;
}

// Get session types that require projects
export function getProjectSessionTypes() {
  return Object.values(SESSION_TYPES).filter(type => type.requiresProject);
}

// Get session types that don't require projects
export function getStandaloneSessionTypes() {
  return Object.values(SESSION_TYPES).filter(type => !type.requiresProject);
}

// Simple validation
export function isValidSessionType(id) {
  return hasSessionType(id);
}

// Get default options for a session type
export function getDefaultOptions(id) {
  const type = getSessionType(id);
  return type ? { ...type.defaultOptions } : {};
}

/**
 * Session type configuration for different contexts
 */

// For client-side component rendering
export const CLIENT_SESSION_TYPES = getAllSessionTypes();

// For server-side handler routing (used by namespaced socket handler)
export const SERVER_SESSION_TYPES = {
  shell: '/shell',
  claude: '/claude'
};

/**
 * Simple session type factory (replaces complex registry)
 */
export function createSessionTypeConfig(id, overrides = {}) {
  const baseType = getSessionType(id);
  if (!baseType) {
    throw new Error(`Unknown session type: ${id}`);
  }
  
  return {
    ...baseType,
    ...overrides,
    defaultOptions: {
      ...baseType.defaultOptions,
      ...overrides.defaultOptions
    }
  };
}