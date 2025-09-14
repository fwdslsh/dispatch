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
	/* Icon-only button specific styles to ensure proper sizing and styling */
	:global(.btn-icon-only) {
		--aug-tl: 6px;
		--aug-br: 6px;
		--aug-border-all: 1px;
		--aug-border-bg: var(--accent);
		--aug-border-opacity: 0.3;
		--aug-inlay-all: 0px;

		width: 2.5rem;
		height: 2.5rem;
		min-width: 2.5rem;
		min-height: 2.5rem;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;

		/* Ensure proper touch targets on mobile */
		@media (max-width: 768px) {
			width: 2.75rem;
			height: 2.75rem;
			min-width: 2.75rem;
			min-height: 2.75rem;
		}
	}

	:global(.btn-icon-only:hover) {
		--aug-tl: 8px;
		--aug-br: 8px;
		--aug-border-opacity: 0.5;
		--aug-inlay-all: 1px;
		--aug-inlay-bg: color-mix(in oklab, var(--accent) 10%, transparent);
		--aug-inlay-opacity: 0.4;
	}

	:global(.btn-icon-only:active),
	:global(.btn-icon-only.active) {
		--aug-tl: 4px;
		--aug-br: 4px;
		--aug-border-opacity: 0.8;
		--aug-inlay-all: 1px;
		--aug-inlay-opacity: 0.6;
		transform: scale(0.95);
	}
</style>
