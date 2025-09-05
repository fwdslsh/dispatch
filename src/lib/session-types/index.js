/**
 * Session Types - Main entry point for session type system
 * 
 * This module provides manual registration of session types with static imports
 * for optimal build-time optimization and tree shaking.
 */

import { sessionTypeRegistry } from './registry.js';

// Static imports for build-time optimization
// Import client-side session type implementations here for static bundling
import { shellSessionType } from './shell/client.js';
import { claudeSessionType } from './claude/client.js';

/**
 * Initialize session types registry with manual registration
 * This function should be called during application startup
 */
export function initializeSessionTypes() {
  console.log('Initializing session type registry...');
  
  // Manual registration - explicit and controlled
  // Register implemented session types:
  
  sessionTypeRegistry.register(shellSessionType);
  sessionTypeRegistry.register(claudeSessionType);
  
  // Future session types would be added here manually:
  // sessionTypeRegistry.register(jupyterSessionType);
  // sessionTypeRegistry.register(dockerSessionType);
  
  sessionTypeRegistry.initialized = true;
  
  const typeCount = sessionTypeRegistry.list().length;
  console.log(`Session type registry initialized with ${typeCount} types`);
  
  // Log registered types for debugging
  if (typeCount > 0) {
    const types = sessionTypeRegistry.list().map(t => `${t.name} (${t.id})`).join(', ');
    console.log(`Registered session types: ${types}`);
  }
}

/**
 * Static handler map for WebSocket handlers
 * This is a placeholder - actual handlers are loaded server-side
 */
export const SESSION_TYPE_HANDLERS = {
  // Handlers are dynamically loaded on server-side only
};

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

/**
 * Get WebSocket handler factory for session type
 * @param {string} typeId - Session type identifier
 * @returns {Function|undefined} Handler factory function or undefined
 */
export function getSessionTypeHandler(typeId) {
  return SESSION_TYPE_HANDLERS[typeId];
}

/**
 * Validate session type registration before startup
 * This helps catch configuration errors early
 */
export function validateRegistration() {
  const errors = [];
  const types = sessionTypeRegistry.list();
  
  // Check for duplicate namespaces
  const namespaces = new Set();
  for (const type of types) {
    if (namespaces.has(type.namespace)) {
      errors.push(`Duplicate namespace: ${type.namespace}`);
    }
    namespaces.add(type.namespace);
  }
  
  // Note: Handler validation is done server-side only
  
  if (errors.length > 0) {
    console.error('Session type registration validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error(`Session type validation failed: ${errors.join(', ')}`);
  }
  
  console.log('Session type registration validation passed');
  return true;
}

// Export the registry for direct access when needed
export { sessionTypeRegistry };

// Export static session type references for build optimization
// These will be populated as session types are implemented:
// export { shellSessionType, claudeSessionType };

// Export base classes for extension
export { BaseSessionType } from './shared/BaseSessionType.js';
export { SessionTypeRegistry } from './registry.js';

// Export shared utilities
export * from './shared/SessionTypeUtils.js';
export * from './shared/ValidationUtils.js';