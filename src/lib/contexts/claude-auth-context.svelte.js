import { getContext, setContext } from 'svelte';
import { io } from 'socket.io-client';

const CLAUDE_AUTH_CONTEXT_KEY = 'claude-auth';

/**
 * Claude authentication context for managing auth state across components
 */
class ClaudeAuthContext {
  authenticated = $state(false);
  loading = $state(false);
  error = $state(null);
  lastChecked = $state(null);

  constructor() {
    // Initialize socket connection
    this.socket = null;
    this.terminalKey = null;
    this.socketAuthenticated = false;
    
    // Check authentication status on initialization
    this.initSocket();
  }

  async initSocket() {
    try {
      this.socket = io();
      
      this.socket.on('connect', () => {
        console.log('Claude auth context connected to socket');
        // Authenticate socket when connected
        const key = this.terminalKey || 'test'; // Use test key for development
        this.socket.emit('auth', key, (response) => {
          if (response?.success) {
            this.socketAuthenticated = true;
            this.checkAuth(); // Check Claude auth after socket auth
          } else {
            console.error('Socket authentication failed:', response);
            this.socketAuthenticated = false;
            this.authenticated = false;
            this.error = 'Socket authentication failed';
            this.loading = false;
          }
        });
      });

      this.socket.on('disconnect', () => {
        console.log('Claude auth context disconnected from socket');
        this.socketAuthenticated = false;
      });
    } catch (error) {
      console.error('Failed to initialize socket:', error);
      this.authenticated = false;
      this.error = 'Failed to connect to server';
      this.loading = false;
    }
  }

  setTerminalKey(key) {
    this.terminalKey = key;
    if (this.socket && this.socket.connected) {
      this.socket.emit('auth', key, (response) => {
        this.socketAuthenticated = response?.success || false;
        if (this.socketAuthenticated) {
          this.checkAuth();
        }
      });
    }
  }

  /**
   * Check Claude CLI authentication status
   */
  async checkAuth() {
    if (!this.socket || !this.socketAuthenticated) {
      this.authenticated = false;
      this.error = 'Socket not authenticated';
      this.loading = false;
      return;
    }

    this.loading = true;
    this.error = null;
    
    try {
      const response = await new Promise((resolve, reject) => {
        this.socket.emit('check-claude-auth', {}, (response) => {
          if (response) {
            resolve(response);
          } else {
            reject(new Error('No response received'));
          }
        });
      });
      
      this.authenticated = response.authenticated || false;
      this.error = response.error;
      this.lastChecked = new Date();
      
    } catch (error) {
      console.error('Failed to check Claude auth:', error);
      this.authenticated = false;
      this.error = 'Failed to check authentication status';
    } finally {
      this.loading = false;
    }
  }

  /**
   * Execute a Claude query
   * @param {string} prompt - The prompt to send to Claude
   * @param {Object} options - Query options
   * @returns {Promise<string>} The response from Claude
   */
  async query(prompt, options = {}) {
    if (!this.socket || !this.socketAuthenticated) {
      throw new Error('Socket not authenticated');
    }
    
    if (!this.authenticated) {
      throw new Error('Not authenticated with Claude CLI');
    }

    const response = await new Promise((resolve, reject) => {
      this.socket.emit('claude-query', { prompt, options }, (response) => {
        if (response) {
          if (response.success) {
            resolve(response);
          } else {
            reject(new Error(response.error || 'Query failed'));
          }
        } else {
          reject(new Error('No response received'));
        }
      });
    });
    
    return response.response;
  }

  /**
   * Get authentication status with automatic refresh if stale
   * @param {number} maxAge - Maximum age in milliseconds before refresh
   * @returns {boolean} Current authentication status
   */
  async getAuthStatus(maxAge = 60000) { // 1 minute default
    const now = new Date();
    const shouldRefresh = !this.lastChecked || 
                         (now - this.lastChecked) > maxAge;
    
    if (shouldRefresh && !this.loading) {
      await this.checkAuth();
    }
    
    return this.authenticated;
  }

  /**
   * Force refresh of authentication status
   */
  async refresh() {
    await this.checkAuth();
  }

  /**
   * Get current authentication state
   */
  get authState() {
    return {
      authenticated: this.authenticated,
      loading: this.loading,
      error: this.error,
      lastChecked: this.lastChecked
    };
  }

  /**
   * Cleanup socket connection
   */
  destroy() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.socketAuthenticated = false;
  }
}

/**
 * Create and set Claude authentication context
 * @returns {ClaudeAuthContext} The authentication context
 */
export function createClaudeAuthContext() {
  const context = new ClaudeAuthContext();
  setContext(CLAUDE_AUTH_CONTEXT_KEY, context);
  return context;
}

/**
 * Get Claude authentication context
 * @returns {ClaudeAuthContext} The authentication context
 */
export function getClaudeAuthContext() {
  const context = getContext(CLAUDE_AUTH_CONTEXT_KEY);
  
  if (!context) {
    throw new Error('Claude auth context not found. Make sure to call createClaudeAuthContext() in a parent component.');
  }
  
  return context;
}