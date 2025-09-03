<script>
    import { onMount } from "svelte";

  
  // Component for reusable header toolbar with left and right content slots
  let { left, right } = $props();
  
  let headerElement = $state();
  
  onMount(() => {
    let ticking = false;
    let lastScrollY = 0;
    
    const handleAnyScroll = (event) => {
      if (window.innerWidth > 768) return; // Mobile only
      
      if (!ticking) {
        requestAnimationFrame(() => {
          // Get scroll position from various sources
          let currentScrollY = 0;
          
          // Try to get scroll from the event target first
          if (event && event.target && event.target !== window && event.target !== document) {
            currentScrollY = event.target.scrollTop || 0;
          } else {
            // Fallback to window scroll
            currentScrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
          }
          
          console.log('Scroll - Last:', lastScrollY, 'Current:', currentScrollY, 'Direction:', currentScrollY > lastScrollY ? 'down' : 'up');
          
          if (currentScrollY > lastScrollY && currentScrollY > 10) {
            // Scrolling down - hide header
            if (headerElement) {
              headerElement.classList.add('header-hidden');
              headerElement.style.transform = 'translateY(-100%)';
              console.log('Header hidden');
            }
          } else if (currentScrollY < lastScrollY || currentScrollY <= 10) {
            // Scrolling up or near top - show header
            if (headerElement) {
              headerElement.classList.remove('header-hidden');
              headerElement.style.transform = 'translateY(0)';
              console.log('Header shown');
            }
          }
          
          lastScrollY = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    // Listen for any scroll events on the page
    window.addEventListener('scroll', handleAnyScroll, { passive: true, capture: true });
    document.addEventListener('scroll', handleAnyScroll, { passive: true, capture: true });
    
    // Cleanup function
    return () => {
      window.removeEventListener('scroll', handleAnyScroll, true);
      document.removeEventListener('scroll', handleAnyScroll, true);
    };
  });
</script>

<div 
  class="header-toolbar"
  bind:this={headerElement}
>
  <div class="header-left">
    {@render left?.()}
  </div>
  <div class="header-right">
    {@render right?.()}
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

  @media (max-width: 768px) {
    .header-toolbar {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      margin: 0 !important;
      gap: var(--space-md);
      padding: var(--space-sm) var(--space-md);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
      backdrop-filter: blur(10px);
      background: rgba(var(--bg-primary-rgb, 10, 10, 10), 0.95);
      z-index: 1000 !important;
      transition: transform 0.3s ease-out;
      will-change: transform;
      transform: translateY(0);
    }
    
    /* Hidden state - slides up */
    .header-toolbar.header-hidden {
      transform: translateY(-100%) !important;
    }
    
    .header-left {
      gap: var(--space-md);
    }
  }
</style>