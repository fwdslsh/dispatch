/**
 * BaseViewModel - Foundation class for ViewModels in MVVM architecture
 * Bridges Models and Views with reactive Svelte 5 state management
 */
export class BaseViewModel {
  constructor(model, services = {}) {
    this.model = model;
    this.services = services;
    
    // Svelte 5 reactive state
    this._reactiveState = $state(model.state);
    this._loading = $state(false);
    this._error = $state(null);
    this._disposed = false;
    this._cleanupCallbacks = [];

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
   * Update reactive state from model changes
   * @private
   */
  _updateReactiveState(newState) {
    Object.assign(this._reactiveState, newState);
  }

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
      this._error = error.message || 'An error occurred';
      throw error;
    } finally {
      this._loading = false;
    }
  }

  /**
   * Set error state
   * @param {string} message - Error message
   */
  setError(message) {
    if (this._disposed) {
      throw new Error('ViewModel has been disposed');
    }
    this._error = message;
  }

  /**
   * Clear error state
   */
  clearError() {
    if (this._disposed) return;
    this._error = null;
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
    this._cleanupCallbacks.forEach(callback => {
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