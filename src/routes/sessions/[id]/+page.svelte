
<script>
  import Terminal from '$lib/components/Terminal.svelte';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  
  let authed = false;
  let sessionId;

  onMount(() => {
    if (browser) {
      const storedAuth = localStorage.getItem('dispatch-auth-token');
      if (storedAuth) {
        authed = true;
        sessionId = $page.params.id;
      } else {
        goto('/');
        return;
      }
    }
  });
</script>

<h1>Session Terminal: {$page.params.id}</h1>
{#if authed && sessionId}
  <Terminal {sessionId} />
{:else}
  <p>Loading...</p>
{/if}
