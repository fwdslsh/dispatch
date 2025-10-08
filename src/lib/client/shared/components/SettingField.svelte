<!--
	SettingField Component
	Reusable form field for settings with built-in validation, error handling, and environment variable indicators.

	Eliminates code duplication across settings sections by providing a single component for all field types.
-->

<script>
	/**
	 * @typedef {Object} Setting
	 * @property {string} key - Setting identifier (e.g., 'terminal_key')
	 * @property {string} display_name - Human-readable label
	 * @property {string} [description] - Help text explaining the setting
	 * @property {string} type - Setting type (text, password, url, etc.)
	 * @property {boolean} is_required - Whether the field is required
	 * @property {string} [env_var_name] - Environment variable name if applicable
	 */

	/**
	 * @type {{
	 *   setting: Setting,
	 *   value: string,
	 *   errors: string[],
	 *   hasChanges: boolean,
	 *   onInput: (event: Event) => void,
	 *   type?: string,
	 *   placeholder?: string,
	 *   autocomplete?: string,
	 *   spellcheck?: boolean,
	 *   testId?: string
	 * }}
	 */
	let {
		setting,
		value,
		errors = [],
		hasChanges = false,
		onInput,
		type = 'text',
		placeholder = '',
		autocomplete = 'off',
		spellcheck = false,
		testId = undefined
	} = $props();

	// Derived state
	let hasErrors = $derived(errors.length > 0);
	let fieldId = $derived(`setting-${setting.key}`);
	let errorId = $derived(`${fieldId}-error`);
	let helpId = $derived(`${fieldId}-help`);

	// Generate test IDs if not provided
	let inputTestId = $derived(testId || `${setting.key}-input`);
	let errorTestId = $derived(`${setting.key}-error`);
	let helpTestId = $derived(`${setting.key}-help`);
	let envFallbackTestId = $derived(`${setting.key}-env-fallback`);
</script>

<div class="setting-field">
	<!-- Label -->
	<label for={fieldId} class="setting-label">
		{setting.display_name}
		{#if setting.is_required}
			<span class="required-indicator" aria-label="Required">*</span>
		{/if}
	</label>

	<!-- Description/Help Text -->
	{#if setting.description}
		<div class="setting-description" id={helpId} data-testid={helpTestId}>
			{setting.description}
		</div>
	{/if}

	<!-- Input Field -->
	<input
		id={fieldId}
		{type}
		class="setting-input"
		class:input-error={hasErrors}
		{placeholder}
		{value}
		oninput={onInput}
		{autocomplete}
		{spellcheck}
		data-testid={inputTestId}
		aria-describedby={hasErrors ? errorId : setting.description ? helpId : undefined}
		aria-invalid={hasErrors}
	/>

	<!-- Validation Errors -->
	{#if hasErrors}
		<div class="error-message" id={errorId} role="alert" data-testid={errorTestId}>
			{#each errors as error}
				<div class="error-item">{error}</div>
			{/each}
		</div>
	{/if}

	<!-- Environment Variable Fallback Indicator -->
	{#if setting.env_var_name && !hasChanges}
		<div class="env-fallback" data-testid={envFallbackTestId}>
			<div class="env-icon">🔧</div>
			<div class="env-content">
				<strong>Environment Variable:</strong>
				Currently using value from <code>{setting.env_var_name}</code> environment variable. Set a value
				here to override the environment setting.
			</div>
		</div>
	{/if}
</div>

<style>
	.setting-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.setting-label {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-weight: 600;
		font-size: var(--font-size-2);
		font-family: var(--font-mono);
		color: var(--text);
		margin: 0;
	}

	.required-indicator {
		color: var(--err);
	}

	.setting-description {
		font-size: var(--font-size-1);
		color: var(--muted);
		line-height: 1.5;
		font-family: var(--font-mono);
	}

	.setting-input {
		width: 100%;
		min-height: 44px; /* WCAG touch target */
		padding: var(--space-2) var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text);
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: var(--radius-xs);
		transition: all 0.2s ease;
		box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.setting-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow:
			0 0 0 3px var(--primary-glow-25),
			inset 0 1px 3px rgba(0, 0, 0, 0.3);
		background: var(--surface);
	}

	.setting-input:hover:not(:focus) {
		border-color: var(--primary-glow-40);
	}

	.setting-input.input-error {
		border-color: var(--err);
	}

	.setting-input.input-error:focus {
		box-shadow:
			0 0 0 3px var(--err-dim),
			inset 0 1px 3px rgba(0, 0, 0, 0.3);
	}

	.error-message {
		padding: var(--space-3);
		background: color-mix(in oklab, var(--err) 15%, transparent);
		border: 1px solid color-mix(in oklab, var(--err) 30%, transparent);
		border-radius: var(--radius-md);
		color: var(--err);
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
	}

	.error-item:not(:last-child) {
		margin-bottom: var(--space-1);
	}

	.env-fallback {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--info-box-bg);
		border: 1px solid var(--info-box-border);
		border-radius: var(--radius-md);
		font-size: var(--font-size-1);
		line-height: 1.5;
		font-family: var(--font-mono);
	}

	.env-icon {
		flex-shrink: 0;
	}

	.env-content code {
		background: var(--primary-glow-15);
		padding: 0 var(--space-1);
		border-radius: var(--radius-xs);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.env-content strong {
		font-weight: 700;
	}

	/* Accessibility: High contrast mode support */
	@media (prefers-contrast: high) {
		.setting-input {
			border-width: 2px;
		}

		.error-message,
		.env-fallback {
			border-width: 2px;
		}
	}

	/* Responsive: Mobile adjustments */
	@media (max-width: 768px) {
		.setting-label {
			font-size: var(--font-size-1);
		}

		.setting-description {
			font-size: var(--font-size-0);
		}
	}
</style>
