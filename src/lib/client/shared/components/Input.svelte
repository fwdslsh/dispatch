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
		const classes = ['input__counter'];
		if (isAtLimit) classes.push('input__counter--error');
		else if (isApproachingLimit) classes.push('input__counter--warning');
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

<div class="input-wrapper" data-augmented-ui={augmented}>
	{#if label}
		<label for={inputId} class="input__label" id={labelId}>
			{label}
			{#if required}
				<span class="input__required" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	<div class="input__field-wrapper" data-augmented-ui-reset>
		{#if type === 'textarea'}
			<textarea
				data-augmented-ui={augmented}
				id={inputId}
				class={inputClasses}
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
				class={inputClasses}
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
			<div class={counterClasses} id={counterId} aria-live="polite">
				{characterCount}/{maxLength}
			</div>
		{/if}
	</div>

	{#if help && !error && !warning}
		<div class="input__help" id={helpId}>
			{help}
		</div>
	{/if}

	{#if error}
		<div class="input__error" id={errorId} role="alert">
			{error}
		</div>
	{:else if warning}
		<div class="input__warning" id={warningId} role="alert">
			{warning}
		</div>
	{/if}
</div>

<style>
	.input-wrapper {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-3);
	}

	.input__label {
		font-size: 0.875rem;
		font-weight: 600;
		font-family: var(--font-mono);
		color: var(--muted);
		display: flex;
		align-items: center;
		gap: var(--space-1);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	/* Terminal label prefix */
	.input__label::before {
		content: '> ';
		color: var(--accent-amber);
		font-weight: 700;
	}

	.input__required {
		color: var(--err);
		font-weight: bold;
	}

	.input__field-wrapper {
		position: relative;
		width: 100%;
	}

	/* Enhanced terminal input styling using design system variables */
	input,
	textarea {
		background: color-mix(in oklab, var(--surface) 60%, var(--bg));
		color: var(--text);
		font-family: var(--font-mono);
		border: none;
		transition: all 0.3s ease;
		position: relative;
		border-radius: 0;
	}

	input:focus,
	textarea:focus {
		border-color: var(--accent);
		background: color-mix(in oklab, var(--surface) 80%, var(--bg));
		color: var(--accent);
		box-shadow:
			inset 0 0 20px color-mix(in oklab, var(--bg) 50%, black),
			0 0 20px var(--glow),
			0 0 0 3px var(--glow);
		text-shadow: 0 0 8px var(--glow);
		outline: none;
	}

	/* Textarea specific */
	textarea {
		resize: vertical;
		min-height: 80px;
		height: auto;
		line-height: 1.5;
	}

	/* Terminal cursor effect simulation */
	input:focus::after,
	textarea:focus::after {
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

	/* Character counter */
	.input__counter {
		position: absolute;
		bottom: var(--space-1);
		right: var(--space-3);
		font-size: 0.75rem;
		color: var(--muted);
		background: var(--surface);
		padding: 2px 4px;
		border-radius: 2px;
		pointer-events: none;
	}

	textarea ~ .input__counter {
		bottom: var(--space-3);
	}

	.input__counter--warning {
		color: var(--warn);
	}

	.input__counter--error {
		color: var(--err);
	}

	/* Enhanced terminal help and validation messages */
	.input__help {
		font-size: 0.75rem;
		font-family: var(--font-mono);
		color: var(--muted);
		line-height: 1.4;
	}

	.input__help::before {
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

	.input__error {
		font-size: 0.75rem;
		font-family: var(--font-mono);
		color: var(--err);
		line-height: 1.4;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		background: color-mix(in oklab, var(--err) 10%, transparent);
		padding: var(--space-2);
		border: 1px solid color-mix(in oklab, var(--err) 30%, transparent);
		text-shadow: 0 0 5px color-mix(in oklab, var(--err) 30%, transparent);
	}

	.input__error::before {
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

	.input__warning {
		font-size: 0.75rem;
		font-family: var(--font-mono);
		color: var(--warn);
		line-height: 1.4;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		background: color-mix(in oklab, var(--warn) 10%, transparent);
		padding: var(--space-2);
		border: 1px solid color-mix(in oklab, var(--warn) 30%, transparent);
		text-shadow: 0 0 5px color-mix(in oklab, var(--warn) 30%, transparent);
	}

	.input__warning::before {
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
</style>
