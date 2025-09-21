<script>
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import { settingsService } from '$lib/client/shared/services/SettingsService.js';
	import { STORAGE_CONFIG } from '$lib/shared/constants.js';

	/**
	 * Claude Default Settings Component
	 * Manages default settings for Claude sessions
	 * Uses unified settings service with server/client sync
	 */

	// Settings state - use service values with fallback defaults
	let model = $state(settingsService.get('claude.model', 'claude-3-5-sonnet-20241022'));
	let permissionMode = $state(settingsService.get('claude.permissionMode', 'default'));
	let maxTurns = $state(settingsService.get('claude.maxTurns', null));
	let includePartialMessages = $state(settingsService.get('claude.includePartialMessages', false));
	let continueConversation = $state(settingsService.get('claude.continueConversation', false));
	let executable = $state(settingsService.get('claude.executable', 'auto'));

	// Feedback state
	let saveStatus = $state('');
	let saving = $state(false);

	// Available Claude models
	const availableModels = [
		{ value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet (Latest)' },
		{ value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
		{ value: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
		{ value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet' },
		{ value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku' }
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

	// Load saved settings on mount
	onMount(async () => {
		// Wait for settings service to load
		if (!settingsService.isLoaded) {
			await settingsService.loadServerSettings();
		}
		
		// Update local state with effective settings
		updateLocalState();
	});

	// Update local component state from settings service
	function updateLocalState() {
		model = settingsService.get('claude.model', 'claude-3-5-sonnet-20241022');
		permissionMode = settingsService.get('claude.permissionMode', 'default');
		maxTurns = settingsService.get('claude.maxTurns', null);
		includePartialMessages = settingsService.get('claude.includePartialMessages', false);
		continueConversation = settingsService.get('claude.continueConversation', false);
		executable = settingsService.get('claude.executable', 'auto');
	}

	// Save settings using the new service
	async function saveSettings() {
		if (saving) return;

		saving = true;
		saveStatus = '';

		try {
			// Save as client overrides (localStorage)
			settingsService.setClientOverride('claude.model', model);
			settingsService.setClientOverride('claude.permissionMode', permissionMode);
			settingsService.setClientOverride('claude.maxTurns', maxTurns || null);
			settingsService.setClientOverride('claude.includePartialMessages', includePartialMessages);
			settingsService.setClientOverride('claude.continueConversation', continueConversation);
			settingsService.setClientOverride('claude.executable', executable);

			saveStatus = 'Claude settings saved successfully';
			setTimeout(() => {
				saveStatus = '';
			}, 3000);
		} catch (error) {
			console.error('Failed to save Claude settings:', error);
			saveStatus = 'Failed to save Claude settings';
		} finally {
			saving = false;
		}
	}

	// Reset to server defaults
	async function resetToDefaults() {
		settingsService.resetClientOverridesForCategory('claude');
		updateLocalState();
		
		saveStatus = 'Claude settings reset to defaults';
		setTimeout(() => {
			saveStatus = '';
		}, 3000);
	}

	// Check if a setting has a client override
	function hasClientOverride(key) {
		const [category, setting] = key.split('.');
		return settingsService.clientOverrides[category]?.[setting] !== undefined;
	}

	// Get server default value for display
	function getServerDefault(key) {
		const [category, setting] = key.split('.');
		return settingsService.serverSettings[category]?.[setting];
	}
</script>

<div class="claude-settings">
	<header class="settings-header">
		<h3 class="settings-title">Claude Defaults</h3>
		<p class="settings-description">
			Configure default settings for new Claude sessions. Settings with a 
			<span class="override-indicator">●</span> are customized from server defaults.
		</p>
	</header>

	<div class="settings-content">
		<!-- Model Settings -->
		<section class="settings-section">
			<h4 class="section-title">Model Configuration</h4>

			<div class="input-group">
				<label for="model-select" class="input-label">
					Default Model
					{#if hasClientOverride('claude.model')}
						<span class="override-indicator" title="Customized from server default: {getServerDefault('claude.model')}">●</span>
					{/if}
				</label>
				<select id="model-select" bind:value={model} class="select-input">
					{#each availableModels as modelOption}
						<option value={modelOption.value}>{modelOption.label}</option>
					{/each}
				</select>
				<p class="input-help">Default Claude model for new sessions</p>
			</div>

			<div class="input-group">
				<label for="permission-select" class="input-label">
					Permission Mode
					{#if hasClientOverride('claude.permissionMode')}
						<span class="override-indicator" title="Customized from server default: {getServerDefault('claude.permissionMode')}">●</span>
					{/if}
				</label>
				<select id="permission-select" bind:value={permissionMode} class="select-input">
					{#each permissionModes as permissionOption}
						<option value={permissionOption.value}>{permissionOption.label}</option>
					{/each}
				</select>
				<p class="input-help">How Claude handles permission requests</p>
			</div>

			<div class="input-group">
				<label for="executable-select" class="input-label">
					JavaScript Executable
					{#if hasClientOverride('claude.executable')}
						<span class="override-indicator" title="Customized from server default: {getServerDefault('claude.executable')}">●</span>
					{/if}
				</label>
				<select id="executable-select" bind:value={executable} class="select-input">
					{#each executables as execOption}
						<option value={execOption.value}>{execOption.label}</option>
					{/each}
				</select>
				<p class="input-help">Default JavaScript runtime for code execution</p>
			</div>
		</section>

		<!-- Session Settings -->
		<section class="settings-section">
			<h4 class="section-title">Session Behavior</h4>

			<div class="input-group">
				<label for="max-turns-input" class="input-label">
					Max Turns (optional)
					{#if hasClientOverride('claude.maxTurns')}
						<span class="override-indicator" title="Customized from server default: {getServerDefault('claude.maxTurns')}">●</span>
					{/if}
				</label>
				<Input
					id="max-turns-input"
					bind:value={maxTurns}
					type="number"
					placeholder="Unlimited"
					min="1"
					max="1000"
				/>
				<p class="input-help">Maximum conversation turns per session (leave empty for unlimited)</p>
			</div>

			<div class="input-group">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={includePartialMessages} class="checkbox-input" />
					<span class="checkbox-text">
						Include partial messages
						{#if hasClientOverride('claude.includePartialMessages')}
							<span class="override-indicator" title="Customized from server default: {getServerDefault('claude.includePartialMessages')}">●</span>
						{/if}
					</span>
				</label>
				<p class="input-help">Include incomplete messages in responses</p>
			</div>

			<div class="input-group">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={continueConversation} class="checkbox-input" />
					<span class="checkbox-text">
						Continue conversations by default
						{#if hasClientOverride('claude.continueConversation')}
							<span class="override-indicator" title="Customized from server default: {getServerDefault('claude.continueConversation')}">●</span>
						{/if}
					</span>
				</label>
				<p class="input-help">Automatically continue conversations across sessions</p>
			</div>
		</section>
	</div>

	<!-- Settings Footer -->
	<div class="settings-footer">
		<div class="settings-actions">
			<Button onclick={resetToDefaults} variant="ghost" size="small">
				Reset to Defaults
			</Button>
			<Button onclick={saveSettings} variant="primary" disabled={saving} loading={saving}>
				Save Settings
			</Button>
		</div>

		{#if saveStatus}
			<div class="save-status" class:success={saveStatus.includes('success')}>
				{saveStatus}
			</div>
		{/if}
	</div>
</div>

<style>
	.claude-settings {
		display: flex;
		flex-direction: column;
		height: 100%;
		gap: var(--space-4);
	}

	.settings-header {
		border-bottom: 1px solid var(--primary-dim);
		padding-bottom: var(--space-4);
	}

	.settings-title {
		font-family: var(--font-mono);
		font-size: 1.4rem;
		color: var(--primary);
		margin: 0 0 var(--space-2) 0;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.settings-description {
		color: var(--text-muted);
		margin: 0;
		font-size: 0.9rem;
	}

	.settings-content {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.settings-section {
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		padding: var(--space-4);
		background: rgba(46, 230, 107, 0.02);
	}

	.section-title {
		font-family: var(--font-mono);
		font-size: 1.1rem;
		color: var(--text-primary);
		margin: 0 0 var(--space-4) 0;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--primary-dim);
		padding-bottom: var(--space-2);
	}

	.input-group {
		margin-bottom: var(--space-4);
	}

	.input-group:last-child {
		margin-bottom: 0;
	}

	.input-label {
		display: block;
		font-family: var(--font-mono);
		font-size: 0.9rem;
		color: var(--text-primary);
		margin-bottom: var(--space-2);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.select-input {
		width: 100%;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		border-radius: 2px;
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.select-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px rgba(46, 230, 107, 0.2);
	}

	.checkbox-label {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		cursor: pointer;
		user-select: none;
	}

	.checkbox-input {
		width: 18px;
		height: 18px;
		border: 2px solid var(--primary-dim);
		background: var(--bg-dark);
		border-radius: 2px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.checkbox-input:checked {
		background: var(--primary);
		border-color: var(--primary);
	}

	.checkbox-text {
		font-size: 0.9rem;
		user-select: none;
	}

	.input-help {
		margin: var(--space-2) 0 0 0;
		font-size: 0.8rem;
		color: var(--text-muted);
		font-style: italic;
	}

	.override-indicator {
		color: var(--primary);
		font-weight: bold;
		margin-left: var(--space-1);
		cursor: help;
		text-shadow: 0 0 4px var(--primary-glow);
		font-size: 0.8rem;
	}

	.settings-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-top: var(--space-4);
		border-top: 1px solid var(--primary-dim);
		margin-top: auto;
	}

	.save-status {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		padding: var(--space-2) 0;
		min-height: 24px;
		display: flex;
		align-items: center;
		color: var(--accent-red);
	}

	.save-status.success {
		color: var(--primary);
	}

	.settings-actions {
		display: flex;
		gap: var(--space-3);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.settings-footer {
			flex-direction: column;
			gap: var(--space-3);
			align-items: stretch;
		}

		.settings-actions {
			justify-content: center;
		}

		.save-status {
			text-align: center;
		}
	}
</style>