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
    max-width: 800px;
    min-height: 475px;
    max-height: calc(100svh - calc(var(--space-xl) * 2));
    margin: 0 auto;
    margin-top: var(--space-xl);
    width: 100%;
    backdrop-filter: blur(10px);
    display: flex;
    flex-direction: column;

    transition: all 0.3s ease;
  }

  .container-header {
    flex-shrink: 0;
    margin-inline: calc(var(--space-md) * -1);
  }

  .container-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .container-footer {
    flex-shrink: 0;
  }

  /* Default desktop layout - use normal container */
  .container:not(.session-container) .container-content {
    min-height: 400px; /* Minimum height for content functionality */
  }

  /* Mobile-specific session container overrides */
  @media (max-width: 800px) {
    .session-container {
      height: 100vh;
      max-height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .session-container .container-content {
      min-height: 0; /* Allow flex child to shrink on mobile */
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
