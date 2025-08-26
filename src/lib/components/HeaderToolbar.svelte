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
    border-bottom: 1px solid var(--primary-muted);
    
    padding-inline: var(--space-sm);
    margin-inline: var(--space-sm);
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
      padding: var(--space-sm) var(--space-md);
    }
    
    .header-left {
      align-items: center;
      gap: var(--space-md);
    }
    
    .header-right {
      align-self: center;
    }
  }
</style>