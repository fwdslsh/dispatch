<script>
	/**
	 * IconButton Component
	 * Icon-only button for close, actions, etc.
	 */
	// Props
	let {
		children = undefined,
		variant = 'ghost',
		size = 'medium',
		disabled = false,
		loading = false,
		ariaLabel = undefined,
		onclick = undefined,
		class: customClass = '',
		...restProps
	} = $props();
</script>

<button
	{disabled}
	class:loading
	aria-labelledby={ariaLabel}
	{onclick}
	class="btn-icon-only {customClass} {variant}"
	{...restProps}
>
	{#if children}
		{@render children()}
	{/if}
</button>

<style>

	:root{
		--transition-duration: 0.5s;
	}
	/* Icon-only button specific styles - minimal styling with only color change on hover */
	.btn-icon-only {
		width: auto;
		padding: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.2rem;
		border: none;
		background: none;
		cursor: pointer;
		transition: all var(--transition-duration) ease-in-out;

		/* Ensure proper touch targets on mobile */
		@media (max-width: 768px) {
			padding: var(--space-2);
		}
	}

	.btn-icon-only:hover {
		transition: all var(--transition-duration) ease-in-out;
		color: var(--accent);
	}

	/* Primary variant */
	.btn-icon-only.primary {
		color: var(--accent);
	}

	.btn-icon-only.primary:hover {
		color: var(--accent);
	}

	:global(.btn-icon-only.primary svg) {
		filter: drop-shadow(0 0 2px var(--accent));
	}

	:global(.btn-icon-only.primary:hover svg) {
		filter: drop-shadow(0 0 4px var(--accent)) drop-shadow(0 0 8px var(--accent));
	}

	/* Secondary/Warning variant */
	.btn-icon-only.secondary,
	.btn-icon-only.warn {
		color: var(--warn);
	}

	.btn-icon-only.secondary:hover,
	.btn-icon-only.warn:hover {
		color: var(--warn);
	}

	:global(.btn-icon-only.secondary svg),
	:global(.btn-icon-only.warn svg) {
		filter: drop-shadow(0 0 2px var(--warn));
	}

	:global(.btn-icon-only.secondary:hover svg),
	:global(.btn-icon-only.warn:hover svg) {
		filter: drop-shadow(0 0 4px var(--warn)) drop-shadow(0 0 8px var(--warn));
	}

	/* Danger variant */
	.btn-icon-only.danger {
		color: var(--err);
	}

	.btn-icon-only.danger:hover {
		color: var(--err);
	}

	:global(.btn-icon-only.danger svg) {
		filter: drop-shadow(0 0 2px var(--err));
	}

	:global(.btn-icon-only.danger:hover svg) {
		filter: drop-shadow(0 0 4px var(--err)) drop-shadow(0 0 8px var(--err));
	}

	/* Ghost variant (default - minimal styling) */
	.btn-icon-only.ghost {
		color: var(--muted);
	}

	.btn-icon-only.ghost:hover {
		color: var(--accent);
	}

	:global(.btn-icon-only.ghost svg) {
		filter: none;
	}

	:global(.btn-icon-only.ghost:hover svg) {
		filter: drop-shadow(0 0 3px var(--accent));
	}
	:global(.btn-icon-only svg) {
		transition: all var(--transition-duration) ease-in-out;
		width: 1.5rem;
	}
	:global(.btn-icon-only:hover svg) {
		filter: drop-shadow(0 0 3px var(--primary-glow));
		transition: all var(--transition-duration) ease-in-out;
	}

	.btn-icon-only:active,
	.btn-icon-only.active {
		color: var(--primary);
	}

	/* Disabled state */
	.btn-icon-only:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
		color: var(--muted);
	}

	:global(.btn-icon-only:disabled svg) {
		filter: none;
	}

	
</style>
