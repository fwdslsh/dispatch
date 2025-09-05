/**
 * Consolidated Session Utilities
 * 
 * Unified utilities for session management, validation, and creation.
 * Replaces duplicated functionality across SessionTypeUtils and ValidationUtils.
 */

import { VALIDATION_CONFIG, ERROR_CODES } from './constants.js';

/**
 * Session ID Generation
 */

/**
 * Generate session ID with type prefix
 * @param {string} type - Session type
 * @param {string} socketId - Socket ID
 * @returns {string} Generated session ID
 */
export function generateSessionId(type, socketId) {
  return `${type}-${socketId}-${Date.now()}`;
}

/**
 * Generate unique session ID (legacy format)
 * @returns {string} Unique session identifier
 */
export function generateUniqueSessionId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 9);
  return `sess_${timestamp}_${random}`;
}

/**
 * Session Validation
 */

/**
 * Validate required fields in data object
 * @param {Object} data - Data to validate
 * @param {Array<string>} requiredFields - Required field names
 * @param {Function} callback - Callback function for errors
 * @returns {boolean} True if valid, false if invalid
 */
export function validateRequiredFields(data, requiredFields, callback) {
  if (!data || typeof data !== 'object') {
    if (callback) callback({ success: false, error: 'Invalid data provided' });
    return false;
  }
  
  for (const field of requiredFields) {
    if (!data[field]) {
      if (callback) callback({ success: false, error: `${field} is required` });
      return false;
    }
  }
  
  return true;
}

/**
 * Validate session name
 * @param {string} name - Session name to validate
 * @returns {Object} Validation result with valid flag, errors, and sanitized name
 */
export function validateSessionName(name) {
  const errors = [];
  
  if (!name || typeof name !== 'string') {
    errors.push('Session name is required');
    return { valid: false, errors };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length === 0) {
    errors.push('Session name cannot be empty');
  }
  
  if (trimmed.length > 100) {
    errors.push('Session name must be 100 characters or less');
  }
  
  if (!VALIDATION_CONFIG.SESSION_NAME_PATTERN.test(trimmed)) {
    errors.push('Session name contains invalid characters');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: sanitizeSessionName(trimmed)
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
 * Validate terminal dimensions
 * @param {number} cols - Terminal columns
 * @param {number} rows - Terminal rows
 * @returns {Object} Validation result with normalized dimensions
 */
export function validateTerminalDimensions(cols, rows) {
  const errors = [];
  
  const normalizedCols = Math.max(10, Math.min(500, parseInt(cols) || 80));
  const normalizedRows = Math.max(5, Math.min(200, parseInt(rows) || 24));
  
  if (cols !== undefined && (cols < 10 || cols > 500)) {
    errors.push('Terminal columns must be between 10 and 500');
  }
  
  if (rows !== undefined && (rows < 5 || rows > 200)) {
    errors.push('Terminal rows must be between 5 and 200');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    normalized: { cols: normalizedCols, rows: normalizedRows }
  };
}

/**
 * Validate project ID
 * @param {string} projectId - Project ID to validate
 * @param {boolean} required - Whether project ID is required
 * @returns {Object} Validation result
 */
export function validateProjectId(projectId, required = false) {
  const errors = [];
  
  if (!projectId) {
    if (required) {
      errors.push('Project ID is required');
    }
    return { valid: !required, errors };
  }
  
  if (typeof projectId !== 'string') {
    errors.push('Project ID must be a string');
    return { valid: false, errors };
  }
  
  const trimmed = projectId.trim();
  
  if (trimmed.length < 3) {
    errors.push('Project ID must be at least 3 characters');
  }
  
  if (trimmed.length > 50) {
    errors.push('Project ID must be at most 50 characters');
  }
  
  if (!/^[a-zA-Z0-9\-_]+$/.test(trimmed)) {
    errors.push('Project ID can only contain letters, numbers, hyphens, and underscores');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate session creation options
 * @param {Object} options - Options to validate
 * @param {Object} requirements - Requirements specification
 * @returns {Object} Validation result with valid flag and errors
 */
export function validateSessionOptions(options, requirements = {}) {
  const errors = [];
  
  // Validate session name
  if (requirements.requiresName || options.name) {
    const nameValidation = validateSessionName(options.name);
    if (!nameValidation.valid) {
      errors.push(...nameValidation.errors);
    }
  }
  
  // Validate project ID
  if (requirements.requiresProject || options.projectId) {
    const projectValidation = validateProjectId(options.projectId, requirements.requiresProject);
    if (!projectValidation.valid) {
      errors.push(...projectValidation.errors);
    }
  }
  
  // Validate terminal dimensions
  const dimensionsValidation = validateTerminalDimensions(options.cols, options.rows);
  if (!dimensionsValidation.valid) {
    errors.push(...dimensionsValidation.errors);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    normalized: dimensionsValidation.normalized
  };
}

/**
 * Session Object Creation
 */

/**
 * Create standard session object
 * @param {string} sessionId - Session ID
 * @param {string} type - Session type
 * @param {Object} options - Session options
 * @param {Object} socket - Socket instance
 * @returns {Object} Session object
 */
export function createSessionObject(sessionId, type, options, socket) {
  return {
    sessionId,
    type,
    name: sanitizeSessionName(options.name) || `${type.charAt(0).toUpperCase() + type.slice(1)} Session`,
    created: new Date().toISOString(),
    status: 'active',
    socket,
    ...options
  };
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
 * @returns {Object} Merged options with normalized dimensions
 */
export function mergeSessionOptions(options, defaults) {
  const merged = {
    ...defaults,
    ...options
  };
  
  // Normalize terminal dimensions
  const dimensionsValidation = validateTerminalDimensions(merged.cols, merged.rows);
  merged.cols = dimensionsValidation.normalized.cols;
  merged.rows = dimensionsValidation.normalized.rows;
  
  return merged;
}

/**
 * Utility Functions
 */

/**
 * Log session operation
 * @param {string} operation - Operation name
 * @param {string} sessionId - Session ID
 * @param {Object} details - Additional details to log
 */
export function logSessionOperation(operation, sessionId, details = {}) {
  const detailsStr = Object.keys(details).length > 0 ? JSON.stringify(details) : '';
  console.log(`${operation}: ${sessionId}${detailsStr ? ' ' + detailsStr : ''}`);
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
    requiresProject: sessionType.requiresProject ?? true,
    defaultOptions: sessionType.defaultOptions || {}
  };
}