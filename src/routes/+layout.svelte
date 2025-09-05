<script>
	import { onMount } from 'svelte';
	import '../app.css';

	let { data, children } = $props();

	onMount(() => {
		// Set body class based on whether TERMINAL_KEY is configured
		if (!data.hasTerminalKey) {
			document.body.classList.add('no-key');
		} else {
			document.body.classList.remove('no-key');
		}
	});
</script>

{@render children()}
