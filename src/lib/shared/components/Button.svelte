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
		icon,
		children,
		...restProps
	} = $props();

	// Generate unique ID if not provided
	const buttonId = id || `btn-${Math.random().toString(36).substr(2, 9)}`;

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
	/* Enhanced terminal button styling */
	.button {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		white-space: nowrap;
		position: relative;
		
		/* Override global styles for component specificity */
		background: linear-gradient(135deg, var(--primary), var(--primary-bright)) !important;
		border: 2px solid var(--primary) !important;
		color: var(--bg-dark) !important;
		font-family: var(--font-mono) !important;
		font-weight: 700 !important;
		text-transform: uppercase !important;
		letter-spacing: 0.05em !important;
		
		/* Enhanced terminal styling */
		box-shadow:
			0 0 20px var(--primary-glow),
			inset 0 2px 0 rgba(255, 255, 255, 0.2),
			inset 0 -2px 0 rgba(0, 0, 0, 0.2) !important;
	}
	
	.button:hover {
		background: linear-gradient(135deg, var(--primary-bright), var(--accent-cyan)) !important;
		transform: translateY(-2px) !important;
		box-shadow:
			var(--glow-strong),
			inset 0 3px 0 rgba(255, 255, 255, 0.3),
			inset 0 -3px 0 rgba(0, 0, 0, 0.3),
			0 8px 25px rgba(0, 0, 0, 0.4) !important;
		text-shadow: 0 0 10px rgba(0, 0, 0, 0.8) !important;
	}
	
	.button:active {
		transform: translateY(0px) !important;
		box-shadow:
			var(--glow-primary),
			inset 0 1px 0 rgba(255, 255, 255, 0.1),
			inset 0 -1px 0 rgba(0, 0, 0, 0.1) !important;
	}
	
	/* Variant styling */
	.button.danger {
		background: linear-gradient(135deg, var(--secondary), #ff5252) !important;
		border-color: var(--secondary) !important;
		box-shadow:
			0 0 20px rgba(255, 107, 107, 0.3),
			inset 0 2px 0 rgba(255, 255, 255, 0.2),
			inset 0 -2px 0 rgba(0, 0, 0, 0.2) !important;
	}
	
	.button.warn {
		background: linear-gradient(135deg, var(--accent-amber), #ffdd44) !important;
		border-color: var(--accent-amber) !important;
		color: var(--bg-dark) !important;
		box-shadow:
			0 0 20px rgba(255, 209, 102, 0.3),
			inset 0 2px 0 rgba(255, 255, 255, 0.2),
			inset 0 -2px 0 rgba(0, 0, 0, 0.2) !important;
	}

	/* Loading and disabled states */
	.button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		pointer-events: none;
		transform: none !important;
		background: var(--text-muted) !important;
		border-color: var(--text-muted) !important;
		box-shadow: none !important;
	}

	.btn__text--hidden {
		opacity: 0;
		width: 0;
		overflow: hidden;
	}

	/* Enhanced terminal spinner */
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
	
	/* Terminal glow animation */
	@keyframes terminalGlow {
		0%, 100% { 
			box-shadow:
				0 0 20px var(--primary-glow),
				inset 0 2px 0 rgba(255, 255, 255, 0.2),
				inset 0 -2px 0 rgba(0, 0, 0, 0.2);
		}
		50% { 
			box-shadow:
				var(--glow-strong),
				inset 0 2px 0 rgba(255, 255, 255, 0.2),
				inset 0 -2px 0 rgba(0, 0, 0, 0.2);
		}
	}
	
	/* Add subtle glow animation for primary buttons */
	.button.primary {
		animation: terminalGlow 3s ease-in-out infinite;
	}
	
	@media (prefers-reduced-motion: reduce) {
		.button.primary {
			animation: none;
		}
	}
</style>
