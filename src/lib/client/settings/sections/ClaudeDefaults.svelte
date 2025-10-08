<script>
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import ClaudeSettings from '$lib/client/claude/ClaudeSettings.svelte';
	import { settingsService } from '$lib/client/shared/services/SettingsService.svelte.js';

	/**
	 * Claude Default Settings Component
	 * Manages default settings for Claude sessions using shared component
	 * Uses unified settings service with server/client sync
	 */

	// Settings state bound to the shared component
	let settings = $state({});

	// Feedback state
	let saveStatus = $state('');
	let saving = $state(false);

	// Load current settings from the service
	onMount(async () => {
		// Wait for settings service to load
		if (!settingsService.isLoaded) {
			await settingsService.loadServerSettings();
		}

		// Load current Claude settings
		updateSettingsFromService();
	});

	// Load settings from the service into our local state
	function updateSettingsFromService() {
		settings = {
			model: settingsService.get('claude.model', ''),
			customSystemPrompt: settingsService.get('claude.customSystemPrompt', ''),
			appendSystemPrompt: settingsService.get('claude.appendSystemPrompt', ''),
			maxTurns: settingsService.get('claude.maxTurns', null),
			maxThinkingTokens: settingsService.get('claude.maxThinkingTokens', null),
			fallbackModel: settingsService.get('claude.fallbackModel', ''),
			includePartialMessages: settingsService.get('claude.includePartialMessages', false),
			continueConversation: settingsService.get('claude.continueConversation', false),
			permissionMode: settingsService.get('claude.permissionMode', 'default'),
			executable: settingsService.get('claude.executable', 'auto'),
			executableArgs: settingsService.get('claude.executableArgs', ''),
			allowedTools: settingsService.get('claude.allowedTools', ''),
			disallowedTools: settingsService.get('claude.disallowedTools', ''),
			additionalDirectories: settingsService.get('claude.additionalDirectories', ''),
			strictMcpConfig: settingsService.get('claude.strictMcpConfig', false)
		};
	}

	// Save settings using the new service
	async function saveSettings() {
		if (saving) return;

		saving = true;
		saveStatus = '';

		try {
			// Save all Claude settings as client overrides (localStorage)
			Object.entries(settings).forEach(([key, value]) => {
				settingsService.setClientOverride(`claude.${key}`, value);
			});

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
		updateSettingsFromService();

		saveStatus = 'Claude settings reset to defaults';
		setTimeout(() => {
			saveStatus = '';
		}, 3000);
	}
</script>

<div class="claude-defaults">
	<header class="settings-header">
		<h3 class="settings-title">Claude Defaults</h3>
		<p class="settings-description">
			Configure default settings for new Claude sessions. These settings will be used as defaults
			when creating new Claude sessions, but can be overridden per session.
		</p>
	</header>

	<div class="settings-content">
		<ClaudeSettings bind:settings mode="global" />
	</div>

	<!-- Settings Footer -->
	<footer class="settings-footer">
		<div
			class="save-status"
			class:success={saveStatus.includes('success')}
			class:error={saveStatus.includes('Failed')}
		>
			{saveStatus}
		</div>
		<div class="settings-actions">
			<Button onclick={resetToDefaults} variant="ghost" size="small" disabled={saving}>
				Reset Defaults
			</Button>
			<Button
				onclick={saveSettings}
				variant="primary"
				size="small"
				disabled={saving}
				loading={saving}
			>
				{saving ? 'Saving...' : 'Save Settings'}
			</Button>
		</div>
	</footer>
</div>

<style>
	.claude-defaults {
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
		min-height: var(--space-5);
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
