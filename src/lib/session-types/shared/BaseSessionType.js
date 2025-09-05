/**
 * BaseSessionType - Abstract base class for all session types
 * 
 * Provides common functionality and lifecycle hooks that session types
 * can override to implement their specific behavior.
 */
export class BaseSessionType {
  /**
   * @param {Object} config - Configuration object for the session type
   * @param {string} config.id - Unique identifier (e.g., 'shell', 'claude', 'jupyter')
   * @param {string} config.name - Human-readable name
   * @param {string} [config.description=''] - Brief description for UI
   * @param {string} [config.version='1.0.0'] - Version for compatibility
   * @param {string} [config.category='general'] - Category for grouping
   * @param {string} [config.namespace] - Socket.IO namespace (defaults to /${id})
   * @param {boolean} [config.requiresProject=true] - Whether project selection is mandatory
   * @param {boolean} [config.supportsAttachment=true] - Whether sessions can be resumed
   * @param {Object} [config.defaultOptions={}] - Default creation options
   */
  constructor(config) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description || '';
    this.version = config.version || '1.0.0';
    this.category = config.category || 'general';
    this.namespace = config.namespace || `/${this.id}`;
    this.requiresProject = config.requiresProject ?? true;
    this.supportsAttachment = config.supportsAttachment ?? true;
    this.defaultOptions = config.defaultOptions || {};
  }

  /**
   * Create a new session of this type
   * 
   * This method must be implemented by concrete session types.
   * It should configure the session based on the provided options
   * and register any necessary socket listeners.
   * 
   * @param {SessionCreationOptions} options - Creation options
   * @param {Socket} socket - Socket.IO socket instance
   * @returns {Promise<SessionMetadata>} Created session metadata
   * @throws {Error} Must be implemented by session type
   */
  async onCreate(options, socket) {
    throw new Error('onCreate must be implemented by session type');
  }

  /**
   * Attach to an existing session
   * 
   * Default implementation returns false (attachment not supported).
   * Override this method to enable session attachment.
   * 
   * @param {string} sessionId - ID of the session to attach to
   * @param {Socket} socket - Socket.IO socket instance
   * @returns {Promise<boolean>} True if attachment succeeded, false otherwise
   */
  async onAttach(sessionId, socket) {
    return false; // Default: attachment not supported
  }

  /**
   * Clean up when a session is destroyed
   * 
   * Override this method to perform cleanup tasks such as:
   * - Removing event listeners
   * - Saving session data that needs to persist
   * - Releasing resources
   * 
   * @param {string} sessionId - ID of the session being destroyed
   * @returns {Promise<void>}
   */
  async onDestroy(sessionId) {
    // Default: no cleanup needed
  }

  /**
   * Validate session creation options
   * 
   * Override this method to implement session type-specific validation.
   * Default implementation accepts all options as valid.
   * 
   * @param {SessionCreationOptions} options - Options to validate
   * @returns {ValidationResult} Validation result with valid flag and errors
   */
  validate(options) {
    return {
      valid: true,
      errors: []
    };
  }

  /**
   * Get a summary of this session type for display
   * @returns {Object} Summary object with key information
   */
  getSummary() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      category: this.category,
      version: this.version,
      namespace: this.namespace,
      requiresProject: this.requiresProject,
      supportsAttachment: this.supportsAttachment
    };
  }

  /**
   * Check if this session type supports a specific capability
   * @param {string} capability - The capability to check for
   * @returns {boolean} True if supported, false otherwise
   */
  supportsCapability(capability) {
    // Default capabilities - can be overridden by specific session types
    const defaultCapabilities = ['create', 'destroy'];
    
    if (this.supportsAttachment) {
      defaultCapabilities.push('attach');
    }

    return defaultCapabilities.includes(capability);
  }

  /**
   * Get the default options for this session type
   * @returns {Object} Copy of default options
   */
  getDefaultOptions() {
    return { ...this.defaultOptions };
  }
}

/**
 * @typedef {Object} SessionCreationOptions
 * @property {string} [name] - Custom session name
 * @property {string} [projectId] - Project context
 * @property {string} [workingDirectory] - Working directory path
 * @property {number} [cols] - Terminal columns
 * @property {number} [rows] - Terminal rows
 * @property {Object} [customOptions] - Type-specific options
 */

/**
 * @typedef {Object} SessionMetadata
 * @property {string} id - Session ID
 * @property {string} name - Session name
 * @property {string} type - Session type ID
 * @property {string} [projectId] - Project ID if applicable
 * @property {'active'|'inactive'|'error'} status - Session status
 * @property {string} created - Creation timestamp (ISO string)
 * @property {Object} [customData] - Type-specific data
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {Array<string>} errors - Array of error messages
 */