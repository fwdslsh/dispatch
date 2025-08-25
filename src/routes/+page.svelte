<script>
    import Terminal from '$lib/components/Terminal.svelte';
  /**
   * Main page for Dispatch Terminal UI
   * Imports the TerminalWrapper component
   */
</script>

<svelte:head>
  <title>Dispatch - SvelteKit PTY + Claude Code</title>
</svelte:head>

<main class="container">
  <h1>Dispatch Terminal</h1>
  <p>Interactive PTY sessions with Claude Code in Docker</p>
  <!-- <TerminalWrapper /> -->

  <Terminal />
</main>