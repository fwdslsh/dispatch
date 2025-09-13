<script>
	/**
	 * IconButton Component
	 * Icon-only button for close, actions, etc.
	 */
	import Button from './Button.svelte';

	// Props
	let {
		children = undefined,
		variant = 'ghost',
		size = 'medium',
		disabled = false,
		loading = false,
		augmented = 'tl-clip br-clip both',
		ariaLabel = undefined,
		onclick = undefined,
		class: customClass = '',
		...restProps
	} = $props();
</script>

<Button
	{variant}
	{size}
	{disabled}
	{loading}
	{augmented}
	{ariaLabel}
	{onclick}
	class="btn-icon-only {customClass}"
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</Button>

<style>
	/* Use CSS utility classes from retro.css - no additional styles needed */
</style>