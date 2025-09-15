/**
 * ValidationService.js
 *
 * Centralized validation service for user inputs and data.
 * Provides consistent validation rules across the application.
 */

import { VALIDATION_CONFIG } from '$lib/shared/constants.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - List of error messages
 * @property {string[]} warnings - List of warning messages
 */

export class ValidationService {
	constructor() {
		// Validation rules
		this.rules = new Map();

		// Custom validators
		this.validators = new Map();

		// Setup built-in rules
		this.setupBuiltinRules();
	}

	/**
	 * Setup built-in validation rules
	 */
	setupBuiltinRules() {
		// Session ID validation
		this.rules.set('sessionId', {
			required: true,
			pattern: VALIDATION_CONFIG.SESSION_ID_PATTERN,
			message: 'Session ID must be 8-64 characters (letters, numbers, hyphens, underscores)'
		});

		// Session name validation
		this.rules.set('sessionName', {
			required: false,
			pattern: VALIDATION_CONFIG.SESSION_NAME_PATTERN,
			maxLength: 100,
			message:
				'Session name must be 1-100 characters (letters, numbers, spaces, hyphens, dots, underscores)'
		});

		// Workspace path validation
		this.rules.set('workspacePath', {
			required: true,
			custom: 'workspacePath',
			message: 'Invalid workspace path'
		});

		// Terminal key validation
		this.rules.set('terminalKey', {
			required: true,
			minLength: 8,
			message: 'Terminal key must be at least 8 characters'
		});

		// Command validation
		this.rules.set('command', {
			required: true,
			maxLength: 1000,
			custom: 'command',
			message: 'Invalid command'
		});

		// Email validation
		this.rules.set('email', {
			required: true,
			pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
			message: 'Invalid email format'
		});
	}

	/**
	 * Setup custom validators
	 */
	setupCustomValidators() {
		// Workspace path validator
		this.validators.set('workspacePath', (value) => {
			if (!value || typeof value !== 'string') {
				return { valid: false, message: 'Workspace path is required' };
			}

			// Check for path traversal
			if (value.includes('..')) {
				return { valid: false, message: 'Path traversal not allowed' };
			}

			// Check for invalid characters
			if (!/^[a-zA-Z0-9\-_/.]+$/.test(value)) {
				return { valid: false, message: 'Invalid characters in path' };
			}

			// Check length
			if (value.length > 500) {
				return { valid: false, message: 'Path too long (max 500 characters)' };
			}

			return { valid: true };
		});

		// Command validator
		this.validators.set('command', (value) => {
			if (!value || typeof value !== 'string') {
				return { valid: false, message: 'Command is required' };
			}

			// Basic command safety checks
			const dangerous = ['rm -rf', 'sudo rm', 'format', 'del /q'];
			const lower = value.toLowerCase();

			for (const danger of dangerous) {
				if (lower.includes(danger)) {
					return {
						valid: false,
						message: `Potentially dangerous command detected: ${danger}`
					};
				}
			}

			return { valid: true };
		});

		// File size validator
		this.validators.set('fileSize', (value, options = {}) => {
			const maxSize = options.maxSize || VALIDATION_CONFIG.MAX_FILE_SIZE;

			if (value > maxSize) {
				const mb = Math.round(maxSize / (1024 * 1024));
				return { valid: false, message: `File size exceeds ${mb}MB limit` };
			}

			return { valid: true };
		});
	}

	/**
	 * Validate a single value against rules
	 * @param {*} value - Value to validate
	 * @param {string|Object} rules - Rule name or rule object
	 * @param {Object} options - Additional options
	 * @returns {ValidationResult}
	 */
	validate(value, rules, options = {}) {
		const result = {
			valid: true,
			errors: [],
			warnings: []
		};

		// Get rule definition
		const ruleDefinition = typeof rules === 'string' ? this.rules.get(rules) : rules;
		if (!ruleDefinition) {
			result.valid = false;
			result.errors.push('Unknown validation rule');
			return result;
		}

		// Required validation
		if (ruleDefinition.required && (value == null || value === '')) {
			result.valid = false;
			result.errors.push(ruleDefinition.message || 'This field is required');
			return result; // Skip other validations if required fails
		}

		// Skip other validations if value is empty and not required
		if (!ruleDefinition.required && (value == null || value === '')) {
			return result;
		}

		// Type validation
		if (ruleDefinition.type && typeof value !== ruleDefinition.type) {
			result.valid = false;
			result.errors.push(`Expected ${ruleDefinition.type}, got ${typeof value}`);
		}

		// Length validations
		if (ruleDefinition.minLength && value.length < ruleDefinition.minLength) {
			result.valid = false;
			result.errors.push(`Minimum length is ${ruleDefinition.minLength} characters`);
		}

		if (ruleDefinition.maxLength && value.length > ruleDefinition.maxLength) {
			result.valid = false;
			result.errors.push(`Maximum length is ${ruleDefinition.maxLength} characters`);
		}

		// Pattern validation
		if (ruleDefinition.pattern && !ruleDefinition.pattern.test(value)) {
			result.valid = false;
			result.errors.push(ruleDefinition.message || 'Invalid format');
		}

		// Custom validation
		if (ruleDefinition.custom) {
			const validator = this.validators.get(ruleDefinition.custom);
			if (validator) {
				const customResult = validator(value, options);
				if (!customResult.valid) {
					result.valid = false;
					result.errors.push(customResult.message || 'Custom validation failed');
				}
			}
		}

		// Range validations (for numbers)
		if (typeof value === 'number') {
			if (ruleDefinition.min != null && value < ruleDefinition.min) {
				result.valid = false;
				result.errors.push(`Minimum value is ${ruleDefinition.min}`);
			}

			if (ruleDefinition.max != null && value > ruleDefinition.max) {
				result.valid = false;
				result.errors.push(`Maximum value is ${ruleDefinition.max}`);
			}
		}

		return result;
	}

	/**
	 * Validate multiple fields
	 * @param {Object} data - Data object to validate
	 * @param {Object} schema - Validation schema
	 * @returns {Object} Validation results by field
	 */
	validateSchema(data, schema) {
		const results = {};
		let overallValid = true;

		for (const [field, rules] of Object.entries(schema)) {
			const value = data[field];
			const result = this.validate(value, rules);

			results[field] = result;

			if (!result.valid) {
				overallValid = false;
			}
		}

		return {
			valid: overallValid,
			fields: results,
			errors: this.flattenErrors(results),
			warnings: this.flattenWarnings(results)
		};
	}

	/**
	 * Validate session creation data
	 * @param {Object} data
	 * @returns {ValidationResult}
	 */
	validateSessionCreation(data) {
		const schema = {
			type: {
				required: true,
				custom: 'sessionType',
				message: 'Invalid session type'
			},
			workspacePath: 'workspacePath',
			title: 'sessionName'
		};

		// Setup session type validator
		this.validators.set('sessionType', (value) => {
			const validTypes = VALIDATION_CONFIG.ALLOWED_MODES || ['claude', 'shell'];
			if (!validTypes.includes(value)) {
				return {
					valid: false,
					message: `Session type must be one of: ${validTypes.join(', ')}`
				};
			}
			return { valid: true };
		});

		return this.validateSchema(data, schema);
	}

	/**
	 * Validate workspace creation data
	 * @param {Object} data
	 * @returns {ValidationResult}
	 */
	validateWorkspaceCreation(data) {
		const schema = {
			path: 'workspacePath',
			name: {
				required: false,
				maxLength: 50,
				message: 'Workspace name must be 50 characters or less'
			}
		};

		return this.validateSchema(data, schema);
	}

	/**
	 * Validate form data
	 * @param {FormData|Object} formData
	 * @param {Object} schema
	 * @returns {ValidationResult}
	 */
	validateForm(formData, schema) {
		const data = {};

		if (formData instanceof FormData) {
			for (const [key, value] of formData.entries()) {
				data[key] = value;
			}
		} else {
			Object.assign(data, formData);
		}

		return this.validateSchema(data, schema);
	}

	/**
	 * Sanitize user input
	 * @param {string} input
	 * @param {Object} options
	 * @returns {string}
	 */
	sanitize(input, options = {}) {
		if (typeof input !== 'string') {
			return String(input || '');
		}

		let sanitized = input;

		// Trim whitespace
		if (options.trim !== false) {
			sanitized = sanitized.trim();
		}

		// Remove null bytes
		sanitized = sanitized.replace(/\0/g, '');

		// Escape HTML if requested
		if (options.escapeHtml) {
			sanitized = sanitized
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#x27;');
		}

		// Remove control characters except tabs and newlines
		if (options.removeControlChars) {
			sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
		}

		return sanitized;
	}

	/**
	 * Flatten validation errors from schema results
	 * @param {Object} results
	 * @returns {string[]}
	 */
	flattenErrors(results) {
		const errors = [];
		for (const [field, result] of Object.entries(results)) {
			if (result.errors) {
				errors.push(...result.errors.map((error) => `${field}: ${error}`));
			}
		}
		return errors;
	}

	/**
	 * Flatten validation warnings from schema results
	 * @param {Object} results
	 * @returns {string[]}
	 */
	flattenWarnings(results) {
		const warnings = [];
		for (const [field, result] of Object.entries(results)) {
			if (result.warnings) {
				warnings.push(...result.warnings.map((warning) => `${field}: ${warning}`));
			}
		}
		return warnings;
	}

	/**
	 * Add custom validator
	 * @param {string} name
	 * @param {Function} validator
	 */
	addValidator(name, validator) {
		this.validators.set(name, validator);
	}

	/**
	 * Add validation rule
	 * @param {string} name
	 * @param {Object} rule
	 */
	addRule(name, rule) {
		this.rules.set(name, rule);
	}

	/**
	 * Get available rules
	 * @returns {string[]}
	 */
	getAvailableRules() {
		return Array.from(this.rules.keys());
	}

	/**
	 * Get available validators
	 * @returns {string[]}
	 */
	getAvailableValidators() {
		return Array.from(this.validators.keys());
	}

	/**
	 * Dispose of resources
	 */
	dispose() {
		this.rules.clear();
		this.validators.clear();
	}
}
