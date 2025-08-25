<script>
  import { onMount } from 'svelte';
  let Terminal;
  let mounted = false;

  onMount(async () => {
    const module = await import('$lib/components/Terminal.svelte');
    Terminal = module.default;
    mounted = true;
  });
</script>

{#if mounted && Terminal}
  <svelte:component this={Terminal} />
{:else}
  <section style="height:70vh; width:100%; border-radius:var(--pico-border-radius); overflow:hidden; border:var(--pico-border-width) solid var(--pico-border-color); background:black; display:flex; align-items:center; justify-content:center;">
    <p style="color:white;">Loading terminal...</p>
  </section>
{/if}