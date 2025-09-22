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
		success = false,
		required = false,

		// Size and appearance
		size = 'medium', // 'small' | 'medium' | 'large'

		// Character limits
		maxLength = undefined,

		// Textarea specific
		rows = 4,
		cols = undefined,
		resize = 'vertical', // 'none' | 'vertical' | 'horizontal' | 'both'

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
		if (error) classes.push('error');
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
		const classes = [];
		if (isAtLimit) classes.push('form-counter--error');
		else if (isApproachingLimit) classes.push('form-counter--warning');
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

<div class="form-wrapper" data-augmented-ui={augmented}>
	{#if label}
		<label for={inputId} class="form-label" id={labelId}>
			{label}
			{#if required}
				<span class="form-required" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	<div class="form-field-wrapper" data-augmented-ui-reset>
		{#if type === 'textarea'}
			<textarea
				data-augmented-ui={augmented}
				id={inputId}
				class="form-textarea {inputClasses}"
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
				class="form-input {inputClasses}"
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
			<div class="form-counter {counterClasses}" id={counterId} aria-live="polite">
				{characterCount}/{maxLength}
			</div>
		{/if}
	</div>

	{#if help && !error && !warning}
		<div class="form-help" id={helpId}>
			{help}
		</div>
	{/if}

	{#if error}
		<div class="form-error" id={errorId} role="alert">
			{error}
		</div>
	{:else if warning}
		<div class="form-warning" id={warningId} role="alert">
			{warning}
		</div>
	{/if}
</div>

<style>
	/* Component-specific overrides only */
	.form-counter {
		position: absolute;
		bottom: var(--space-1);
		right: var(--space-3);
		background: var(--surface);
		padding: 2px 4px;
		border-radius: 2px;
		pointer-events: none;
	}

	.form-textarea ~ .form-counter {
		bottom: var(--space-3);
	}

	/* Terminal cursor effect simulation */
	.form-input:focus::after,
	.form-textarea:focus::after {
		content: '';
		position: absolute;
		right: 8px;
		top: 50%;
		transform: translateY(-50%);
		width: 2px;
		height: 1em;
		background: var(--primary);
		animation: cursorBlink 1s infinite;
		pointer-events: none;
	}

	/* Enhanced help and validation message styling */
	.form-help::before {
		content: 'i';
		color: var(--accent-cyan);
		margin-right: 0.25rem;
		font-style: italic;
		font-weight: bold;
		border: 1px solid var(--accent-cyan);
		border-radius: 50%;
		width: 12px;
		height: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		text-align: center;
		line-height: 1;
	}

	.form-error {
		background: color-mix(in oklab, var(--err) 10%, transparent);
		padding: var(--space-2);
		border: 1px solid color-mix(in oklab, var(--err) 30%, transparent);
		text-shadow: 0 0 5px color-mix(in oklab, var(--err) 30%, transparent);
	}

	.form-error::before {
		content: '!';
		color: var(--err);
		font-weight: bold;
		border: 1px solid var(--err);
		border-radius: 50%;
		width: 12px;
		height: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		text-align: center;
		line-height: 1;
		margin-right: 0.25rem;
	}

	.form-warning {
		background: color-mix(in oklab, var(--warn) 10%, transparent);
		padding: var(--space-2);
		border: 1px solid color-mix(in oklab, var(--warn) 30%, transparent);
		text-shadow: 0 0 5px color-mix(in oklab, var(--warn) 30%, transparent);
	}

	.form-warning::before {
		content: '!';
		color: var(--warn);
		font-weight: bold;
		border: 1px solid var(--warn);
		border-radius: 50%;
		width: 12px;
		height: 12px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		text-align: center;
		line-height: 1;
		margin-right: 0.25rem;
	}

	@keyframes cursorBlink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}
</style>
