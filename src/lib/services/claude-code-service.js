import { query } from '@anthropic-ai/claude-code';

/**
 * Service wrapper for Claude Code SDK integration
 * Provides authentication management, error handling, and request queuing
 */
export class ClaudeCodeService {
  constructor(options = {}) {
    this.authenticated = false;
    this.lastError = null;
    this.requestQueue = [];
    this.processing = false;
    this.options = {
      allowedTools: ['Read', 'Grep', 'WriteFile', 'Bash', 'WebSearch'],
      permissionMode: 'default',
      maxTurns: 5,
      ...options
    };
  }

  /**
   * Check authentication status with Claude CLI
   * @returns {Promise<boolean>} Authentication status
   */
  async checkAuthentication() {
    try {
      // Test authentication by making a simple query
      // The SDK will throw if not authenticated
      const testQuery = query({
        prompt: 'test',
        options: { maxTurns: 1 }
      });
      
      // Try to get first result
      const iterator = testQuery[Symbol.asyncIterator]();
      await iterator.next();
      
      this.authenticated = true;
      this.lastError = null;
      return true;
    } catch (error) {
      this.lastError = error;
      this.authenticated = false;
      return false;
    }
  }

  /**
   * Execute a query using Claude Code SDK
   * @param {string} prompt - The prompt to send to Claude
   * @param {Object} options - Query options
   * @returns {Promise<string>} The complete response from Claude
   */
  async query(prompt, options = {}) {
    // Check authentication first
    if (!this.authenticated) {
      const authSuccess = await this.checkAuthentication();
      if (!authSuccess) {
        throw new Error('Not authenticated with Claude CLI. Please run: claude-code login');
      }
    }

    const queryOptions = {
      prompt,
      allowedTools: options.allowedTools || this.options.allowedTools,
      permissionMode: options.permissionMode || this.options.permissionMode,
      maxTurns: options.maxTurns || this.options.maxTurns,
      ...options
    };

    let fullResponse = '';
    
    try {
      for await (const message of query({ prompt, options: queryOptions })) {
        if (message.type === 'result') {
          fullResponse += message.result;
        }
        // Additional message types can be handled here for streaming UI updates
      }
      
      return fullResponse;
    } catch (error) {
      this.lastError = error;
      throw error;
    }
  }

  /**
   * Add a query to the processing queue to prevent concurrent requests
   * @param {string} prompt - The prompt to send to Claude
   * @param {Object} options - Query options
   * @returns {Promise<string>} Promise that resolves with the response
   */
  async queueQuery(prompt, options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ prompt, options, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process queued requests sequentially
   * @private
   */
  async processQueue() {
    if (this.processing || this.requestQueue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.requestQueue.length > 0) {
      const { prompt, options, resolve, reject } = this.requestQueue.shift();
      
      try {
        const result = await this.query(prompt, options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Check if service is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return this.authenticated;
  }

  /**
   * Get the last error that occurred
   * @returns {Error|null} The last error or null if no error
   */
  getLastError() {
    return this.lastError;
  }

  /**
   * Clear all pending requests from the queue
   */
  clearQueue() {
    this.requestQueue = [];
  }

  /**
   * Get the current queue length
   * @returns {number} Number of pending requests
   */
  getQueueLength() {
    return this.requestQueue.length;
  }

  /**
   * Check if the service is currently processing requests
   * @returns {boolean} Processing status
   */
  isProcessing() {
    return this.processing;
  }
}

// Export a singleton instance for convenience
export const claudeCodeService = new ClaudeCodeService();