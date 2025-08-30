// src/lib/server/name-validation.js
/**
 * Session name validation utilities for Dispatch
 */

/**
 * Validates if a session name meets requirements
 * @param {string} name - The session name to validate
 * @returns {boolean} True if valid, false otherwise
 */
export function validateSessionName(name) {
  if (!name || typeof name !== 'string') {
    return false;
  }

  // Trim and check for empty string
  const trimmed = name.trim();
  if (!trimmed || trimmed.length === 0) {
    return false;
  }

  // Check length constraints (1-50 characters)
  if (trimmed.length > 50) {
    return false;
  }

  // Check for valid characters: alphanumeric, spaces, hyphens, underscores
  const validPattern = /^[a-zA-Z0-9\s_-]+$/;
  if (!validPattern.test(trimmed)) {
    return false;
  }

  return true;
}

/**
 * Sanitizes a session name for filesystem use
 * @param {string} name - The session name to sanitize
 * @returns {string} Sanitized name safe for filesystem use
 */
export function sanitizeSessionName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  // Trim whitespace
  let sanitized = name.trim();
  
  // Return empty string if nothing left after trim
  if (!sanitized) {
    return '';
  }

  // Replace invalid characters with hyphens
  sanitized = sanitized.replace(/[^a-zA-Z0-9\s_-]/g, '-');
  
  // Replace multiple spaces/hyphens with single hyphen
  sanitized = sanitized.replace(/[\s-]+/g, '-');
  
  // Convert to lowercase for filesystem consistency
  sanitized = sanitized.toLowerCase();
  
  // Remove leading/trailing hyphens
  sanitized = sanitized.replace(/^-+|-+$/g, '');
  
  return sanitized;
}

/**
 * Generates a fallback name using session ID
 * @param {string} sessionId - The session UUID
 * @returns {string} Fallback session name
 */
export function generateFallbackName(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return 'Session';
  }

  // Use first 8 characters of session ID, or full ID if shorter
  const idPart = sessionId.length >= 8 ? sessionId.slice(0, 8) : sessionId;
  return `Session ${idPart}`;
}

/**
 * Resolves name conflicts by adding incremental suffix
 * @param {string} desiredName - The desired session name
 * @param {Array<string>} existingNames - Array of existing session names
 * @returns {string} Unique session name
 */
export function resolveNameConflict(desiredName, existingNames) {
  if (!existingNames || !Array.isArray(existingNames)) {
    return desiredName;
  }

  // If no conflict, return original name
  if (!existingNames.includes(desiredName)) {
    return desiredName;
  }

  // Find next available number
  let counter = 2;
  let candidateName;
  
  do {
    candidateName = `${desiredName} (${counter})`;
    counter++;
  } while (existingNames.includes(candidateName) && counter < 100); // Safety limit
  
  return candidateName;
}