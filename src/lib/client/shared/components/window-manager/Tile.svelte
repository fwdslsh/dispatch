<script>
	import { onMount } from 'svelte';

	let {
		/** @type {string} */ id,
		/** @type {string} */ focused = '',
		/** @type {import('svelte').Snippet} */ children,
		/** @type {(id: string) => void} */ onfocus = () => {},
		/** @type {(id: string) => void} */ onmounted = () => {},
		/** @type {(id: string) => void} */ ondestroyed = () => {}
	} = $props();

	onMount(() => {
		onmounted(id);
		return () => ondestroyed(id);
	});

	// Handle focus events by calling parent's onfocus handler
	function focusSelf() {
		onfocus(id);
	}
</script>

<button
	type="button"
	class="wm-tile"
	data-tile-id={id}
	data-focused={String(focused === id)}
	aria-label={id}
	onclick={focusSelf}
	onfocus={focusSelf}
>
	{@render children?.()}
</button>
