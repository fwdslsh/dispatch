/**
 * ValidationError Unit Tests
 * Tests custom error class for form/input validation
 */
import { describe, it, expect } from 'vitest';
import { ValidationError } from '../../src/lib/services/ValidationError.js';

describe('ValidationError', () => {
	describe('Constructor and Basic Properties', () => {
		it('should create ValidationError with message only', () => {
			const error = new ValidationError('Field is required');
			
			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(ValidationError);
			expect(error.message).toBe('Field is required');
			expect(error.name).toBe('ValidationError');
			expect(error.field).toBeUndefined();
			expect(error.code).toBeUndefined();
		});

		it('should create ValidationError with field', () => {
			const error = new ValidationError('Invalid email format', 'email');
			
			expect(error.message).toBe('Invalid email format');
			expect(error.field).toBe('email');
		});

		it('should create ValidationError with field and code', () => {
			const error = new ValidationError('Password too weak', 'password', 'WEAK_PASSWORD');
			
			expect(error.message).toBe('Password too weak');
			expect(error.field).toBe('password');
			expect(error.code).toBe('WEAK_PASSWORD');
		});

		it('should create ValidationError with field and details object', () => {
			const details = {
				minLength: 8,
				hasUppercase: false,
				hasNumbers: false
			};
			const error = new ValidationError('Password requirements not met', 'password', 'WEAK_PASSWORD', details);
			
			expect(error.message).toBe('Password requirements not met');
			expect(error.field).toBe('password');
			expect(error.code).toBe('WEAK_PASSWORD');
			expect(error.details).toEqual(details);
		});
	});

	describe('Error Stack and Name', () => {
		it('should have proper error stack', () => {
			const error = new ValidationError('Test error');
			
			expect(error.stack).toBeDefined();
			expect(error.stack).toContain('ValidationError');
		});

		it('should maintain proper prototype chain', () => {
			const error = new ValidationError('Test error');
			
			expect(error instanceof ValidationError).toBe(true);
			expect(error instanceof Error).toBe(true);
		});
	});

	describe('Static Factory Methods', () => {
		it('should create required field error', () => {
			const error = ValidationError.required('username');
			
			expect(error.message).toBe('This field is required');
			expect(error.field).toBe('username');
			expect(error.code).toBe('REQUIRED');
		});

		it('should create invalid format error', () => {
			const error = ValidationError.invalidFormat('email', 'email address');
			
			expect(error.message).toBe('Please enter a valid email address');
			expect(error.field).toBe('email');
			expect(error.code).toBe('INVALID_FORMAT');
		});

		it('should create minimum length error', () => {
			const error = ValidationError.minLength('password', 8);
			
			expect(error.message).toBe('Must be at least 8 characters long');
			expect(error.field).toBe('password');
			expect(error.code).toBe('MIN_LENGTH');
			expect(error.details.minLength).toBe(8);
		});

		it('should create maximum length error', () => {
			const error = ValidationError.maxLength('description', 100);
			
			expect(error.message).toBe('Must be no more than 100 characters long');
			expect(error.field).toBe('description');
			expect(error.code).toBe('MAX_LENGTH');
			expect(error.details.maxLength).toBe(100);
		});

		it('should create custom validation error', () => {
			const error = ValidationError.custom('username', 'Username already exists', 'DUPLICATE_USERNAME');
			
			expect(error.message).toBe('Username already exists');
			expect(error.field).toBe('username');
			expect(error.code).toBe('DUPLICATE_USERNAME');
		});
	});

	describe('Multiple Field Validation', () => {
		it('should create multiple field errors from object', () => {
			const errors = ValidationError.fromObject({
				email: 'Invalid email format',
				password: 'Password too weak',
				confirmPassword: 'Passwords do not match'
			});
			
			expect(errors).toHaveLength(3);
			expect(errors[0].field).toBe('email');
			expect(errors[0].message).toBe('Invalid email format');
			expect(errors[1].field).toBe('password');
			expect(errors[1].message).toBe('Password too weak');
			expect(errors[2].field).toBe('confirmPassword');
			expect(errors[2].message).toBe('Passwords do not match');
		});

		it('should handle empty object', () => {
			const errors = ValidationError.fromObject({});
			
			expect(errors).toHaveLength(0);
		});

		it('should filter out null/undefined values', () => {
			const errors = ValidationError.fromObject({
				email: 'Invalid email',
				password: null,
				username: undefined,
				confirmPassword: 'Does not match'
			});
			
			expect(errors).toHaveLength(2);
			expect(errors[0].field).toBe('email');
			expect(errors[1].field).toBe('confirmPassword');
		});
	});

	describe('Serialization and JSON', () => {
		it('should serialize to JSON correctly', () => {
			const error = new ValidationError('Invalid input', 'email', 'INVALID_EMAIL', { pattern: /\S+@\S+\.\S+/ });
			const json = error.toJSON();
			
			expect(json).toEqual({
				name: 'ValidationError',
				message: 'Invalid input',
				field: 'email',
				code: 'INVALID_EMAIL',
				details: { pattern: /\S+@\S+\.\S+/ }
			});
		});

		it('should serialize minimal error to JSON', () => {
			const error = new ValidationError('Simple error');
			const json = error.toJSON();
			
			expect(json).toEqual({
				name: 'ValidationError',
				message: 'Simple error',
				field: undefined,
				code: undefined,
				details: undefined
			});
		});

		it('should work with JSON.stringify', () => {
			const error = new ValidationError('Test error', 'field1', 'TEST_CODE');
			const jsonString = JSON.stringify(error);
			
			const parsed = JSON.parse(jsonString);
			expect(parsed.name).toBe('ValidationError');
			expect(parsed.message).toBe('Test error');
			expect(parsed.field).toBe('field1');
			expect(parsed.code).toBe('TEST_CODE');
		});
	});

	describe('Error Formatting and Display', () => {
		it('should format user-friendly message', () => {
			const error = new ValidationError('Email is required', 'email', 'REQUIRED');
			
			expect(error.getUserMessage()).toBe('Email is required');
		});

		it('should format technical message', () => {
			const error = new ValidationError('Email is required', 'email', 'REQUIRED');
			
			expect(error.getTechnicalMessage()).toBe('[email] REQUIRED: Email is required');
		});

		it('should format technical message without code', () => {
			const error = new ValidationError('Email is required', 'email');
			
			expect(error.getTechnicalMessage()).toBe('[email] Email is required');
		});

		it('should format technical message without field', () => {
			const error = new ValidationError('General error', undefined, 'GENERAL_ERROR');
			
			expect(error.getTechnicalMessage()).toBe('GENERAL_ERROR: General error');
		});

		it('should format technical message with minimal info', () => {
			const error = new ValidationError('Simple error');
			
			expect(error.getTechnicalMessage()).toBe('Simple error');
		});
	});

	describe('Error Comparison and Utilities', () => {
		it('should check if error is for specific field', () => {
			const error = new ValidationError('Invalid email', 'email', 'INVALID_FORMAT');
			
			expect(error.isForField('email')).toBe(true);
			expect(error.isForField('password')).toBe(false);
		});

		it('should check error code', () => {
			const error = new ValidationError('Required field', 'username', 'REQUIRED');
			
			expect(error.hasCode('REQUIRED')).toBe(true);
			expect(error.hasCode('INVALID_FORMAT')).toBe(false);
		});

		it('should handle undefined field/code checks', () => {
			const error = new ValidationError('Simple error');
			
			expect(error.isForField('email')).toBe(false);
			expect(error.hasCode('REQUIRED')).toBe(false);
		});
	});

	describe('Integration with Validation Flows', () => {
		it('should work in try-catch blocks', () => {
			expect(() => {
				throw new ValidationError('Test validation error', 'field1', 'TEST_ERROR');
			}).toThrow(ValidationError);
		});

		it('should maintain error properties when caught', () => {
			let caughtError;
			
			try {
				throw new ValidationError('Test error', 'email', 'INVALID_EMAIL');
			} catch (error) {
				caughtError = error;
			}
			
			expect(caughtError).toBeInstanceOf(ValidationError);
			expect(caughtError.field).toBe('email');
			expect(caughtError.code).toBe('INVALID_EMAIL');
		});

		it('should be distinguishable from regular errors', () => {
			const validationError = new ValidationError('Validation failed');
			const regularError = new Error('Regular error');
			
			expect(validationError instanceof ValidationError).toBe(true);
			expect(regularError instanceof ValidationError).toBe(false);
		});
	});
});