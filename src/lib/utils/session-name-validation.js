/**
 * Session name validation utilities
 */

/**
 * Validate session name in real-time as user types
 * @param {string} name - Session name to validate
 * @returns {Object} Validation result with isValid, message, severity
 */
export function validateSessionNameRealtime(name) {
    // If name is empty, it's valid (will use auto-generated name)
    if (!name || !name.trim()) {
        return {
            isValid: true,
            message: 'Leave empty for auto-generated name',
            severity: 'info'
        };
    }

    const trimmedName = name.trim();

    // Check length
    if (trimmedName.length > 50) {
        return {
            isValid: false,
            message: 'Session name too long (max 50 characters)',
            severity: 'error'
        };
    }

    // Check for invalid characters
    const invalidChars = /[<>:"/\\|?*\x00-\x1F]/;
    if (invalidChars.test(trimmedName)) {
        return {
            isValid: false,
            message: 'Session name contains invalid characters',
            severity: 'error'
        };
    }

    // Valid name
    return {
        isValid: true,
        message: 'Valid session name',
        severity: 'success'
    };
}

/**
 * Validate session name with feedback for form submission
 * @param {string} name - Session name to validate
 * @returns {Object} Validation result with isValid, message, severity
 */
export function validateSessionNameWithFeedback(name) {
    if (!name || !name.trim()) {
        return {
            isValid: true,
            message: 'Using auto-generated name',
            severity: 'info'
        };
    }

    return validateSessionNameRealtime(name);
}