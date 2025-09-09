<script>
	import { onMount } from 'svelte';
	import '$lib/shared/styles/retro.css';
	import { getStoredAuthToken } from '$lib/shared/utils/socket-auth.js';

	let { data, children } = $props();

	onMount(() => {
		// Set body class based on whether TERMINAL_KEY is configured OR user has stored auth token
		const hasStoredAuth = !!getStoredAuthToken();
		const hasAuth = data?.hasTerminalKey || hasStoredAuth;

		if (!hasAuth) {
			document.body.classList.add('no-key');
		} else {
			document.body.classList.remove('no-key');
		}
	});
</script>

{@render children()}
