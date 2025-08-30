<script>
  import { onMount, onDestroy } from 'svelte';
  import { Xterm, XtermAddon } from '@battlefieldduck/xterm-svelte';
  import { PaneManager } from '../services/pane-manager.js';
  
  export let socket = null;
  export let isMobile = false;
  export let sessionId = null;
  export let linkDetector = null;
  export let terminalOptions = {};
  export let onInputEvent = () => {};
  export let onOutputEvent = () => {};
  
  let containerElement;
  let paneManager;
  let paneElements = new Map();
  let terminals = new Map();
  let resizeHandle = null;
  let isResizing = false;
  let resizeStartX = 0;
  let resizeStartY = 0;
  let resizeStartRatio = 50;
  
  // Reactive state
  let panes = [];
  let dimensions = new Map();
  let layoutType = 'single';
  
  onMount(() => {
    if (isMobile) return; // Don't initialize on mobile
    
    paneManager = new PaneManager();
    
    // Try to load saved layout
    if (!paneManager.loadLayout()) {
      // Create initial pane
      paneManager.createPane({ title: 'Terminal 1' });
    }
    
    updatePanes();
    setupKeyboardShortcuts();
    setupResizeObserver();
    
    // Initial dimension calculation
    if (containerElement) {
      recalculateDimensions();
    }
  });
  
  onDestroy(() => {
    if (paneManager) {
      paneManager.saveLayout();
      paneManager.clearAll();
    }
    
    // Clean up terminals
    terminals.forEach(terminal => {
      if (terminal) terminal.dispose();
    });
  });
  
  function updatePanes() {
    panes = paneManager.getAllPanes();
    layoutType = paneManager.layout.type;
    recalculateDimensions();
  }
  
  function recalculateDimensions() {
    if (!containerElement || !paneManager) return;
    
    const rect = containerElement.getBoundingClientRect();
    dimensions = paneManager.calculatePaneDimensions(rect.width, rect.height);
    
    // Fit terminals after layout change
    setTimeout(() => {
      terminals.forEach((terminal, paneId) => {
        if (terminal._fitAddon) {
          terminal._fitAddon.fit();
        }
      });
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
    
    if (containerElement) {
      resizeObserver.observe(containerElement);
    }
    
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
    if (socket && activePane.sessionId) {
      socket.emit('end', activePane.sessionId);
    }
    
    paneManager.removePane(activePane.id);
    updatePanes();
  }
  
  function handlePaneClick(paneId) {
    paneManager.focusPane(paneId);
    updatePanes();
  }
  
  async function initializeTerminal(paneId) {
    const pane = paneManager.panes.get(paneId);
    if (!pane) return;
    
    // Terminal will be initialized by onLoad callback
  }
  
  async function onTerminalLoad(paneId, terminal) {
    console.log(`Terminal loaded for pane ${paneId}`);
    
    // Store terminal reference
    terminals.set(paneId, terminal);
    
    const pane = paneManager.panes.get(paneId);
    if (pane) {
      pane.terminal = terminal;
    }
    
    // Load fit addon
    const fitAddon = new (await XtermAddon.FitAddon()).FitAddon();
    terminal.loadAddon(fitAddon);
    terminal._fitAddon = fitAddon;
    
    // Register link detection if available
    if (linkDetector) {
      linkDetector.registerWithTerminal(terminal);
    }
    
    // Initial fit
    setTimeout(() => {
      fitAddon.fit();
    }, 100);
    
    // Set up socket connection for this pane
    if (socket && socket.connected) {
      // Create new session for this pane
      socket.emit('create', {
        cols: terminal.cols,
        rows: terminal.rows,
        mode: 'shell'
      }, (response) => {
        if (response.success) {
          const sessionId = response.sessionId;
          pane.sessionId = sessionId;
          
          // Attach to session
          socket.emit('attach', {
            sessionId,
            cols: terminal.cols,
            rows: terminal.rows
          });
          
          // Handle output for this specific pane
          const outputHandler = (data) => {
            if (pane.sessionId === sessionId) {
              terminal.write(data);
            }
          };
          
          socket.on('output', outputHandler);
          
          // Store handler for cleanup
          terminal._outputHandler = outputHandler;
        }
      });
    }
  }
  
  function onTerminalData(paneId, data) {
    const pane = paneManager.panes.get(paneId);
    if (socket && pane && pane.sessionId) {
      // Send input to the specific session
      socket.emit('input', data, pane.sessionId);
    }
  }
  
  // Resize handling
  function startResize(e, direction) {
    if (layoutType !== 'split') return;
    
    isResizing = true;
    resizeStartX = e.clientX;
    resizeStartY = e.clientY;
    resizeStartRatio = paneManager.layout.ratio || 50;
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', stopResize);
    
    e.preventDefault();
  }
  
  function handleResizeMove(e) {
    if (!isResizing || !containerElement) return;
    
    const rect = containerElement.getBoundingClientRect();
    const direction = paneManager.layout.direction;
    
    let newRatio;
    if (direction === 'vertical') {
      const deltaX = e.clientX - resizeStartX;
      const percentChange = (deltaX / rect.width) * 100;
      newRatio = resizeStartRatio + percentChange;
    } else {
      const deltaY = e.clientY - resizeStartY;
      const percentChange = (deltaY / rect.height) * 100;
      newRatio = resizeStartRatio + percentChange;
    }
    
    paneManager.updateSplitRatio(newRatio);
    recalculateDimensions();
  }
  
  function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', stopResize);
    
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
        if (!terminals.has(pane.id)) {
          initializeTerminal(pane.id);
        }
      });
    }, 100);
  }
  
</script>

{#if !isMobile}
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
  <div class="panes-wrapper" class:split-vertical={layoutType === 'split' && paneManager?.layout?.direction === 'vertical'}
       class:split-horizontal={layoutType === 'split' && paneManager?.layout?.direction === 'horizontal'}
       class:grid-layout={layoutType === 'grid'}>
    
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
        onclick={() => handlePaneClick(pane.id)}
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
      <div 
        class="resize-handle"
        class:vertical={direction === 'vertical'}
        class:horizontal={direction === 'horizontal'}
        style={direction === 'vertical' 
          ? `left: ${dimensions.get(panes[0].id)?.width || 0}px;`
          : `top: ${dimensions.get(panes[0].id)?.height || 0}px;`}
        onmousedown={(e) => startResize(e, direction)}
      />
    {/if}
  </div>
</div>
{/if}

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
  
  /* Resize handle */
  .resize-handle {
    position: absolute;
    background: var(--primary, #00ff88);
    opacity: 0;
    transition: opacity 0.2s;
    z-index: 20;
  }
  
  .resize-handle:hover {
    opacity: 0.3;
  }
  
  .resize-handle.vertical {
    width: 4px;
    height: 100%;
    top: 0;
    cursor: ew-resize;
    transform: translateX(-2px);
  }
  
  .resize-handle.horizontal {
    width: 100%;
    height: 4px;
    left: 0;
    cursor: ns-resize;
    transform: translateY(-2px);
  }
  
  /* Active resizing */
  :global(body.resizing) {
    cursor: ew-resize !important;
    user-select: none !important;
  }
  
  :global(body.resizing-horizontal) {
    cursor: ns-resize !important;
  }
  
  /* Make sure xterm takes full space */
  .pane-terminal :global(.xterm) {
    width: 100% !important;
    height: 100% !important;
  }
  
  /* Responsive - hide on mobile */
  @media (max-width: 768px) {
    .multi-pane-container {
      display: none;
    }
  }
</style>