/**
 * Terminal Buffer Cache for Dispatch
 * Optimizes buffer operations with intelligent caching and change detection
 */

import { TERMINAL_CONFIG } from '../config/constants.js';
import { ErrorHandler } from '../utils/error-handling.js';

/**
 * Terminal Buffer Cache class
 * Provides optimized buffer extraction and caching for terminal components
 */
export class TerminalBufferCache {
  constructor(sessionId, config = TERMINAL_CONFIG) {
    this.sessionId = sessionId;
    this.config = config;
    
    // Cache storage
    this.bufferCache = new Map();
    this.lastBufferHash = null;
    this.lastBufferContent = '';
    
    // Performance metrics
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.lastUpdateTime = 0;
    
    // Change detection
    this.changeSubscribers = new Set();
    this.bufferChangeThreshold = config.BUFFER_CHANGE_THRESHOLD || 100; // Min chars change to notify
  }

  /**
   * Generate a fast hash for buffer change detection
   * @param {object} buffer - Terminal buffer
   * @returns {string} Buffer hash
   */
  generateBufferHash(buffer) {
    if (!buffer) return 'empty';
    
    // Fast hash based on buffer metrics and sample content
    const metrics = `${buffer.length}-${buffer.baseY}-${buffer.cursorY}-${buffer.cursorX}`;
    
    // Sample a few lines for content hash
    let contentSample = '';
    const sampleLines = Math.min(3, buffer.length);
    for (let i = 0; i < sampleLines; i++) {
      const line = buffer.getLine(i);
      if (line) {
        contentSample += line.translateToString(true).slice(0, 20);
      }
    }
    
    return `${metrics}-${contentSample.length}-${this.simpleHash(contentSample)}`;
  }

  /**
   * Simple hash function for content sampling
   * @param {string} str - String to hash
   * @returns {number} Hash value
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Extract buffer content with caching
   * @param {object} terminal - Terminal instance
   * @param {boolean} force - Force refresh cache
   * @returns {string} Buffer content
   */
  extractBuffer(terminal, force = false) {
    if (!terminal?.buffer?.active) {
      return '';
    }

    try {
      const buffer = terminal.buffer.active;
      const currentHash = this.generateBufferHash(buffer);

      // Check if we can use cached content
      if (!force && currentHash === this.lastBufferHash && this.bufferCache.has(currentHash)) {
        this.cacheHits++;
        return this.bufferCache.get(currentHash);
      }

      // Cache miss - extract new content
      this.cacheMisses++;
      const content = this.extractBufferContent(buffer);
      
      // Update cache
      this.bufferCache.set(currentHash, content);
      this.lastBufferHash = currentHash;
      
      // Manage cache size
      this.manageCacheSize();
      
      // Detect significant changes and notify subscribers
      const contentChanged = this.detectSignificantChange(this.lastBufferContent, content);
      if (contentChanged) {
        this.notifyChangeSubscribers(content);
        this.lastBufferContent = content;
      }
      
      this.lastUpdateTime = Date.now();
      return content;

    } catch (error) {
      ErrorHandler.handle(error, 'TerminalBufferCache.extractBuffer', false);
      return this.lastBufferContent || '';
    }
  }

  /**
   * Extract content from terminal buffer
   * @param {object} buffer - Terminal buffer
   * @returns {string} Extracted content
   */
  extractBufferContent(buffer) {
    const lines = [];
    
    try {
      // Extract visible buffer content
      const visibleStart = Math.max(0, buffer.baseY);
      const visibleEnd = Math.min(buffer.length, visibleStart + buffer.viewportY + 50); // Extra lines for context
      
      for (let i = visibleStart; i < visibleEnd; i++) {
        const line = buffer.getLine(i);
        if (line) {
          lines.push(line.translateToString(true));
        }
      }
      
      return lines.join('\n');
    } catch (error) {
      ErrorHandler.handle(error, 'TerminalBufferCache.extractBufferContent', false);
      return '';
    }
  }

  /**
   * Detect if buffer change is significant enough to notify subscribers
   * @param {string} oldContent - Previous content
   * @param {string} newContent - New content
   * @returns {boolean} Whether change is significant
   */
  detectSignificantChange(oldContent, newContent) {
    if (!oldContent && newContent) return true;
    if (!newContent) return false;
    
    const sizeDiff = Math.abs(newContent.length - oldContent.length);
    return sizeDiff > this.bufferChangeThreshold;
  }

  /**
   * Notify change subscribers
   * @param {string} content - New buffer content
   */
  notifyChangeSubscribers(content) {
    this.changeSubscribers.forEach(callback => {
      try {
        callback(content, this.sessionId);
      } catch (error) {
        ErrorHandler.handle(error, 'TerminalBufferCache.notifyChangeSubscribers', false);
      }
    });
  }

  /**
   * Subscribe to buffer changes
   * @param {Function} callback - Change callback
   * @returns {Function} Unsubscribe function
   */
  onBufferChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback must be a function');
    }
    
    this.changeSubscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.changeSubscribers.delete(callback);
    };
  }

  /**
   * Manage cache size to prevent memory leaks
   */
  manageCacheSize() {
    const maxCacheSize = this.config.MAX_BUFFER_CACHE_SIZE || 10;
    
    if (this.bufferCache.size > maxCacheSize) {
      // Remove oldest entries (simple FIFO)
      const entriesToRemove = this.bufferCache.size - maxCacheSize;
      const keys = Array.from(this.bufferCache.keys());
      
      for (let i = 0; i < entriesToRemove; i++) {
        this.bufferCache.delete(keys[i]);
      }
    }
  }

  /**
   * Get current buffer content without cache refresh
   * @returns {string} Last cached buffer content
   */
  getCurrentBuffer() {
    return this.lastBufferContent;
  }

  /**
   * Force refresh buffer cache
   * @param {object} terminal - Terminal instance
   * @returns {string} Refreshed buffer content
   */
  refreshBuffer(terminal) {
    return this.extractBuffer(terminal, true);
  }

  /**
   * Get cache performance statistics
   * @returns {object} Performance stats
   */
  getStats() {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? (this.cacheHits / totalRequests) * 100 : 0;
    
    return {
      sessionId: this.sessionId,
      cacheSize: this.bufferCache.size,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      hitRate: Math.round(hitRate * 100) / 100,
      lastUpdateTime: this.lastUpdateTime,
      subscriberCount: this.changeSubscribers.size,
      bufferSize: this.lastBufferContent.length
    };
  }

  /**
   * Clear cache and reset statistics
   */
  clearCache() {
    this.bufferCache.clear();
    this.lastBufferHash = null;
    this.lastBufferContent = '';
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.lastUpdateTime = 0;
    
    console.debug(`[TerminalBufferCache] Cleared cache for session ${this.sessionId}`);
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy() {
    this.clearCache();
    this.changeSubscribers.clear();
    
    console.debug(`[TerminalBufferCache] Destroyed cache for session ${this.sessionId}`);
  }
}

/**
 * Buffer Cache Manager
 * Manages multiple buffer caches for different sessions
 */
export class BufferCacheManager {
  constructor() {
    this.caches = new Map();
  }

  /**
   * Get or create buffer cache for session
   * @param {string} sessionId - Session ID
   * @returns {TerminalBufferCache} Buffer cache for session
   */
  getCache(sessionId) {
    if (!this.caches.has(sessionId)) {
      this.caches.set(sessionId, new TerminalBufferCache(sessionId));
    }
    return this.caches.get(sessionId);
  }

  /**
   * Remove buffer cache for session
   * @param {string} sessionId - Session ID
   */
  removeCache(sessionId) {
    const cache = this.caches.get(sessionId);
    if (cache) {
      cache.destroy();
      this.caches.delete(sessionId);
    }
  }

  /**
   * Get all active caches
   * @returns {TerminalBufferCache[]} Array of active caches
   */
  getAllCaches() {
    return Array.from(this.caches.values());
  }

  /**
   * Get statistics for all caches
   * @returns {object[]} Array of cache statistics
   */
  getAllStats() {
    return this.getAllCaches().map(cache => cache.getStats());
  }

  /**
   * Cleanup all caches
   */
  cleanup() {
    for (const cache of this.caches.values()) {
      cache.destroy();
    }
    this.caches.clear();
    console.debug('[BufferCacheManager] Cleaned up all caches');
  }
}

// Export singleton instance
export const bufferCacheManager = new BufferCacheManager();