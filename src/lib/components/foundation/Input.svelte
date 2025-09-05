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

	// Compute classes
	const inputClasses = $derived(() => {
		const classes = ['input', `input--${size}`];
		
		if (type === 'textarea') classes.push('input--textarea');
		if (error) classes.push('input--error');
		else if (warning) classes.push('input--warning');
		else if (success) classes.push('input--success');
		if (disabled) classes.push('input--disabled');
		if (readonly) classes.push('input--readonly');
		if (resize && type === 'textarea') classes.push(`input--resize-${resize}`);
		if (customClass) classes.push(...customClass.split(' '));
		
		return classes.join(' ');
	});

	// Compute ARIA describedby
	const computedAriaDescribedBy = $derived(() => {
		const ids = [];
		if (help) ids.push(helpId);
		if (error) ids.push(errorId);
		else if (warning) ids.push(warningId);
		if (maxLength) ids.push(counterId);
		if (ariaDescribedBy) ids.push(ariaDescribedBy);
		return ids.length > 0 ? ids.join(' ') : undefined;
	});

	// Character count
	const characterCount = $derived(() => value?.toString().length || 0);
	const isApproachingLimit = $derived(() => maxLength && characterCount / maxLength > 0.8);
	const isAtLimit = $derived(() => maxLength && characterCount >= maxLength);

	const counterClasses = $derived(() => {
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
		gap: var(--space-xs);
		width: 100%;
	}

	.input__label {
		font-family: var(--font-sans);
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--text-primary);
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.input__required {
		color: var(--secondary);
		font-weight: bold;
	}

	.input__field-wrapper {
		position: relative;
		width: 100%;
	}

	.input {
		width: 100%;
		border: 1px solid var(--border);
		border-radius: 4px;
		background: var(--bg-dark);
		color: var(--text-primary);
		font-family: var(--font-sans);
		transition: all 0.2s ease;
		outline: none;
	}

	.input:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.2);
	}

	.input:hover:not(:disabled):not(:focus) {
		border-color: var(--border-light);
	}

	/* Sizes */
	.input--small {
		padding: var(--space-xs) var(--space-sm);
		font-size: 0.875rem;
		height: 32px;
	}

	.input--medium {
		padding: var(--space-sm) var(--space-md);
		font-size: 1rem;
		height: 40px;
	}

	.input--large {
		padding: var(--space-md) var(--space-lg);
		font-size: 1.125rem;
		height: 48px;
	}

	/* Textarea specific */
	.input--textarea {
		resize: vertical;
		min-height: 80px;
		height: auto;
		line-height: 1.5;
	}

	.input--resize-none { resize: none; }
	.input--resize-vertical { resize: vertical; }
	.input--resize-horizontal { resize: horizontal; }
	.input--resize-both { resize: both; }

	/* States */
	.input--error {
		border-color: var(--secondary);
		box-shadow: 0 0 0 1px rgba(255, 107, 107, 0.3);
	}

	.input--error:focus {
		box-shadow: 0 0 0 2px rgba(255, 107, 107, 0.4);
	}

	.input--warning {
		border-color: #ffa726;
		box-shadow: 0 0 0 1px rgba(255, 167, 38, 0.3);
	}

	.input--warning:focus {
		box-shadow: 0 0 0 2px rgba(255, 167, 38, 0.4);
	}

	.input--success {
		border-color: var(--primary);
		box-shadow: 0 0 0 1px rgba(0, 255, 136, 0.3);
	}

	.input--disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background: var(--bg-darker);
	}

	.input--readonly {
		background: var(--bg-darker);
		cursor: default;
	}

	/* Character counter */
	.input__counter {
		position: absolute;
		bottom: var(--space-xs);
		right: var(--space-sm);
		font-size: 0.75rem;
		color: var(--text-muted);
		background: var(--bg-dark);
		padding: 2px 4px;
		border-radius: 2px;
		pointer-events: none;
	}

	.input--textarea ~ .input__counter {
		bottom: var(--space-sm);
	}

	.input__counter--warning {
		color: #ffa726;
	}

	.input__counter--error {
		color: var(--secondary);
	}

	/* Help and validation messages */
	.input__help {
		font-size: 0.75rem;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.input__error {
		font-size: 0.75rem;
		color: var(--secondary);
		line-height: 1.4;
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.input__warning {
		font-size: 0.75rem;
		color: #ffa726;
		line-height: 1.4;
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	/* Responsive */
	@media (max-width: 768px) {
		.input {
			min-height: 44px; /* Better touch targets */
		}
		
		.input--small {
			height: 36px;
		}
		
		.input--medium {
			height: 44px;
		}
		
		.input--large {
			height: 52px;
		}
	}

	/* Placeholder styling */
	.input::placeholder {
		color: var(--text-muted);
		opacity: 1;
	}

	/* Autofill styles */
	.input:-webkit-autofill,
	.input:-webkit-autofill:hover,
	.input:-webkit-autofill:focus {
		-webkit-box-shadow: 0 0 0 1000px var(--bg-dark) inset;
		-webkit-text-fill-color: var(--text-primary);
		transition: background-color 5000s ease-in-out 0s;
	}
</style>