/**
 * Claude Authentication ViewModel
 * 
 * Handles Claude authentication business logic using MVVM pattern.
 * Separates authentication concerns from UI components.
 */

import { BaseViewModel } from '../../../shared/contexts/BaseViewModel.svelte.js';

/**
 * Claude Authentication States
 */
export const CLAUDE_AUTH_STATES = {
  UNCHECKED: 'unchecked',
  CHECKING: 'checking',
  AUTHENTICATED: 'authenticated',
  NOT_AUTHENTICATED: 'not-authenticated',
  AUTHENTICATING: 'authenticating',
  WAITING_FOR_TOKEN: 'waiting-for-token'
};

/**
 * Claude Authentication ViewModel
 */
export class ClaudeAuthViewModel extends BaseViewModel {
  constructor(socketService, projectId) {
    super();
    
    this.socketService = socketService;
    this.projectId = projectId;
    
    // Authentication state
    this.authState = $state(CLAUDE_AUTH_STATES.UNCHECKED);
    this.authSessionId = $state(null);
    this.oAuthUrl = $state(null);
    this.authToken = $state('');
    
    // Computed states
    this.isAuthenticated = $derived(() => this.authState === CLAUDE_AUTH_STATES.AUTHENTICATED);
    this.isAuthenticating = $derived(() => 
      this.authState === CLAUDE_AUTH_STATES.AUTHENTICATING || 
      this.authState === CLAUDE_AUTH_STATES.CHECKING
    );
    this.canSubmitToken = $derived(() => 
      this.authState === CLAUDE_AUTH_STATES.WAITING_FOR_TOKEN && 
      this.authToken.trim().length > 0 && 
      this.authSessionId
    );
    this.showTokenInput = $derived(() => 
      this.authState === CLAUDE_AUTH_STATES.WAITING_FOR_TOKEN && 
      this.oAuthUrl
    );
    
    this.setupEventHandlers();
  }

  /**
   * Setup socket event handlers for Claude authentication
   */
  setupEventHandlers() {
    if (!this.socketService) return;

    this.socketService.on('claude-auth-url', (data) => {
      this.handleAuthUrl(data);
    });

    this.socketService.on('claude-token-saved', (data) => {
      this.handleTokenSaved(data);
    });

    this.socketService.on('claude-auth-error', (data) => {
      this.handleAuthError(data);
    });

    this.socketService.on('claude-auth-ended', (data) => {
      this.handleAuthEnded(data);
    });
  }

  /**
   * Check Claude authentication status
   * @returns {Promise<boolean>} Authentication status
   */
  async checkAuthStatus() {
    if (!this.socketService || !this.projectId) {
      console.warn('ClaudeAuthViewModel: Missing socket service or project ID');
      return false;
    }

    try {
      this.authState = CLAUDE_AUTH_STATES.CHECKING;
      
      const response = await this.socketService.emit('check-claude-auth', { 
        projectId: this.projectId 
      });
      
      if (response.success) {
        this.authState = response.authenticated ? 
          CLAUDE_AUTH_STATES.AUTHENTICATED : 
          CLAUDE_AUTH_STATES.NOT_AUTHENTICATED;
        
        console.log(`ClaudeAuthViewModel: Auth status checked - ${this.authState}`);
        return response.authenticated;
      } else {
        this.authState = CLAUDE_AUTH_STATES.NOT_AUTHENTICATED;
        console.warn('ClaudeAuthViewModel: Auth check failed:', response.error);
        return false;
      }
    } catch (error) {
      console.error('ClaudeAuthViewModel: Error checking auth status:', error);
      this.authState = CLAUDE_AUTH_STATES.NOT_AUTHENTICATED;
      return false;
    }
  }

  /**
   * Start Claude authentication process
   * @returns {Promise<boolean>} Success status
   */
  async startAuthentication() {
    if (!this.socketService || !this.projectId) {
      console.warn('ClaudeAuthViewModel: Missing socket service or project ID');
      return false;
    }

    try {
      this.authState = CLAUDE_AUTH_STATES.AUTHENTICATING;
      this.oAuthUrl = null;
      this.authToken = '';

      const response = await this.socketService.emit('start-claude-auth', { 
        projectId: this.projectId 
      });

      if (response.success) {
        this.authSessionId = response.sessionId;
        console.log('ClaudeAuthViewModel: Authentication started, session:', response.sessionId);
        return true;
      } else {
        console.error('ClaudeAuthViewModel: Failed to start authentication:', response.error);
        this.authState = CLAUDE_AUTH_STATES.NOT_AUTHENTICATED;
        return false;
      }
    } catch (error) {
      console.error('ClaudeAuthViewModel: Error starting authentication:', error);
      this.authState = CLAUDE_AUTH_STATES.NOT_AUTHENTICATED;
      return false;
    }
  }

  /**
   * Submit authentication token
   * @returns {Promise<boolean>} Success status
   */
  async submitToken() {
    if (!this.canSubmitToken) {
      console.warn('ClaudeAuthViewModel: Cannot submit token - invalid state');
      return false;
    }

    try {
      const response = await this.socketService.emit('submit-auth-token', {
        sessionId: this.authSessionId,
        token: this.authToken.trim()
      });

      if (response.success) {
        console.log('ClaudeAuthViewModel: Token submitted successfully');
        return true;
      } else {
        console.error('ClaudeAuthViewModel: Failed to submit token:', response.error);
        return false;
      }
    } catch (error) {
      console.error('ClaudeAuthViewModel: Error submitting token:', error);
      return false;
    }
  }

  /**
   * Set authentication token
   * @param {string} token - Authentication token
   */
  setToken(token) {
    this.authToken = typeof token === 'string' ? token : '';
  }

  /**
   * Reset authentication state
   */
  resetAuth() {
    this.authState = CLAUDE_AUTH_STATES.UNCHECKED;
    this.authSessionId = null;
    this.oAuthUrl = null;
    this.authToken = '';
    console.log('ClaudeAuthViewModel: Authentication state reset');
  }

  /**
   * Handle auth URL received from server
   */
  handleAuthUrl(data) {
    console.log('ClaudeAuthViewModel: Received OAuth URL:', data.url);
    this.oAuthUrl = data.url;
    this.authState = CLAUDE_AUTH_STATES.WAITING_FOR_TOKEN;
  }

  /**
   * Handle successful token save
   */
  handleTokenSaved(data) {
    console.log('ClaudeAuthViewModel: Token saved successfully:', data);
    this.authState = CLAUDE_AUTH_STATES.AUTHENTICATED;
    this.oAuthUrl = null;
    this.authToken = '';
    this.authSessionId = null;
  }

  /**
   * Handle authentication error
   */
  handleAuthError(data) {
    console.error('ClaudeAuthViewModel: Authentication error:', data.error);
    this.authState = CLAUDE_AUTH_STATES.NOT_AUTHENTICATED;
    
    // Emit error event for UI to handle
    this.emit('auth-error', {
      error: data.error,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle auth session ended
   */
  handleAuthEnded(data) {
    console.log('ClaudeAuthViewModel: Auth session ended:', data);
    
    if (data.exitCode === 0) {
      this.authState = CLAUDE_AUTH_STATES.AUTHENTICATED;
    } else {
      this.authState = CLAUDE_AUTH_STATES.NOT_AUTHENTICATED;
    }
    
    this.oAuthUrl = null;
    this.authToken = '';
    this.authSessionId = null;
    
    // Emit completion event
    this.emit('auth-completed', {
      success: data.exitCode === 0,
      exitCode: data.exitCode,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get authentication status summary
   */
  getAuthSummary() {
    return {
      state: this.authState,
      isAuthenticated: this.isAuthenticated,
      isAuthenticating: this.isAuthenticating,
      hasOAuthUrl: !!this.oAuthUrl,
      canSubmitToken: this.canSubmitToken,
      projectId: this.projectId
    };
  }

  /**
   * Cleanup resources
   */
  destroy() {
    super.destroy();
    this.resetAuth();
    console.log('ClaudeAuthViewModel: Destroyed');
  }
}