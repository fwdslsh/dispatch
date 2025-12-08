<script>
	/**
	 * AI Settings Component
	 * Configuration for AI session defaults (provider, model, server settings)
	 *
	 * v2.0 Hard Fork: OpenCode-first architecture
	 * @file src/lib/client/ai/AISettings.svelte
	 */
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import IconRobot from '$lib/client/shared/components/Icons/IconRobot.svelte';
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';

	// Props
	let {
		settings = $bindable({}),
		disabled = false,
		mode = 'session' // 'session' for session creation, 'global' for defaults
	} = $props();

	// State initialized from settings service
	let baseUrl = $state(
		settings.baseUrl ??
			(mode === 'global' ? settingsService.get('ai.baseUrl', 'http://localhost:4096') : '')
	);
	let model = $state(
		settings.model ??
			(mode === 'global' ? settingsService.get('ai.model', 'claude-sonnet-4-20250514') : '')
	);
	let provider = $state(settings.provider ?? settingsService.get('ai.provider', 'anthropic'));
	let timeout = $state(settings.timeout ?? settingsService.get('ai.timeout', 60000));
	let maxRetries = $state(settings.maxRetries ?? settingsService.get('ai.maxRetries', 2));

	// Available providers
	const providers = [
		{ value: 'anthropic', label: 'Anthropic (Claude)' },
		{ value: 'openai', label: 'OpenAI (GPT)' },
		{ value: 'google', label: 'Google (Gemini)' },
		{ value: 'deepseek', label: 'DeepSeek' }
	];

	// Sync settings binding when values change
	$effect(() => {
		const newSettings =
			mode === 'global'
				? { baseUrl, model, provider, timeout, maxRetries }
				: Object.fromEntries(
						Object.entries({ baseUrl, model, provider, timeout, maxRetries }).filter(
							([_, value]) => value !== '' && value !== null && value !== undefined
						)
					);

		const currentStr = JSON.stringify(settings);
		const newStr = JSON.stringify(newSettings);
		if (currentStr !== newStr) {
			settings = newSettings;
		}
	});
</script>

<div class="ai-settings-form">
	<FormSection title="AI Server" description="OpenCode server connection settings" {disabled}>
		{#snippet icon()}<IconRobot size={18} />{/snippet}

		<div class="form-field">
			<label for="baseUrl">
				<span class="label-text">Server URL</span>
				<span class="label-hint">OpenCode server URL (e.g., http://localhost:4096)</span>
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
				{#each providers as opt}
					<option value={opt.value}>{opt.label}</option>
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
				placeholder={mode === 'global' ? 'claude-sonnet-4-20250514' : 'Use global default'}
				{disabled}
			/>
		</div>
	</FormSection>

	<FormSection title="Advanced" description="Connection timeouts and retry settings" {disabled}>
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
				placeholder="60000"
				min="1000"
				step="1000"
				{disabled}
			/>
		</div>

		<div class="form-field">
			<label for="maxRetries">
				<span class="label-text">Max Retries</span>
				<span class="label-hint">Maximum retry attempts on failure</span>
			</label>
			<input
				id="maxRetries"
				type="number"
				bind:value={maxRetries}
				placeholder="2"
				min="0"
				max="10"
				{disabled}
			/>
		</div>
	</FormSection>
</div>

<style>
	.ai-settings-form {
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
