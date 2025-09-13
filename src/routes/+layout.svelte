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

<svelte:head>
  <link rel="preload" href="/fonts/exo-2/7cHmv4okm5zmbtYoK-4.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/share-tech-mono/J7aHnp1uDWRBEqV98dVQztYldFcLowEF.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/protest-revolution/ProtestRevolution-Regular-latin.woff2" as="font" type="font/woff2" crossorigin>
</svelte:head>

{@render children()}
