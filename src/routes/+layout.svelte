<script>
  import '../app.css';
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  
  export let data;
  
  onMount(() => {
    // Set body class based on whether TERMINAL_KEY is configured
    if (!data.hasTerminalKey) {
      document.body.classList.add('no-key');
    } else {
      document.body.classList.remove('no-key');
    }
  });
</script>

<slot />