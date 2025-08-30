// tests/test-mobile-integration.js  
// Test complete mobile UX integration across all components

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: ${message}. Expected: ${expected}, Actual: ${actual}`);
  }
}

console.log('🧪 Testing Mobile UX Integration...\n');

async function runTests() {
  try {
    // Test 1: Responsive breakpoint system
    console.log('🔧 Test 1: Responsive breakpoint system');
    
    class ResponsiveBreakpoints {
      constructor() {
        this.breakpoints = {
          mobile: 768,
          tablet: 1024,
          desktop: 1200
        };
      }
      
      getCurrentBreakpoint(width) {
        if (width < this.breakpoints.mobile) return 'mobile';
        if (width < this.breakpoints.tablet) return 'tablet';  
        if (width < this.breakpoints.desktop) return 'desktop';
        return 'large';
      }
      
      isMobile(width) {
        return width < this.breakpoints.mobile;
      }
      
      shouldShowMobileFeatures(width, orientation = 'portrait') {
        const mobile = this.isMobile(width);
        const smallTablet = width < this.breakpoints.tablet && orientation === 'portrait';
        return mobile || smallTablet;
      }
      
      calculateOptimalTerminalSize(screenWidth, screenHeight, headerHeight = 60, toolbarHeight = 50) {
        const availableWidth = screenWidth - 32; // Account for padding
        const availableHeight = screenHeight - headerHeight - toolbarHeight - 32;
        
        // Calculate optimal font size for readability
        let fontSize = 14;
        if (screenWidth < 360) fontSize = 12;
        if (screenWidth < 320) fontSize = 11;
        
        // Calculate columns and rows based on font size
        const charWidth = fontSize * 0.6; // Rough approximation for monospace
        const lineHeight = fontSize * 1.4;
        
        const cols = Math.floor(availableWidth / charWidth);
        const rows = Math.floor(availableHeight / lineHeight);
        
        return {
          cols: Math.max(cols, 20), // Minimum 20 columns
          rows: Math.max(rows, 10), // Minimum 10 rows
          fontSize,
          width: availableWidth,
          height: availableHeight
        };
      }
    }
    
    const responsive = new ResponsiveBreakpoints();
    
    // Test breakpoint detection
    assertEqual(responsive.getCurrentBreakpoint(400), 'mobile', 'Should detect mobile breakpoint');
    assertEqual(responsive.getCurrentBreakpoint(800), 'tablet', 'Should detect tablet breakpoint');
    assertEqual(responsive.getCurrentBreakpoint(1100), 'desktop', 'Should detect desktop breakpoint');
    
    // Test mobile feature detection
    assert(responsive.shouldShowMobileFeatures(600), 'Should show mobile features on small screens');
    assert(responsive.shouldShowMobileFeatures(900, 'portrait'), 'Should show mobile features on portrait tablet');
    assert(!responsive.shouldShowMobileFeatures(1100, 'landscape'), 'Should not show mobile features on landscape desktop');
    
    // Test terminal size calculation
    const terminalSize = responsive.calculateOptimalTerminalSize(375, 812, 60, 50);
    assert(terminalSize.cols >= 20, 'Should calculate minimum columns');
    assert(terminalSize.rows >= 10, 'Should calculate minimum rows');
    assert(terminalSize.fontSize >= 11, 'Should set readable font size');
    
    console.log('   ✓ Responsive breakpoint system works correctly\n');
    
    // Test 2: Component interaction coordination  
    console.log('🔧 Test 2: Component interaction coordination');
    
    class MobileComponentCoordinator {
      constructor() {
        this.components = {
          keyboardToolbar: { visible: false, height: 0 },
          commandPalette: { visible: false, height: 0 },
          headerToolbar: { collapsed: false, height: 60 },
          mobileSidebar: { visible: false, width: 0 }
        };
        
        this.screenMetrics = {
          width: 375,
          height: 812,
          keyboardHeight: 0,
          availableHeight: 812
        };
        
        this.terminalSpace = {};
        this.recalculateLayout();
      }
      
      updateScreenMetrics(width, height, keyboardHeight = 0) {
        this.screenMetrics = {
          width,
          height, 
          keyboardHeight,
          availableHeight: height - keyboardHeight
        };
        
        this.recalculateLayout();
      }
      
      showComponent(name, options = {}) {
        if (!this.components[name]) return false;
        
        // Handle component-specific logic
        switch (name) {
          case 'commandPalette':
            // Command palette should hide keyboard toolbar
            this.components.keyboardToolbar.visible = false;
            this.components.commandPalette.visible = true;
            this.components.commandPalette.height = options.height || 400;
            break;
            
          case 'keyboardToolbar':
            // Keyboard toolbar should hide command palette
            this.components.commandPalette.visible = false;
            this.components.keyboardToolbar.visible = true;
            this.components.keyboardToolbar.height = options.height || 50;
            break;
            
          case 'mobileSidebar':
            // Sidebar overlays everything
            this.components.mobileSidebar.visible = true;
            this.components.mobileSidebar.width = options.width || 280;
            break;
            
          case 'headerToolbar':
            this.components.headerToolbar.collapsed = false;
            break;
        }
        
        this.recalculateLayout();
        return true;
      }
      
      hideComponent(name) {
        if (!this.components[name]) return false;
        
        if (name === 'mobileSidebar') {
          this.components.mobileSidebar.visible = false;
          this.components.mobileSidebar.width = 0;
        } else {
          this.components[name].visible = false;
          if (this.components[name].height !== undefined) {
            this.components[name].height = 0;
          }
        }
        
        this.recalculateLayout();
        return true;
      }
      
      recalculateLayout() {
        // Calculate available terminal space
        let terminalHeight = this.screenMetrics.availableHeight;
        
        // Subtract header if not collapsed
        if (!this.components.headerToolbar.collapsed) {
          terminalHeight -= this.components.headerToolbar.height;
        }
        
        // Subtract keyboard toolbar if visible
        if (this.components.keyboardToolbar.visible) {
          terminalHeight -= this.components.keyboardToolbar.height;
        }
        
        // Account for command palette overlay
        if (this.components.commandPalette.visible) {
          // Command palette overlays but needs space calculation
          const paletteSpace = Math.min(this.components.commandPalette.height, terminalHeight * 0.6);
          terminalHeight -= paletteSpace;
        }
        
        this.terminalSpace = {
          width: this.screenMetrics.width - (this.components.mobileSidebar.visible ? 0 : 0), // Sidebar overlays
          height: Math.max(terminalHeight, 200), // Minimum terminal height
          x: this.components.mobileSidebar.visible ? this.components.mobileSidebar.width : 0,
          y: this.components.headerToolbar.collapsed ? 0 : this.components.headerToolbar.height
        };
      }
      
      getTerminalSpace() {
        return this.terminalSpace;
      }
      
      canShowComponent(name) {
        // Prevent overlapping problematic combinations
        if (name === 'commandPalette' && this.components.keyboardToolbar.visible) {
          return false;
        }
        if (name === 'keyboardToolbar' && this.components.commandPalette.visible) {
          return false;
        }
        return true;
      }
    }
    
    const coordinator = new MobileComponentCoordinator();
    
    // Test initial state
    const initialSpace = coordinator.getTerminalSpace();
    assert(initialSpace.height > 0, 'Should calculate initial terminal space');
    
    // Test keyboard toolbar activation
    assert(coordinator.showComponent('keyboardToolbar', { height: 50 }), 'Should show keyboard toolbar');
    const keyboardSpace = coordinator.getTerminalSpace();
    assert(keyboardSpace.height < initialSpace.height, 'Terminal space should be reduced when keyboard toolbar is shown');
    
    // Test command palette activation
    assert(coordinator.showComponent('commandPalette', { height: 300 }), 'Should show command palette');
    assert(!coordinator.components.keyboardToolbar.visible, 'Keyboard toolbar should be hidden when command palette is shown');
    
    // Test component conflict prevention
    coordinator.showComponent('keyboardToolbar');
    assert(!coordinator.canShowComponent('commandPalette'), 'Should prevent showing command palette when keyboard toolbar is active');
    
    console.log('   ✓ Component interaction coordination works correctly\n');
    
    // Test 3: Touch gesture integration
    console.log('🔧 Test 3: Touch gesture integration');
    
    class TouchGestureIntegration {
      constructor() {
        this.gestures = {
          swipeDown: { handler: null, zones: ['header-edge'] },
          swipeUp: { handler: null, zones: ['bottom-edge'] },
          swipeRight: { handler: null, zones: ['left-edge'] },
          swipeLeft: { handler: null, zones: ['right-edge'] },
          doubleTap: { handler: null, zones: ['terminal'] },
          longPress: { handler: null, zones: ['terminal'] }
        };
        
        this.activeZones = new Set();
      }
      
      registerGesture(gesture, zone, handler) {
        if (this.gestures[gesture]) {
          this.gestures[gesture].handler = handler;
          if (zone && !this.gestures[gesture].zones.includes(zone)) {
            this.gestures[gesture].zones.push(zone);
          }
          this.activeZones.add(zone);
          return true;
        }
        return false;
      }
      
      simulateGesture(gesture, zone, event = {}) {
        if (this.gestures[gesture] && this.gestures[gesture].zones.includes(zone)) {
          if (this.gestures[gesture].handler) {
            return this.gestures[gesture].handler(event);
          }
        }
        return false;
      }
      
      calculateGestureZones(screenWidth, screenHeight) {
        const edgeSize = 20; // 20px edge zones
        
        return {
          'header-edge': { 
            x: 0, y: 0, 
            width: screenWidth, height: edgeSize,
            description: 'Top edge for header reveal'
          },
          'bottom-edge': { 
            x: 0, y: screenHeight - edgeSize, 
            width: screenWidth, height: edgeSize,
            description: 'Bottom edge for keyboard toolbar'
          },
          'left-edge': { 
            x: 0, y: 0, 
            width: edgeSize, height: screenHeight,
            description: 'Left edge for sidebar'
          },
          'right-edge': { 
            x: screenWidth - edgeSize, y: 0, 
            width: edgeSize, height: screenHeight,
            description: 'Right edge'
          },
          'terminal': { 
            x: edgeSize, y: 60, 
            width: screenWidth - (edgeSize * 2), height: screenHeight - 110,
            description: 'Main terminal area'
          }
        };
      }
      
      isPointInZone(x, y, zone) {
        return x >= zone.x && x <= zone.x + zone.width && 
               y >= zone.y && y <= zone.y + zone.height;
      }
    }
    
    const gestureIntegration = new TouchGestureIntegration();
    let headerRevealed = false;
    let sidebarShown = false;
    let commandPaletteShown = false;
    
    // Register gesture handlers
    assert(gestureIntegration.registerGesture('swipeDown', 'header-edge', () => {
      headerRevealed = true;
      return true;
    }), 'Should register swipe down gesture');
    
    assert(gestureIntegration.registerGesture('swipeRight', 'left-edge', () => {
      sidebarShown = true;
      return true;
    }), 'Should register swipe right gesture');
    
    assert(gestureIntegration.registerGesture('doubleTap', 'terminal', () => {
      commandPaletteShown = true;
      return true;
    }), 'Should register double tap gesture');
    
    // Test gesture zones
    const zones = gestureIntegration.calculateGestureZones(375, 812);
    assert(zones['header-edge'].height === 20, 'Should calculate correct header edge height');
    assert(zones['terminal'].width > 0, 'Should calculate terminal zone');
    
    // Test point detection
    assert(gestureIntegration.isPointInZone(10, 10, zones['header-edge']), 'Should detect point in header edge');
    assert(gestureIntegration.isPointInZone(200, 400, zones['terminal']), 'Should detect point in terminal');
    assert(!gestureIntegration.isPointInZone(200, 400, zones['header-edge']), 'Should not detect terminal point in header edge');
    
    // Test gesture simulation
    assert(gestureIntegration.simulateGesture('swipeDown', 'header-edge'), 'Should trigger header reveal gesture');
    assert(headerRevealed, 'Header should be revealed after swipe down');
    
    assert(gestureIntegration.simulateGesture('swipeRight', 'left-edge'), 'Should trigger sidebar gesture');
    assert(sidebarShown, 'Sidebar should be shown after swipe right');
    
    assert(gestureIntegration.simulateGesture('doubleTap', 'terminal'), 'Should trigger command palette gesture');
    assert(commandPaletteShown, 'Command palette should be shown after double tap');
    
    console.log('   ✓ Touch gesture integration works correctly\n');
    
    // Test 4: Performance monitoring and optimization
    console.log('🔧 Test 4: Performance monitoring and optimization');
    
    class MobilePerformanceMonitor {
      constructor() {
        this.metrics = {
          frameRate: 60,
          renderTime: 0,
          memoryUsage: 0,
          outputRate: 0,
          gestureLatency: 0
        };
        
        this.thresholds = {
          minFrameRate: 45,
          maxRenderTime: 16, // 60fps = 16.67ms per frame
          maxMemoryUsage: 100 * 1024 * 1024, // 100MB
          maxOutputRate: 1000, // lines per second
          maxGestureLatency: 100 // ms
        };
        
        this.optimizations = {
          enableVirtualScrolling: false,
          reduceOutputRate: false,
          throttleGestures: false,
          simplifyAnimations: false
        };
      }
      
      updateMetrics(newMetrics) {
        Object.assign(this.metrics, newMetrics);
        this.evaluatePerformance();
      }
      
      evaluatePerformance() {
        // Reset optimizations
        Object.keys(this.optimizations).forEach(key => {
          this.optimizations[key] = false;
        });
        
        // Check frame rate
        if (this.metrics.frameRate < this.thresholds.minFrameRate) {
          this.optimizations.simplifyAnimations = true;
          this.optimizations.throttleGestures = true;
        }
        
        // Check render time
        if (this.metrics.renderTime > this.thresholds.maxRenderTime) {
          this.optimizations.enableVirtualScrolling = true;
        }
        
        // Check output rate
        if (this.metrics.outputRate > this.thresholds.maxOutputRate) {
          this.optimizations.reduceOutputRate = true;
        }
        
        // Check gesture latency
        if (this.metrics.gestureLatency > this.thresholds.maxGestureLatency) {
          this.optimizations.throttleGestures = true;
        }
      }
      
      getOptimizationRecommendations() {
        const recommendations = [];
        
        if (this.optimizations.enableVirtualScrolling) {
          recommendations.push('Enable virtual scrolling for large outputs');
        }
        
        if (this.optimizations.reduceOutputRate) {
          recommendations.push('Throttle output updates to improve performance');
        }
        
        if (this.optimizations.throttleGestures) {
          recommendations.push('Debounce gesture handlers');
        }
        
        if (this.optimizations.simplifyAnimations) {
          recommendations.push('Reduce animation complexity');
        }
        
        return recommendations;
      }
      
      calculateOptimalSettings(deviceSpecs) {
        const settings = {
          maxTerminalLines: 1000,
          outputThrottleMs: 16,
          gestureDebounceMs: 50,
          animationDuration: 200
        };
        
        // Adjust based on device capabilities
        if (deviceSpecs.ramMB < 2048) {
          settings.maxTerminalLines = 500;
          settings.outputThrottleMs = 33;
        }
        
        if (deviceSpecs.cpuCores < 4) {
          settings.gestureDebounceMs = 100;
          settings.animationDuration = 150;
        }
        
        if (deviceSpecs.screenDensity > 3) {
          // High DPI screens need more aggressive optimization
          settings.maxTerminalLines = Math.floor(settings.maxTerminalLines * 0.8);
        }
        
        return settings;
      }
    }
    
    const monitor = new MobilePerformanceMonitor();
    
    // Test performance evaluation
    monitor.updateMetrics({ frameRate: 30, renderTime: 25, outputRate: 1500 });
    
    const recommendations = monitor.getOptimizationRecommendations();
    assert(recommendations.length > 0, 'Should generate performance recommendations');
    assert(recommendations.some(r => r.includes('virtual scrolling')), 'Should recommend virtual scrolling for slow render');
    assert(recommendations.some(r => r.includes('output updates')), 'Should recommend output throttling for high rate');
    
    // Test device-specific optimizations
    const lowEndDevice = { ramMB: 1024, cpuCores: 2, screenDensity: 2 };
    const lowEndSettings = monitor.calculateOptimalSettings(lowEndDevice);
    assert(lowEndSettings.maxTerminalLines <= 500, 'Should reduce terminal lines for low-end device');
    assert(lowEndSettings.gestureDebounceMs >= 100, 'Should increase debounce for low-end device');
    
    const highEndDevice = { ramMB: 8192, cpuCores: 8, screenDensity: 4 };
    const highEndSettings = monitor.calculateOptimalSettings(highEndDevice);
    assert(highEndSettings.maxTerminalLines < 1000, 'Should still optimize for high DPI screens');
    
    console.log('   ✓ Performance monitoring and optimization works correctly\n');
    
    // Test 5: Accessibility and usability
    console.log('🔧 Test 5: Accessibility and usability');
    
    class MobileAccessibility {
      constructor() {
        this.features = {
          touchTargetSize: 44, // iOS HIG minimum
          contrastRatio: 4.5, // WCAG AA standard
          fontSize: { min: 16, max: 24, default: 18 },
          animations: { respectsReducedMotion: true },
          keyboard: { trapFocus: true, announceChanges: true }
        };
      }
      
      validateTouchTargets(elements) {
        return elements.filter(el => 
          el.width >= this.features.touchTargetSize && 
          el.height >= this.features.touchTargetSize
        ).length === elements.length;
      }
      
      calculateContrastRatio(foreground, background) {
        // Simplified contrast calculation for testing
        const fgLum = this.getLuminance(foreground);
        const bgLum = this.getLuminance(background);
        const lighter = Math.max(fgLum, bgLum);
        const darker = Math.min(fgLum, bgLum);
        return (lighter + 0.05) / (darker + 0.05);
      }
      
      getLuminance(color) {
        // Simplified luminance calculation
        if (typeof color === 'string') {
          if (color === '#ffffff' || color === 'white') return 1;
          if (color === '#000000' || color === 'black') return 0;
          if (color === '#00ff88') return 0.7; // Approximate for terminal green
        }
        return 0.5; // Default mid-range
      }
      
      validateFontSizes(elements) {
        return elements.every(el => 
          el.fontSize >= this.features.fontSize.min && 
          el.fontSize <= this.features.fontSize.max
        );
      }
      
      generateARIALabels(components) {
        const labels = {};
        
        for (const [name, component] of Object.entries(components)) {
          switch (name) {
            case 'keyboardToolbar':
              labels[name] = 'Virtual keyboard toolbar with command shortcuts';
              break;
            case 'commandPalette':
              labels[name] = 'Command palette for quick command selection';
              break;
            case 'mobileSidebar':
              labels[name] = 'Session navigation sidebar';
              break;
            case 'headerToolbar':
              labels[name] = 'Application header with navigation controls';
              break;
            default:
              labels[name] = `${name.replace(/([A-Z])/g, ' $1').toLowerCase()} component`;
          }
        }
        
        return labels;
      }
      
      validateKeyboardNavigation(focusableElements) {
        // Check for proper tab order
        let tabOrder = focusableElements
          .filter(el => el.tabIndex >= 0)
          .sort((a, b) => a.tabIndex - b.tabIndex);
        
        if (tabOrder.length === 0) {
          // Use natural DOM order if no explicit tabindex
          tabOrder = focusableElements.filter(el => el.focusable);
        }
        
        return {
          hasValidTabOrder: tabOrder.length > 0,
          tabOrderCount: tabOrder.length,
          hasSkipLinks: focusableElements.some(el => el.type === 'skip-link'),
          trapsFocus: focusableElements.some(el => el.trapsFocus)
        };
      }
    }
    
    const accessibility = new MobileAccessibility();
    
    // Test touch target validation
    const touchTargets = [
      { width: 44, height: 44 }, // Valid
      { width: 48, height: 48 }, // Valid
      { width: 30, height: 30 }  // Invalid
    ];
    
    assert(!accessibility.validateTouchTargets(touchTargets), 'Should fail validation for small touch targets');
    assert(accessibility.validateTouchTargets(touchTargets.slice(0, 2)), 'Should pass validation for large touch targets');
    
    // Test contrast ratio
    const contrast = accessibility.calculateContrastRatio('#000000', '#ffffff');
    assert(contrast >= accessibility.features.contrastRatio, 'Black on white should have sufficient contrast');
    
    // Test font size validation
    const fontSizes = [
      { fontSize: 16 }, // Valid
      { fontSize: 18 }, // Valid  
      { fontSize: 14 }  // Invalid (too small)
    ];
    
    assert(!accessibility.validateFontSizes(fontSizes), 'Should fail validation for small fonts');
    assert(accessibility.validateFontSizes(fontSizes.slice(0, 2)), 'Should pass validation for readable fonts');
    
    // Test ARIA label generation
    const components = {
      keyboardToolbar: {},
      commandPalette: {},
      mobileSidebar: {}
    };
    
    const ariaLabels = accessibility.generateARIALabels(components);
    assert(Object.keys(ariaLabels).length === 3, 'Should generate labels for all components');
    assert(ariaLabels.keyboardToolbar.includes('keyboard'), 'Should generate descriptive labels');
    
    // Test keyboard navigation
    const focusableElements = [
      { tabIndex: 0, focusable: true, type: 'button' },
      { tabIndex: 1, focusable: true, type: 'input' },
      { tabIndex: -1, focusable: false, type: 'div' },
      { tabIndex: 0, focusable: true, type: 'button', trapsFocus: true }
    ];
    
    const navValidation = accessibility.validateKeyboardNavigation(focusableElements);
    assert(navValidation.hasValidTabOrder, 'Should detect valid tab order');
    assert(navValidation.trapsFocus, 'Should detect focus trapping');
    
    console.log('   ✓ Accessibility and usability works correctly\n');
    
    console.log('🎉 All Mobile UX Integration tests passed!\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Responsive breakpoint system');
    console.log('   ✅ Component interaction coordination'); 
    console.log('   ✅ Touch gesture integration');
    console.log('   ✅ Performance monitoring and optimization');
    console.log('   ✅ Accessibility and usability\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

runTests().catch((error) => {
  console.error('Mobile UX Integration test suite failed:', error);
  process.exit(1);
});