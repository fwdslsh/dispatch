/**
 * Project Page ViewModel
 * 
 * Simple ViewModel for the project page that handles business logic.
 * Uses straightforward reactive state with no unnecessary complexity.
 */

import { BaseViewModel } from '../../../src/lib/shared/contexts/BaseViewModel.svelte.js';

/**
 * Simple Project Page ViewModel
 * 
 * Handles business logic for the project page without unnecessary complexity.
 */
export class ProjectPageViewModel extends BaseViewModel {
  constructor(projectId, socket) {
    super();
    
    this.projectId = projectId;
    this.socket = socket;
    
    // Simple reactive state
    this.isInitialized = $state(false);
    this.currentProject = $state(null);
    this.currentSession = $state(null);
    
    // Component visibility (for {#if} statements in template)
    this.showTerminal = $state(false);
    this.showChat = $state(false);
    this.showSessionForm = $state(false);
    
    // Claude auth state
    this.claudeAuthState = $state('unchecked');
    this.claudeOAuthUrl = $state(null);
    this.claudeAuthToken = $state('');
    this.claudeAuthSessionId = $state(null);
    
    // Session creation state
    this.sessionCreationData = $state(null);
    this.selectedSessionType = $state(null);
    
    // Computed state
    this.isOnline = $derived(() => this.socket?.connected || false);
    this.canCreateClaude = $derived(() => this.claudeAuthState === 'authenticated');
  }

  /**
   * Simple initialization
   */
  async initialize() {
    try {
      console.log('ProjectPageViewModel: Initializing for project:', this.projectId);
      
      // Setup socket event handlers
      this.setupSocketHandlers();
      
      // Load project if we have an ID
      if (this.projectId) {
        await this.loadProject();
        await this.checkClaudeAuth();
      }
      
      this.isInitialized = true;
      console.log('ProjectPageViewModel: Initialized');
    } catch (error) {
      console.error('ProjectPageViewModel: Initialization failed:', error);
    }
  }

  /**
   * Setup socket event handlers
   */
  setupSocketHandlers() {
    if (!this.socket) return;
    
    // Claude auth handlers
    this.socket.on('claude-auth-url', (data) => {
      console.log('Received Claude OAuth URL:', data);
      this.claudeOAuthUrl = data.url;
      this.claudeAuthState = 'waiting-for-token';
    });

    this.socket.on('claude-token-saved', (data) => {
      console.log('Claude token saved:', data);
      this.claudeAuthState = 'authenticated';
      this.claudeOAuthUrl = null;
      this.claudeAuthToken = '';
      this.claudeAuthSessionId = null;
    });

    this.socket.on('claude-auth-error', (data) => {
      console.error('Claude auth error:', data.error);
      this.claudeAuthState = 'not-authenticated';
    });

    this.socket.on('claude-auth-ended', (data) => {
      console.log('Claude auth session ended:', data);
      this.claudeAuthState = data.exitCode === 0 ? 'authenticated' : 'not-authenticated';
      this.claudeOAuthUrl = null;
      this.claudeAuthToken = '';
      this.claudeAuthSessionId = null;
    });
  }

  /**
   * Load project data
   */
  async loadProject() {
    if (!this.socket || !this.projectId) return;
    
    try {
      const response = await new Promise((resolve) => {
        this.socket.emit('get-project', { projectId: this.projectId }, resolve);
      });
      
      if (response.success) {
        this.currentProject = response.project;
        console.log('Project loaded:', this.currentProject);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }

  /**
   * Check Claude authentication status
   */
  async checkClaudeAuth() {
    if (!this.socket || !this.projectId) return;

    this.claudeAuthState = 'checking';
    
    try {
      const response = await new Promise((resolve) => {
        this.socket.emit('check-claude-auth', { projectId: this.projectId }, resolve);
      });
      
      this.claudeAuthState = response.success && response.authenticated ? 
        'authenticated' : 'not-authenticated';
    } catch (error) {
      console.error('Claude auth check failed:', error);
      this.claudeAuthState = 'not-authenticated';
    }
  }

  /**
   * Start Claude authentication
   */
  async startClaudeAuth() {
    if (!this.socket || !this.projectId) return;

    this.claudeAuthState = 'authenticating';
    this.claudeOAuthUrl = null;
    this.claudeAuthToken = '';

    try {
      const response = await new Promise((resolve) => {
        this.socket.emit('start-claude-auth', { projectId: this.projectId }, resolve);
      });
      
      if (response.success) {
        this.claudeAuthSessionId = response.sessionId;
        console.log('Claude auth started, session:', response.sessionId);
      } else {
        console.error('Failed to start Claude auth:', response.error);
        this.claudeAuthState = 'not-authenticated';
      }
    } catch (error) {
      console.error('Claude auth start error:', error);
      this.claudeAuthState = 'not-authenticated';
    }
  }

  /**
   * Submit Claude auth token
   */
  async submitClaudeToken() {
    if (!this.socket || !this.claudeAuthSessionId || !this.claudeAuthToken.trim()) return;

    try {
      await new Promise((resolve) => {
        this.socket.emit('submit-auth-token', {
          sessionId: this.claudeAuthSessionId,
          token: this.claudeAuthToken.trim()
        }, resolve);
      });
      
      console.log('Claude token submitted');
    } catch (error) {
      console.error('Failed to submit Claude token:', error);
    }
  }

  /**
   * Handle session creation from form data
   */
  async handleCreateSession(sessionData) {
    try {
      const sessionType = sessionData.sessionType || this.selectedSessionType?.id || 'shell';
      const sessionName = sessionData.name || 'Terminal Session';
      
      console.log('Creating session:', { sessionType, sessionName, projectId: this.projectId });

      const response = await new Promise((resolve) => {
        this.socket.emit('create', {
          name: sessionName,
          mode: sessionType,
          project: { id: this.projectId },
          cols: 80,
          rows: 24,
          ...sessionData
        }, resolve);
      });

      if (response.success) {
        this.currentSession = response;
        
        // Show appropriate component
        if (sessionType === 'claude') {
          this.showChat = true;
          this.showTerminal = false;
        } else {
          this.showTerminal = true;
          this.showChat = false;
        }
        
        this.showSessionForm = false;
        console.log('Session created and component shown');
      }
    } catch (error) {
      console.error('Session creation failed:', error);
    }
  }

  /**
   * Show/hide components
   */
  showCreateForm() { this.showSessionForm = true; }
  hideCreateForm() { this.showSessionForm = false; }
  hideAllComponents() {
    this.showTerminal = false;
    this.showChat = false;
    this.showSessionForm = false;
    this.currentSession = null;
  }

  /**
   * Simple cleanup
   */
  destroy() {
    console.log('ProjectPageViewModel: Cleaning up');
    this.hideAllComponents();
    super.destroy();
  }
}