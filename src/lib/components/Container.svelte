<script>
  let {
    sessionContainer = false,
    children,
    header = null,
    footer = null,
  } = $props();
</script>

<div
  class="container"
  class:session-container={sessionContainer}
  data-augmented-ui="br-clip bl-clip tl-clip tr-clip border"
>
  {#if header}
    <div class="container-header">
      {@render header()}
    </div>
  {/if}

  <div class="container-content">
    {@render children()}
  </div>

  {#if footer}
    <div class="container-footer">
      {@render footer()}
    </div>
  {/if}
</div>

<style>
  .container {
    --aug-border-opacity: 0.5;
    max-width: calc(100svw - calc(var(--space-lg) * 2));
    height: calc(100svh - calc(var(--space-lg) * 2));
    margin: 0 auto;
    margin-top: var(--space-xl);
    width: 100%;
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;
    
    /* Enhanced glassmorphism effect */
    /* background: rgba(26, 26, 26, 0.137); */
    /* box-shadow: 
      0 8px 32px rgba(0, 0, 0, 0.3),
      0 0 20px rgba(0, 255, 136, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(0, 255, 136, 0.15);
     */
    transition: all 0.3s ease;
  }
  
  /* .container:hover {
    box-shadow: 
      0 12px 40px rgba(0, 0, 0, 0.4),
      0 0 30px rgba(0, 255, 136, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
    border-color: rgba(0, 255, 136, 0.25);
  } */

  .container-header {
    flex-shrink: 0;
    margin-inline: calc(var(--space-md) * -1);
  }

  /* Ensure header can transform outside container bounds on mobile */
  @media (max-width: 800px) {
    .container-header {
      position: relative;
      z-index: 101;
      overflow: visible;
    }
  }

  .container-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin-inline: -0.5rem;
  }

  .container-footer {
    flex-shrink: 0;
    padding: var(--space-md);
  }

  /* Default desktop layout - use normal container */
  .container:not(.session-container) .container-content {
    min-height: 400px; /* Minimum height for content functionality */
  }

  /* Session container specific styles */
  .session-container .container-content {
    overflow: hidden; /* Only apply overflow hidden to actual terminal sessions */
  }

  /* Mobile-specific session container overrides */
  @media (max-width: 800px) {
    .session-container {
      height: 100vh;
      max-height: 100svh;
      width: 100vw;
      max-width: 100vw;
      overflow-x: hidden; /* Only hide horizontal overflow */
      overflow-y: visible; /* Allow header to transform outside bounds */
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
    }

    .session-container .container-content {
      min-height: 0; /* Allow flex child to shrink on mobile */
      margin-inline: 0; /* Remove negative margins on mobile to prevent text cutoff */
    }

    /* For non-session containers (like session list), ensure proper flex layout */
    .container:not(.session-container) {
      height: 100vh;
      max-height: 100vh;
      padding-top: 80px; /* Reduced padding since header auto-hides */
      box-sizing: border-box;
    }
    
    .container:not(.session-container) .container-content {
      min-height: 0; /* Allow flex child to shrink */
      margin-inline: 0;
    }
    
    .container:not(.session-container) .container-footer {
      padding: var(--space-sm);
      background: rgba(15, 15, 15, 0.95);
      backdrop-filter: blur(10px);
      flex-shrink: 0;
    }
  }

  /* Responsive container - full width on small screens */
  @media (max-width: 800px) {
    .container {
      max-width: 100%;
      height: 100dvh;
      /* Use dynamic viewport height for mobile */
      margin-top: 0;
      padding: 0;
      /* background: var(--bg-dark); 
      backdrop-filter: none;*/

      /* Remove augmented styling on mobile for better usability */
      clip-path: none;
      box-shadow: none;
      --aug-border-all: 0px;
      --aug-inlay-all: 0px;
      --aug-inplay-opacity: 0;
      --aug-br: 0px;
      --aug-bl: 0px;
      --aug-tr: 0px;
      --aug-tl: 0px;
    }
  }
</style>
