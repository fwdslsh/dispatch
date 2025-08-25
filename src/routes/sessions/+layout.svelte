<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { browser } from '$app/environment';

  onMount(() => {
    if (browser) {
      const storedAuth = localStorage.getItem('dispatch-auth-token');
      if (!storedAuth) {
        goto('/');
      }
    }
  });
</script>

<slot />