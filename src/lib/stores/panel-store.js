// src/lib/stores/panel-store.js
// Svelte store for managing collapsible panel states

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

// Panel state interface
const initialPanelState = {
  header: {
    collapsed: false,
    visible: true,
    animating: false
  },
  sidebar: {
    collapsed: true,
    visible: false,
    animating: false
  }
};

// Create the main panel store
function createPanelStore() {
  const { subscribe, set, update } = writable(initialPanelState);

  return {
    subscribe,
    
    // Update specific panel state
    updatePanel: (panelName, newState) => {
      update(state => ({
        ...state,
        [panelName]: {
          ...state[panelName],
          ...newState
        }
      }));
    },
    
    // Toggle panel collapse state
    togglePanel: (panelName) => {
      update(state => {
        const currentPanel = state[panelName];
        return {
          ...state,
          [panelName]: {
            ...currentPanel,
            collapsed: !currentPanel.collapsed,
            visible: panelName === 'sidebar' ? !currentPanel.collapsed : currentPanel.visible,
            animating: true
          }
        };
      });
    },
    
    // Show panel (expand and make visible)
    showPanel: (panelName) => {
      update(state => ({
        ...state,
        [panelName]: {
          ...state[panelName],
          collapsed: false,
          visible: true,
          animating: true
        }
      }));
    },
    
    // Hide panel (collapse and hide)
    hidePanel: (panelName) => {
      update(state => ({
        ...state,
        [panelName]: {
          ...state[panelName],
          collapsed: true,
          visible: panelName === 'sidebar' ? false : state[panelName].visible,
          animating: true
        }
      }));
    },
    
    // Set animation state
    setAnimating: (panelName, isAnimating) => {
      update(state => ({
        ...state,
        [panelName]: {
          ...state[panelName],
          animating: isAnimating
        }
      }));
    },
    
    // Auto-collapse based on viewport
    autoCollapseForViewport: (width, height) => {
      const isMobile = width <= 768;
      const isLandscapePhone = width <= 896 && height <= 414;
      const isPortraitTablet = width <= 834 && height > 1000;
      
      update(state => ({
        ...state,
        header: {
          ...state.header,
          collapsed: isMobile || isLandscapePhone,
          visible: true // Header always visible, just collapsed
        },
        sidebar: {
          ...state.sidebar,
          collapsed: isMobile || isLandscapePhone || isPortraitTablet,
          visible: !(isMobile || isLandscapePhone || isPortraitTablet)
        }
      }));
    },
    
    // Reset to initial state
    reset: () => set(initialPanelState)
  };
}

// Create store instances
export const panelStore = createPanelStore();

// Derived stores for specific panels
export const headerState = derived(
  panelStore,
  $panels => $panels.header
);

export const sidebarState = derived(
  panelStore,
  $panels => $panels.sidebar
);

// Viewport-responsive store
function createViewportStore() {
  const { subscribe, set } = writable({
    width: browser ? window.innerWidth : 1024,
    height: browser ? window.innerHeight : 768,
    isMobile: browser ? window.innerWidth <= 768 : false
  });

  let resizeTimeout;

  function handleResize() {
    if (!browser) return;
    
    // Debounce resize events
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const isMobile = width <= 768;
      
      set({ width, height, isMobile });
      
      // Auto-collapse panels based on viewport
      panelStore.autoCollapseForViewport(width, height);
    }, 100);
  }

  // Initialize event listener if in browser
  if (browser) {
    window.addEventListener('resize', handleResize);
    
    // Set initial values
    handleResize();
  }

  return {
    subscribe,
    cleanup: () => {
      if (browser) {
        window.removeEventListener('resize', handleResize);
        clearTimeout(resizeTimeout);
      }
    }
  };
}

export const viewportStore = createViewportStore();

// Gesture detection store
function createGestureStore() {
  const { subscribe, set } = writable({
    isDetecting: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    threshold: 50, // minimum distance for gesture
    velocity: 0.3 // minimum velocity for gesture
  });

  return {
    subscribe,
    
    startGesture: (x, y) => {
      set({
        isDetecting: true,
        startX: x,
        startY: y,
        startTime: Date.now(),
        threshold: 50,
        velocity: 0.3
      });
    },
    
    endGesture: (x, y, callback) => {
      update(state => {
        if (!state.isDetecting) return state;
        
        const deltaX = x - state.startX;
        const deltaY = y - state.startY;
        const deltaTime = Date.now() - state.startTime;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const velocity = distance / deltaTime;
        
        if (distance >= state.threshold && velocity >= state.velocity) {
          // Determine gesture direction
          let direction;
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? 'right' : 'left';
          } else {
            direction = deltaY > 0 ? 'down' : 'up';
          }
          
          // Execute callback with gesture info
          if (callback) {
            callback(direction, { deltaX, deltaY, distance, velocity });
          }
        }
        
        return {
          ...state,
          isDetecting: false
        };
      });
    }
  };
}

export const gestureStore = createGestureStore();

// Touch zone detection helper
export function getTouchZones(width, height) {
  const edgeZone = 20; // 20px edge zones
  const headerZone = 60; // Top 60px for header reveal
  
  return {
    leftEdge: { x: 0, y: 0, width: edgeZone, height },
    rightEdge: { x: width - edgeZone, y: 0, width: edgeZone, height },
    topEdge: { x: 0, y: 0, width, height: headerZone },
    bottomEdge: { x: 0, y: height - edgeZone, width, height: edgeZone }
  };
}

export function isInTouchZone(x, y, zone) {
  return x >= zone.x && x <= zone.x + zone.width && 
         y >= zone.y && y <= zone.y + zone.height;
}

// Animation helper functions
export function getHeaderTransform(collapsed, progress = 1) {
  const translateY = collapsed ? -100 : 0;
  const opacity = collapsed ? 0 : 1;
  
  return {
    transform: `translateY(${translateY * progress}%)`,
    opacity: progress === 1 ? opacity : Math.max(0, 1 - Math.abs(progress - 0.5) * 2)
  };
}

export function getSidebarTransform(visible, progress = 1) {
  const translateX = visible ? 0 : -100;
  
  return {
    transform: `translateX(${translateX + (100 * (1 - progress))}%)`,
    opacity: Math.min(1, progress * 1.5) // Fade in faster than slide
  };
}