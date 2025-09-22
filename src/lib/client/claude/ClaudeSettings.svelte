<script>
	/**
	 * Claude Settings Component
	 * Provides Claude-specific configuration options for both global defaults and session creation
	 * Integrates with settings service for defaults
	 */
	import FormSection from '$lib/client/shared/components/FormSection.svelte';
	import IconRobot from '$lib/client/shared/components/Icons/IconRobot.svelte';
	import { settingsService } from '$lib/client/shared/services/SettingsService.js';

	// Props
	let {
		settings = $bindable({}),
		disabled = false,
		mode = 'session' // 'session' for session creation, 'global' for global defaults
	} = $props();

	// Default Claude settings based on settings service with fallbacks
	let model = $state(
		settings.model ??
			(mode === 'global' ? settingsService.get('claude.model', 'claude-3-5-sonnet-20241022') : '')
	);
	let customSystemPrompt = $state(
		settings.customSystemPrompt ?? settingsService.get('claude.customSystemPrompt', '')
	);
	let appendSystemPrompt = $state(
		settings.appendSystemPrompt ?? settingsService.get('claude.appendSystemPrompt', '')
	);
	let maxTurns = $state(settings.maxTurns ?? settingsService.get('claude.maxTurns', null));
	let maxThinkingTokens = $state(
		settings.maxThinkingTokens ?? settingsService.get('claude.maxThinkingTokens', null)
	);
	let fallbackModel = $state(
		settings.fallbackModel ?? settingsService.get('claude.fallbackModel', '')
	);
	let includePartialMessages = $state(
		settings.includePartialMessages ?? settingsService.get('claude.includePartialMessages', false)
	);
	let continueConversation = $state(
		settings.continue ??
			settings.continueConversation ??
			settingsService.get('claude.continueConversation', false)
	);
	let permissionMode = $state(
		settings.permissionMode ?? settingsService.get('claude.permissionMode', 'default')
	);
	let executable = $state(settings.executable ?? settingsService.get('claude.executable', 'auto'));
	let executableArgs = $state(
		settings.executableArgs ?? settingsService.get('claude.executableArgs', '')
	);
	let allowedTools = $state(
		settings.allowedTools ?? settingsService.get('claude.allowedTools', '')
	);
	let disallowedTools = $state(
		settings.disallowedTools ?? settingsService.get('claude.disallowedTools', '')
	);
	let additionalDirectories = $state(
		settings.additionalDirectories ?? settingsService.get('claude.additionalDirectories', '')
	);
	let strictMcpConfig = $state(
		settings.strictMcpConfig ?? settingsService.get('claude.strictMcpConfig', false)
	);

	// Available Claude models - always include default option
	const baseModels = [
		{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)' },
		{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
		{ value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
		{ value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
		{ value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
	];

	// Model options with default option for both modes
	const availableModels = [
		{ value: '', label: mode === 'global' ? 'Let Claude SDK choose' : 'Use global default' },
		...baseModels
	];

	// Permission modes
	const permissionModes = [
		{ value: 'default', label: 'Default' },
		{ value: 'ask', label: 'Ask for permissions' },
		{ value: 'allow', label: 'Allow all' }
	];

	// JavaScript executables
	const executables = [
		{ value: 'auto', label: 'Auto-detect' },
		{ value: 'node', label: 'Node.js' },
		{ value: 'bun', label: 'Bun' },
		{ value: 'deno', label: 'Deno' }
	];

	// Update settings binding when values change
	$effect(() => {
		if (mode === 'global') {
			// Global mode: save all values (including empty ones for defaults)
			settings = {
				model,
				customSystemPrompt,
				appendSystemPrompt,
				maxTurns,
				maxThinkingTokens,
				fallbackModel,
				includePartialMessages,
				continueConversation,
				permissionMode,
				executable,
				executableArgs,
				allowedTools,
				disallowedTools,
				additionalDirectories,
				strictMcpConfig
			};
		} else {
			// Session mode: only include overrides (non-default values)
			const cleanSettings = {
				model: model.trim() || undefined,
				customSystemPrompt: customSystemPrompt.trim() || undefined,
				appendSystemPrompt: appendSystemPrompt.trim() || undefined,
				maxTurns: maxTurns || undefined,
				maxThinkingTokens: maxThinkingTokens || undefined,
				fallbackModel: fallbackModel.trim() || undefined,
				includePartialMessages: includePartialMessages || undefined,
				continue: continueConversation || undefined,
				permissionMode: permissionMode !== 'default' ? permissionMode : undefined,
				executable: executable !== 'auto' ? executable : undefined,
				executableArgs: executableArgs.trim()
					? executableArgs
							.split(',')
							.map((arg) => arg.trim())
							.filter(Boolean)
					: undefined,
				allowedTools: allowedTools.trim()
					? allowedTools
							.split(',')
							.map((tool) => tool.trim())
							.filter(Boolean)
					: undefined,
				disallowedTools: disallowedTools.trim()
					? disallowedTools
							.split(',')
							.map((tool) => tool.trim())
							.filter(Boolean)
					: undefined,
				additionalDirectories: additionalDirectories.trim()
					? additionalDirectories
							.split(',')
							.map((dir) => dir.trim())
							.filter(Boolean)
					: undefined,
				strictMcpConfig: strictMcpConfig || undefined
			};

			// Remove undefined values for session mode
			settings = Object.fromEntries(
				Object.entries(cleanSettings).filter(([_, value]) => value !== undefined)
			);
		}
	});
</script>

<FormSection label="Claude Configuration">
	{#snippet icon()}<IconRobot size={18} />{/snippet}

	<div class="claude-settings">
		<!-- Model Configuration -->
		<div class="setting-group">
			<label for="claude-model" class="setting-label">
				{mode === 'global' ? 'Default Model' : 'Model (Optional)'}
				{#if mode === 'session' && !model && settingsService.get('claude.model')}
					<span
						class="default-hint"
						title="Using global default: {settingsService.get('claude.model')}">🔧</span
					>
				{/if}
			</label>
			<select id="claude-model" class="setting-input" bind:value={model} {disabled}>
				{#each availableModels as modelOption}
					<option value={modelOption.value}>{modelOption.label}</option>
				{/each}
			</select>
		</div>

		<div class="setting-group">
			<label for="claude-fallback-model" class="setting-label">Fallback Model (Optional)</label>
			<select
				id="claude-fallback-model"
				class="setting-input"
				bind:value={fallbackModel}
				{disabled}
			>
				<option value="">Use default fallback</option>
				{#each availableModels as modelOption}
					<option value={modelOption.value}>{modelOption.label}</option>
				{/each}
			</select>
		</div>

		<!-- System Prompts -->
		<div class="setting-group">
			<label for="claude-custom-system-prompt" class="setting-label"
				>Custom System Prompt (Optional)</label
			>
			<textarea
				id="claude-custom-system-prompt"
				class="setting-textarea"
				rows="3"
				placeholder="Replace the default system prompt entirely..."
				bind:value={customSystemPrompt}
				{disabled}
			></textarea>
		</div>

		<div class="setting-group">
			<label for="claude-append-system-prompt" class="setting-label"
				>Append System Prompt (Optional)</label
			>
			<textarea
				id="claude-append-system-prompt"
				class="setting-textarea"
				rows="2"
				placeholder="Text to append to the default system prompt..."
				bind:value={appendSystemPrompt}
				{disabled}
			></textarea>
		</div>

		<!-- Session Control -->
		<div class="setting-group">
			<label class="setting-label">
				<input
					type="checkbox"
					class="setting-checkbox"
					bind:checked={continueConversation}
					{disabled}
				/>
				Continue most recent conversation
			</label>
		</div>

		<div class="setting-group">
			<label for="claude-max-turns" class="setting-label">Max Turns (Optional)</label>
			<input
				id="claude-max-turns"
				type="number"
				min="1"
				class="setting-input"
				placeholder="No limit"
				bind:value={maxTurns}
				{disabled}
			/>
		</div>

		<div class="setting-group">
			<label for="claude-max-thinking-tokens" class="setting-label"
				>Max Thinking Tokens (Optional)</label
			>
			<input
				id="claude-max-thinking-tokens"
				type="number"
				min="1"
				class="setting-input"
				placeholder="No limit"
				bind:value={maxThinkingTokens}
				{disabled}
			/>
		</div>

		<!-- Advanced Settings -->
		<details class="advanced-settings">
			<summary class="advanced-toggle">Advanced Settings</summary>

			<div class="setting-group">
				<label for="claude-permission-mode" class="setting-label">Permission Mode</label>
				<select
					id="claude-permission-mode"
					class="setting-input"
					bind:value={permissionMode}
					{disabled}
				>
					{#each permissionModes as mode}
						<option value={mode.value}>{mode.label}</option>
					{/each}
				</select>
			</div>

			<div class="setting-group">
				<label for="claude-executable" class="setting-label">JavaScript Runtime</label>
				<select id="claude-executable" class="setting-input" bind:value={executable} {disabled}>
					{#each executables as exec}
						<option value={exec.value}>{exec.label}</option>
					{/each}
				</select>
			</div>

			<div class="setting-group">
				<label for="claude-executable-args" class="setting-label"
					>Executable Arguments (comma-separated)</label
				>
				<input
					id="claude-executable-args"
					type="text"
					class="setting-input"
					placeholder="--flag1, --flag2=value"
					bind:value={executableArgs}
					{disabled}
				/>
			</div>

			<div class="setting-group">
				<label for="claude-allowed-tools" class="setting-label"
					>Allowed Tools (comma-separated)</label
				>
				<input
					id="claude-allowed-tools"
					type="text"
					class="setting-input"
					placeholder="tool1, tool2, tool3"
					bind:value={allowedTools}
					{disabled}
				/>
			</div>

			<div class="setting-group">
				<label for="claude-disallowed-tools" class="setting-label"
					>Disallowed Tools (comma-separated)</label
				>
				<input
					id="claude-disallowed-tools"
					type="text"
					class="setting-input"
					placeholder="tool1, tool2, tool3"
					bind:value={disallowedTools}
					{disabled}
				/>
			</div>

			<div class="setting-group">
				<label for="claude-additional-directories" class="setting-label"
					>Additional Directories (comma-separated)</label
				>
				<input
					id="claude-additional-directories"
					type="text"
					class="setting-input"
					placeholder="/path1, /path2, /path3"
					bind:value={additionalDirectories}
					{disabled}
				/>
			</div>

			<div class="setting-group">
				<label class="setting-label">
					<input
						type="checkbox"
						class="setting-checkbox"
						bind:checked={includePartialMessages}
						{disabled}
					/>
					Include partial message events
				</label>
			</div>

			<div class="setting-group">
				<label class="setting-label">
					<input
						type="checkbox"
						class="setting-checkbox"
						bind:checked={strictMcpConfig}
						{disabled}
					/>
					Enforce strict MCP validation
				</label>
			</div>
		</details>
	</div>
</FormSection>

