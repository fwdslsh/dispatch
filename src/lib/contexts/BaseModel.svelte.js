/**
 * BaseModel - Foundation class for all data models in the MVVM architecture
 * Provides reactive state management and validation framework
 */
export class BaseModel {
	constructor(initialState = {}) {
		this._state = { ...initialState };
		this._disposed = false;
		this.onChange = null; // Override in subclasses or set externally
	}

	/**
	 * Get current state (immutable copy)
	 */
	get state() {
		return { ...this._state };
	}

	/**
	 * Update state with validation and change notification
	 * @param {Object} updates - Partial state updates
	 */
	setState(updates) {
		if (this._disposed) {
			throw new Error('Cannot update state: Model has been disposed');
		}

		const newState = { ...this._state, ...updates };

		if (this.validate && !this.validate(newState)) {
			return false;
		}

		this._state = newState;

		if (this.onChange) {
			this.onChange(this.state);
		}

		return true;
	}

	/**
	 * Reset state to initial values
	 */
	reset() {
		if (this._disposed) return;

		this._state = {};
		if (this.onChange) {
			this.onChange(this.state);
		}
	}

	/**
	 * Validate state - override in subclasses
	 * @param {Object} state - State to validate
	 * @returns {boolean} - True if valid
	 */
	validate(state) {
		return true; // Default: all states are valid
	}

	/**
	 * Serialize model to JSON
	 */
	toJSON() {
		return this.state;
	}

	/**
	 * Load state from JSON
	 * @param {Object} data - JSON data to load
	 */
	fromJSON(data) {
		this.setState(data);
	}

	/**
	 * Dispose of the model and clean up resources
	 */
	dispose() {
		this._disposed = true;
		this._state = {};
		this.onChange = null;
	}

	/**
	 * Check if model has been disposed
	 */
	get isDisposed() {
		return this._disposed;
	}
}
