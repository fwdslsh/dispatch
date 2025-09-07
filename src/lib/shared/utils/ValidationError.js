/**
 * ValidationError
 * Custom error class for form and input validation with structured error data
 */

export class ValidationError extends Error {
	/**
	 * Create a ValidationError
	 * @param {string} message - Error message
	 * @param {string} [field] - Field name that failed validation
	 * @param {string} [code] - Error code for programmatic handling
	 * @param {Object} [details] - Additional error details
	 */
	constructor(message, field, code, details) {
		super(message);

		this.name = 'ValidationError';
		this.field = field;
		this.code = code;
		this.details = details;

		// Maintains proper stack trace for where error was thrown (only available on V8)
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, ValidationError);
		}
	}

	/**
	 * Static factory method for required field errors
	 * @param {string} field - Field name
	 * @returns {ValidationError}
	 */
	static required(field) {
		return new ValidationError('This field is required', field, 'REQUIRED');
	}

	/**
	 * Static factory method for invalid format errors
	 * @param {string} field - Field name
	 * @param {string} formatName - Human-readable format name
	 * @returns {ValidationError}
	 */
	static invalidFormat(field, formatName) {
		return new ValidationError(`Please enter a valid ${formatName}`, field, 'INVALID_FORMAT');
	}

	/**
	 * Static factory method for minimum length errors
	 * @param {string} field - Field name
	 * @param {number} minLength - Minimum required length
	 * @returns {ValidationError}
	 */
	static minLength(field, minLength) {
		return new ValidationError(
			`Must be at least ${minLength} characters long`,
			field,
			'MIN_LENGTH',
			{ minLength }
		);
	}

	/**
	 * Static factory method for maximum length errors
	 * @param {string} field - Field name
	 * @param {number} maxLength - Maximum allowed length
	 * @returns {ValidationError}
	 */
	static maxLength(field, maxLength) {
		return new ValidationError(
			`Must be no more than ${maxLength} characters long`,
			field,
			'MAX_LENGTH',
			{ maxLength }
		);
	}

	/**
	 * Static factory method for custom validation errors
	 * @param {string} field - Field name
	 * @param {string} message - Error message
	 * @param {string} code - Error code
	 * @param {Object} [details] - Additional details
	 * @returns {ValidationError}
	 */
	static custom(field, message, code, details) {
		return new ValidationError(message, field, code, details);
	}

	/**
	 * Create multiple ValidationError instances from an object
	 * @param {Object} errorObject - Object with field names as keys and error messages as values
	 * @returns {ValidationError[]}
	 */
	static fromObject(errorObject) {
		return Object.entries(errorObject)
			.filter(([_, message]) => message != null) // Filter out null/undefined
			.map(([field, message]) => new ValidationError(message, field));
	}

	/**
	 * Check if this error is for a specific field
	 * @param {string} fieldName - Field name to check
	 * @returns {boolean}
	 */
	isForField(fieldName) {
		return this.field === fieldName;
	}

	/**
	 * Check if this error has a specific code
	 * @param {string} errorCode - Error code to check
	 * @returns {boolean}
	 */
	hasCode(errorCode) {
		return this.code === errorCode;
	}

	/**
	 * Get user-friendly error message
	 * @returns {string}
	 */
	getUserMessage() {
		return this.message;
	}

	/**
	 * Get technical error message with field and code information
	 * @returns {string}
	 */
	getTechnicalMessage() {
		let message = '';

		if (this.field) {
			message += `[${this.field}] `;
		}

		if (this.code) {
			message += `${this.code}: `;
		}

		message += this.message;

		return message;
	}

	/**
	 * Serialize error to JSON
	 * @returns {Object}
	 */
	toJSON() {
		return {
			name: this.name,
			message: this.message,
			field: this.field,
			code: this.code,
			details: this.details
		};
	}

	/**
	 * String representation of the error
	 * @returns {string}
	 */
	toString() {
		return this.getTechnicalMessage();
	}
}
