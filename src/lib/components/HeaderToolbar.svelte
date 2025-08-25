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
    padding: 1rem 2rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  @media (max-width: 768px) {
    .header-toolbar {
      flex-direction: column;
      align-items: stretch;
      gap: 1rem;
      padding: 1rem;
    }
    
    .header-left {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
    
    .header-right {
      align-self: flex-end;
    }
  }
</style>