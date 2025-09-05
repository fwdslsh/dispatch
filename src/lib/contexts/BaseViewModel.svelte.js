/**
 * BaseViewModel - Foundation class for ViewModels in MVVM architecture
 * Bridges Models and Views with reactive Svelte 5 state management
 * Enhanced with $derived patterns and comprehensive reactive state
 */
export class BaseViewModel {
	constructor(model, services = {}) {
		this.model = model;
		this.services = services;

		// Core reactive state using $state
		this._reactiveState = $state(model.state);
		this._loading = $state(false);
		this._error = $state(null);
		this._validationErrors = $state(new Map());
		this._isDirty = $state(false);
		this._disposed = false;
		this._cleanupCallbacks = [];

		// Track initial state for dirty checking
		this._initialState = $state.snapshot(this._reactiveState);

		// $derived computed properties (must be class fields)
		this.hasValidationErrors = $derived(this._validationErrors.size > 0);
		this.isValid = $derived(!this.hasValidationErrors);
		this.hasErrors = $derived(this._error !== null || this.hasValidationErrors);
		this.isBusy = $derived(this._loading);
		this.isReady = $derived(!this._loading && !this._disposed);
		this.validationSummary = $derived.by(() => {
			const errors = Array.from(this._validationErrors.entries());
			return {
				isValid: errors.length === 0,
				errorCount: errors.length,
				errors: errors.reduce((acc, [field, error]) => {
					acc[field] = error;
					return acc;
				}, {}),
				firstError: errors.length > 0 ? errors[0][1] : null
			};
		});
		this.status = $derived.by(() => ({
			loading: this._loading,
			hasError: this._error !== null,
			hasValidationErrors: this.hasValidationErrors,
			isValid: this.isValid,
			isDirty: this._isDirty,
			isReady: this.isReady,
			isDisposed: this._disposed
		}));

		// Listen to model changes and update reactive state
		if (model.onChange) {
			const originalOnChange = model.onChange;
			model.onChange = (newState) => {
				this._updateReactiveState(newState);
				if (originalOnChange) originalOnChange(newState);
			};
		} else {
			model.onChange = (newState) => this._updateReactiveState(newState);
		}
	}

	/**
	 * Reactive state proxy to model
	 */
	get state() {
		return this._reactiveState;
	}

	/**
	 * Loading state
	 */
	get loading() {
		return this._loading;
	}

	/**
	 * Error state
	 */
	get error() {
		return this._error;
	}

	/**
	 * Validation errors map
	 */
	get validationErrors() {
		return this._validationErrors;
	}

	/**
	 * Dirty state - has data been modified from initial state
	 */
	get isDirty() {
		return this._isDirty;
	}

	// ========================================
	// Private Methods
	// ========================================

	/**
	 * Update reactive state from model changes
	 * @private
	 */
	_updateReactiveState(newState) {
		Object.assign(this._reactiveState, newState);
		this._checkDirtyState();
	}

	/**
	 * Check if current state differs from initial state
	 * @private
	 */
	_checkDirtyState() {
		const currentSnapshot = $state.snapshot(this._reactiveState);
		this._isDirty = JSON.stringify(currentSnapshot) !== JSON.stringify(this._initialState);
	}

	// ========================================
	// $effect Reactive Side Effects
	// ========================================

	/**
	 * Set up reactive effects for state monitoring and cleanup
	 * Call this in extending classes to enable reactive effects
	 * @protected
	 */
	_setupEffects() {
		// Effect for monitoring state changes and auto-validation
		$effect(() => {
			if (this._disposed) return;
			
			// Track state changes for potential validation
			$state.snapshot(this._reactiveState);
			
			// Auto-validate if validation service is available
			if (this.services.validationService && typeof this.services.validationService.validate === 'function') {
				this._performAutoValidation();
			}
		});

		// Add cleanup for effects
		this.addCleanup(() => {
			// Effects are automatically cleaned up by Svelte when the component unmounts
			// but we track this for manual disposal
		});
	}

	/**
	 * Auto-validation effect
	 * @private
	 */
	_performAutoValidation() {
		if (this._disposed) return;
		
		try {
			const validationResult = this.services.validationService.validate(this._reactiveState);
			if (validationResult && typeof validationResult === 'object') {
				this._updateValidationErrors(validationResult);
			}
		} catch (error) {
			console.warn('Auto-validation failed:', error);
		}
	}

	/**
	 * Update validation errors from validation result
	 * @private
	 */
	_updateValidationErrors(validationResult) {
		this._validationErrors.clear();
		
		if (validationResult.errors && Array.isArray(validationResult.errors)) {
			validationResult.errors.forEach(error => {
				if (error.field && error.message) {
					this._validationErrors.set(error.field, error.message);
				}
			});
		} else if (typeof validationResult === 'object') {
			// Handle object-style validation results
			Object.entries(validationResult).forEach(([field, message]) => {
				if (message) {
					this._validationErrors.set(field, message);
				}
			});
		}
	}

	// ========================================
	// Public API Methods
	// ========================================

	/**
	 * Execute an async action with loading state management
	 * @param {Function} action - Async function to execute
	 * @returns {Promise} - Promise from action
	 */
	async withLoading(action) {
		if (this._disposed) return;

		try {
			this._loading = true;
			this._error = null;
			return await action();
		} catch (error) {
			console.error('ViewModel action failed:', error);
			this.setError(error);
			throw error;
		} finally {
			this._loading = false;
		}
	}

	/**
	 * Set error state - enhanced to handle Error objects and structured errors
	 * @param {string|Error|Object} error - Error message, Error object, or structured error
	 */
	setError(error) {
		if (this._disposed) {
			throw new Error('ViewModel has been disposed');
		}

		if (error instanceof Error) {
			this._error = error.message;
		} else if (typeof error === 'object' && error !== null) {
			// Handle structured error objects
			this._error = error.message || error.error || JSON.stringify(error);
		} else {
			this._error = error || 'An error occurred';
		}
	}

	/**
	 * Clear error state
	 */
	clearError() {
		if (this._disposed) return;
		this._error = null;
	}

	/**
	 * Set validation error for a specific field
	 * @param {string} field - Field name
	 * @param {string} message - Error message
	 */
	setValidationError(field, message) {
		if (this._disposed) return;
		this._validationErrors.set(field, message);
	}

	/**
	 * Clear validation error for a specific field
	 * @param {string} field - Field name
	 */
	clearValidationError(field) {
		if (this._disposed) return;
		this._validationErrors.delete(field);
	}

	/**
	 * Clear all validation errors
	 */
	clearAllValidationErrors() {
		if (this._disposed) return;
		this._validationErrors.clear();
	}

	/**
	 * Clear all errors (general and validation)
	 */
	clearAllErrors() {
		if (this._disposed) return;
		this._error = null;
		this._validationErrors.clear();
	}

	/**
	 * Manually validate current state using injected validation service
	 * @returns {Promise<boolean>} - True if valid, false if invalid
	 */
	async validate() {
		if (this._disposed) return true;
		
		if (!this.services.validationService) {
			console.warn('No validation service available');
			return true;
		}

		try {
			const result = await this.services.validationService.validate(this._reactiveState);
			this._updateValidationErrors(result);
			return this.isValid;
		} catch (error) {
			console.error('Validation failed:', error);
			this.setError('Validation failed');
			return false;
		}
	}

	/**
	 * Reset state to initial values and clear all errors
	 */
	reset() {
		if (this._disposed) return;
		
		// Reset state to initial
		Object.assign(this._reactiveState, this._initialState);
		
		// Clear all errors and flags
		this._error = null;
		this._validationErrors.clear();
		this._isDirty = false;
		this._loading = false;
	}

	/**
	 * Update a specific field in the state
	 * @param {string} field - Field path (supports dot notation)
	 * @param {any} value - New value
	 */
	updateField(field, value) {
		if (this._disposed) return;
		
		// Handle dot notation for nested fields
		const fieldParts = field.split('.');
		let target = this._reactiveState;
		
		for (let i = 0; i < fieldParts.length - 1; i++) {
			if (!target[fieldParts[i]]) {
				target[fieldParts[i]] = {};
			}
			target = target[fieldParts[i]];
		}
		
		target[fieldParts[fieldParts.length - 1]] = value;
		this._checkDirtyState();
		
		// Clear validation error for this field if it exists
		this.clearValidationError(field);
	}

	/**
	 * Batch update multiple fields
	 * @param {Object} updates - Object with field/value pairs
	 */
	updateFields(updates) {
		if (this._disposed) return;
		
		Object.entries(updates).forEach(([field, value]) => {
			this.updateField(field, value);
		});
	}

	/**
	 * Add cleanup callback for disposal
	 * @param {Function} callback - Cleanup function
	 */
	addCleanup(callback) {
		this._cleanupCallbacks.push(callback);
	}

	/**
	 * Dispose ViewModel and clean up resources
	 */
	dispose() {
		if (this._disposed) return;

		this._disposed = true;

		// Run cleanup callbacks
		this._cleanupCallbacks.forEach((callback) => {
			try {
				callback();
			} catch (error) {
				console.error('Cleanup callback failed:', error);
			}
		});
		this._cleanupCallbacks = [];

		// Dispose model if it has dispose method
		if (this.model && typeof this.model.dispose === 'function') {
			this.model.dispose();
		}

		// Clear references
		this.model = null;
		this.services = null;
	}

	/**
	 * Check if ViewModel has been disposed
	 */
	get isDisposed() {
		return this._disposed;
	}
}
