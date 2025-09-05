<script>
	import { onMount } from 'svelte';
	import { initializeClientSessionTypes } from '$lib/session-types/client.js';
	import '$lib/shared/styles/app.css';

	let { data, children } = $props();

	onMount(() => {
		// Initialize client-side session types registry (metadata only)
		try {
			initializeClientSessionTypes();
			console.log('Client session types initialized in frontend');
		} catch (error) {
			console.warn('Failed to initialize client session types in frontend:', error);
		}

		// Set body class based on whether TERMINAL_KEY is configured
		if (!data?.hasTerminalKey) {
			document.body.classList.add('no-key');
		} else {
			document.body.classList.remove('no-key');
		}
	});
</script>

{@render children()}
