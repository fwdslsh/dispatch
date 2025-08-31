import { JSDOM } from 'jsdom';

// Simple assertion helper
function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Mock environment setup
const dom = new JSDOM('<!DOCTYPE html><div id="test-container"></div>', {
  url: 'http://localhost',
  pretendToBeVisual: true
});

global.window = dom.window;
global.document = dom.window.document;
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);

// Mock Terminal class (simulating xterm.js)
class MockTerminal {
  constructor(options = {}) {
    this.id = Math.random().toString(36).substr(2, 9);
    this.cols = options.cols || 80;
    this.rows = options.rows || 24;
    this.element = null;
    this.disposed = false;
    this.focused = false;
    this.buffer = [];
    this.onData = null;
    this.onResize = null;
    this.addons = new Map();
  }
  
  open(element) {
    this.element = element;
    element.innerHTML = `<div class="xterm-screen">Terminal ${this.id}</div>`;
  }
  
  write(data) {
    this.buffer.push(data);
  }
  
  focus() {
    this.focused = true;
  }
  
  blur() {
    this.focused = false;
  }
  
  dispose() {
    this.disposed = true;
    this.element = null;
    this.buffer = [];
    this.addons.clear();
  }
  
  resize(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    if (this.onResize) {
      this.onResize({ cols, rows });
    }
  }
  
  loadAddon(addon) {
    this.addons.set(addon.constructor.name, addon);
  }
}

// Mock Terminal Instance Manager
class TerminalInstanceManager {
  constructor() {
    this.instances = new Map();
    this.activeInstanceId = null;
    this.sessionMapping = new Map(); // Map session IDs to terminal instances
  }
  
  createInstance(paneId, options = {}) {
    if (this.instances.has(paneId)) {
      throw new Error(`Terminal instance for pane ${paneId} already exists`);
    }
    
    const terminal = new MockTerminal(options);
    const instance = {
      paneId,
      terminal,
      sessionId: null,
      socket: null,
      handlers: new Map(),
      created: Date.now()
    };
    
    this.instances.set(paneId, instance);
    
    if (!this.activeInstanceId) {
      this.activeInstanceId = paneId;
    }
    
    return instance;
  }
  
  destroyInstance(paneId) {
    const instance = this.instances.get(paneId);
    if (!instance) return false;
    
    // Clean up socket handlers
    if (instance.socket) {
      instance.handlers.forEach((handler, event) => {
        instance.socket.removeListener(event, handler);
      });
    }
    
    // Dispose terminal
    instance.terminal.dispose();
    
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
  
  getInstance(paneId) {
    return this.instances.get(paneId);
  }
  
  getActiveInstance() {
    return this.instances.get(this.activeInstanceId);
  }
  
  setActiveInstance(paneId) {
    if (!this.instances.has(paneId)) {
      throw new Error(`Terminal instance ${paneId} does not exist`);
    }
    
    // Blur previous active
    const prevActive = this.getActiveInstance();
    if (prevActive) {
      prevActive.terminal.blur();
    }
    
    // Focus new active
    this.activeInstanceId = paneId;
    const newActive = this.getActiveInstance();
    if (newActive) {
      newActive.terminal.focus();
    }
  }
  
  attachSession(paneId, sessionId, socket) {
    const instance = this.instances.get(paneId);
    if (!instance) {
      throw new Error(`Terminal instance ${paneId} does not exist`);
    }
    
    instance.sessionId = sessionId;
    instance.socket = socket;
    this.sessionMapping.set(sessionId, paneId);
    
    // Set up output handler
    const outputHandler = (data) => {
      instance.terminal.write(data);
    };
    
    socket.on(`output-${sessionId}`, outputHandler);
    instance.handlers.set(`output-${sessionId}`, outputHandler);
    
    // Set up input handler
    instance.terminal.onData = (data) => {
      socket.emit('input', data, sessionId);
    };
  }
  
  detachSession(paneId) {
    const instance = this.instances.get(paneId);
    if (!instance) return;
    
    // Clean up handlers
    if (instance.socket && instance.handlers.size > 0) {
      instance.handlers.forEach((handler, event) => {
        instance.socket.removeListener(event, handler);
      });
      instance.handlers.clear();
    }
    
    // Remove from session mapping
    if (instance.sessionId) {
      this.sessionMapping.delete(instance.sessionId);
    }
    
    instance.sessionId = null;
    instance.socket = null;
    instance.terminal.onData = null;
  }
  
  resizeInstance(paneId, cols, rows) {
    const instance = this.instances.get(paneId);
    if (!instance) return;
    
    instance.terminal.resize(cols, rows);
    
    // Emit resize event to server if connected
    if (instance.socket && instance.sessionId) {
      instance.socket.emit('resize', { cols, rows, sessionId: instance.sessionId });
    }
  }
  
  getAllInstances() {
    return Array.from(this.instances.values());
  }
  
  getInstanceBySession(sessionId) {
    const paneId = this.sessionMapping.get(sessionId);
    return paneId ? this.instances.get(paneId) : null;
  }
  
  cleanup() {
    // Destroy all instances
    const paneIds = Array.from(this.instances.keys());
    paneIds.forEach(paneId => this.destroyInstance(paneId));
    
    this.instances.clear();
    this.sessionMapping.clear();
    this.activeInstanceId = null;
  }
}

// Mock Socket
class MockSocket {
  constructor() {
    this.connected = true;
    this.listeners = new Map();
  }
  
  emit(event, ...args) {
    // Simulate server response
    if (event === 'create') {
      const callback = args[args.length - 1];
      if (typeof callback === 'function') {
        callback({
          success: true,
          sessionId: 'session-' + Math.random().toString(36).substr(2, 9)
        });
      }
    }
  }
  
  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }
  
  removeListener(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  trigger(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }
}

// Test Suite
console.log('🧪 Testing Multiple Terminal Instance Management...\n');

try {
  // Test 3.1: Multiple xterm.js instance lifecycle
  console.log('📋 Test 3.1: Multiple xterm.js instance creation, destruction, and lifecycle management');
  
  const manager = new TerminalInstanceManager();
  
  // Test 3.1.1: Create multiple instances
  console.log('  Test 3.1.1: Create multiple terminal instances');
  const instance1 = manager.createInstance('pane-1', { cols: 80, rows: 24 });
  const instance2 = manager.createInstance('pane-2', { cols: 100, rows: 30 });
  const instance3 = manager.createInstance('pane-3', { cols: 120, rows: 40 });
  
  assert(manager.instances.size === 3, 'Should have 3 instances');
  assert(instance1.terminal.cols === 80, 'Instance 1 should have correct cols');
  assert(instance2.terminal.rows === 30, 'Instance 2 should have correct rows');
  assert(manager.activeInstanceId === 'pane-1', 'First instance should be active');
  console.log('    ✅ Multiple instances created successfully');
  
  // Test 3.1.2: Prevent duplicate instances
  console.log('  Test 3.1.2: Prevent duplicate instance creation');
  let errorThrown = false;
  try {
    manager.createInstance('pane-1');
  } catch (error) {
    errorThrown = true;
  }
  assert(errorThrown, 'Should throw error for duplicate pane ID');
  console.log('    ✅ Duplicate prevention works');
  
  // Test 3.1.3: Destroy instances
  console.log('  Test 3.1.3: Destroy terminal instances');
  const destroyed = manager.destroyInstance('pane-2');
  assert(destroyed === true, 'Should successfully destroy instance');
  assert(manager.instances.size === 2, 'Should have 2 instances after destruction');
  assert(instance2.terminal.disposed === true, 'Terminal should be disposed');
  assert(manager.activeInstanceId === 'pane-1', 'Active instance should remain unchanged');
  console.log('    ✅ Instance destruction works correctly');
  
  // Test 3.1.4: Active instance management
  console.log('  Test 3.1.4: Active instance switching');
  manager.setActiveInstance('pane-3');
  assert(manager.activeInstanceId === 'pane-3', 'Active instance should change');
  assert(instance3.terminal.focused === true, 'New active terminal should be focused');
  assert(instance1.terminal.focused === false, 'Previous active should be blurred');
  console.log('    ✅ Active instance switching works');
  
  // Test 3.2: Terminal instance registry
  console.log('\n  Test 3.2: Terminal instance registry tracking');
  const allInstances = manager.getAllInstances();
  assert(allInstances.length === 2, 'Should return all instances');
  assert(allInstances[0].paneId === 'pane-1' || allInstances[1].paneId === 'pane-1', 'Should include pane-1');
  assert(allInstances[0].paneId === 'pane-3' || allInstances[1].paneId === 'pane-3', 'Should include pane-3');
  console.log('    ✅ Instance registry works correctly');
  
  // Test 3.3: Socket connection multiplexing
  console.log('\n  Test 3.3: Socket connection multiplexing for multiple sessions');
  const socket = new MockSocket();
  
  // Attach sessions to instances
  manager.attachSession('pane-1', 'session-1', socket);
  manager.attachSession('pane-3', 'session-3', socket);
  
  assert(instance1.sessionId === 'session-1', 'Instance 1 should have session ID');
  assert(instance3.sessionId === 'session-3', 'Instance 3 should have session ID');
  assert(manager.sessionMapping.size === 2, 'Session mapping should have 2 entries');
  assert(manager.getInstanceBySession('session-1') === instance1, 'Should retrieve instance by session');
  console.log('    ✅ Socket multiplexing configured correctly');
  
  // Test 3.4: Terminal input/output routing
  console.log('\n  Test 3.4: Terminal input/output routing');
  
  // Test output routing
  socket.trigger('output-session-1', 'Hello from session 1');
  assert(instance1.terminal.buffer.includes('Hello from session 1'), 'Instance 1 should receive its output');
  assert(!instance3.terminal.buffer.includes('Hello from session 1'), 'Instance 3 should not receive instance 1 output');
  
  socket.trigger('output-session-3', 'Hello from session 3');
  assert(instance3.terminal.buffer.includes('Hello from session 3'), 'Instance 3 should receive its output');
  console.log('    ✅ Output routing works correctly');
  
  // Test 3.5: Memory management and cleanup
  console.log('\n  Test 3.5: Memory management and cleanup');
  
  // Detach a session
  manager.detachSession('pane-1');
  assert(instance1.sessionId === null, 'Session ID should be cleared');
  assert(instance1.handlers.size === 0, 'Handlers should be cleared');
  assert(manager.sessionMapping.size === 1, 'Session mapping should have 1 entry');
  console.log('    ✅ Session detachment cleans up properly');
  
  // Full cleanup
  manager.cleanup();
  assert(manager.instances.size === 0, 'All instances should be destroyed');
  assert(manager.sessionMapping.size === 0, 'Session mapping should be empty');
  assert(manager.activeInstanceId === null, 'Active instance should be null');
  assert(instance1.terminal.disposed === true, 'All terminals should be disposed');
  assert(instance3.terminal.disposed === true, 'All terminals should be disposed');
  console.log('    ✅ Full cleanup works correctly');
  
  // Test 3.6: Terminal resize handling
  console.log('\n  Test 3.6: Terminal resize event integration');
  const manager2 = new TerminalInstanceManager();
  const socket2 = new MockSocket();
  
  const resizeInstance = manager2.createInstance('resize-pane', { cols: 80, rows: 24 });
  manager2.attachSession('resize-pane', 'resize-session', socket2);
  
  let resizeEmitted = false;
  socket2.emit = (event, data) => {
    if (event === 'resize') {
      resizeEmitted = true;
      assert(data.cols === 120, 'Should emit new cols');
      assert(data.rows === 40, 'Should emit new rows');
      assert(data.sessionId === 'resize-session', 'Should include session ID');
    }
  };
  
  manager2.resizeInstance('resize-pane', 120, 40);
  assert(resizeInstance.terminal.cols === 120, 'Terminal cols should update');
  assert(resizeInstance.terminal.rows === 40, 'Terminal rows should update');
  assert(resizeEmitted === true, 'Resize event should be emitted');
  console.log('    ✅ Resize handling works correctly');
  
  // Test 3.7: Instance lifecycle edge cases
  console.log('\n  Test 3.7: Instance lifecycle edge cases');
  const manager3 = new TerminalInstanceManager();
  
  // Destroy non-existent instance
  const destroyResult = manager3.destroyInstance('non-existent');
  assert(destroyResult === false, 'Should return false for non-existent instance');
  
  // Create and destroy active instance
  const edgeInstance = manager3.createInstance('edge-pane');
  assert(manager3.activeInstanceId === 'edge-pane', 'Should be active');
  manager3.destroyInstance('edge-pane');
  assert(manager3.activeInstanceId === null, 'Active should be null after destroying only instance');
  console.log('    ✅ Edge cases handled correctly');
  
  // Test 3.8: Terminal focus management
  console.log('\n  Test 3.8: Terminal focus management between panes');
  const manager4 = new TerminalInstanceManager();
  
  const focus1 = manager4.createInstance('focus-1');
  const focus2 = manager4.createInstance('focus-2');
  const focus3 = manager4.createInstance('focus-3');
  
  // Initial state
  assert(focus1.terminal.focused === false, 'First terminal should not be auto-focused');
  
  // Focus management during switching
  manager4.setActiveInstance('focus-1');
  assert(focus1.terminal.focused === true, 'Focus 1 should be focused');
  
  manager4.setActiveInstance('focus-2');
  assert(focus1.terminal.focused === false, 'Focus 1 should lose focus');
  assert(focus2.terminal.focused === true, 'Focus 2 should gain focus');
  
  manager4.setActiveInstance('focus-3');
  assert(focus2.terminal.focused === false, 'Focus 2 should lose focus');
  assert(focus3.terminal.focused === true, 'Focus 3 should gain focus');
  console.log('    ✅ Focus management works correctly');
  
  console.log('\n✅ All Test 3.1-3.8 multiple terminal instance tests passed!\n');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}

// Export for use in actual component
export { TerminalInstanceManager, MockTerminal };