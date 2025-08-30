// src/lib/services/gesture-service.js
// Gesture detection service using Hammer.js

import Hammer from 'hammerjs';
import { panelStore, getTouchZones, isInTouchZone } from '$lib/stores/panel-store.js';

class GestureService {
  constructor() {
    this.hammerInstances = new Map();
    this.edgeZones = null;
    this.viewportWidth = 0;
    this.viewportHeight = 0;
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized || typeof window === 'undefined') return;

    this.updateViewport();
    this.setupEdgeZones();
    this.setupViewportListener();
    this.isInitialized = true;
  }

  updateViewport() {
    if (typeof window === 'undefined') return;
    
    this.viewportWidth = window.innerWidth;
    this.viewportHeight = window.innerHeight;
    this.edgeZones = getTouchZones(this.viewportWidth, this.viewportHeight);
  }

  setupViewportListener() {
    if (typeof window === 'undefined') return;

    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.updateViewport();
        this.setupEdgeZones(); // Recreate edge zones with new dimensions
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
    };
  }

  setupEdgeZones() {
    if (typeof document === 'undefined') return;
    
    this.cleanupEdgeZones();

    // Create left edge zone for sidebar reveal
    this.createEdgeZone('left', {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '20px',
      height: '100vh',
      zIndex: '150'
    }, (direction, data) => {
      if (direction === 'right') {
        panelStore.showPanel('sidebar');
      }
    });

    // Create top edge zone for header reveal
    this.createEdgeZone('top', {
      position: 'fixed',
      top: '0',
      left: '0',
      right: '0',
      height: '60px',
      zIndex: '149'
    }, (direction, data) => {
      if (direction === 'down') {
        panelStore.showPanel('header');
        // Auto-hide header after 3 seconds
        setTimeout(() => {
          panelStore.hidePanel('header');
        }, 3000);
      }
    });
  }

  createEdgeZone(name, styles, onGesture) {
    if (typeof document === 'undefined') return;

    const zone = document.createElement('div');
    zone.className = `gesture-edge-zone gesture-edge-${name}`;
    
    // Apply styles
    Object.assign(zone.style, {
      pointerEvents: 'auto',
      background: 'transparent',
      userSelect: 'none',
      touchAction: 'none',
      ...styles
    });

    document.body.appendChild(zone);

    // Set up Hammer.js for the zone
    const hammer = new Hammer(zone);
    
    // Configure gestures
    hammer.get('swipe').set({ 
      direction: Hammer.DIRECTION_ALL,
      threshold: 30,
      velocity: 0.2
    });

    hammer.get('pan').set({ 
      direction: Hammer.DIRECTION_ALL,
      threshold: 10
    });

    // Handle swipe gestures
    hammer.on('swipeup swipedown swipeleft swiperight', (e) => {
      const direction = e.type.replace('swipe', '');
      onGesture(direction, {
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        distance: e.distance,
        velocity: e.velocity
      });
    });

    // Store references for cleanup
    this.hammerInstances.set(`edge-${name}`, { hammer, element: zone });
  }

  setupElementGestures(element, options = {}) {
    if (!element || this.hammerInstances.has(element)) return null;

    const hammer = new Hammer(element);
    
    // Configure gestures based on options
    const {
      enableSwipe = true,
      enablePan = false,
      swipeDirection = Hammer.DIRECTION_ALL,
      panDirection = Hammer.DIRECTION_ALL,
      threshold = 30,
      velocity = 0.3
    } = options;

    if (enableSwipe) {
      hammer.get('swipe').set({
        direction: swipeDirection,
        threshold,
        velocity
      });
    }

    if (enablePan) {
      hammer.get('pan').set({
        direction: panDirection,
        threshold: threshold / 2
      });
    }

    this.hammerInstances.set(element, { hammer, element });
    
    return hammer;
  }

  // Specific gesture handlers for panels
  setupSidebarGestures(sidebarElement) {
    if (!sidebarElement) return;

    const hammer = this.setupElementGestures(sidebarElement, {
      enableSwipe: true,
      swipeDirection: Hammer.DIRECTION_HORIZONTAL,
      threshold: 50,
      velocity: 0.3
    });

    if (hammer) {
      hammer.on('swipeleft', () => {
        panelStore.hidePanel('sidebar');
      });

      hammer.on('swiperight', (e) => {
        // Only allow swipe right if we're at the left edge of content
        if (e.center.x < 100) {
          panelStore.showPanel('sidebar');
        }
      });
    }
  }

  setupHeaderGestures(headerElement) {
    if (!headerElement) return;

    const hammer = this.setupElementGestures(headerElement, {
      enableSwipe: true,
      swipeDirection: Hammer.DIRECTION_VERTICAL,
      threshold: 30,
      velocity: 0.2
    });

    if (hammer) {
      hammer.on('swipeup', () => {
        panelStore.hidePanel('header');
      });

      hammer.on('swipedown', () => {
        panelStore.showPanel('header');
      });
    }
  }

  // Utility method for custom gesture detection
  detectGestureInZone(x, y, zoneName) {
    if (!this.edgeZones) return false;

    const zone = this.edgeZones[zoneName];
    return zone ? isInTouchZone(x, y, zone) : false;
  }

  // Panel-specific helpers
  shouldShowSidebarFromGesture(startX, endX, startY, endY) {
    const isLeftEdge = startX <= 20;
    const isHorizontalGesture = Math.abs(endX - startX) > Math.abs(endY - startY);
    const isRightwardGesture = endX > startX;
    const hasMinimumDistance = (endX - startX) >= 50;

    return isLeftEdge && isHorizontalGesture && isRightwardGesture && hasMinimumDistance;
  }

  shouldShowHeaderFromGesture(startY, endY, startX, endX) {
    const isTopEdge = startY <= 60;
    const isVerticalGesture = Math.abs(endY - startY) > Math.abs(endX - startX);
    const isDownwardGesture = endY > startY;
    const hasMinimumDistance = (endY - startY) >= 30;

    return isTopEdge && isVerticalGesture && isDownwardGesture && hasMinimumDistance;
  }

  // Cleanup methods
  cleanupElement(element) {
    const instance = this.hammerInstances.get(element);
    if (instance) {
      instance.hammer.destroy();
      this.hammerInstances.delete(element);
    }
  }

  cleanupEdgeZones() {
    // Clean up existing edge zones
    const existingZones = document.querySelectorAll('.gesture-edge-zone');
    existingZones.forEach(zone => {
      const hammerInstance = Array.from(this.hammerInstances.values())
        .find(instance => instance.element === zone);
      
      if (hammerInstance) {
        hammerInstance.hammer.destroy();
      }
      
      zone.remove();
    });

    // Clear edge zone references
    Array.from(this.hammerInstances.keys())
      .filter(key => typeof key === 'string' && key.startsWith('edge-'))
      .forEach(key => this.hammerInstances.delete(key));
  }

  cleanup() {
    // Cleanup all hammer instances
    this.hammerInstances.forEach(({ hammer }) => {
      hammer.destroy();
    });
    this.hammerInstances.clear();

    // Remove edge zones
    this.cleanupEdgeZones();

    this.isInitialized = false;
  }
}

// Singleton instance
export const gestureService = new GestureService();

// Auto-initialize in browser environment
if (typeof window !== 'undefined') {
  // Initialize after DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      gestureService.initialize();
    });
  } else {
    gestureService.initialize();
  }
}

export default gestureService;