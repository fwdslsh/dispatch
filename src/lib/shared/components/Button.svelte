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
		augmented = 'tl-clip br-clip',

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
		icon,
		children,
		...restProps
	} = $props();

	// Generate unique ID if not provided
	const buttonId = id || `btn-${Math.random().toString(36).substr(2, 9)}`;

	// Compute button classes
	const buttonClasses = $derived(() => {
		const classes = ['btn', `btn--${variant}`, `btn--${size}`];

		if (disabled) classes.push('btn--disabled');
		if (loading) classes.push('btn--loading');
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
	{id}
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
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-sm);
		border: none;
		border-radius: 0;
		font-family: var(--font-sans);
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
		position: relative;
		outline: none;
		white-space: nowrap;
	}

	.btn:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	/* Variants */
	.btn--primary {
		background: var(--primary-gradient);
		color: var(--bg-dark);
		--aug-border-bg: var(--primary);
	}

	.btn--primary:hover:not(:disabled) {
		background: var(--primary);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
	}

	.btn--secondary {
		background: var(--surface);
		color: var(--text-primary);
		border: 1px solid var(--border-light);
		--aug-border-bg: var(--border-light);
	}

	.btn--secondary:hover:not(:disabled) {
		background: var(--surface-hover);
		border-color: var(--primary);
		--aug-border-bg: var(--primary);
	}

	.btn--danger {
		background: linear-gradient(135deg, var(--secondary), #ff4757);
		color: white;
		--aug-border-bg: var(--secondary);
	}

	.btn--danger:hover:not(:disabled) {
		background: var(--secondary);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
	}

	.btn--ghost {
		background: transparent;
		color: var(--primary);
		border: 1px solid var(--primary-muted);
		--aug-border-bg: transparent;
	}

	.btn--ghost:hover:not(:disabled) {
		background: var(--primary-muted);
		color: var(--bg-dark);
		border-color: var(--primary);
	}

	/* Sizes */
	.btn--small {
		padding: var(--space-xs) var(--space-sm);
		font-size: 0.875rem;
		height: 32px;
		min-width: 64px;
	}

	.btn--medium {
		padding: var(--space-sm) var(--space-md);
		font-size: 1rem;
		height: 40px;
		min-width: 80px;
	}

	.btn--large {
		padding: var(--space-md) var(--space-lg);
		font-size: 1.125rem;
		height: 48px;
		min-width: 96px;
	}

	/* States */
	.btn--disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none !important;
		box-shadow: none !important;
	}

	.btn--loading {
		cursor: wait;
		pointer-events: none;
	}

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
		animation: spin 1s linear infinite;
	}

	.btn--small .spinner {
		width: 12px;
		height: 12px;
		border-width: 1.5px;
	}

	.btn--large .spinner {
		width: 20px;
		height: 20px;
		border-width: 2.5px;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.btn {
			min-height: 44px; /* Better touch targets on mobile */
		}

		.btn--small {
			height: 36px;
		}

		.btn--medium {
			height: 44px;
		}

		.btn--large {
			height: 52px;
		}
	}
</style>
