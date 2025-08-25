<script>
  import TerminalWrapper from '$lib/components/TerminalWrapper.svelte';
</script>

<svelte:head>
  <title>Dispatch - SvelteKit PTY + Claude Code</title>
  <script src="https://cdn.tailwindcss.com"></script>
</svelte:head>

<div class="container mx-auto px-4 py-6 max-w-6xl">
  <h1 class="text-2xl font-semibold mb-6">Dispatch Terminal</h1>
  <p class="text-gray-600 mb-6">Interactive PTY sessions with Claude Code in Docker</p>
  <TerminalWrapper />
</div>