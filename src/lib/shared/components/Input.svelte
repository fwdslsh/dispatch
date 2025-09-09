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
		autofocus = false,

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

<div class="input-wrapper">
	{#if label}
		<label for={inputId} class="input__label" id={labelId}>
			{label}
			{#if required}
				<span class="input__required" aria-label="required">*</span>
			{/if}
		</label>
	{/if}

	<div class="input__field-wrapper">
		{#if type === 'textarea'}
			<textarea
				id={inputId}
				class={inputClasses}
				{placeholder}
				{disabled}
				{readonly}
				{required}
				{form}
				{autocomplete}
				{autofocus}
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
				id={inputId}
				class={inputClasses}
				{type}
				{placeholder}
				{disabled}
				{readonly}
				{required}
				{form}
				{autocomplete}
				{autofocus}
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
	}

	.input__label {
		font-size: 0.875rem;
		font-weight: 600;
		font-family: var(--font-mono);
		color: var(--text-secondary);
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

	/* Enhanced terminal input styling - override global styles */
	input, textarea {
		background: rgba(18, 26, 23, 0.6) !important;
		border: 2px solid var(--primary-dim) !important;
		border-radius: 0 !important;
		color: var(--text-primary) !important;
		font-family: var(--font-mono) !important;
		
		/* Terminal styling */
		box-shadow:
			inset 0 0 20px rgba(0, 0, 0, 0.5),
			0 0 10px var(--primary-glow) !important;
		
		transition: all 0.3s ease !important;
		position: relative;
	}
	
	input:focus, textarea:focus {
		border-color: var(--primary) !important;
		background: rgba(18, 26, 23, 0.8) !important;
		color: var(--primary-bright) !important;
		box-shadow:
			inset 0 0 20px rgba(0, 0, 0, 0.5),
			var(--glow-primary),
			0 0 0 3px var(--primary-glow) !important;
		text-shadow: 0 0 8px var(--primary-glow) !important;
		outline: none !important;
	}

	/* Textarea specific */
	textarea {
		resize: vertical;
		min-height: 80px;
		height: auto;
		line-height: 1.5;
	}
	
	/* Terminal cursor effect simulation */
	input:focus::after, textarea:focus::after {
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
		color: var(--text-muted);
		line-height: 1.4;
	}
	
	.input__help::before {
		content: 'ℹ ';
		color: var(--accent-cyan);
		margin-right: 0.25rem;
	}

	.input__error {
		font-size: 0.75rem;
		font-family: var(--font-mono);
		color: var(--secondary);
		line-height: 1.4;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		background: rgba(255, 107, 107, 0.1);
		padding: var(--space-2);
		border: 1px solid rgba(255, 107, 107, 0.3);
		text-shadow: 0 0 5px rgba(255, 107, 107, 0.3);
	}
	
	.input__error::before {
		content: '⚠ ';
		color: var(--secondary);
		font-weight: 700;
	}

	.input__warning {
		font-size: 0.75rem;
		font-family: var(--font-mono);
		color: var(--accent-amber);
		line-height: 1.4;
		display: flex;
		align-items: center;
		gap: var(--space-1);
		background: rgba(255, 209, 102, 0.1);
		padding: var(--space-2);
		border: 1px solid rgba(255, 209, 102, 0.3);
		text-shadow: 0 0 5px rgba(255, 209, 102, 0.3);
	}
	
	.input__warning::before {
		content: '⚡ ';
		color: var(--accent-amber);
		font-weight: 700;
	}
</style>
