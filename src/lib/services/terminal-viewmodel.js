/**
 * Terminal View Model
 * Coordinates between Terminal component and services, manages state
 */

import { writable, derived } from 'svelte/store';
import { goto } from '$app/navigation';
import { STORAGE_CONFIG } from '../config/constants.js';
import { ErrorHandler, SafeStorage } from '../utils/error-handling.js';
import { TerminalSocketService } from './terminal-socket.js';
import { TerminalSessionService } from './terminal-session.js';
import { TerminalConfigurationService } from './terminal-configuration.js';
import { createCleanupManager } from '../utils/cleanup-manager.js';

export class TerminalViewModel {
  constructor() {
    // Services
    this.socketService = new TerminalSocketService();
    this.sessionService = new TerminalSessionService(this.socketService);
    this.configService = new TerminalConfigurationService();
    
    // Cleanup manager
    this.cleanupManager = createCleanupManager('TerminalViewModel');
    
    // State stores
    this.isInitialized = writable(false);
    this.isLoading = writable(false);
    this.error = writable(null);
    this.connectionStatus = writable('disconnected');
    this.sessionInfo = writable(null);
    
    // Derived stores
    this.isConnected = derived(
      this.connectionStatus,
      $status => $status === 'connected' || $status === 'attached'
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
  }

  /**
   * Initialize the terminal view model
   * @param {Object} options - Initialization options
   * @returns {Promise<boolean>} Success status
   */
  async initialize(options = {}) {
    try {
      this.isLoading.set(true);
      this.error.set(null);

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

      this.isInitialized.set(true);
      this.isLoading.set(false);
      
      console.debug('TerminalViewModel: Initialized successfully');
      return true;
    } catch (error) {
      this.error.set(error.message);
      this.isLoading.set(false);
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
    // Use external session
    this.sessionService.useExternalSession(sessionId, projectId);
    
    // Set up socket event listeners using the external socket
    this.setupSocketEventListeners(socket);
    
    this.connectionStatus.set('connected');
    this.updateSessionInfo();
    
    console.debug('TerminalViewModel: Initialized with external session');
  }

  /**
   * Initialize own session (self-contained mode)
   */
  async initializeOwnSession() {
    // Get auth key from localStorage
    const storedAuth = SafeStorage.getItem("dispatch-auth-token", null);
    const authKey = storedAuth === "no-auth" ? "" : storedAuth || "";
    
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
    
    this.connectionStatus.set('connected');
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
      // Initialize configuration service
      const configInitialized = await this.configService.initialize(terminal, options);
      if (!configInitialized) {
        throw new Error('Failed to initialize terminal configuration');
      }

      // Setup input handling
      this.setupInputHandling();
      
      // Restore session history
      this.restoreSessionHistory();
      
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
      this.error.set(err.message);
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
    
    // Write to terminal
    this.configService.write(data);
    
    // Add to session history
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
    
    // Update terminal buffer cache
    const terminal = this.configService.getTerminal();
    if (terminal) {
      this.sessionService.updateBuffer(terminal);
      
      // Notify parent component of buffer update
      const currentBuffer = this.sessionService.getCurrentBuffer();
      this.onBufferUpdate(currentBuffer);
    }
  }

  /**
   * Setup input handling
   */
  setupInputHandling() {
    if (this.inputDisposable) {
      this.inputDisposable();
    }

    this.inputDisposable = this.configService.setupInputHandler((data) => {
      // Send input to session
      this.sessionService.sendInput(data);
      
      // Notify event handler
      this.onInputEvent(data);
    });
  }

  /**
   * Restore session history
   */
  restoreSessionHistory() {
    const storedHistory = this.sessionService.getHistory();
    
    if (storedHistory) {
      console.debug('TerminalViewModel: Restoring session history, length:', storedHistory.length);
      this.configService.write(storedHistory);
      
      // Update buffer
      const currentBuffer = this.sessionService.getCurrentBuffer();
      this.onBufferUpdate(currentBuffer);
    }
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
    this.sessionInfo.set(info);
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
   * Get stores for reactive UI
   * @returns {Object} Store objects
   */
  getStores() {
    return {
      isInitialized: this.isInitialized,
      isLoading: this.isLoading,
      error: this.error,
      connectionStatus: this.connectionStatus,
      sessionInfo: this.sessionInfo,
      isConnected: this.isConnected
    };
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

    // Reset state
    this.isInitialized.set(false);
    this.isLoading.set(false);
    this.error.set(null);
    this.connectionStatus.set('disconnected');
    this.sessionInfo.set(null);

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