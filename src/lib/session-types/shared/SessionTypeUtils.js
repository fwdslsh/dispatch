/**
 * Shared utilities for session type operations
 */

/**
 * Generate a unique session ID
 * @returns {string} Unique session identifier
 */
export function generateSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `sess_${timestamp}_${random}`;
}

/**
 * Validate session creation options
 * @param {Object} options - Options to validate
 * @param {Object} requirements - Requirements specification
 * @returns {Object} Validation result with valid flag and errors
 */
export function validateSessionOptions(options, requirements = {}) {
  const errors = [];
  
  // Check required fields
  if (requirements.requiresProject && !options.projectId) {
    errors.push('Project ID is required for this session type');
  }
  
  if (requirements.requiresName && (!options.name || options.name.trim().length === 0)) {
    errors.push('Session name is required');
  }
  
  // Validate name length
  if (options.name && options.name.length > 100) {
    errors.push('Session name must be 100 characters or less');
  }
  
  // Validate terminal dimensions
  if (options.cols !== undefined && (options.cols < 10 || options.cols > 500)) {
    errors.push('Terminal columns must be between 10 and 500');
  }
  
  if (options.rows !== undefined && (options.rows < 5 || options.rows > 200)) {
    errors.push('Terminal rows must be between 5 and 200');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize session name for safe usage
 * @param {string} name - Raw session name
 * @returns {string} Sanitized session name
 */
export function sanitizeSessionName(name) {
  if (!name) return 'Untitled Session';
  
  return name
    .trim()
    .replace(/[<>:"\/\\|?*]/g, '') // Remove invalid filename characters
    .substr(0, 100) // Limit length
    || 'Untitled Session';
}

/**
 * Create session metadata object
 * @param {Object} params - Session parameters
 * @returns {Object} Standard session metadata
 */
export function createSessionMetadata({
  id,
  name,
  type,
  projectId,
  status = 'active',
  customData = {}
}) {
  return {
    id,
    name: sanitizeSessionName(name) || id,
    type,
    projectId,
    status,
    created: new Date().toISOString(),
    customData
  };
}

/**
 * Merge session options with defaults
 * @param {Object} options - User-provided options
 * @param {Object} defaults - Default options
 * @returns {Object} Merged options
 */
export function mergeSessionOptions(options, defaults) {
  return {
    ...defaults,
    ...options,
    // Ensure terminal dimensions are reasonable
    cols: options.cols || defaults.cols || 80,
    rows: options.rows || defaults.rows || 24,
    // Merge custom options
    customOptions: {
      ...(defaults.customOptions || {}),
      ...(options.customOptions || {})
    }
  };
}

/**
 * Extract namespace from session type or use default
 * @param {Object} sessionType - Session type object
 * @returns {string} Socket.IO namespace
 */
export function getSessionNamespace(sessionType) {
  return sessionType.namespace || `/${sessionType.id}`;
}

/**
 * Check if session type supports a capability
 * @param {Object} sessionType - Session type object
 * @param {string} capability - Capability to check
 * @returns {boolean} True if supported
 */
export function sessionTypeSupports(sessionType, capability) {
  if (typeof sessionType.supportsCapability === 'function') {
    return sessionType.supportsCapability(capability);
  }
  
  // Default capability check
  const defaultCapabilities = ['create', 'destroy'];
  if (sessionType.supportsAttachment) {
    defaultCapabilities.push('attach');
  }
  
  return defaultCapabilities.includes(capability);
}

/**
 * Format session type summary for UI display
 * @param {Object} sessionType - Session type object
 * @returns {Object} Formatted summary
 */
export function formatSessionTypeSummary(sessionType) {
  return {
    id: sessionType.id,
    name: sessionType.name,
    description: sessionType.description || '',
    category: sessionType.category || 'general',
    version: sessionType.version || '1.0.0',
    capabilities: sessionTypeSupports(sessionType, 'attach') ? 
      ['create', 'destroy', 'attach'] : ['create', 'destroy'],
    requiresProject: sessionType.requiresProject ?? true
  };
}