/**
 * SessionTypeRegistry - Central registry for managing session types
 * 
 * Provides Map-based storage, validation, and categorization of session types.
 * Session types are manually registered during application startup for
 * better control and build-time optimization.
 */
export class SessionTypeRegistry {
  constructor() {
    this.types = new Map();
    this.initialized = false;
  }

  /**
   * Register a session type with the registry
   * @param {BaseSessionType} sessionType - The session type to register
   * @throws {Error} If session type validation fails
   */
  register(sessionType) {
    if (!this.validateSessionType(sessionType)) {
      throw new Error(`Invalid session type: ${sessionType.id || 'unknown'}`);
    }

    this.types.set(sessionType.id, sessionType);
    console.log(`Registered session type: ${sessionType.id}`);
  }

  /**
   * Get a session type by its ID
   * @param {string} typeId - The session type identifier
   * @returns {BaseSessionType|undefined} The session type or undefined if not found
   */
  get(typeId) {
    return this.types.get(typeId);
  }

  /**
   * Get all registered session types
   * @returns {Array<BaseSessionType>} Array of all registered session types
   */
  list() {
    return Array.from(this.types.values());
  }

  /**
   * Get session types filtered by category
   * @param {string} category - The category to filter by
   * @returns {Array<BaseSessionType>} Array of session types in the specified category
   */
  getByCategory(category) {
    return this.list().filter(type => type.category === category);
  }

  /**
   * Validate that a session type has all required fields
   * @param {Object} sessionType - The session type to validate
   * @returns {boolean} True if valid, false otherwise
   */
  validateSessionType(sessionType) {
    const required = ['id', 'name', 'namespace'];
    return required.every(field => sessionType[field] !== undefined);
  }

  /**
   * Check if a session type is registered
   * @param {string} typeId - The session type identifier
   * @returns {boolean} True if registered, false otherwise
   */
  has(typeId) {
    return this.types.has(typeId);
  }

  /**
   * Get the count of registered session types
   * @returns {number} Number of registered session types
   */
  size() {
    return this.types.size;
  }

  /**
   * Clear all registered session types (primarily for testing)
   */
  clear() {
    this.types.clear();
    this.initialized = false;
    console.log('Session type registry cleared');
  }

  /**
   * Get all available categories
   * @returns {Array<string>} Array of unique categories
   */
  getCategories() {
    const categories = new Set();
    for (const type of this.types.values()) {
      categories.add(type.category);
    }
    return Array.from(categories);
  }
}

// Create and export singleton instance
export const sessionTypeRegistry = new SessionTypeRegistry();