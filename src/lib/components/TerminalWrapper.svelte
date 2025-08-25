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
  <div class="h-[70vh] w-full rounded-lg overflow-hidden border bg-black flex items-center justify-center">
    <p class="text-white">Loading terminal...</p>
  </div>
{/if}