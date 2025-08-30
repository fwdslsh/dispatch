<script>
  import { onMount, onDestroy } from 'svelte';
  import { headerState, panelStore, viewportStore } from '$lib/stores/panel-store.js';
  
  // Component for reusable header toolbar with left and right content slots
  let { left, right, collapsible = true } = $props();
  
  let headerElement;
  let cleanupFunctions = [];
  
  // Subscribe to header state
  let isCollapsed = false;
  let isAnimating = false;
  
  // Scroll-based auto-hide state
  let lastScrollY = 0;
  let scrollDirection = 'down';
  let autoHideTimeout;
  let isMobile = false;
  
  onMount(() => {
    // Subscribe to header state changes
    const unsubscribeHeader = headerState.subscribe(state => {
      isCollapsed = state.collapsed;
      isAnimating = state.animating;
    });
    
    cleanupFunctions.push(unsubscribeHeader);
    
    // Set up scroll-based auto-hide for mobile only
    if (typeof window !== 'undefined') {
      checkMobileAndSetupAutoHide();
      
      // Listen for resize events to re-check mobile state
      const handleResize = () => checkMobileAndSetupAutoHide();
      window.addEventListener('resize', handleResize);
      cleanupFunctions.push(() => window.removeEventListener('resize', handleResize));
    }
  });
  
  function checkMobileAndSetupAutoHide() {
    const wasMobile = isMobile;
    isMobile = window.innerWidth <= 768;
    
    // Only setup auto-hide if mobile state changed or first time
    if (isMobile !== wasMobile) {
      if (isMobile && collapsible) {
        setupScrollBasedAutoHide();
      } else if (!isMobile) {
        // Show header on desktop
        panelStore.showPanel('header');
        clearTimeout(autoHideTimeout);
      }
    }
  }
  
  function handleAnimationEnd() {
    panelStore.setAnimating('header', false);
  }
  
  function setupScrollBasedAutoHide() {
    // Only setup auto-hide on mobile
    if (!isMobile) return;
    
    let ticking = false;
    
    const createScrollHandler = (getScrollPosition) => {
      return () => {
        // Double-check mobile state during scroll
        if (!isMobile || !ticking) {
          if (!isMobile && ticking) {
            ticking = false;
            return;
          }
          
          requestAnimationFrame(() => {
            if (!isMobile) {
              ticking = false;
              return;
            }
            
            const currentScrollY = getScrollPosition();
            const scrollThreshold = 20; // Minimum scroll distance to trigger hide/show
            
            if (Math.abs(currentScrollY - lastScrollY) > scrollThreshold) {
              const newDirection = currentScrollY > lastScrollY ? 'down' : 'up';
              
              if (newDirection !== scrollDirection) {
                scrollDirection = newDirection;
                
                // Clear existing timeout
                clearTimeout(autoHideTimeout);
                
                if (scrollDirection === 'down' && currentScrollY > 50) {
                  // Hide header when scrolling down
                  panelStore.hidePanel('header');
                } else if (scrollDirection === 'up') {
                  // Show header immediately when scrolling up
                  panelStore.showPanel('header');
                  // Auto-hide again after 3 seconds of no interaction
                  clearTimeout(autoHideTimeout);
                  autoHideTimeout = setTimeout(() => {
                    if (isMobile) { // Only auto-hide if still on mobile
                      panelStore.hidePanel('header');
                    }
                  }, 3000);
                }
              }
              
              lastScrollY = currentScrollY;
            }
            
            ticking = false;
          });
          ticking = true;
        }
      };
    };

    // Create handlers for different scroll contexts
    const windowScrollHandler = createScrollHandler(() => window.scrollY || window.pageYOffset);
    
    const containerScrollHandler = createScrollHandler(() => {
      const container = document.querySelector('.sessions');
      return container ? container.scrollTop : 0;
    });

    // Add listeners with retry logic for dynamic content
    const addScrollListeners = () => {
      // Window scroll (for pages that allow body scrolling)
      window.addEventListener('scroll', windowScrollHandler, { passive: true });
      
      // Container scroll (for mobile session list)
      const sessionsContainer = document.querySelector('.sessions');
      if (sessionsContainer) {
        sessionsContainer.addEventListener('scroll', containerScrollHandler, { passive: true });
        console.debug('HeaderToolbar: Added scroll listener to sessions container');
      }
      
      // Container content scroll (for other scrollable containers)
      const containerContent = document.querySelector('.container-content');
      if (containerContent) {
        const containerContentHandler = createScrollHandler(() => containerContent.scrollTop);
        containerContent.addEventListener('scroll', containerContentHandler, { passive: true });
      }
    };

    // Add listeners immediately and retry a few times for dynamic content
    addScrollListeners();
    setTimeout(addScrollListeners, 100);
    setTimeout(addScrollListeners, 500);
    
    cleanupFunctions.push(() => {
      window.removeEventListener('scroll', windowScrollHandler);
      
      const sessionsContainer = document.querySelector('.sessions');
      if (sessionsContainer) {
        sessionsContainer.removeEventListener('scroll', containerScrollHandler);
      }
      
      const containerContent = document.querySelector('.container-content');
      if (containerContent) {
        // We don't have a reference to the handler, so we'll need to recreate cleanup logic
        const containerContentHandler = createScrollHandler(() => containerContent.scrollTop);
        containerContent.removeEventListener('scroll', containerContentHandler);
      }
      
      clearTimeout(autoHideTimeout);
    });
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