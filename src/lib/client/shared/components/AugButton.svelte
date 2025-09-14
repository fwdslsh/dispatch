<script>
	/**
	 * Button Foundation Component
	 * Standardized button with variants, sizes, loading states, and augmented-ui styling
	 */

	// Props with defaults
	let {
		// Content props
		text = '',

		// Variant and styling
		variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'ghost'
		size = 'medium', // 'small' | 'medium' | 'large'

		// State props
		disabled = false,
		loading = false,
		hideTextOnLoading = false,

		// Augmented UI
		augmented = 'tl-clip br-clip both',

		// Button behavior
		type = /** @type {'button' | 'submit' | 'reset'} */ ('button'), // 'button' | 'submit' | 'reset'
		form = undefined,

		// Icon support
		iconPosition = 'start', // 'start' | 'end'

		// Event handlers
		onclick = undefined,

		// Accessibility
		ariaLabel = undefined,
		ariaDescribedBy = undefined,

		// HTML attributes
		class: customClass = '',
		style = '',
		id = undefined,

		// Snippet props
		icon = undefined,
		children = undefined,
		...restProps
	} = $props();

	// Generate unique ID if not provided
	const buttonId = id || `btn-${Math.random().toString(36).substring(2, 9)}`;

	// Compute button classes - use global retro.css classes
	const buttonClasses = $derived.by(() => {
		const classes = ['button'];

		if (variant === 'primary') classes.push('primary');
		else if (variant === 'danger') classes.push('danger');
		else if (variant === 'secondary') classes.push('warn');

		if (augmented && augmented !== 'none') classes.push('aug');
		if (customClass) classes.push(...customClass.split(' '));

		return classes.join(' ');
	});

	// Compute button state
	const isDisabled = $derived(disabled || loading);
	const showText = $derived(!loading || !hideTextOnLoading);

	// Handle click with disabled/loading checks
	function handleClick(event) {
		if (isDisabled || !onclick) return;
		onclick(event);
	}

	// Handle keyboard activation
	function handleKeyDown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClick(event);
		}
	}
</script>

<button
	id={buttonId}
	class={buttonClasses}
	{type}
	{form}
	{style}
	disabled={isDisabled}
	aria-label={ariaLabel}
	aria-describedby={ariaDescribedBy}
	aria-busy={loading ? 'true' : 'false'}
	data-augmented-ui={augmented}
	onclick={handleClick}
	onkeydown={handleKeyDown}
	{...restProps}
>
	{#if iconPosition === 'start'}
		{#if loading}
			<div class="btn__spinner" aria-hidden="true">
				<div class="spinner"></div>
			</div>
		{:else if icon}
			{@render icon()}
		{/if}
	{/if}

	{#if showText}
		<span class="btn__text" class:btn__text--hidden={loading && hideTextOnLoading}>
			{#if children}
				{@render children()}
			{:else}
				{text}
			{/if}
		</span>
	{/if}

	{#if iconPosition === 'end'}
		{#if loading}
			<div class="btn__spinner" aria-hidden="true">
				<div class="spinner"></div>
			</div>
		{:else if icon}
			{@render icon()}
		{/if}
	{/if}
</button>

<style>
	/* Button styles that work with global .button class from retro.css */
	.button {
		/* Remove conflicting overrides, inherit from global styles */
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		white-space: nowrap;
		position: relative;

		/* Use system variables consistently */
		background: color-mix(in oklab, var(--accent) 5%, var(--surface));
		border: 1px solid var(--primary-dim);
		color: var(--text);
		font-family: var(--font-mono);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-radius: 8px;

		/* Smooth transitions */
		transition: all 0.2s ease;
		box-shadow: none;
	}

	.button:hover {
		background: color-mix(in oklab, var(--accent) 10%, var(--surface));
		border-color: var(--accent);
		box-shadow: 0 0 20px var(--glow);
	}

	.button:active,
	.button.active {
		background: color-mix(in oklab, var(--accent) 15%, var(--surface));
		border-color: var(--accent);
		box-shadow: inset 0 0 8px var(--glow);
		transform: translateY(1px);
	}

	/* Primary variant */
	.button.primary {
		background: color-mix(in oklab, var(--accent) 20%, var(--surface));
		border-color: var(--accent);
		color: var(--text);
	}

	.button.primary:hover {
		background: color-mix(in oklab, var(--accent) 30%, var(--surface));
		box-shadow: 0 0 25px var(--glow);
	}

	/* Ghost variant */
	.button.ghost {
		background: transparent;
		border: 1px solid var(--primary-dim);
		color: var(--muted);
	}

	.button.ghost:hover {
		background: color-mix(in oklab, var(--accent) 8%, transparent);
		border-color: var(--accent);
		color: var(--accent);
		box-shadow: 0 0 18px var(--glow);
	}

	.button.ghost:active,
	.button.ghost.active {
		background: color-mix(in oklab, var(--accent) 12%, transparent);
		box-shadow: inset 0 0 6px var(--glow);
	}

	/* Danger variant */
	.button.danger {
		background: color-mix(in oklab, var(--err) 20%, var(--surface));
		border-color: var(--err);
		color: var(--text);
	}

	.button.danger:hover {
		background: color-mix(in oklab, var(--err) 30%, var(--surface));
		box-shadow: 0 0 20px color-mix(in oklab, var(--err) 40%, transparent);
	}

	/* Warning variant */
	.button.warn {
		background: color-mix(in oklab, var(--warn) 20%, var(--surface));
		border-color: var(--warn);
		color: var(--text);
	}

	.button.warn:hover {
		background: color-mix(in oklab, var(--warn) 30%, var(--surface));
		box-shadow: 0 0 20px color-mix(in oklab, var(--warn) 40%, transparent);
	}

	/* Disabled state */
	.button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
		transform: none;
		background: var(--muted);
		border-color: var(--muted);
		box-shadow: none;
	}

	/* Text states */
	.btn__text--hidden {
		opacity: 0;
		width: 0;
		overflow: hidden;
	}

	/* Spinner */
	.btn__spinner {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		width: 16px;
		height: 16px;
		border: 2px solid currentColor;
		border-top: 2px solid transparent;
		border-radius: 50%;
		animation: terminalSpin 1s linear infinite;
	}

	@keyframes terminalSpin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Ensure augmented-ui styles work properly */
	.button.aug {
		border-radius: 0; /* Remove radius for augmented-ui */
		background: color-mix(in oklab, var(--accent) 5%, var(--surface));
	}

	@media (prefers-reduced-motion: reduce) {
		.button {
			transition: opacity 0.2s ease;
		}
	}
</style>
