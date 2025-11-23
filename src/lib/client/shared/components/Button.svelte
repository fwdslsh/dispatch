<script>
	/**
	 * @component Button
	 * @description
	 * Button component with multiple variants, sizes, and loading states.
	 * Uses BEM pattern with .btn base class and modifiers.
	 * Supports augmented-ui styling, icon positioning, and full accessibility.
	 *
	 * @typedef {Object} ButtonProps
	 * @property {string} [text=''] - Button text content (alternative to children)
	 * @property {'primary'|'ghost'|'warn'|'danger'} [variant='primary'] - Visual variant
	 * @property {'small'|'medium'|'large'} [size='medium'] - Button size
	 * @property {boolean} [disabled=false] - Disabled state
	 * @property {boolean} [loading=false] - Loading state with spinner
	 * @property {boolean} [hideTextOnLoading=false] - Hide text when loading
	 * @property {string} [augmented='tl-clip br-clip both'] - Augmented-ui styling
	 * @property {'button'|'submit'|'reset'} [type='button'] - HTML button type
	 * @property {string} [form] - Form ID to associate with
	 * @property {'start'|'end'} [iconPosition='start'] - Icon position relative to text
	 * @property {(event: MouseEvent) => void} [onclick] - Click event handler
	 * @property {string} [ariaLabel] - Accessible label (overrides text)
	 * @property {string} [ariaDescribedBy] - ID of describing element
	 * @property {string} [class] - Additional CSS classes
	 * @property {string} [style] - Inline styles
	 * @property {string} [id] - Element ID (auto-generated if not provided)
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic usage -->
	 * <Button text="Click me" onclick={handleClick} />
	 *
	 * <!-- With icon snippet -->
	 * <Button variant="danger" loading={isSubmitting}>
	 *   {#snippet icon()}
	 *     <IconTrash size={16} />
	 *   {/snippet}
	 *   Delete Item
	 * </Button>
	 *
	 * <!-- Ghost variant with custom styling -->
	 * <Button
	 *   variant="ghost"
	 *   size="small"
	 *   augmented="none"
	 *   class="custom-class"
	 * >
	 *   Cancel
	 * </Button>
	 * ```
	 *
	 * @fires {MouseEvent} click - Fired when button is clicked (not disabled/loading)
	 */

	// Props with defaults
	let {
		// Content props
		text = '',

		// Variant and styling
		variant = 'primary', // 'primary' | 'ghost' | 'warn' | 'danger'
		size = 'medium', // 'small' | 'medium' | 'large'

		// State props
		disabled = false,
		loading = false,
		hideTextOnLoading = false,

		// Augmented UI
		augmented = 'tl-clip br-clip both',

		// Button behavior
		type = /** @type {'button' | 'submit' | 'reset'} */ ('button'),
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

	// Compute button classes - BEM pattern
	const buttonClasses = $derived.by(() => {
		const classes = ['btn'];

		// Add variant modifier
		if (variant === 'primary') classes.push('btn--primary');
		else if (variant === 'danger') classes.push('btn--danger');
		else if (variant === 'warn') classes.push('btn--warn');
		else if (variant === 'ghost') classes.push('btn--ghost');

		// Add size modifier
		if (size === 'small') classes.push('btn--sm');
		else if (size === 'large') classes.push('btn--lg');

		// Add augmented modifier
		if (augmented && augmented !== 'none') classes.push('btn--aug');

		// Add custom classes
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
	/* All button styles defined in buttons.css - no component-specific CSS needed */
</style>
