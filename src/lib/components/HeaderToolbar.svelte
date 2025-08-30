<script>
  import { onMount, onDestroy } from 'svelte';
  import { headerState, panelStore, viewportStore } from '$lib/stores/panel-store.js';
  
  // Component for reusable header toolbar with left and right content slots
  let { left, right, collapsible = true } = $props();
  
  let headerElement;
  let touchZone;
  let cleanupFunctions = [];
  
  // Subscribe to header state
  let isCollapsed = false;
  let isAnimating = false;
  
  onMount(() => {
    // Subscribe to header state changes
    const unsubscribeHeader = headerState.subscribe(state => {
      isCollapsed = state.collapsed;
      isAnimating = state.animating;
    });
    
    cleanupFunctions.push(unsubscribeHeader);
    
    // Set up gesture detection for header reveal
    if (collapsible) {
      setupGestureDetection();
    }
  });
  
  function setupGestureDetection() {
    let startY = 0;
    let startTime = 0;
    
    const handleTouchStart = (e) => {
      if (!isCollapsed) return;
      
      const touch = e.touches[0];
      startY = touch.clientY;
      startTime = Date.now();
      
      // Only trigger if touching near the top of screen
      if (touch.clientY <= 60) {
        document.addEventListener('touchmove', handleTouchMove);
        document.addEventListener('touchend', handleTouchEnd);
      }
    };
    
    const handleTouchMove = (e) => {
      const touch = e.touches[0];
      const deltaY = touch.clientY - startY;
      
      // Show header preview while dragging down
      if (deltaY > 20) {
        const progress = Math.min(1, (deltaY - 20) / 60);
        updateHeaderPreview(progress);
      }
    };
    
    const handleTouchEnd = (e) => {
      const touch = e.changedTouches[0];
      const deltaY = touch.clientY - startY;
      const deltaTime = Date.now() - startTime;
      const velocity = deltaY / deltaTime;
      
      // Show header if swipe down is strong enough
      if (deltaY > 50 && velocity > 0.2) {
        panelStore.showPanel('header');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
          panelStore.hidePanel('header');
        }, 3000);
      } else {
        // Reset preview
        updateHeaderPreview(0);
      }
      
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
    
    document.addEventListener('touchstart', handleTouchStart);
    
    cleanupFunctions.push(() => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    });
  }
  
  function updateHeaderPreview(progress) {
    if (headerElement) {
      const translateY = -100 + (100 * progress);
      const opacity = progress;
      headerElement.style.transform = `translateY(${translateY}%)`;
      headerElement.style.opacity = opacity.toString();
    }
  }
  
  function handleAnimationEnd() {
    panelStore.setAnimating('header', false);
  }
  
  onDestroy(() => {
    cleanupFunctions.forEach(cleanup => cleanup());
  });
</script>

<div 
  class="header-toolbar"
  class:collapsed={isCollapsed}
  class:animating={isAnimating}
  bind:this={headerElement}
  on:transitionend={handleAnimationEnd}
>
  <div class="header-left">
    {@render left()}
  </div>
  <div class="header-right">
    {@render right()}
  </div>
</div>

<!-- Touch zone for gesture detection when collapsed -->
{#if isCollapsed && collapsible}
  <div class="touch-zone" bind:this={touchZone}></div>
{/if}

<style>
  .header-toolbar {
    border-bottom: 1px solid var(--primary-muted);    
    padding-inline: var(--space-sm);
    margin-inline: var(--space-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-xl);
    position: relative;
    background: var(--bg-primary);
    z-index: 200;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), 
                opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-lg);
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }

  /* Collapsed state */
  .header-toolbar.collapsed {
    transform: translateY(-100%);
    opacity: 0;
    pointer-events: none;
  }

  .header-toolbar.animating {
    transition-duration: 0.3s;
  }

  /* Touch zone for gesture detection */
  .touch-zone {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    height: 60px;
    z-index: 150;
    pointer-events: auto;
    background: transparent;
  }

  @media (max-width: 768px) {
    .header-toolbar {
      gap: var(--space-md);
      padding: var(--space-sm) var(--space-md);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      margin: 0;
      border-radius: 0;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      backdrop-filter: blur(10px);
      background: rgba(var(--bg-primary-rgb, 10, 10, 10), 0.95);
    }
    
    .header-left {
      align-items: center;
      gap: var(--space-md);
    }
    
    .header-right {
      align-self: center;
    }

    /* Enhanced collapsed animation on mobile */
    .header-toolbar.collapsed {
      transform: translateY(-120%);
    }
  }

  @media (min-width: 769px) {
    /* Desktop: never collapse */
    .header-toolbar.collapsed {
      transform: none;
      opacity: 1;
      pointer-events: auto;
    }
    
    .touch-zone {
      display: none;
    }
  }

  /* Prevent flickering during animations */
  .header-toolbar.animating * {
    pointer-events: none;
  }

  /* Smooth performance optimizations */
  .header-toolbar {
    will-change: transform, opacity;
    contain: layout style;
  }

  .header-toolbar.animating {
    will-change: transform, opacity;
  }
</style>