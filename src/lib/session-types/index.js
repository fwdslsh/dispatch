/**
 * Session Types - Main entry point for session type system
 * 
 * Static configuration without complex registry system.
 * Re-exports from session-types.js for clean interface.
 */

// Re-export everything from session-types for clean interface
export {
  SESSION_TYPES,
  getAllSessionTypes,
  getSessionType,
  getSessionTypesByCategory,
  hasSessionType,
  getProjectSessionTypes,
  getStandaloneSessionTypes,
  isValidSessionType,
  getDefaultOptions,
  CLIENT_SESSION_TYPES,
  SERVER_SESSION_TYPES,
  createSessionTypeConfig
} from './session-types.js';

// Re-export server configuration for server-side usage
export {
  SESSION_HANDLERS,
  SESSION_NAMESPACES,
  getHandlerCreator,
  getNamespace,
  getAvailableTypes,
  hasHandlers,
  createHandlersForType,
  setupSessionTypeNamespace
} from './server-config.js';

/**
 * Initialize session types
 * No complex initialization needed - just validates configuration
 */
export function initializeSessionTypes() {
  console.log('Session types initialized with static configuration');
  
  const types = getAllSessionTypes();
  const typeCount = types.length;
  console.log(`Available session types: ${typeCount}`);
  
  if (typeCount > 0) {
    const typeNames = types.map(t => `${t.name} (${t.id})`).join(', ');
    console.log(`Types: ${typeNames}`);
  }
  
  return true;
}

/**
 * Validate session type configuration
 * Simple validation without complex registry checking
 */
export function validateRegistration() {
  const types = getAllSessionTypes();
  const errors = [];
  
  // Check for duplicate namespaces
  const namespaces = new Set();
  for (const type of types) {
    if (namespaces.has(type.namespace)) {
      errors.push(`Duplicate namespace: ${type.namespace}`);
    }
    namespaces.add(type.namespace);
  }
  
  if (errors.length > 0) {
    console.error('Session type validation failed:');
    errors.forEach(error => console.error(`  - ${error}`));
    throw new Error(`Session type validation failed: ${errors.join(', ')}`);
  }
  
  console.log('Session type validation passed');
  return true;
}

// Legacy compatibility - functions already exported above
export const getAvailableCategories = () => {
  const categories = new Set();
  getAllSessionTypes().forEach(type => {
    if (type.category) categories.add(type.category);
  });
  return Array.from(categories);
};