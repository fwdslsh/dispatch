<script>
	/**
	 * OpenCode Settings Component
	 * Provides OpenCode-specific configuration options for both global defaults and session creation
	 * Integrates with settings service for defaults
	 */
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import IconRobot from '$lib/client/shared/components/Icons/IconRobot.svelte';
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';

	// Props
	let {
		settings = $bindable({}),
		disabled = false,
		mode = 'session' // 'session' for session creation, 'global' for global defaults
	} = $props();

	// Default OpenCode settings based on settings service with fallbacks
	let baseUrl = $state(
		settings.baseUrl ??
			(mode === 'global'
				? settingsService.get('opencode.baseUrl', 'http://localhost:4096')
				: '')
	);
	let model = $state(
		settings.model ??
			(mode === 'global'
				? settingsService.get('opencode.model', 'claude-3-7-sonnet-20250219')
				: '')
	);
	let provider = $state(
		settings.provider ?? settingsService.get('opencode.provider', 'anthropic')
	);
	let timeout = $state(settings.timeout ?? settingsService.get('opencode.timeout', 60000));
	let maxRetries = $state(settings.maxRetries ?? settingsService.get('opencode.maxRetries', 2));

	// Available providers
	const providers = [
		{ value: 'anthropic', label: 'Anthropic (Claude)' },
		{ value: 'openai', label: 'OpenAI (GPT)' },
		{ value: 'google', label: 'Google (Gemini)' },
		{ value: 'deepseek', label: 'DeepSeek' }
	];

	// Update settings binding when values change
	// Use untrack to prevent infinite loops from bindable props
	$effect(() => {
		const newSettings = mode === 'global'
			? {
					baseUrl,
					model,
					provider,
					timeout,
					maxRetries
				}
			: Object.fromEntries(
					Object.entries({
						baseUrl,
						model,
						provider,
						timeout,
						maxRetries
					}).filter(([_, value]) => value !== '' && value !== null && value !== undefined)
				);

		// Only update if settings have actually changed to prevent loops
		const currentStr = JSON.stringify(settings);
		const newStr = JSON.stringify(newSettings);
		if (currentStr !== newStr) {
			settings = newSettings;
		}
	});
</script>

<div class="opencode-settings-form">
	<!-- Server Configuration -->
	<FormSection
		title="Server"
		description="OpenCode server connection settings"
		{disabled}
	>
		{#snippet icon()}<IconRobot size={18} />{/snippet}
		<div class="form-field">
			<label for="baseUrl">
				<span class="label-text">Server URL</span>
				<span class="label-hint">URL of the OpenCode server (e.g., http://localhost:4096)</span>
			</label>
			<input
				id="baseUrl"
				type="url"
				bind:value={baseUrl}
				placeholder={mode === 'global' ? 'http://localhost:4096' : 'Use global default'}
				{disabled}
			/>
		</div>

		<div class="form-field">
			<label for="provider">
				<span class="label-text">AI Provider</span>
				<span class="label-hint">AI service provider for code generation</span>
			</label>
			<select id="provider" bind:value={provider} {disabled}>
				{#each providers as providerOption}
					<option value={providerOption.value}>{providerOption.label}</option>
				{/each}
			</select>
		</div>

		<div class="form-field">
			<label for="model">
				<span class="label-text">Model</span>
				<span class="label-hint">AI model to use (provider-specific)</span>
			</label>
			<input
				id="model"
				type="text"
				bind:value={model}
				placeholder={mode === 'global' ? 'claude-3-7-sonnet-20250219' : 'Use global default'}
				{disabled}
			/>
		</div>
	</FormSection>

	<!-- Advanced Settings -->
	<FormSection
		title="Advanced"
		description="Connection timeouts and retry settings"
		{disabled}
	>
		{#snippet icon()}<IconRobot size={18} />{/snippet}
		<div class="form-field">
			<label for="timeout">
				<span class="label-text">Timeout (ms)</span>
				<span class="label-hint">Request timeout in milliseconds</span>
			</label>
			<input
				id="timeout"
				type="number"
				bind:value={timeout}
				placeholder={mode === 'global' ? '60000' : 'Use global default'}
				min="1000"
				step="1000"
				{disabled}
			/>
		</div>

		<div class="form-field">
			<label for="maxRetries">
				<span class="label-text">Max Retries</span>
				<span class="label-hint">Maximum number of retry attempts on failure</span>
			</label>
			<input
				id="maxRetries"
				type="number"
				bind:value={maxRetries}
				placeholder={mode === 'global' ? '2' : 'Use global default'}
				min="0"
				max="10"
				{disabled}
			/>
		</div>
	</FormSection>
</div>

<style>
	.opencode-settings-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.form-field label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.label-text {
		color: var(--text);
	}

	.label-hint {
		color: var(--muted);
		font-size: 0.8rem;
		text-transform: none;
		letter-spacing: normal;
	}

	.form-field input,
	.form-field select {
		padding: var(--space-2) var(--space-3);
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	.form-field input:focus,
	.form-field select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-glow-15);
	}

	.form-field input:disabled,
	.form-field select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
