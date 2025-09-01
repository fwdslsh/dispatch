/**
 * Cleanup Management utilities for Dispatch
 * Provides systematic resource cleanup tracking and management
 */

import { ErrorHandler } from './error-handling.js';

/**
 * Cleanup Manager class
 * Tracks cleanup functions and resources to ensure proper cleanup
 */
export class CleanupManager {
  constructor(context = 'unknown') {
    this.context = context;
    this.cleanupFunctions = [];
    this.intervals = new Set();
    this.timeouts = new Set();
    this.eventListeners = [];
    this.observers = [];
    this.isDestroyed = false;
  }

  /**
   * Register a cleanup function
   * @param {Function} cleanupFn - Cleanup function to register
   * @param {string} description - Description of what this function cleans up
   */
  register(cleanupFn, description = 'unnamed') {
    if (this.isDestroyed) {
      console.warn(`[CleanupManager:${this.context}] Attempted to register after cleanup`);
      return;
    }

    if (typeof cleanupFn !== 'function') {
      console.warn(`[CleanupManager:${this.context}] Invalid cleanup function for: ${description}`);
      return;
    }

    this.cleanupFunctions.push({ fn: cleanupFn, description });
  }

  /**
   * Set interval with automatic cleanup tracking
   * @param {Function} fn - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Interval ID
   */
  setInterval(fn, delay) {
    if (this.isDestroyed) {
      console.warn(`[CleanupManager:${this.context}] Attempted to create interval after cleanup`);
      return null;
    }

    const id = setInterval(fn, delay);
    this.intervals.add(id);
    return id;
  }

  /**
   * Set timeout with automatic cleanup tracking
   * @param {Function} fn - Function to execute
   * @param {number} delay - Delay in milliseconds
   * @returns {number} Timeout ID
   */
  setTimeout(fn, delay) {
    if (this.isDestroyed) {
      console.warn(`[CleanupManager:${this.context}] Attempted to create timeout after cleanup`);
      return null;
    }

    const id = setTimeout(() => {
      // Remove from tracking when it executes
      this.timeouts.delete(id);
      fn();
    }, delay);
    
    this.timeouts.add(id);
    return id;
  }

  /**
   * Add event listener with automatic cleanup tracking
   * @param {EventTarget} target - Event target
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   * @param {object} options - Event listener options
   */
  addEventListener(target, event, handler, options = {}) {
    if (this.isDestroyed) {
      console.warn(`[CleanupManager:${this.context}] Attempted to add event listener after cleanup`);
      return;
    }

    target.addEventListener(event, handler, options);
    this.eventListeners.push({ target, event, handler, options });
  }

  /**
   * Add observer with automatic cleanup tracking
   * @param {object} observer - Observer instance (ResizeObserver, MutationObserver, etc.)
   * @param {string} description - Description of the observer
   */
  addObserver(observer, description = 'observer') {
    if (this.isDestroyed) {
      console.warn(`[CleanupManager:${this.context}] Attempted to add observer after cleanup`);
      return;
    }

    if (!observer || typeof observer.disconnect !== 'function') {
      console.warn(`[CleanupManager:${this.context}] Invalid observer: ${description}`);
      return;
    }

    this.observers.push({ observer, description });
  }

  /**
   * Clear a specific interval
   * @param {number} id - Interval ID
   */
  clearInterval(id) {
    if (this.intervals.has(id)) {
      clearInterval(id);
      this.intervals.delete(id);
    }
  }

  /**
   * Clear a specific timeout
   * @param {number} id - Timeout ID
   */
  clearTimeout(id) {
    if (this.timeouts.has(id)) {
      clearTimeout(id);
      this.timeouts.delete(id);
    }
  }

  /**
   * Remove a specific event listener
   * @param {EventTarget} target - Event target
   * @param {string} event - Event name
   * @param {Function} handler - Event handler
   */
  removeEventListener(target, event, handler) {
    const index = this.eventListeners.findIndex(
      listener => listener.target === target && 
                  listener.event === event && 
                  listener.handler === handler
    );
    
    if (index !== -1) {
      const listener = this.eventListeners[index];
      target.removeEventListener(event, handler, listener.options);
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Get cleanup statistics
   * @returns {object} Cleanup statistics
   */
  getStats() {
    return {
      context: this.context,
      cleanupFunctions: this.cleanupFunctions.length,
      intervals: this.intervals.size,
      timeouts: this.timeouts.size,
      eventListeners: this.eventListeners.length,
      observers: this.observers.length,
      isDestroyed: this.isDestroyed
    };
  }

  /**
   * Execute all cleanup operations
   */
  cleanup() {
    if (this.isDestroyed) {
      console.warn(`[CleanupManager:${this.context}] Already cleaned up`);
      return;
    }

    console.debug(`[CleanupManager:${this.context}] Starting cleanup...`);
    
    const stats = this.getStats();
    let errorCount = 0;

    // Clear intervals
    this.intervals.forEach(id => {
      try {
        clearInterval(id);
      } catch (error) {
        errorCount++;
        ErrorHandler.handle(error, `CleanupManager.${this.context}.clearInterval`, false);
      }
    });
    this.intervals.clear();

    // Clear timeouts
    this.timeouts.forEach(id => {
      try {
        clearTimeout(id);
      } catch (error) {
        errorCount++;
        ErrorHandler.handle(error, `CleanupManager.${this.context}.clearTimeout`, false);
      }
    });
    this.timeouts.clear();

    // Remove event listeners
    this.eventListeners.forEach(({ target, event, handler, options }) => {
      try {
        target.removeEventListener(event, handler, options);
      } catch (error) {
        errorCount++;
        ErrorHandler.handle(error, `CleanupManager.${this.context}.removeEventListener`, false);
      }
    });
    this.eventListeners = [];

    // Disconnect observers
    this.observers.forEach(({ observer, description }) => {
      try {
        observer.disconnect();
      } catch (error) {
        errorCount++;
        ErrorHandler.handle(error, `CleanupManager.${this.context}.observer.${description}`, false);
      }
    });
    this.observers = [];

    // Run registered cleanup functions
    this.cleanupFunctions.forEach(({ fn, description }) => {
      try {
        fn();
      } catch (error) {
        errorCount++;
        ErrorHandler.handle(error, `CleanupManager.${this.context}.${description}`, false);
      }
    });
    this.cleanupFunctions = [];

    this.isDestroyed = true;

    console.debug(`[CleanupManager:${this.context}] Cleanup completed:`, {
      ...stats,
      errors: errorCount
    });
  }

  /**
   * Check if manager is destroyed
   * @returns {boolean} Destroyed status
   */
  isDestroyed() {
    return this.isDestroyed;
  }
}

/**
 * Resource Manager class
 * Manages multiple cleanup managers for complex components
 */
export class ResourceManager {
  constructor(context = 'resource-manager') {
    this.context = context;
    this.managers = new Map();
    this.isDestroyed = false;
  }

  /**
   * Create or get a cleanup manager for a specific scope
   * @param {string} scope - Scope identifier
   * @returns {CleanupManager} Cleanup manager for the scope
   */
  getManager(scope) {
    if (this.isDestroyed) {
      console.warn(`[ResourceManager:${this.context}] Attempted to get manager after cleanup`);
      return null;
    }

    if (!this.managers.has(scope)) {
      this.managers.set(scope, new CleanupManager(`${this.context}.${scope}`));
    }
    return this.managers.get(scope);
  }

  /**
   * Cleanup a specific scope
   * @param {string} scope - Scope to cleanup
   */
  cleanupScope(scope) {
    const manager = this.managers.get(scope);
    if (manager) {
      manager.cleanup();
      this.managers.delete(scope);
    }
  }

  /**
   * Get statistics for all managers
   * @returns {object} Statistics for all scopes
   */
  getAllStats() {
    const stats = {
      context: this.context,
      totalManagers: this.managers.size,
      isDestroyed: this.isDestroyed,
      scopes: {}
    };

    for (const [scope, manager] of this.managers.entries()) {
      stats.scopes[scope] = manager.getStats();
    }

    return stats;
  }

  /**
   * Cleanup all managed resources
   */
  cleanup() {
    if (this.isDestroyed) {
      console.warn(`[ResourceManager:${this.context}] Already cleaned up`);
      return;
    }

    console.debug(`[ResourceManager:${this.context}] Cleaning up ${this.managers.size} managers`);

    for (const [scope, manager] of this.managers.entries()) {
      try {
        manager.cleanup();
      } catch (error) {
        ErrorHandler.handle(error, `ResourceManager.${this.context}.${scope}`, false);
      }
    }

    this.managers.clear();
    this.isDestroyed = true;

    console.debug(`[ResourceManager:${this.context}] Cleanup completed`);
  }
}

/**
 * Global cleanup registry for emergency cleanup
 * Useful for development and debugging
 */
class GlobalCleanupRegistry {
  constructor() {
    this.managers = new Set();
    this.setupEmergencyCleanup();
  }

  register(manager) {
    this.managers.add(manager);
  }

  unregister(manager) {
    this.managers.delete(manager);
  }

  setupEmergencyCleanup() {
    // Emergency cleanup on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        console.debug('[GlobalCleanupRegistry] Emergency cleanup on page unload');
        this.emergencyCleanup();
      });

      // Development helper
      if (process.env.NODE_ENV === 'development') {
        window._dispatchCleanupRegistry = this;
      }
    }
  }

  emergencyCleanup() {
    console.debug(`[GlobalCleanupRegistry] Emergency cleanup of ${this.managers.size} managers`);
    
    for (const manager of this.managers) {
      try {
        if (typeof manager.cleanup === 'function' && !manager.isDestroyed) {
          manager.cleanup();
        }
      } catch (error) {
        console.error('[GlobalCleanupRegistry] Error during emergency cleanup:', error);
      }
    }
    
    this.managers.clear();
  }

  getStats() {
    return {
      totalManagers: this.managers.size,
      managers: Array.from(this.managers).map(manager => {
        if (typeof manager.getStats === 'function') {
          return manager.getStats();
        }
        return { context: 'unknown', type: typeof manager };
      })
    };
  }
}

// Export singleton instance
export const globalCleanupRegistry = new GlobalCleanupRegistry();

/**
 * Utility function to create a managed cleanup function
 * Useful for components that need simple cleanup
 * @param {string} context - Context identifier
 * @returns {CleanupManager} New cleanup manager
 */
export function createCleanupManager(context) {
  const manager = new CleanupManager(context);
  globalCleanupRegistry.register(manager);
  
  // Auto-unregister when cleaned up
  manager.register(() => {
    globalCleanupRegistry.unregister(manager);
  }, 'global-registry-cleanup');
  
  return manager;
}