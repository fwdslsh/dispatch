/**
 * Validation utilities for session types
 */

/**
 * Common validation rules for session creation
 */
export const ValidationRules = {
  SESSION_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100,
    PATTERN: /^[a-zA-Z0-9\s\-_\.()]+$/,
    INVALID_CHARS: /[<>:"\/\\|?*]/g
  },
  
  TERMINAL_DIMENSIONS: {
    COLS: { MIN: 10, MAX: 500 },
    ROWS: { MIN: 5, MAX: 200 }
  },
  
  PROJECT_ID: {
    PATTERN: /^[a-zA-Z0-9\-_]+$/,
    MIN_LENGTH: 3,
    MAX_LENGTH: 50
  }
};

/**
 * Validate session name
 * @param {string} name - Session name to validate
 * @returns {Object} Validation result
 */
export function validateSessionName(name) {
  const errors = [];
  
  if (!name || typeof name !== 'string') {
    errors.push('Session name is required');
    return { valid: false, errors };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < ValidationRules.SESSION_NAME.MIN_LENGTH) {
    errors.push('Session name cannot be empty');
  }
  
  if (trimmed.length > ValidationRules.SESSION_NAME.MAX_LENGTH) {
    errors.push(`Session name must be ${ValidationRules.SESSION_NAME.MAX_LENGTH} characters or less`);
  }
  
  if (!ValidationRules.SESSION_NAME.PATTERN.test(trimmed)) {
    errors.push('Session name contains invalid characters');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    sanitized: trimmed.replace(ValidationRules.SESSION_NAME.INVALID_CHARS, '')
  };
}

/**
 * Validate terminal dimensions
 * @param {number} cols - Terminal columns
 * @param {number} rows - Terminal rows
 * @returns {Object} Validation result
 */
export function validateTerminalDimensions(cols, rows) {
  const errors = [];
  
  if (cols !== undefined) {
    if (!Number.isInteger(cols) || cols < ValidationRules.TERMINAL_DIMENSIONS.COLS.MIN) {
      errors.push(`Terminal columns must be at least ${ValidationRules.TERMINAL_DIMENSIONS.COLS.MIN}`);
    } else if (cols > ValidationRules.TERMINAL_DIMENSIONS.COLS.MAX) {
      errors.push(`Terminal columns must be at most ${ValidationRules.TERMINAL_DIMENSIONS.COLS.MAX}`);
    }
  }
  
  if (rows !== undefined) {
    if (!Number.isInteger(rows) || rows < ValidationRules.TERMINAL_DIMENSIONS.ROWS.MIN) {
      errors.push(`Terminal rows must be at least ${ValidationRules.TERMINAL_DIMENSIONS.ROWS.MIN}`);
    } else if (rows > ValidationRules.TERMINAL_DIMENSIONS.ROWS.MAX) {
      errors.push(`Terminal rows must be at most ${ValidationRules.TERMINAL_DIMENSIONS.ROWS.MAX}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
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
  
  if (trimmed.length < ValidationRules.PROJECT_ID.MIN_LENGTH) {
    errors.push(`Project ID must be at least ${ValidationRules.PROJECT_ID.MIN_LENGTH} characters`);
  }
  
  if (trimmed.length > ValidationRules.PROJECT_ID.MAX_LENGTH) {
    errors.push(`Project ID must be at most ${ValidationRules.PROJECT_ID.MAX_LENGTH} characters`);
  }
  
  if (!ValidationRules.PROJECT_ID.PATTERN.test(trimmed)) {
    errors.push('Project ID can only contain letters, numbers, hyphens, and underscores');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate working directory path
 * @param {string} workingDirectory - Directory path to validate
 * @returns {Object} Validation result
 */
export function validateWorkingDirectory(workingDirectory) {
  const errors = [];
  
  if (!workingDirectory) {
    return { valid: true, errors }; // Optional field
  }
  
  if (typeof workingDirectory !== 'string') {
    errors.push('Working directory must be a string');
    return { valid: false, errors };
  }
  
  const trimmed = workingDirectory.trim();
  
  // Basic path validation
  if (trimmed.includes('..')) {
    errors.push('Working directory cannot contain relative path traversal');
  }
  
  // Check for null bytes or other dangerous characters
  if (trimmed.includes('\0') || /[<>"|*?]/.test(trimmed)) {
    errors.push('Working directory contains invalid characters');
  }
  
  if (trimmed.length > 500) {
    errors.push('Working directory path is too long');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a comprehensive validator for session creation options
 * @param {Object} requirements - Validation requirements
 * @returns {Function} Validator function
 */
export function createSessionValidator(requirements = {}) {
  return function validateSessionCreationOptions(options) {
    const allErrors = [];
    let isValid = true;
    
    // Validate session name
    const nameValidation = validateSessionName(options.name);
    if (!nameValidation.valid) {
      allErrors.push(...nameValidation.errors);
      isValid = false;
    }
    
    // Validate project ID if required
    if (requirements.requiresProject || options.projectId) {
      const projectValidation = validateProjectId(options.projectId, requirements.requiresProject);
      if (!projectValidation.valid) {
        allErrors.push(...projectValidation.errors);
        isValid = false;
      }
    }
    
    // Validate terminal dimensions
    const dimensionsValidation = validateTerminalDimensions(options.cols, options.rows);
    if (!dimensionsValidation.valid) {
      allErrors.push(...dimensionsValidation.errors);
      isValid = false;
    }
    
    // Validate working directory
    const workingDirValidation = validateWorkingDirectory(options.workingDirectory);
    if (!workingDirValidation.valid) {
      allErrors.push(...workingDirValidation.errors);
      isValid = false;
    }
    
    // Custom validation rules
    if (requirements.customValidators) {
      for (const validator of requirements.customValidators) {
        const customResult = validator(options);
        if (!customResult.valid) {
          allErrors.push(...customResult.errors);
          isValid = false;
        }
      }
    }
    
    return {
      valid: isValid,
      errors: allErrors
    };
  };
}