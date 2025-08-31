/**
 * Terminal Instance Manager
 * Manages multiple terminal instances for multi-pane layouts
 */
export class TerminalInstanceManager {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.instances = new Map();
    this.activeInstanceId = null;
    this.sessionMapping = new Map(); // Map session IDs to terminal instances
  }
  
  /**
   * Create a new terminal instance for a pane
   */
  createInstance(paneId, options = {}) {
    if (this.instances.has(paneId)) {
      throw new Error(`Terminal instance for pane ${paneId} already exists`);
    }
    
    const instance = {
      paneId,
      terminal: null, // Will be set when terminal is loaded
      sessionId: null,
      socket: null,
      handlers: new Map(),
      fitAddon: null,
      created: Date.now(),
      cols: options.cols || 80,
      rows: options.rows || 24
    };
    
    this.instances.set(paneId, instance);
    
    if (!this.activeInstanceId) {
      this.activeInstanceId = paneId;
    }
    
    return instance;
  }
  
  /**
   * Destroy a terminal instance
   */
  destroyInstance(paneId) {
    const instance = this.instances.get(paneId);
    if (!instance) return false;
    
    // Clean up handlers
    if (instance.handlers.size > 0) {
      instance.handlers.forEach((handler, event) => {
        if (event === 'input') {
          // Dispose terminal input handler
          if (handler && typeof handler.dispose === 'function') {
            handler.dispose();
          }
        } else if (instance.socket) {
          // Remove socket event handlers
          instance.socket.off(event, handler);
        }
      });
    }
    
    // Dispose terminal and addons
    if (instance.terminal) {
      if (instance.fitAddon) {
        instance.fitAddon.dispose();
      }
      instance.terminal.dispose();
    }
    
    // Remove from session mapping
    if (instance.sessionId) {
      this.sessionMapping.delete(instance.sessionId);
    }
    
    // Remove from instances
    this.instances.delete(paneId);
    
    // Update active instance if needed
    if (this.activeInstanceId === paneId) {
      const remaining = Array.from(this.instances.keys());
      this.activeInstanceId = remaining.length > 0 ? remaining[0] : null;
    }
    
    return true;
  }
  
  /**
   * Get instance by pane ID
   */
  getInstance(paneId) {
    return this.instances.get(paneId);
  }
  
  /**
   * Get the active instance
   */
  getActiveInstance() {
    return this.instances.get(this.activeInstanceId);
  }
  
  /**
   * Set active instance and manage focus
   */
  setActiveInstance(paneId) {
    if (!this.instances.has(paneId)) {
      throw new Error(`Terminal instance ${paneId} does not exist`);
    }
    
    // Blur previous active terminal
    const prevActive = this.getActiveInstance();
    if (prevActive && prevActive.terminal) {
      prevActive.terminal.blur();
    }
    
    // Focus new active terminal
    this.activeInstanceId = paneId;
    const newActive = this.getActiveInstance();
    if (newActive && newActive.terminal) {
      setTimeout(() => {
        newActive.terminal.focus();
      }, 50);
    }
  }
  
  /**
   * Set the terminal object for an instance
   */
  setTerminal(paneId, terminal, fitAddon) {
    const instance = this.instances.get(paneId);
    if (!instance) {
      throw new Error(`Terminal instance ${paneId} does not exist`);
    }
    
    instance.terminal = terminal;
    instance.fitAddon = fitAddon;
    
    // Update dimensions
    if (terminal) {
      instance.cols = terminal.cols;
      instance.rows = terminal.rows;
    }
  }
  
  /**
   * Attach a session to a terminal instance
   */
  attachSession(paneId, sessionId, socket) {
    const instance = this.instances.get(paneId);
    if (!instance) {
      throw new Error(`Terminal instance ${paneId} does not exist`);
    }
    
    // Ensure terminal object is ready before attaching session
    if (!instance.terminal) {
      console.warn(`TerminalManager: Warning - terminal object not set for pane ${paneId} during session attachment`);
    }
    
    console.log(`TerminalManager: Attaching session ${sessionId} to pane ${paneId}`, {
      hasTerminal: !!instance.terminal,
      terminalCols: instance.terminal?.cols,
      terminalRows: instance.terminal?.rows
    });
    
    // Clean up any existing session
    if (instance.sessionId) {
      console.log(`TerminalManager: Detaching existing session ${instance.sessionId} from pane ${paneId}`);
      this.detachSession(paneId);
    }
    
    instance.sessionId = sessionId;
    instance.socket = socket;
    this.sessionMapping.set(sessionId, paneId);
    
    // Set up output handler for this specific session
    const outputHandler = (output) => {
      console.log(`TerminalManager: Output received for session ${output.sessionId}, target: ${sessionId}, pane: ${paneId}`);
      // Only write to this terminal if it's from the correct session
      if (instance.terminal && output.sessionId === sessionId) {
        console.log(`TerminalManager: Writing ${output.data.length} chars to terminal ${paneId}`);
        instance.terminal.write(output.data);
      } else {
        console.log(`TerminalManager: Ignoring output - reason:`, {
          hasTerminal: !!instance.terminal,
          sessionMatch: output.sessionId === sessionId,
          receivedSessionId: output.sessionId,
          expectedSessionId: sessionId,
          paneId: paneId
        });
      }
    };
    
    // Listen for output from this specific session
    console.log(`TerminalManager: Setting up output handler for pane ${paneId}, session ${sessionId}`);
    socket.on('output', outputHandler);
    instance.handlers.set('output', outputHandler);
    
    // Input handler is now managed by MultiPaneLayout.onTerminalData
    // to avoid duplicate input handling
    
    return true;
  }
  
  /**
   * Detach session from terminal instance
   */
  detachSession(paneId) {
    const instance = this.instances.get(paneId);
    if (!instance) return false;
    
    console.log(`TerminalManager: Detaching session ${instance.sessionId} from pane ${paneId}`);
    
    // Clean up handlers
    if (instance.handlers.size > 0) {
      console.log(`TerminalManager: Cleaning up ${instance.handlers.size} handlers for pane ${paneId}`);
      instance.handlers.forEach((handler, event) => {
        if (event === 'input') {
          // Dispose terminal input handler
          if (handler && typeof handler.dispose === 'function') {
            handler.dispose();
          }
        } else if (instance.socket) {
          // Remove socket event handlers
          console.log(`TerminalManager: Removing ${event} handler for pane ${paneId}`);
          instance.socket.off(event, handler);
        }
      });
      instance.handlers.clear();
    }
    
    // Remove from session mapping
    if (instance.sessionId) {
      this.sessionMapping.delete(instance.sessionId);
    }
    
    instance.sessionId = null;
    instance.socket = null;
    
    return true;
  }
  
  /**
   * Resize a terminal instance
   */
  resizeInstance(paneId, cols, rows) {
    const instance = this.instances.get(paneId);
    if (!instance) return false;
    
    instance.cols = cols;
    instance.rows = rows;
    
    // Resize the terminal
    if (instance.terminal) {
      instance.terminal.resize(cols, rows);
      
      // Fit to container if fit addon is available
      if (instance.fitAddon) {
        setTimeout(() => {
          instance.fitAddon.fit();
        }, 50);
      }
    }
    
    // Emit resize event to server if connected
    if (instance.socket && instance.sessionId) {
      instance.socket.emit('resize', { cols, rows, sessionId: instance.sessionId });
    }
    
    return true;
  }
  
  /**
   * Get all instances
   */
  getAllInstances() {
    return Array.from(this.instances.values());
  }
  
  /**
   * Get instance by session ID
   */
  getInstanceBySession(sessionId) {
    const paneId = this.sessionMapping.get(sessionId);
    return paneId ? this.instances.get(paneId) : null;
  }
  
  /**
   * Check if a pane has an active session
   */
  hasSession(paneId) {
    const instance = this.instances.get(paneId);
    return instance && instance.sessionId !== null;
  }
  
  /**
   * Get session ID for a pane
   */
  getSessionId(paneId) {
    const instance = this.instances.get(paneId);
    return instance ? instance.sessionId : null;
  }
  
  /**
   * Clean up all instances
   */
  cleanup() {
    // Destroy all instances
    const paneIds = Array.from(this.instances.keys());
    paneIds.forEach(paneId => this.destroyInstance(paneId));
    
    this.instances.clear();
    this.sessionMapping.clear();
    this.activeInstanceId = null;
  }
  
  /**
   * Fit all terminals to their containers
   */
  fitAll() {
    this.instances.forEach(instance => {
      if (instance.fitAddon) {
        instance.fitAddon.fit();
      }
    });
  }
  
  /**
   * Get statistics about terminal instances
   */
  getStats() {
    return {
      dispatchSessionId: this.sessionId,
      totalInstances: this.instances.size,
      activeSessions: this.sessionMapping.size,
      activeInstanceId: this.activeInstanceId,
      instances: Array.from(this.instances.entries()).map(([paneId, instance]) => ({
        paneId,
        hasTerminal: !!instance.terminal,
        hasSession: !!instance.sessionId,
        sessionId: instance.sessionId,
        cols: instance.cols,
        rows: instance.rows,
        created: instance.created
      }))
    };
  }
}