/**
 * Simple Session Service
 * 
 * Straightforward session management without unnecessary complexity.
 * Follows the simple service patterns defined in ServicePatterns.md
 */

/**
 * Simple Session Service
 */
export class SimpleSessionService {
  constructor(socketService) {
    this.socket = socketService;
    this.currentSession = $state(null);
    this.sessions = $state([]);
  }

  /**
   * Create a new session
   */
  async createSession(data) {
    try {
      const response = await this.socket.emit('create', {
        name: data.name || 'Terminal Session',
        mode: data.type || 'shell',
        project: data.projectId ? { id: data.projectId } : undefined,
        cols: data.cols || 80,
        rows: data.rows || 24,
        ...data
      });

      if (response.success) {
        this.currentSession = response;
        return { success: true, data: response };
      } else {
        return { success: false, error: response.error || 'Failed to create session' };
      }
    } catch (error) {
      console.error('SimpleSessionService: Create session failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Attach to an existing session
   */
  async attachToSession(sessionId, options = {}) {
    try {
      const response = await this.socket.emit('attach', {
        sessionId,
        cols: options.cols || 80,
        rows: options.rows || 24
      });

      if (response.success) {
        this.currentSession = response;
        return { success: true, data: response };
      } else {
        return { success: false, error: response.error || 'Failed to attach to session' };
      }
    } catch (error) {
      console.error('SimpleSessionService: Attach failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all sessions
   */
  async getSessions() {
    try {
      const response = await this.socket.emit('list');

      if (response.success) {
        this.sessions = response.sessions || [];
        return { success: true, data: this.sessions };
      } else {
        return { success: false, error: response.error || 'Failed to get sessions' };
      }
    } catch (error) {
      console.error('SimpleSessionService: Get sessions failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * End a session
   */
  async endSession(sessionId = null) {
    try {
      const response = await this.socket.emit('end', sessionId);
      
      if (!sessionId || sessionId === this.currentSession?.sessionId) {
        this.currentSession = null;
      }
      
      return { success: true };
    } catch (error) {
      console.error('SimpleSessionService: End session failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send input to current session
   */
  sendInput(input) {
    try {
      if (!this.currentSession) {
        return { success: false, error: 'No active session' };
      }

      this.socket.socket.emit('input', input);
      return { success: true };
    } catch (error) {
      console.error('SimpleSessionService: Send input failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Resize session terminal
   */
  resizeSession(cols, rows) {
    try {
      if (!this.currentSession) {
        return { success: false, error: 'No active session' };
      }

      this.socket.socket.emit('resize', { cols, rows });
      return { success: true };
    } catch (error) {
      console.error('SimpleSessionService: Resize failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Simple cleanup
   */
  destroy() {
    this.currentSession = null;
    this.sessions = [];
  }
}