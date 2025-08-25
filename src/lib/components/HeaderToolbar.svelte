<script>
  // Component for reusable header toolbar with left and right content slots
  let { left, right } = $props();
</script>

<div class="header-toolbar">
  <div class="header-left">
    {@render left()}
  </div>
  <div class="header-right">
    {@render right()}
  </div>
</div>

<style>
  .header-toolbar {
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: var(--space-md) var(--space-xl);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-xl);
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
      gap: var(--space-md);
      padding: var(--space-md);
      min-height: auto;
    }
    
    .header-left {
      align-items: flex-start;
      gap: var(--space-sm);
    }
    
    .header-right {
      align-self: flex-end;
    }
  }
</style>