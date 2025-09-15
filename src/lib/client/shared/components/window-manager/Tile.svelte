<script>
  let {
    /** @type {string} */ id,
    /** @type {string} */ focused = '',
    /** @type {import('svelte').Snippet} */ children,
    /** @type {(id: string) => void} */ onfocus = () => {}
  } = $props();

  // Handle focus events by calling parent's onfocus handler
  function focusSelf() {
    onfocus(id);
  }
  /** @type {HTMLElement|null} */ let tileEl = $state(null);
</script>

<!-- No visual styles; focus state exposed via data-focused -->
<button
  type="button"
  class="wm-tile"
  data-tile-id={id}
  data-focused={String(focused === id)}
  aria-label={id}
  bind:this={tileEl}
  onclick={focusSelf}
  onfocus={focusSelf}
>
  {@render children?.()}
</button>
