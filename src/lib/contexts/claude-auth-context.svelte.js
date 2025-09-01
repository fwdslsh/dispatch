import { getContext, setContext } from 'svelte';

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
    // Check authentication status on initialization
    this.checkAuth();
  }

  /**
   * Check Claude CLI authentication status
   */
  async checkAuth() {
    this.loading = true;
    this.error = null;
    
    try {
      const response = await fetch('/api/claude/auth');
      const data = await response.json();
      
      this.authenticated = data.authenticated;
      this.error = data.error;
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
    if (!this.authenticated) {
      throw new Error('Not authenticated with Claude CLI');
    }

    const response = await fetch('/api/claude/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, options }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Query failed');
    }
    
    return data.response;
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