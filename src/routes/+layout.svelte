<script>
	import { onMount } from 'svelte';
	import '$lib/client/shared/styles/index.css';
	import { getStoredAuthToken } from '$lib/client/shared/socket-auth.js';

	let { data, children } = $props();

	onMount(() => {
		// Check if user has authentication (cookie-based or localStorage)
		const hasStoredAuth = !!getStoredAuthToken();

		// Use JWT-based authentication system
		if (!hasStoredAuth) {
			document.body.classList.add('no-key');
		} else {
			document.body.classList.remove('no-key');
		}
	});
</script>

{@render children()}
