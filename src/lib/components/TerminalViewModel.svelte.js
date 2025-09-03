/**
 * Terminal View Model
 * Coordinates between Terminal component and services, manages state
 */

import { goto } from '$app/navigation';
import { ErrorHandler, SafeStorage } from '../utils/error-handling.js';
import { TerminalSocketService } from '$lib/services/terminal-socket.js';
import { TerminalSessionService } from '$lib/services//terminal-session.js';
import { TerminalConfigurationService } from '$lib/services//terminal-configuration.js';
import { createCleanupManager } from '../utils/cleanup-manager.js';

export class TerminalViewModel {
  constructor() {
    // Services
    this.socketService = new TerminalSocketService();
    this.sessionService = new TerminalSessionService(this.socketService);
    this.configService = new TerminalConfigurationService();
    
    // Cleanup manager
    this.cleanupManager = createCleanupManager('TerminalViewModel');
    
    // Svelte 5 reactive state
    this._state = $state({
      isInitialized: false,
      isLoading: false,
      error: null,
      connectionStatus: 'disconnected',
      sessionInfo: null
    });
    
    // Derived reactive state
    this.isConnected = $derived(
      this._state.connectionStatus === 'connected' || this._state.connectionStatus === 'attached'
    );
    
    // Event handlers
    this.onInputEvent = () => {};
    this.onOutputEvent = () => {};
    this.onBufferUpdate = () => {};
    this.onChatClick = () => {};
    
    // Internal state
    this.currentOutputBuffer = '';
    this.inputDisposable = null;
    this.socketEventUnsubscribes = [];
    this.queuedOutput = []; // Queue for output received before terminal is ready
  }

  /**
   * Initialize the terminal view model
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} Success status
   */
  async initialize(options = {}) {
    try {
      this._state.isLoading = true;
      this._state.error = null;

      const {
        socket = null,
        sessionId = null,
        projectId = null,
        initialHistory = '',
        terminalOptions = {},
        onInputEvent = () => {},
        onOutputEvent = () => {},
        onBufferUpdate = () => {},
        onChatClick = () => {}
      } = options;

      // Set event handlers
      this.onInputEvent = onInputEvent;
      this.onOutputEvent = onOutputEvent;
      this.onBufferUpdate = onBufferUpdate;
      this.onChatClick = onChatClick;

      // Initialize based on provided parameters
      if (socket && sessionId) {
        // Use external socket and session
        await this.initializeWithExternalSession(socket, sessionId, projectId);
      } else {
        // Create own socket and session (self-contained mode)
        await this.initializeOwnSession();
      }

      // Restore history if provided
      if (initialHistory) {
        this.restoreInitialHistory(initialHistory);
      }

      this._state.isInitialized = true;
      this._state.isLoading = false;
      
      console.debug('TerminalViewModel: Initialized successfully');
      return true;
    } catch (error) {
      this._state.error = error.message;
      this._state.isLoading = false;
      ErrorHandler.handle(error, 'TerminalViewModel.initialize');
      return false;
    }
  }

  /**
   * Initialize with external socket and session
   * @param {Object} socket - External socket
   * @param {string} sessionId - Session ID
   * @param {string} projectId - Project ID (optional)
   */
  async initializeWithExternalSession(socket, sessionId, projectId = null) {
    // Set up socket service to use the external socket
    this.socketService.setSocket(socket);
    
    // Set up socket event listeners FIRST so we can receive buffered data
    this.setupSocketEventListeners(socket);
    
    // Use external session and attach to it
    const attached = await this.sessionService.useExternalSession(sessionId, projectId);
    
    if (!attached) {
      throw new Error('Failed to attach to external session');
    }
    
    this._state.connectionStatus = 'connected';
    this.updateSessionInfo();
    
    console.debug('TerminalViewModel: Initialized with external session');
  }

  /**
   * Initialize own session (self-contained mode)
   */
  async initializeOwnSession() {
    // Get auth key from localStorage
    const storedAuth = SafeStorage.getItem("dispatch-auth-token", null);
    const authKey = storedAuth === "no-auth" ? "" : storedAuth || "testkey12345";
    
    console.log('Terminal auth - storedAuth:', storedAuth, 'authKey:', authKey);
    
    // Connect socket
    const connected = await this.socketService.connect(authKey);
    if (!connected) {
      throw new Error('Failed to connect to server');
    }
    
    // Create session
    const sessionCreated = await this.sessionService.createSession();
    if (!sessionCreated) {
      throw new Error('Failed to create session');
    }
    
    // Set up socket event listeners
    this.setupSocketEventListeners();
    
    this._state.connectionStatus = 'connected';
    this.updateSessionInfo();
    
    console.debug('TerminalViewModel: Initialized own session');
  }

  /**
   * Initialize terminal with terminal instance
   * @param {Object} terminal - Terminal instance
   * @param {Object} options - Terminal options
   * @returns {Promise<boolean>} Success status
   */
  async initializeTerminal(terminal, options = {}) {
    try {
      // Initialize configuration service (simplified)
      const configInitialized = await this.configService.initialize(terminal, options);
      if (!configInitialized) {
        throw new Error('Failed to initialize terminal configuration');
      }

      // Setup input handling ONCE
      this.setupInputHandling();
      
      // First, restore session history to show previous content
      const historyLoaded = this.restoreSessionHistory();
      
      // Then process any queued output from current session (don't duplicate with history)
      if (this.queuedOutput && this.queuedOutput.length > 0 && !historyLoaded) {
        console.debug('TerminalViewModel: Processing queued output:', this.queuedOutput.length, 'items');
        this.queuedOutput.forEach(data => {
          this.configService.write(data);
        });
        this.queuedOutput = [];
      } else if (this.queuedOutput && this.queuedOutput.length > 0) {
        console.debug('TerminalViewModel: Skipping queued output to avoid duplication with loaded history');
        this.queuedOutput = [];
      }
      
      // Send an empty string to trigger initial prompt display
      // This helps the PTY know the terminal is ready
      if (!historyLoaded) {
        this.cleanupManager.setTimeout(() => {
          if (this.sessionService.isActive()) {
            console.debug('TerminalViewModel: Triggering initial prompt');
            // Send empty string to trigger prompt without adding a newline
            this.sessionService.sendInput('');
          }
        }, 100);
      }
      
      console.debug('TerminalViewModel: Terminal initialized');
      return true;
    } catch (error) {
      ErrorHandler.handle(error, 'TerminalViewModel.initializeTerminal');
      return false;
    }
  }

  /**
   * Setup socket event listeners
   * @param {Object} externalSocket - External socket (optional)
   */
  setupSocketEventListeners(externalSocket = null) {
    const socket = externalSocket || this.socketService.getSocket();
    if (!socket) {
      console.warn('TerminalViewModel: No socket available for event listeners');
      return;
    }

    // Output event
    const unsubscribeOutput = this.sessionService.onSocketEvent('output', (output) => {
      this.handleSocketOutput(output);
    });
    this.socketEventUnsubscribes.push(unsubscribeOutput);

    // Connection error event
    const unsubscribeConnectError = this.sessionService.onSocketEvent('connect_error', (err) => {
      this.configService.writeln(`\r\n[connection error] ${err.message}\r\n`);
      this._state.error = err.message;
    });
    this.socketEventUnsubscribes.push(unsubscribeConnectError);

    // Session ended event
    const unsubscribeEnded = this.sessionService.onSocketEvent('ended', () => {
      this.configService.writeln('\r\n[session ended]\r\n');
      this.sessionService.clearStoredSessionId();
      this.sessionService.clearHistory();
      
      // Redirect to sessions page when session ends
      this.cleanupManager.setTimeout(() => {
        goto('/sessions');
      }, 1000);
    });
    this.socketEventUnsubscribes.push(unsubscribeEnded);

    console.debug('TerminalViewModel: Socket event listeners setup');
  }

  /**
   * Handle socket output
   * @param {string|Object} output - Output data
   */
  handleSocketOutput(output) {
    // Handle both old format (direct data) and new format (session-specific)
    const data = typeof output === 'string' ? output : output.data;
    
    // Skip empty data
    if (!data || data.length === 0) {
      return;
    }
    
    // Only write to terminal if configuration service is ready
    if (this.configService && this.configService.isTerminalInitialized()) {
      this.configService.write(data);
    } else {
      // Queue the data if terminal isn't ready yet
      if (!this.queuedOutput) {
        this.queuedOutput = [];
      }
      this.queuedOutput.push(data);
    }
    
    // Add to session history (this is the PTY output that should be saved)
    this.sessionService.addToHistory(data);
    
    // Accumulate output data for chat history
    this.currentOutputBuffer += data;
    
    // Check if we have complete lines (ends with newline or carriage return)
    if (data.includes('\n') || data.includes('\r')) {
      // Clean and process the accumulated output
      let cleanOutput = this.currentOutputBuffer
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .trim();
      
      if (cleanOutput) {
        // Add to shared output history
        this.onOutputEvent(cleanOutput);
      }
      
      this.currentOutputBuffer = '';
    }
    
    // Update terminal buffer cache and force save to history
    const terminal = this.configService.getTerminal();
    if (terminal) {
      this.sessionService.updateBuffer(terminal);
      
      // Force save history periodically to ensure persistence
      if (this.sessionService.historyService) {
        this.sessionService.historyService.save();
      }
      
      // Notify parent component of buffer update
      const currentBuffer = this.sessionService.getCurrentBuffer();
      this.onBufferUpdate(currentBuffer);
    }
  }

  /**
   * Setup input handling
   */
  setupInputHandling() {
    // CRITICAL: Always clean up existing handler first
    if (this.inputDisposable) {
      console.debug('TerminalViewModel: Cleaning up existing input handler');
      this.inputDisposable();
      this.inputDisposable = null;
    }

    // Set up the single input handler
    this.inputDisposable = this.configService.setupInputHandler((data) => {
      // Log input for debugging
      console.debug('TerminalViewModel: Received input from terminal:', JSON.stringify(data), 'sending to PTY');
      
      // Send input to session (PTY will echo back)
      this.sessionService.sendInput(data);
      
      // Notify event handler
      this.onInputEvent(data);
    });
    
    if (this.inputDisposable) {
      console.debug('TerminalViewModel: Input handling setup complete - keystroke wiring active');
    } else {
      console.error('TerminalViewModel: Failed to setup input handling - keystrokes will not work');
    }
  }

  /**
   * Restore session history
   * @returns {boolean} Whether history was loaded
   */
  restoreSessionHistory() {
    const storedHistory = this.sessionService.getHistory();
    
    if (storedHistory && storedHistory.length > 0) {
      console.debug('TerminalViewModel: Restoring session history, length:', storedHistory.length);
      this.configService.write(storedHistory);
      
      // Update buffer
      const currentBuffer = this.sessionService.getCurrentBuffer();
      this.onBufferUpdate(currentBuffer);
      return true;
    }
    
    console.debug('TerminalViewModel: No session history to restore');
    return false;
  }

  /**
   * Restore initial history
   * @param {string} initialHistory - Initial history to restore
   */
  restoreInitialHistory(initialHistory) {
    if (initialHistory) {
      console.debug('TerminalViewModel: Restoring initial history, length:', initialHistory.length);
      this.configService.write(initialHistory);
    }
  }

  /**
   * Update session info store
   */
  updateSessionInfo() {
    const info = this.sessionService.getSessionInfo();
    this._state.sessionInfo = info;
  }

  /**
   * Resize terminal
   * @param {number} cols - Columns
   * @param {number} rows - Rows
   */
  resize(cols, rows) {
    this.configService.resize(cols, rows);
    this.sessionService.resize(cols, rows);
  }

  /**
   * Fit terminal to container
   */
  fit() {
    this.configService.fit();
    
    // Update session with new dimensions
    const dimensions = this.configService.getDimensions();
    this.sessionService.resize(dimensions.cols, dimensions.rows);
  }

  /**
   * Get terminal dimensions
   * @returns {Object} Terminal dimensions
   */
  getDimensions() {
    return this.configService.getDimensions();
  }

  /**
   * Get session statistics
   * @returns {Object} Session statistics
   */
  getStats() {
    return this.sessionService.getStats();
  }

  /**
   * Get connection status
   * @returns {Object} Connection status
   */
  getConnectionStatus() {
    return this.socketService.getStatus();
  }

  /**
   * Clear terminal
   */
  clear() {
    this.configService.clear();
  }

  /**
   * Focus terminal
   */
  focus() {
    this.configService.focus();
  }

  /**
   * Write to terminal
   * @param {string} data - Data to write
   */
  write(data) {
    this.configService.write(data);
  }

  /**
   * Write line to terminal
   * @param {string} data - Data to write as a line
   */
  writeln(data) {
    this.configService.writeln(data);
  }

  /**
   * Get reactive state for Svelte 5 components
   * @returns {Object} State object
   */
  get state() {
    return this._state;
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Unsubscribe from socket events
    this.socketEventUnsubscribes.forEach(unsubscribe => unsubscribe());
    this.socketEventUnsubscribes = [];

    // Cleanup input handler
    if (this.inputDisposable) {
      this.inputDisposable();
      this.inputDisposable = null;
    }

    // Cleanup services
    this.sessionService.cleanup();
    this.configService.cleanup();
    
    // Note: Don't disconnect socket if it's external
    // Only disconnect if we own the socket
    if (this.sessionService.isOwnSession) {
      this.socketService.disconnect();
    }

    // Cleanup manager
    if (this.cleanupManager) {
      this.cleanupManager.cleanup();
    }

    // Clear queued output
    this.queuedOutput = [];
    
    // Reset state
    this._state.isInitialized = false;
    this._state.isLoading = false;
    this._state.error = null;
    this._state.connectionStatus = 'disconnected';
    this._state.sessionInfo = null;

    console.debug('TerminalViewModel: Cleaned up');
  }

  /**
   * Destroy the view model
   */
  destroy() {
    this.cleanup();
    
    // Destroy services
    this.sessionService.destroy();
    this.configService.destroy();
    
    console.debug('TerminalViewModel: Destroyed');
  }
}