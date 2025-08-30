// Mobile responsive design service
// Coordinates all mobile UX enhancements and responsive behavior

export class MobileResponsiveManager {
  constructor(options = {}) {
    this.breakpoints = {
      mobile: options.mobile || 768,
      tablet: options.tablet || 1024,
      desktop: options.desktop || 1200
    };
    
    this.currentBreakpoint = 'desktop';
    this.isMobile = false;
    this.screenMetrics = {
      width: window.innerWidth,
      height: window.innerHeight,
      orientation: this.getOrientation()
    };
    
    this.components = new Map();
    this.callbacks = {
      onBreakpointChange: options.onBreakpointChange || (() => {}),
      onOrientationChange: options.onOrientationChange || (() => {}),
      onMobileFeaturesToggle: options.onMobileFeaturesToggle || (() => {})
    };
    
    this.init();
  }
  
  init() {
    this.updateBreakpoint();
    this.setupEventListeners();
    
    // Initial mobile features setup
    if (this.isMobile) {
      this.enableMobileFeatures();
    }
  }
  
  setupEventListeners() {
    // Debounced resize handler
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
      }, 150);
    });
    
    // Orientation change handler
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        this.handleOrientationChange();
      }, 100); // Small delay to ensure metrics are updated
    });
    
    // Visual viewport changes (for keyboard detection)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => {
        this.handleViewportChange();
      });
    }
  }
  
  handleResize() {
    const oldBreakpoint = this.currentBreakpoint;
    const oldMobile = this.isMobile;
    
    this.screenMetrics.width = window.innerWidth;
    this.screenMetrics.height = window.innerHeight;
    this.updateBreakpoint();
    
    if (oldBreakpoint !== this.currentBreakpoint) {
      this.callbacks.onBreakpointChange(this.currentBreakpoint, oldBreakpoint);
    }
    
    if (oldMobile !== this.isMobile) {
      if (this.isMobile) {
        this.enableMobileFeatures();
      } else {
        this.disableMobileFeatures();
      }
      this.callbacks.onMobileFeaturesToggle(this.isMobile);
    }
    
    // Update all registered components
    this.components.forEach((component, name) => {
      if (component.onResize) {
        component.onResize(this.screenMetrics);
      }
    });
  }
  
  handleOrientationChange() {
    const oldOrientation = this.screenMetrics.orientation;
    this.screenMetrics.orientation = this.getOrientation();
    
    // Force recalculation of screen metrics
    this.screenMetrics.width = window.innerWidth;
    this.screenMetrics.height = window.innerHeight;
    this.updateBreakpoint();
    
    if (oldOrientation !== this.screenMetrics.orientation) {
      this.callbacks.onOrientationChange(this.screenMetrics.orientation, oldOrientation);
      
      // Notify components of orientation change
      this.components.forEach((component, name) => {
        if (component.onOrientationChange) {
          component.onOrientationChange(this.screenMetrics.orientation);
        }
      });
    }
  }
  
  handleViewportChange() {
    if (!window.visualViewport || !this.isMobile) return;
    
    const keyboardHeight = window.innerHeight - window.visualViewport.height;
    const wasKeyboardVisible = this.screenMetrics.keyboardHeight > 0;
    const isKeyboardVisible = keyboardHeight > 100; // Threshold for keyboard detection
    
    this.screenMetrics.keyboardHeight = Math.max(0, keyboardHeight);
    
    if (wasKeyboardVisible !== isKeyboardVisible) {
      this.components.forEach((component, name) => {
        if (component.onKeyboardToggle) {
          component.onKeyboardToggle(isKeyboardVisible, this.screenMetrics.keyboardHeight);
        }
      });
    }
  }
  
  updateBreakpoint() {
    const width = this.screenMetrics.width;
    
    if (width < this.breakpoints.mobile) {
      this.currentBreakpoint = 'mobile';
      this.isMobile = true;
    } else if (width < this.breakpoints.tablet) {
      this.currentBreakpoint = 'tablet';
      this.isMobile = this.screenMetrics.orientation === 'portrait';
    } else if (width < this.breakpoints.desktop) {
      this.currentBreakpoint = 'desktop';
      this.isMobile = false;
    } else {
      this.currentBreakpoint = 'large';
      this.isMobile = false;
    }
  }
  
  getOrientation() {
    if (window.screen && window.screen.orientation) {
      return window.screen.orientation.angle % 180 === 0 ? 'portrait' : 'landscape';
    }
    return this.screenMetrics.width > this.screenMetrics.height ? 'landscape' : 'portrait';
  }
  
  enableMobileFeatures() {
    // Add mobile-specific CSS classes
    document.body.classList.add('mobile-mode');
    document.body.classList.add(`orientation-${this.screenMetrics.orientation}`);
    
    // Enable mobile components
    this.components.forEach((component, name) => {
      if (component.enableMobileMode) {
        component.enableMobileMode(true);
      }
    });
  }
  
  disableMobileFeatures() {
    // Remove mobile-specific CSS classes
    document.body.classList.remove('mobile-mode');
    document.body.classList.remove('orientation-portrait', 'orientation-landscape');
    
    // Disable mobile components
    this.components.forEach((component, name) => {
      if (component.enableMobileMode) {
        component.enableMobileMode(false);
      }
    });
  }
  
  // Component registration system
  registerComponent(name, component) {
    this.components.set(name, component);
    
    // Immediate setup if mobile is currently active
    if (this.isMobile && component.enableMobileMode) {
      component.enableMobileMode(true);
    }
    
    // Provide initial metrics
    if (component.onResize) {
      component.onResize(this.screenMetrics);
    }
  }
  
  unregisterComponent(name) {
    return this.components.delete(name);
  }
  
  // Utility methods for components
  calculateTerminalDimensions(options = {}) {
    const {
      headerHeight = 60,
      toolbarHeight = this.isMobile ? 50 : 0,
      sidebarWidth = 0,
      keyboardOffset = this.screenMetrics.keyboardHeight || 0
    } = options;
    
    const availableWidth = this.screenMetrics.width - sidebarWidth - 32; // Account for padding
    const availableHeight = this.screenMetrics.height - headerHeight - toolbarHeight - keyboardOffset - 32;
    
    // Calculate optimal font size for mobile readability
    let fontSize = 14;
    if (this.isMobile) {
      if (this.screenMetrics.width < 360) fontSize = 12;
      if (this.screenMetrics.width < 320) fontSize = 11;
      if (this.screenMetrics.orientation === 'landscape') fontSize = Math.max(fontSize - 1, 11);
    }
    
    // Calculate grid dimensions
    const charWidth = fontSize * 0.6; // Rough approximation for monospace
    const lineHeight = fontSize * 1.4;
    
    const cols = Math.max(Math.floor(availableWidth / charWidth), 20);
    const rows = Math.max(Math.floor(availableHeight / lineHeight), 10);
    
    return {
      cols,
      rows,
      fontSize,
      width: availableWidth,
      height: availableHeight,
      charWidth,
      lineHeight
    };
  }
  
  shouldShowMobileFeatures() {
    return this.isMobile || (
      this.currentBreakpoint === 'tablet' && 
      this.screenMetrics.orientation === 'portrait'
    );
  }
  
  getOptimalAnimationDuration() {
    // Shorter animations on mobile for better performance
    const baseMs = 200;
    if (this.isMobile) {
      return Math.max(baseMs * 0.75, 150);
    }
    return baseMs;
  }
  
  getTouchZones() {
    const edgeSize = 20;
    return {
      headerEdge: { 
        x: 0, y: 0, 
        width: this.screenMetrics.width, 
        height: edgeSize 
      },
      bottomEdge: { 
        x: 0, 
        y: this.screenMetrics.height - edgeSize, 
        width: this.screenMetrics.width, 
        height: edgeSize 
      },
      leftEdge: { 
        x: 0, y: 0, 
        width: edgeSize, 
        height: this.screenMetrics.height 
      },
      rightEdge: { 
        x: this.screenMetrics.width - edgeSize, y: 0, 
        width: edgeSize, 
        height: this.screenMetrics.height 
      }
    };
  }
  
  // Performance helpers
  requestAnimationFrame(callback) {
    if (this.isMobile && this.screenMetrics.width < 400) {
      // Throttle animations on very small/slow devices
      setTimeout(callback, 16);
    } else {
      requestAnimationFrame(callback);
    }
  }
  
  shouldReduceAnimations() {
    // Check for prefers-reduced-motion or performance constraints
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
           (this.isMobile && this.screenMetrics.width < 360);
  }
  
  // Cleanup
  destroy() {
    // Remove event listeners
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleOrientationChange);
    
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', this.handleViewportChange);
    }
    
    // Cleanup components
    this.components.forEach((component, name) => {
      if (component.destroy) {
        component.destroy();
      }
    });
    
    this.components.clear();
    
    // Remove mobile classes
    document.body.classList.remove('mobile-mode', 'orientation-portrait', 'orientation-landscape');
  }
  
  // Getters for current state
  get breakpoint() {
    return this.currentBreakpoint;
  }
  
  get mobile() {
    return this.isMobile;
  }
  
  get metrics() {
    return { ...this.screenMetrics };
  }
  
  get orientation() {
    return this.screenMetrics.orientation;
  }
}