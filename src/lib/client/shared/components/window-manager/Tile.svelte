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

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="wm-tile"
	role="region"
	tabindex="0"
	data-tile-id={id}
	data-focused={String(focused === id)}
	aria-label="Session tile {id}"
	onclick={focusSelf}
	onfocus={focusSelf}
	onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && focusSelf()}
>
	{@render children?.()}
</div>
