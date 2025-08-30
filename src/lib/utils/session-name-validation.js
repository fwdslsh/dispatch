// src/lib/utils/session-name-validation.js
/**
 * Frontend session name validation utilities
 * Mirror of backend validation rules for client-side feedback
 */

/**
 * Validates if a session name meets requirements
 * @param {string} name - The session name to validate
 * @returns {{ isValid: boolean, error?: string }} Validation result
 */
export function validateSessionName(name) {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Name is required' };
  }

  // Trim and check for empty string
  const trimmed = name.trim();
  if (!trimmed || trimmed.length === 0) {
    return { isValid: false, error: 'Name cannot be empty' };
  }

  // Check length constraints (1-50 characters)
  if (trimmed.length > 50) {
    return { isValid: false, error: 'Name must be 50 characters or less' };
  }

  // Check for valid characters: alphanumeric, spaces, hyphens, underscores
  const validPattern = /^[a-zA-Z0-9\s_-]+$/;
  if (!validPattern.test(trimmed)) {
    return { isValid: false, error: 'Name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }

  return { isValid: true };
}

/**
 * Validates session name and returns user-friendly messages
 * @param {string} name - The session name to validate
 * @returns {{ isValid: boolean, message?: string, severity?: string }} Validation result with UI feedback
 */
export function validateSessionNameWithFeedback(name) {
  if (!name || !name.trim()) {
    // Empty is allowed (will fallback to generated name)
    return { isValid: true, message: 'Will use generated name if empty', severity: 'info' };
  }

  const result = validateSessionName(name);
  
  if (!result.isValid) {
    return { 
      isValid: false, 
      message: result.error, 
      severity: 'error' 
    };
  }

  const trimmed = name.trim();
  
  // Provide helpful feedback for valid names
  if (trimmed.length < 3) {
    return { 
      isValid: true, 
      message: 'Very short name', 
      severity: 'warning' 
    };
  }
  
  if (trimmed.length > 30) {
    return { 
      isValid: true, 
      message: 'Long name (max 50)', 
      severity: 'warning' 
    };
  }

  return { isValid: true };
}

/**
 * Real-time validation for input fields
 * @param {string} name - Current input value
 * @returns {{ isValid: boolean, message?: string, severity?: string }} Real-time feedback
 */
export function validateSessionNameRealtime(name) {
  // Don't show errors while typing if empty
  if (!name || name.length === 0) {
    return { isValid: true };
  }

  // Show character count warnings as user types
  if (name.length > 45) {
    const remaining = 50 - name.length;
    return { 
      isValid: remaining >= 0, 
      message: remaining >= 0 ? `${remaining} characters remaining` : 'Name too long',
      severity: remaining >= 0 ? 'warning' : 'error'
    };
  }

  // Check for invalid characters
  const validPattern = /^[a-zA-Z0-9\s_-]*$/; // Allow partial input
  if (!validPattern.test(name)) {
    return { 
      isValid: false, 
      message: 'Invalid characters detected', 
      severity: 'error' 
    };
  }

  return { isValid: true };
}