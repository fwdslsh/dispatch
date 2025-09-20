<script>
	/**
	 * Claude Session Settings Component
	 * Provides Claude-specific configuration options for session creation
	 */
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import IconRobot from '$lib/client/shared/components/Icons/IconRobot.svelte';

	// Props
	let { 
		settings = $bindable({}),
		disabled = false 
	} = $props();

	// Default Claude settings based on SDK documentation
	let model = $state(settings.model || 'claude-3-5-sonnet-20241022');
	let temperature = $state(settings.temperature || 0.7);
	let maxTokens = $state(settings.maxTokens || 4096);
	let systemPrompt = $state(settings.systemPrompt || '');
	let topP = $state(settings.topP || 1.0);
	let topK = $state(settings.topK || 5);

	// Available Claude models
	const availableModels = [
		{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)' },
		{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
		{ value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
		{ value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
		{ value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
	];

	// Update settings binding when values change
	$effect(() => {
		settings = {
			model,
			temperature,
			maxTokens,
			systemPrompt: systemPrompt.trim() || undefined,
			topP,
			topK
		};
	});
</script>

<FormSection label="Claude Configuration">
	{#snippet icon()}<IconRobot size={18} />{/snippet}

	<div class="claude-settings">
		<!-- Model Selection -->
		<div class="setting-group">
			<label for="claude-model" class="setting-label">Model</label>
			<select 
				id="claude-model" 
				class="setting-input"
				bind:value={model}
				{disabled}
			>
				{#each availableModels as modelOption}
					<option value={modelOption.value}>{modelOption.label}</option>
				{/each}
			</select>
		</div>

		<!-- Temperature -->
		<div class="setting-group">
			<label for="claude-temperature" class="setting-label">
				Temperature ({temperature})
			</label>
			<input 
				id="claude-temperature"
				type="range" 
				min="0" 
				max="1" 
				step="0.1"
				class="setting-slider"
				bind:value={temperature}
				{disabled}
			/>
			<div class="slider-info">
				<span>More Focused</span>
				<span>More Creative</span>
			</div>
		</div>

		<!-- Max Tokens -->
		<div class="setting-group">
			<label for="claude-max-tokens" class="setting-label">Max Tokens</label>
			<input 
				id="claude-max-tokens"
				type="number" 
				min="1" 
				max="8192" 
				class="setting-input"
				bind:value={maxTokens}
				{disabled}
			/>
		</div>

		<!-- System Prompt -->
		<div class="setting-group">
			<label for="claude-system-prompt" class="setting-label">System Prompt (Optional)</label>
			<textarea 
				id="claude-system-prompt"
				class="setting-textarea"
				rows="3"
				placeholder="Enter custom instructions for Claude..."
				bind:value={systemPrompt}
				{disabled}
			></textarea>
		</div>

		<!-- Advanced Settings -->
		<details class="advanced-settings">
			<summary class="advanced-toggle">Advanced Settings</summary>
			
			<div class="setting-group">
				<label for="claude-top-p" class="setting-label">
					Top P ({topP})
				</label>
				<input 
					id="claude-top-p"
					type="range" 
					min="0" 
					max="1" 
					step="0.05"
					class="setting-slider"
					bind:value={topP}
					{disabled}
				/>
			</div>

			<div class="setting-group">
				<label for="claude-top-k" class="setting-label">Top K</label>
				<input 
					id="claude-top-k"
					type="number" 
					min="1" 
					max="20" 
					class="setting-input"
					bind:value={topK}
					{disabled}
				/>
			</div>
		</details>
	</div>
</FormSection>

<style>
	.claude-settings {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		background: var(--surface);
		border: 2px solid var(--primary-dim);
		border-radius: 0;
		padding: var(--space-4);
		box-shadow: inset 0 0 10px var(--glow);
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.setting-label {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text-primary);
		font-weight: 600;
	}

	.setting-input,
	.setting-textarea {
		background: var(--background);
		border: 1px solid var(--primary-dim);
		border-radius: 0;
		padding: var(--space-2);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.setting-input:focus,
	.setting-textarea:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 5px var(--glow);
	}

	.setting-slider {
		-webkit-appearance: none;
		appearance: none;
		height: 4px;
		background: var(--primary-dim);
		border-radius: 0;
		outline: none;
	}

	.setting-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 16px;
		height: 16px;
		background: var(--primary);
		border-radius: 0;
		cursor: pointer;
		border: 2px solid var(--background);
	}

	.setting-slider::-moz-range-thumb {
		width: 16px;
		height: 16px;
		background: var(--primary);
		border-radius: 0;
		cursor: pointer;
		border: 2px solid var(--background);
	}

	.slider-info {
		display: flex;
		justify-content: space-between;
		font-size: var(--font-size-0);
		color: var(--text-secondary);
		font-family: var(--font-mono);
	}

	.advanced-settings {
		border: 1px solid var(--primary-dim);
		border-radius: 0;
		background: color-mix(in oklab, var(--primary-dim) 5%, var(--surface));
	}

	.advanced-toggle {
		padding: var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text-primary);
		cursor: pointer;
		border-bottom: 1px solid var(--primary-dim);
	}

	.advanced-toggle:hover {
		background: color-mix(in oklab, var(--primary-dim) 10%, var(--surface));
	}

	.advanced-settings[open] .advanced-toggle {
		border-bottom: 1px solid var(--primary-dim);
	}

	.advanced-settings[open] > :not(summary) {
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
</style>