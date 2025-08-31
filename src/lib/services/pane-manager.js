// Pane Manager Service - Manages multi-pane terminal layouts
// No external dependencies - pure vanilla JavaScript implementation

export class PaneManager {
  constructor(sessionId = 'default') {
    this.sessionId = sessionId;
    this.panes = new Map();
    this.activePane = null;
    this.nextPaneId = 1;
    this.layout = {
      type: 'single',
      root: null
    };
    
    // Layout presets for common configurations
    this.presets = {
      single: { type: 'single' },
      vertical: { type: 'split', direction: 'vertical', ratio: 50 },
      horizontal: { type: 'split', direction: 'horizontal', ratio: 50 },
      quad: { type: 'grid', rows: 2, cols: 2 },
      triple: { type: 'split', direction: 'vertical', ratio: 33, nested: true }
    };
  }
  
  // Create a new pane
  createPane(options = {}) {
    const paneId = `pane-${this.nextPaneId++}`;
    const pane = {
      id: paneId,
      sessionId: options.sessionId || null,
      terminal: null,
      element: null,
      focused: false,
      title: options.title || `Terminal ${this.nextPaneId - 1}`,
      ...options
    };
    
    this.panes.set(paneId, pane);
    
    if (!this.activePane) {
      this.activePane = paneId;
      pane.focused = true;
    }
    
    return pane;
  }
  
  // Remove a pane
  removePane(paneId) {
    const pane = this.panes.get(paneId);
    if (!pane) return false;
    
    // Clean up terminal instance
    if (pane.terminal) {
      pane.terminal.dispose();
    }
    
    this.panes.delete(paneId);
    
    // Select new active pane if needed
    if (this.activePane === paneId) {
      const remaining = Array.from(this.panes.keys());
      this.activePane = remaining[0] || null;
      if (this.activePane) {
        this.panes.get(this.activePane).focused = true;
      }
    }
    
    return true;
  }
  
  // Focus a specific pane
  focusPane(paneId) {
    if (!this.panes.has(paneId)) return false;
    
    // Unfocus current
    if (this.activePane) {
      const current = this.panes.get(this.activePane);
      if (current) current.focused = false;
    }
    
    // Focus new
    this.activePane = paneId;
    const pane = this.panes.get(paneId);
    pane.focused = true;
    
    // Focus terminal if it exists
    if (pane.terminal) {
      pane.terminal.focus();
    }
    
    return true;
  }
  
  // Navigate between panes
  navigatePane(direction) {
    const paneIds = Array.from(this.panes.keys());
    if (paneIds.length <= 1) return;
    
    const currentIndex = paneIds.indexOf(this.activePane);
    let nextIndex;
    
    switch (direction) {
      case 'up':
      case 'left':
        nextIndex = currentIndex - 1;
        if (nextIndex < 0) nextIndex = paneIds.length - 1;
        break;
      case 'down':
      case 'right':
        nextIndex = currentIndex + 1;
        if (nextIndex >= paneIds.length) nextIndex = 0;
        break;
      default:
        return;
    }
    
    this.focusPane(paneIds[nextIndex]);
  }
  
  // Split current pane
  splitPane(paneId, direction = 'vertical') {
    const sourcePane = this.panes.get(paneId);
    if (!sourcePane) return null;
    
    // Create new pane
    const newPane = this.createPane({
      title: `Terminal ${this.nextPaneId}`
    });
    
    // Update layout structure
    this.updateLayoutForSplit(paneId, newPane.id, direction);
    
    return newPane;
  }
  
  // Update layout structure for split
  updateLayoutForSplit(originalPaneId, newPaneId, direction) {
    // Simple layout tracking for persistence
    if (this.layout.type === 'single') {
      this.layout = {
        type: 'split',
        direction,
        ratio: 50,
        panes: [originalPaneId, newPaneId]
      };
    } else {
      // For complex layouts, maintain a tree structure
      // This is simplified for the initial implementation
      this.layout = {
        type: 'complex',
        panes: Array.from(this.panes.keys())
      };
    }
  }
  
  // Apply a preset layout
  applyPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) return false;
    
    // Clear existing panes except first
    const paneIds = Array.from(this.panes.keys());
    for (let i = 1; i < paneIds.length; i++) {
      this.removePane(paneIds[i]);
    }
    
    // Create panes based on preset
    switch (preset.type) {
      case 'single':
        // Already have one pane
        break;
      case 'split':
        this.createPane();
        this.layout = { ...preset, panes: Array.from(this.panes.keys()) };
        break;
      case 'grid':
        const totalPanes = preset.rows * preset.cols;
        for (let i = 1; i < totalPanes; i++) {
          this.createPane();
        }
        this.layout = { ...preset, panes: Array.from(this.panes.keys()) };
        break;
    }
    
    return true;
  }
  
  // Calculate pane dimensions based on container size
  calculatePaneDimensions(containerWidth, containerHeight) {
    const paneCount = this.panes.size;
    const dimensions = new Map();
    
    if (paneCount === 0) return dimensions;
    
    if (paneCount === 1) {
      // Single pane takes full space
      const paneId = Array.from(this.panes.keys())[0];
      dimensions.set(paneId, {
        x: 0,
        y: 0,
        width: containerWidth,
        height: containerHeight
      });
    } else if (this.layout.type === 'split') {
      // Split layout
      const paneIds = Array.from(this.panes.keys());
      const ratio = this.layout.ratio || 50;
      
      if (this.layout.direction === 'vertical') {
        const leftWidth = Math.floor(containerWidth * ratio / 100);
        dimensions.set(paneIds[0], {
          x: 0,
          y: 0,
          width: leftWidth,
          height: containerHeight
        });
        dimensions.set(paneIds[1], {
          x: leftWidth,
          y: 0,
          width: containerWidth - leftWidth,
          height: containerHeight
        });
      } else {
        const topHeight = Math.floor(containerHeight * ratio / 100);
        dimensions.set(paneIds[0], {
          x: 0,
          y: 0,
          width: containerWidth,
          height: topHeight
        });
        dimensions.set(paneIds[1], {
          x: 0,
          y: topHeight,
          width: containerWidth,
          height: containerHeight - topHeight
        });
      }
    } else if (this.layout.type === 'grid') {
      // Grid layout
      const paneIds = Array.from(this.panes.keys());
      const rows = this.layout.rows || 2;
      const cols = this.layout.cols || 2;
      const cellWidth = Math.floor(containerWidth / cols);
      const cellHeight = Math.floor(containerHeight / rows);
      
      paneIds.forEach((paneId, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        dimensions.set(paneId, {
          x: col * cellWidth,
          y: row * cellHeight,
          width: cellWidth,
          height: cellHeight
        });
      });
    } else {
      // Fallback: even distribution
      const paneIds = Array.from(this.panes.keys());
      const cols = Math.ceil(Math.sqrt(paneCount));
      const rows = Math.ceil(paneCount / cols);
      const cellWidth = Math.floor(containerWidth / cols);
      const cellHeight = Math.floor(containerHeight / rows);
      
      paneIds.forEach((paneId, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        dimensions.set(paneId, {
          x: col * cellWidth,
          y: row * cellHeight,
          width: cellWidth,
          height: cellHeight
        });
      });
    }
    
    return dimensions;
  }
  
  // Update split ratio (for resizing)
  updateSplitRatio(newRatio) {
    if (this.layout.type === 'split') {
      this.layout.ratio = Math.max(20, Math.min(80, newRatio)); // Clamp between 20-80%
      return true;
    }
    return false;
  }
  
  // Save layout to localStorage (scoped by session)
  saveLayout() {
    const layoutData = {
      layout: this.layout,
      panes: Array.from(this.panes.values()).map(pane => ({
        id: pane.id,
        title: pane.title,
        sessionId: pane.sessionId
      })),
      activePane: this.activePane
    };
    
    try {
      const storageKey = `dispatch-pane-layout-${this.sessionId}`;
      localStorage.setItem(storageKey, JSON.stringify(layoutData));
      return true;
    } catch (error) {
      console.error('Failed to save pane layout:', error);
      return false;
    }
  }
  
  // Load layout from localStorage (scoped by session)
  loadLayout() {
    try {
      const storageKey = `dispatch-pane-layout-${this.sessionId}`;
      const stored = localStorage.getItem(storageKey);
      if (!stored) return false;
      
      const layoutData = JSON.parse(stored);
      
      // Restore layout structure
      this.layout = layoutData.layout || { type: 'single' };
      
      // Clear existing panes
      this.panes.clear();
      
      // Restore panes
      layoutData.panes.forEach(paneData => {
        const pane = this.createPane(paneData);
        pane.id = paneData.id; // Preserve original ID
      });
      
      // Restore active pane
      if (layoutData.activePane && this.panes.has(layoutData.activePane)) {
        this.focusPane(layoutData.activePane);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to load pane layout:', error);
      return false;
    }
  }
  
  // Get all panes
  getAllPanes() {
    return Array.from(this.panes.values());
  }
  
  // Get active pane
  getActivePane() {
    return this.panes.get(this.activePane);
  }
  
  // Clear all panes
  clearAll() {
    this.panes.forEach(pane => {
      if (pane.terminal) {
        pane.terminal.dispose();
      }
    });
    this.panes.clear();
    this.activePane = null;
    this.layout = { type: 'single', root: null };
  }

  // Clean up session-specific data from localStorage
  cleanupSession() {
    try {
      const storageKey = `dispatch-pane-layout-${this.sessionId}`;
      localStorage.removeItem(storageKey);
      return true;
    } catch (error) {
      console.error('Failed to cleanup session layout:', error);
      return false;
    }
  }
}