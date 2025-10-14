<script>
	/**
	 * Input Foundation Component
	 * Standardized input with validation, types, help text, and augmented-ui styling
	 */

	// Props with defaults
	let {
		// Value binding
		value = $bindable(''),

		// Input configuration
		type = 'text', // 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date' | 'time' | 'datetime-local' | 'textarea'
		placeholder = '',

		// Label and help
		label = '',
		help = '',

		// Validation states
		error = '',
		warning = '',
		required = false,

		// Character limits
		maxLength = undefined,

		// Textarea specific
		rows = 4,
		cols = undefined,

		// State
		disabled = false,
		readonly = false,

		// Form integration
		form = undefined,
		autocomplete = undefined,
		// autofocus removed for accessibility compliance

		// Event handlers
		oninput = undefined,
		onchange = undefined,
		onfocus = undefined,
		onblur = undefined,

		// Accessibility
		ariaLabel = undefined,
		ariaDescribedBy = undefined,

		// HTML attributes
		class: customClass = '',
		style = '',
		id = undefined,

		// Augmented UI
		augmented = 'tl-clip br-clip both',

		...restProps
	} = $props();

	// Generate unique IDs
	const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
	const labelId = `${inputId}-label`;
	const helpId = `${inputId}-help`;
	const errorId = `${inputId}-error`;
	const warningId = `${inputId}-warning`;
	const counterId = `${inputId}-counter`;

	// Compute classes - use global input styles
	const inputClasses = $derived.by(() => {
		const classes = [];
		if (error) classes.push('border-err', 'focus:border-err', 'focus:shadow-glow-err');
		if (customClass) classes.push(...customClass.split(' '));
		return classes.join(' ');
	});

	// Compute ARIA describedby
	const computedAriaDescribedBy = $derived.by(() => {
		const ids = [];
		if (help) ids.push(helpId);
		if (error) ids.push(errorId);
		else if (warning) ids.push(warningId);
		if (maxLength) ids.push(counterId);
		if (ariaDescribedBy) ids.push(ariaDescribedBy);
		return ids.length > 0 ? ids.join(' ') : undefined;
	});

	// Character count
	const characterCount = $derived(value?.toString().length || 0);
	const isApproachingLimit = $derived(maxLength && characterCount / maxLength > 0.8);
	const isAtLimit = $derived(maxLength && characterCount >= maxLength);

	const counterClasses = $derived.by(() => {
		const classes = ['bottom-1'];
		if (isAtLimit) classes.push('text-err');
		else if (isApproachingLimit) classes.push('text-warn');
		else classes.push('text-muted');
		if (type === 'textarea') classes.push('!bottom-3');
		return classes.join(' ');
	});

	// Event handlers
	function handleInput(event) {
		value = event.target.value;
		oninput?.(event);
	}

	function handleChange(event) {
		onchange?.(event);
	}

	function handleFocus(event) {
		onfocus?.(event);
	}

	function handleBlur(event) {
		onblur?.(event);
	}
</script>

<div class="space-y-1" data-augmented-ui={augmented}>
	{#if label}
		<label for={inputId} class="block text-sm font-medium text-text mb-1" id={labelId}>
			{label}
			{#if required}
				<span class="text-err ml-1" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	<div class="relative" data-augmented-ui-reset>
		{#if type === 'textarea'}
			<textarea
				data-augmented-ui={augmented}
				id={inputId}
				class="w-full px-3 py-2 bg-surface-glass border border-surface-border rounded-lg text-text placeholder-muted/50 transition-all duration-200 focus:outline-none focus:border-primary focus:shadow-glow-primary min-h-20 resize-y {inputClasses}"
				{placeholder}
				{disabled}
				{readonly}
				{required}
				{form}
				{autocomplete}
				{rows}
				{cols}
				{style}
				maxlength={maxLength}
				aria-label={ariaLabel}
				aria-describedby={computedAriaDescribedBy}
				aria-invalid={error ? 'true' : 'false'}
				aria-required={required ? 'true' : 'false'}
				bind:value
				oninput={handleInput}
				onchange={handleChange}
				onfocus={handleFocus}
				onblur={handleBlur}
				{...restProps}
			></textarea>
		{:else}
			<input
				data-augmented-ui={augmented}
				id={inputId}
				class="w-full px-3 py-2 bg-surface-glass border border-surface-border rounded-lg text-text placeholder-muted/50 transition-all duration-200 focus:outline-none focus:border-primary focus:shadow-glow-primary {inputClasses}"
				{type}
				{placeholder}
				{disabled}
				{readonly}
				{required}
				{form}
				{autocomplete}
				{style}
				maxlength={maxLength}
				aria-label={ariaLabel}
				aria-describedby={computedAriaDescribedBy}
				aria-invalid={error ? 'true' : 'false'}
				aria-required={required ? 'true' : 'false'}
				bind:value
				oninput={handleInput}
				onchange={handleChange}
				onfocus={handleFocus}
				onblur={handleBlur}
				{...restProps}
			/>
		{/if}

		{#if maxLength}
			<div
				class="absolute right-3 text-xs bg-surface px-1 rounded pointer-events-none {counterClasses}"
				id={counterId}
				aria-live="polite"
			>
				{characterCount}/{maxLength}
			</div>
		{/if}
	</div>

	{#if help && !error && !warning}
		<div class="form-help text-xs text-muted mt-1" id={helpId}>
			{help}
		</div>
	{/if}

	{#if error}
		<div class="form-error text-xs text-err mt-1 p-2 rounded" id={errorId} role="alert">
			{error}
		</div>
	{:else if warning}
		<div class="form-warning text-xs text-warn mt-1 p-2 rounded" id={warningId} role="alert">
			{warning}
		</div>
	{/if}
</div>

<style>
	/* Component-specific styles only */
	.form-error {
		background: color-mix(in oklab, var(--err) 10%, transparent);
		border: 1px solid color-mix(in oklab, var(--err) 30%, transparent);
		text-shadow: 0 0 5px color-mix(in oklab, var(--err) 30%, transparent);
	}

	.form-warning {
		background: color-mix(in oklab, var(--warn) 10%, transparent);
		border: 1px solid color-mix(in oklab, var(--warn) 30%, transparent);
		text-shadow: 0 0 5px color-mix(in oklab, var(--warn) 30%, transparent);
	}

	/* Enhanced help and validation message styling */
	.form-help::before {
		content: 'i';
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 0.75rem;
		height: 0.75rem;
		margin-right: 0.25rem;
		color: var(--accent-cyan);
		border: 1px solid var(--accent-cyan);
		border-radius: var(--radius-full);
		font-size: 0.5rem;
		font-weight: bold;
		font-style: italic;
	}

	.form-error::before {
		content: '!';
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 0.75rem;
		height: 0.75rem;
		margin-right: 0.25rem;
		color: var(--err);
		border: 1px solid var(--err);
		border-radius: var(--radius-full);
		font-size: 0.5rem;
		font-weight: bold;
	}

	.form-warning::before {
		content: '!';
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 0.75rem;
		height: 0.75rem;
		margin-right: 0.25rem;
		color: var(--warn);
		border: 1px solid var(--warn);
		border-radius: var(--radius-full);
		font-size: 0.5rem;
		font-weight: bold;
	}
</style>
