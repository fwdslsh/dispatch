<script>
  import { onMount, onDestroy } from 'svelte';
  import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
  import { PaneManager } from '../services/pane-manager.js';
  import { TerminalInstanceManager } from '../services/terminal-instance-manager.js';
  import ResizeHandle from './ResizeHandle.svelte';
  
  export let socket = null;
  export let sessionId = null;
  export let linkDetector = null;
  export let terminalOptions = {};
  export let onInputEvent = () => {};
  export let onOutputEvent = () => {};
  
  let containerElement;
  let panesWrapper;
  let paneManager;
  let terminalInstanceManager;
  let paneElements = new Map();
  let resizeHandle = null;
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartRatio = 50;
  let minPaneSize = 100; // Minimum pane size in pixels
  
  // Reactive state
  let panes = [];
  let dimensions = new Map();
  let layoutType = 'single';
  
  onMount(() => {
    console.debug('MultiPaneLayout onMount - desktop mode');
    
    paneManager = new PaneManager();
    terminalInstanceManager = new TerminalInstanceManager();
    
    // Try to load saved layout
    if (!paneManager.loadLayout()) {
      // Create initial pane
      paneManager.createPane({ title: 'Terminal 1' });
    }
    
    updatePanes();
    setupKeyboardShortcuts();
    setupResizeObserver();
    
    // Initial dimension calculation will be done when panesWrapper is available
  });
  
  onDestroy(() => {
    if (paneManager) {
      paneManager.saveLayout();
      paneManager.clearAll();
    }
    
    // Clean up terminal instances
    if (terminalInstanceManager) {
      terminalInstanceManager.cleanup();
    }
  });
  
  function updatePanes() {
    panes = paneManager.getAllPanes();
    layoutType = paneManager.layout.type;
    recalculateDimensions();
  }
  
  function recalculateDimensions() {
    if (!panesWrapper || !paneManager) return;
    
    const rect = panesWrapper.getBoundingClientRect();
    dimensions = paneManager.calculatePaneDimensions(rect.width, rect.height);
    
    // Fit terminals after layout change
    setTimeout(() => {
      if (terminalInstanceManager) {
        terminalInstanceManager.fitAll();
      }
    }, 100);
  }
  
  function setupKeyboardShortcuts() {
    const handleKeydown = (e) => {
      // Alt + Arrow keys for navigation
      if (e.altKey) {
        switch (e.key) {
          case 'ArrowUp':
            e.preventDefault();
            paneManager.navigatePane('up');
            updatePanes();
            break;
          case 'ArrowDown':
            e.preventDefault();
            paneManager.navigatePane('down');
            updatePanes();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            paneManager.navigatePane('left');
            updatePanes();
            break;
          case 'ArrowRight':
            e.preventDefault();
            paneManager.navigatePane('right');
            updatePanes();
            break;
        }
      }
      
      // Ctrl + Shift + D for vertical split
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        splitCurrentPane('vertical');
      }
      
      // Ctrl + Shift + E for horizontal split
      if (e.ctrlKey && e.shiftKey && e.key === 'E') {
        e.preventDefault();
        splitCurrentPane('horizontal');
      }
      
      // Ctrl + Shift + W to close current pane
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        closeCurrentPane();
      }
    };
    
    window.addEventListener('keydown', handleKeydown);
    
    return () => {
      window.removeEventListener('keydown', handleKeydown);
    };
  }
  
  function setupResizeObserver() {
    const resizeObserver = new ResizeObserver(() => {
      recalculateDimensions();
    });
    
    // We'll start observing once panesWrapper is available
    const startObserving = () => {
      if (panesWrapper) {
        resizeObserver.observe(panesWrapper);
        // Initial calculation
        recalculateDimensions();
      } else {
        // Try again in next frame
        requestAnimationFrame(startObserving);
      }
    };
    
    startObserving();
    
    return () => {
      resizeObserver.disconnect();
    };
  }
  
  function splitCurrentPane(direction) {
    const activePane = paneManager.getActivePane();
    if (!activePane) return;
    
    const newPane = paneManager.splitPane(activePane.id, direction);
    if (newPane) {
      updatePanes();
      
      // Create terminal for new pane
      setTimeout(() => {
        initializeTerminal(newPane.id);
      }, 100);
    }
  }
  
  function closeCurrentPane() {
    const activePane = paneManager.getActivePane();
    if (!activePane || panes.length <= 1) return;
    
    // Close terminal session if connected
    const instance = terminalInstanceManager.getInstance(activePane.id);
    if (instance && instance.socket && instance.sessionId) {
      instance.socket.emit('end', instance.sessionId);
    }
    
    // Destroy terminal instance
    terminalInstanceManager.destroyInstance(activePane.id);
    
    paneManager.removePane(activePane.id);
    updatePanes();
  }
  
  function handlePaneClick(paneId) {
    paneManager.focusPane(paneId);
    updatePanes();
    
    // Focus the terminal instance
    if (terminalInstanceManager) {
      terminalInstanceManager.setActiveInstance(paneId);
    }
  }
  
  async function initializeTerminal(paneId) {
    const pane = paneManager.panes.get(paneId);
    if (!pane) return;
    
    // Terminal will be initialized by onLoad callback
  }
  
  async function onTerminalLoad(paneId, terminal) {
    console.log(`Terminal loaded for pane ${paneId}`);
    
    // Create or get terminal instance
    let instance = terminalInstanceManager.getInstance(paneId);
    if (!instance) {
      instance = terminalInstanceManager.createInstance(paneId, {
        cols: terminal.cols,
        rows: terminal.rows
      });
    }
    
    // Load fit addon
    const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
    terminal.loadAddon(fitAddon);
    
    // Set terminal in instance manager
    terminalInstanceManager.setTerminal(paneId, terminal, fitAddon);
    
    const pane = paneManager.panes.get(paneId);
    if (pane) {
      pane.terminal = terminal;
    }
    
    // Register link detection if available
    if (linkDetector) {
      try {
        linkDetector.registerWithTerminal(terminal);
      } catch (error) {
        console.warn('Failed to register link detector:', error);
      }
    }
    
    // Focus the terminal so it can receive input
    terminal.focus();
    
    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
      // Focus again after fit to ensure it's ready for input
      terminal.focus();
    }, 100);
    
    // Set up socket connection for this pane
    if (socket && socket.connected) {
      if (paneManager.getAllPanes().length === 1 && sessionId) {
        // First pane connects to existing session
        pane.sessionId = sessionId;
        
        // Attach session to terminal instance
        terminalInstanceManager.attachSession(paneId, sessionId, socket);
        
        // Attach to existing session
        socket.emit('attach', {
          sessionId,
          cols: terminal.cols,
          rows: terminal.rows
        });
        
        console.log(`MultiPaneLayout: Attached pane ${paneId} to existing session ${sessionId}`);
      } else {
        // Additional panes create new sessions in the same directory
        socket.emit('create', {
          cols: terminal.cols,
          rows: terminal.rows,
          mode: 'shell',
          parentSessionId: sessionId // Use original session directory
        }, (response) => {
          if (response.ok) {
            const newSessionId = response.sessionId;
            pane.sessionId = newSessionId;
            
            // Attach session to terminal instance
            terminalInstanceManager.attachSession(paneId, newSessionId, socket);
            
            // Attach to new session
            socket.emit('attach', {
              sessionId: newSessionId,
              cols: terminal.cols,
              rows: terminal.rows
            });
            
            console.log(`MultiPaneLayout: Created new session ${newSessionId} for pane ${paneId}`);
          } else {
            console.error(`MultiPaneLayout: Failed to create session for pane ${paneId}:`, response.error);
          }
        });
      }
    }
  }
  
  function onTerminalData(paneId, data) {
    const instance = terminalInstanceManager.getInstance(paneId);
    if (instance && instance.socket && instance.sessionId) {
      // Send input to the specific session - simplified
      instance.socket.emit('input', data, instance.sessionId);
      // Simple input event tracking
      onInputEvent(data);
    }
  }
  
  // Resize handling with collision detection
  function handleResizeStart(event) {
    if (layoutType !== 'split') return;
    
    isResizing = true;
    resizeStartRatio = paneManager.layout.ratio || 50;
  }
  
  function handleResize(event) {
    if (!isResizing || !panesWrapper) return;
    
    const rect = panesWrapper.getBoundingClientRect();
    const direction = paneManager.layout.direction;
    const { delta } = event.detail;
    
    let newRatio;
    if (direction === 'vertical') {
      const percentChange = (delta / rect.width) * 100;
      newRatio = resizeStartRatio + percentChange;
      
      // Collision detection for vertical split
      const minRatio = (minPaneSize / rect.width) * 100;
      const maxRatio = 100 - minRatio;
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));
    } else {
      const percentChange = (delta / rect.height) * 100;
      newRatio = resizeStartRatio + percentChange;
      
      // Collision detection for horizontal split
      const minRatio = (minPaneSize / rect.height) * 100;
      const maxRatio = 100 - minRatio;
      newRatio = Math.max(minRatio, Math.min(maxRatio, newRatio));
    }
    
    paneManager.updateSplitRatio(newRatio);
    recalculateDimensions();
  }
  
  function handleResizeEnd(event) {
    isResizing = false;
    
    // Save layout after resize
    paneManager.saveLayout();
  }
  
  // Apply preset layouts
  function applyPreset(presetName) {
    paneManager.applyPreset(presetName);
    updatePanes();
    
    // Initialize terminals for new panes
    setTimeout(() => {
      panes.forEach(pane => {
        if (!terminalInstanceManager.getInstance(pane.id)) {
          initializeTerminal(pane.id);
        }
      });
    }, 100);
  }
  
</script>

<!-- Desktop-only multi-pane layout -->
<div class="multi-pane-container" bind:this={containerElement}>
  <!-- Layout controls -->
  <div class="pane-controls">
    <button onclick={() => applyPreset('single')} title="Single pane">
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1" y="1" width="14" height="14" stroke="currentColor" fill="none"/>
      </svg>
    </button>
    <button onclick={() => applyPreset('vertical')} title="Split vertical">
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1" y="1" width="6" height="14" stroke="currentColor" fill="none"/>
        <rect x="9" y="1" width="6" height="14" stroke="currentColor" fill="none"/>
      </svg>
    </button>
    <button onclick={() => applyPreset('horizontal')} title="Split horizontal">
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1" y="1" width="14" height="6" stroke="currentColor" fill="none"/>
        <rect x="1" y="9" width="14" height="6" stroke="currentColor" fill="none"/>
      </svg>
    </button>
    <button onclick={() => applyPreset('quad')} title="Quad grid">
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="1" y="1" width="6" height="6" stroke="currentColor" fill="none"/>
        <rect x="9" y="1" width="6" height="6" stroke="currentColor" fill="none"/>
        <rect x="1" y="9" width="6" height="6" stroke="currentColor" fill="none"/>
        <rect x="9" y="9" width="6" height="6" stroke="currentColor" fill="none"/>
      </svg>
    </button>
    
    <span class="separator">|</span>
    
    <button onclick={() => splitCurrentPane('vertical')} title="Split vertical (Ctrl+Shift+D)">
      Split V
    </button>
    <button onclick={() => splitCurrentPane('horizontal')} title="Split horizontal (Ctrl+Shift+E)">
      Split H
    </button>
    <button onclick={closeCurrentPane} title="Close pane (Ctrl+Shift+W)">
      Close
    </button>
  </div>
  
  <!-- Panes container -->
  <div class="panes-wrapper" 
       class:split-vertical={layoutType === 'split' && paneManager?.layout?.direction === 'vertical'}
       class:split-horizontal={layoutType === 'split' && paneManager?.layout?.direction === 'horizontal'}
       class:grid-layout={layoutType === 'grid'}
       bind:this={panesWrapper}>
    
    {#each panes as pane (pane.id)}
      {@const dim = dimensions.get(pane.id) || {}}
      <div 
        class="terminal-pane"
        class:focused={pane.focused}
        style="
          left: {dim.x || 0}px;
          top: {dim.y || 0}px;
          width: {dim.width || 0}px;
          height: {dim.height || 0}px;
        "
        onclick={(e) => {
          e.stopPropagation();
          handlePaneClick(pane.id);
        }}
      >
        <div class="pane-header">
          <span class="pane-title">{pane.title}</span>
          {#if pane.focused}
            <span class="focus-indicator">●</span>
          {/if}
        </div>
        
        <div class="pane-terminal">
          <Xterm 
            options={terminalOptions}
            onLoad={(terminal) => onTerminalLoad(pane.id, terminal)}
            onData={(data) => onTerminalData(pane.id, data)}
          />
        </div>
      </div>
    {/each}
    
    <!-- Resize handle for split layouts -->
    {#if layoutType === 'split' && panes.length === 2}
      {@const direction = paneManager?.layout?.direction}
      {@const pane0Dim = dimensions.get(panes[0].id)}
      {#if pane0Dim}
        <ResizeHandle
          direction={direction}
          position={{
            x: direction === 'vertical' ? pane0Dim.width : 0,
            y: direction === 'horizontal' ? pane0Dim.height : 0
          }}
          minSize={minPaneSize}
          maxSize={direction === 'vertical' 
            ? (panesWrapper?.getBoundingClientRect().width || 1000) - minPaneSize
            : (panesWrapper?.getBoundingClientRect().height || 1000) - minPaneSize}
          on:resizeStart={handleResizeStart}
          on:resize={handleResize}
          on:resizeEnd={handleResizeEnd}
        />
      {/if}
    {/if}
  </div>
</div>

<style>
  .multi-pane-container {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-darker, #0a0a0a);
  }
  
  .pane-controls {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background: var(--bg-dark, #1a1a1a);
    border-bottom: 1px solid var(--border, #333);
  }
  
  .pane-controls button {
    padding: 4px 8px;
    background: var(--surface, #2a2a2a);
    border: 1px solid var(--border, #333);
    color: var(--text-secondary, #ccc);
    cursor: pointer;
    border-radius: 4px;
    font-size: 12px;
    transition: all 0.2s;
  }
  
  .pane-controls button:hover {
    background: var(--primary-muted, #00ff8850);
    border-color: var(--primary, #00ff88);
    color: var(--primary, #00ff88);
  }
  
  .pane-controls svg {
    display: block;
  }
  
  .separator {
    color: var(--border, #333);
    margin: 0 4px;
  }
  
  .panes-wrapper {
    position: relative;
    flex: 1;
    overflow: hidden;
  }
  
  .terminal-pane {
    position: absolute;
    border: 1px solid var(--border, #333);
    background: var(--bg-darker, #0a0a0a);
    display: flex;
    flex-direction: column;
    transition: border-color 0.2s;
  }
  
  .terminal-pane.focused {
    border-color: var(--primary, #00ff88);
    z-index: 10;
  }
  
  .pane-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 4px 8px;
    background: var(--surface, #1a1a1a);
    border-bottom: 1px solid var(--border, #333);
    font-size: 12px;
    color: var(--text-secondary, #ccc);
  }
  
  .pane-title {
    font-family: var(--font-mono, monospace);
  }
  
  .focus-indicator {
    color: var(--primary, #00ff88);
    font-size: 10px;
  }
  
  .pane-terminal {
    flex: 1;
    overflow: hidden;
    padding: 4px;
  }
  
  /* ResizeHandle component will handle its own styles */
  
  /* Make sure xterm takes full space */
  .pane-terminal :global(.xterm) {
    width: 100% !important;
    height: 100% !important;
  }
  
  /* Desktop-only layout */
</style>