// tests/test-collapsible-panels.js
// Test collapsible UI panel functionality

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

console.log('🧪 Testing Collapsible UI Panel System...\n');

async function runTests() {
  try {
    // Test 1: Panel state management
    console.log('🔧 Test 1: Panel state management');
    
    // Mock panel state manager
    class PanelStateManager {
      constructor() {
        this.states = {
          header: { collapsed: false, visible: true },
          sidebar: { collapsed: true, visible: false },
        };
        this.listeners = [];
      }
      
      setState(panel, newState) {
        this.states[panel] = { ...this.states[panel], ...newState };
        this.listeners.forEach(listener => listener(panel, this.states[panel]));
      }
      
      getState(panel) {
        return this.states[panel];
      }
      
      subscribe(listener) {
        this.listeners.push(listener);
        return () => {
          this.listeners = this.listeners.filter(l => l !== listener);
        };
      }
      
      collapseOnMobile(isMobile) {
        if (isMobile) {
          this.setState('header', { collapsed: true });
          this.setState('sidebar', { collapsed: true, visible: false });
        } else {
          this.setState('header', { collapsed: false });
        }
      }
    }
    
    const panelManager = new PanelStateManager();
    
    // Test initial states
    assert(!panelManager.getState('header').collapsed, 'Header should start expanded');
    assert(panelManager.getState('sidebar').collapsed, 'Sidebar should start collapsed');
    
    // Test state changes
    panelManager.setState('header', { collapsed: true });
    assert(panelManager.getState('header').collapsed, 'Header should be collapsed after state change');
    
    // Test mobile collapse behavior
    panelManager.collapseOnMobile(true);
    assert(panelManager.getState('header').collapsed, 'Header should be collapsed on mobile');
    assert(!panelManager.getState('sidebar').visible, 'Sidebar should be hidden on mobile');
    
    console.log('   ✓ Panel state management works correctly\n');
    
    // Test 2: Swipe gesture detection
    console.log('🔧 Test 2: Swipe gesture detection');
    
    class SwipeGestureDetector {
      constructor(threshold = 50, velocity = 0.3) {
        this.threshold = threshold;
        this.velocity = velocity;
        this.startX = 0;
        this.startY = 0;
        this.startTime = 0;
      }
      
      handleStart(x, y) {
        this.startX = x;
        this.startY = y;
        this.startTime = Date.now();
      }
      
      handleEnd(x, y) {
        const deltaX = x - this.startX;
        const deltaY = y - this.startY;
        const deltaTime = Date.now() - this.startTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const velocity = distance / deltaTime;
        
        if (distance < this.threshold || velocity < this.velocity) {
          return null; // Not a swipe
        }
        
        // Determine direction based on dominant axis
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          return deltaX > 0 ? 'right' : 'left';
        } else {
          return deltaY > 0 ? 'down' : 'up';
        }
      }
    }
    
    const swipeDetector = new SwipeGestureDetector();
    
    // Test swipe right (should show sidebar)
    swipeDetector.handleStart(0, 100);
    const rightSwipe = swipeDetector.handleEnd(80, 105);
    assertEqual(rightSwipe, 'right', 'Should detect right swipe');
    
    // Test swipe down (should show header)
    swipeDetector.handleStart(100, 0);
    const downSwipe = swipeDetector.handleEnd(105, 80);
    assertEqual(downSwipe, 'down', 'Should detect down swipe');
    
    // Test too short distance (should not register)
    swipeDetector.handleStart(0, 0);
    const shortSwipe = swipeDetector.handleEnd(30, 5);
    assertEqual(shortSwipe, null, 'Should not detect short swipe');
    
    console.log('   ✓ Swipe gesture detection works correctly\n');
    
    // Test 3: Panel animation calculations
    console.log('🔧 Test 3: Panel animation calculations');
    
    function calculateHeaderTransform(collapsed, progress = 1) {
      const translateY = collapsed ? -100 : 0;
      const opacity = collapsed ? 0 : 1;
      return {
        transform: `translateY(${translateY * progress}%)`,
        opacity: progress === 1 ? opacity : 1 - Math.abs(progress - 0.5) * 2
      };
    }
    
    function calculateSidebarTransform(visible, progress = 1) {
      const translateX = visible ? 0 : -100;
      return {
        transform: `translateX(${translateX + (100 * (1 - progress))}%)`,
        opacity: progress
      };
    }
    
    // Test header collapse animation
    const headerCollapsed = calculateHeaderTransform(true);
    assertEqual(headerCollapsed.transform, 'translateY(-100%)', 'Header should translate up when collapsed');
    assertEqual(headerCollapsed.opacity, 0, 'Header should be transparent when collapsed');
    
    const headerExpanded = calculateHeaderTransform(false);
    assertEqual(headerExpanded.transform, 'translateY(0%)', 'Header should be in normal position when expanded');
    assertEqual(headerExpanded.opacity, 1, 'Header should be opaque when expanded');
    
    // Test sidebar slide animation
    const sidebarVisible = calculateSidebarTransform(true);
    assertEqual(sidebarVisible.transform, 'translateX(0%)', 'Sidebar should be in normal position when visible');
    assertEqual(sidebarVisible.opacity, 1, 'Sidebar should be opaque when visible');
    
    const sidebarHidden = calculateSidebarTransform(false, 1);
    assertEqual(sidebarHidden.transform, 'translateX(-100%)', 'Sidebar should translate left when hidden');
    
    console.log('   ✓ Panel animation calculations work correctly\n');
    
    // Test 4: Responsive breakpoint handling
    console.log('🔧 Test 4: Responsive breakpoint handling');
    
    function shouldCollapseForViewport(width, height) {
      const isMobile = width <= 768;
      const isLandscapePhone = width <= 896 && height <= 414;
      const isPortraitTablet = width <= 834 && height > 1000;
      
      return {
        header: isMobile || isLandscapePhone,
        sidebar: isMobile || isLandscapePhone || isPortraitTablet
      };
    }
    
    // Test desktop (should not collapse)
    const desktop = shouldCollapseForViewport(1920, 1080);
    assert(!desktop.header, 'Header should not collapse on desktop');
    assert(!desktop.sidebar, 'Sidebar should not collapse on desktop');
    
    // Test mobile portrait (should collapse both)
    const mobilePortrait = shouldCollapseForViewport(375, 812);
    assert(mobilePortrait.header, 'Header should collapse on mobile portrait');
    assert(mobilePortrait.sidebar, 'Sidebar should collapse on mobile portrait');
    
    // Test mobile landscape (should collapse both)
    const mobileLandscape = shouldCollapseForViewport(812, 375);
    assert(mobileLandscape.header, 'Header should collapse on mobile landscape');
    assert(mobileLandscape.sidebar, 'Sidebar should collapse on mobile landscape');
    
    // Test tablet portrait (sidebar only)
    const tabletPortrait = shouldCollapseForViewport(768, 1024);
    assert(tabletPortrait.header, 'Header should collapse on tablet portrait (768px boundary)');
    assert(tabletPortrait.sidebar, 'Sidebar should collapse on tablet portrait');
    
    console.log('   ✓ Responsive breakpoint handling works correctly\n');
    
    // Test 5: Touch area calculations for gesture zones
    console.log('🔧 Test 5: Touch area calculations for gesture zones');
    
    function getTouchZones(viewportWidth, viewportHeight) {
      const edgeZone = 20; // 20px edge zones for gestures
      const headerZone = 60; // Top 60px for header reveal
      
      return {
        leftEdge: { x: 0, y: 0, width: edgeZone, height: viewportHeight },
        rightEdge: { x: viewportWidth - edgeZone, y: 0, width: edgeZone, height: viewportHeight },
        topEdge: { x: 0, y: 0, width: viewportWidth, height: headerZone },
        bottomEdge: { x: 0, y: viewportHeight - edgeZone, width: viewportWidth, height: edgeZone }
      };
    }
    
    function isInTouchZone(x, y, zone) {
      return x >= zone.x && x <= zone.x + zone.width && 
             y >= zone.y && y <= zone.y + zone.height;
    }
    
    const zones = getTouchZones(375, 812);
    
    // Test left edge (for sidebar)
    assert(isInTouchZone(10, 400, zones.leftEdge), 'Should detect touch in left edge zone');
    assert(!isInTouchZone(30, 400, zones.leftEdge), 'Should not detect touch outside left edge zone');
    
    // Test top edge (for header)
    assert(isInTouchZone(200, 30, zones.topEdge), 'Should detect touch in top edge zone');
    assert(!isInTouchZone(200, 80, zones.topEdge), 'Should not detect touch outside top edge zone');
    
    console.log('   ✓ Touch area calculations work correctly\n');
    
    // Test 6: Panel overlap and z-index management
    console.log('🔧 Test 6: Panel overlap and z-index management');
    
    class ZIndexManager {
      constructor() {
        this.layers = {
          background: 1,
          content: 10,
          sidebar: 100,
          header: 200,
          overlay: 300,
          modal: 400
        };
      }
      
      getZIndex(layer) {
        return this.layers[layer] || 1;
      }
      
      shouldShowBackdrop(panelVisible) {
        return panelVisible && window.innerWidth <= 768;
      }
    }
    
    const zIndexManager = new ZIndexManager();
    
    assert(zIndexManager.getZIndex('sidebar') > zIndexManager.getZIndex('content'), 
           'Sidebar should be above content');
    assert(zIndexManager.getZIndex('header') > zIndexManager.getZIndex('sidebar'), 
           'Header should be above sidebar');
    assert(zIndexManager.getZIndex('modal') > zIndexManager.getZIndex('header'), 
           'Modal should be above header');
    
    // Mock window width for backdrop test
    global.window = { innerWidth: 768 };
    assert(zIndexManager.shouldShowBackdrop(true), 'Should show backdrop on mobile when panel is visible');
    global.window.innerWidth = 1024;
    assert(!zIndexManager.shouldShowBackdrop(true), 'Should not show backdrop on desktop');
    
    console.log('   ✓ Panel overlap and z-index management works correctly\n');
    
    console.log('🎉 All Collapsible Panel System tests passed!\n');
    
    // Summary
    console.log('📊 Test Summary:');
    console.log('   ✅ Panel state management');
    console.log('   ✅ Swipe gesture detection');
    console.log('   ✅ Panel animation calculations');
    console.log('   ✅ Responsive breakpoint handling');
    console.log('   ✅ Touch area calculations');
    console.log('   ✅ Panel overlap and z-index management\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  }
}

runTests().catch((error) => {
  console.error('Collapsible Panel System test suite failed:', error);
  process.exit(1);
});