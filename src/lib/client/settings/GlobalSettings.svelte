<script>
	import { onMount } from 'svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import { STORAGE_CONFIG } from '$lib/shared/constants.js';
	import { settingsService } from '$lib/client/shared/services/SettingsService.js';

	/**
	 * Global Settings Component
	 * Manages global application preferences and workspace defaults
	 * Now uses unified settings service with server/client sync
	 */

	// Settings state - use service values with fallback defaults
	let theme = $state(settingsService.get('global.theme', 'retro'));
	let defaultWorkspaceDirectory = $state(
		settingsService.get('global.defaultWorkspaceDirectory', '')
	);
	let autoSaveEnabled = $state(settingsService.get('global.autoSaveEnabled', true));
	let sessionTimeoutMinutes = $state(
		settingsService.get('global.sessionTimeoutMinutes', 30).toString()
	);
	let defaultLayout = $state(settingsService.get('global.defaultLayout', '2up'));
	let enableAnimations = $state(settingsService.get('global.enableAnimations', true));
	let enableSoundEffects = $state(settingsService.get('global.enableSoundEffects', false));

	// Feedback state
	let saveStatus = $state('');
	let saving = $state(false);

	// Available options
	const themes = [
		{ value: 'retro', label: 'Retro Terminal' },
		{ value: 'dark', label: 'Dark Mode' },
		{ value: 'system', label: 'System Default' }
	];

	const layouts = [
		{ value: '1up', label: 'Single Panel' },
		{ value: '2up', label: 'Dual Panel' },
		{ value: '4up', label: 'Quad Panel' }
	];

	// Load settings from localStorage
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
		theme = settingsService.get('global.theme', 'retro');
		defaultWorkspaceDirectory = settingsService.get('global.defaultWorkspaceDirectory', '');
	}

	// Save settings using the new service
	async function saveSettings() {
		if (saving) return;

		saving = true;
		saveStatus = '';

		try {
			// Save as client override (localStorage)
			settingsService.setClientOverride('global.theme', theme);
			settingsService.setClientOverride(
				'global.defaultWorkspaceDirectory',
				defaultWorkspaceDirectory
			);

			// Legacy theme storage for immediate theme application
			localStorage.setItem(STORAGE_CONFIG.THEME_KEY, theme);

			// Apply theme immediately if needed
			if (theme !== 'system') {
				document.documentElement.setAttribute('data-theme', theme);
			} else {
				document.documentElement.removeAttribute('data-theme');
			}

			saveStatus = 'Settings saved successfully';
			setTimeout(() => {
				saveStatus = '';
			}, 3000);
		} catch (error) {
			console.error('Failed to save settings:', error);
			saveStatus = 'Failed to save settings';
		} finally {
			saving = false;
		}
	}

	// Reset to server defaults
	async function resetToDefaults() {
		settingsService.resetClientOverridesForCategory('global');
		updateLocalState();

		// Apply theme immediately
		if (theme !== 'system') {
			document.documentElement.setAttribute('data-theme', theme);
		} else {
			document.documentElement.removeAttribute('data-theme');
		}

		saveStatus = 'Settings reset to defaults';
		setTimeout(() => {
			saveStatus = '';
		}, 3000);
	}

	// Auto-save when settings change (disabled for now to prevent conflicts)
	// $effect(() => {
	// 	// Debounced auto-save
	// 	const timeoutId = setTimeout(saveSettings, 1000);
	// 	return () => clearTimeout(timeoutId);
	// });

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

<div class="global-settings flex-col gap-4">
	<header class="settings-header">
		<h3 class="settings-title">Global Preferences</h3>
		<p class="settings-description">
			Configure global application settings. Only settings that are actually used in the application
			are shown. Settings with a <span class="override-indicator">●</span> are customized from server
			defaults.
		</p>
	</header>

	<div class="flex-col flex-1 gap-6" style="overflow-y: auto;">
		<!-- Theme Settings - The only global setting actually used -->
		<section class="settings-section">
			<h4 class="section-title">Appearance</h4>

			<div class="input-group">
				<label for="theme-select" class="input-label">
					Theme
					{#if hasClientOverride('global.theme')}
						<span
							class="override-indicator"
							title="Customized from server default: {getServerDefault('global.theme')}" >●</span
						>
					{/if}
				</label>
				<select id="theme-select" bind:value={theme} class="select-input">
					{#each themes as themeOption}
						<option value={themeOption.value}>{themeOption.label}</option>
					{/each}
				</select>
				<p class="input-help">
					Choose your preferred visual theme (applied to HTML data-theme attribute)
				</p>
			</div>
		</section>

		<!-- Workspace Settings -->
		<section class="settings-section">
			<h4 class="section-title">Workspace</h4>

			<div class="input-group">
				<label for="default-workspace-dir" class="input-label">
					Default Workspace Directory
					{#if hasClientOverride('global.defaultWorkspaceDirectory')}
						<span
							class="override-indicator"
							title="Customized from server default: {getServerDefault(
								'global.defaultWorkspaceDirectory'
							) || 'Server WORKSPACES_ROOT'}" >●</span
						>
					{/if}
				</label>
				<Input
					id="default-workspace-dir"
					bind:value={defaultWorkspaceDirectory}
					placeholder="Leave empty to use server WORKSPACES_ROOT"
					class="workspace-dir-input"
				/>
				<p class="input-help">
					Default directory used when creating new sessions. Leave empty to use the server's
					WORKSPACES_ROOT environment variable.
				</p>
			</div>
		</section>
	</div>

	<!-- Actions -->
	<footer
		class="settings-footer flex-between gap-4 p-4"
		style="border-top: 1px solid var(--primary-dim); margin-top: auto;"
	>
		<div
			class="save-status"
			class:success={saveStatus.includes('success')}
			class:error={saveStatus.includes('Failed')}
		>
			{saveStatus}
		</div>
		<div class="flex gap-3">
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
	.global-settings {
		height: 100%;
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
		padding: var(--space-3);
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		border-radius: 2px;
		transition: all 0.2s ease;
	}

	.select-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px rgba(46, 230, 107, 0.2);
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

	.save-status {
		font-family: var(--font-mono);
		font-size: 0.85rem;
		padding: var(--space-2) 0;
		min-height: 24px;
		display: flex;
		align-items: center;
	}

	.save-status.success {
		color: var(--primary);
	}

	.save-status.error {
		color: var(--accent-red);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.settings-footer {
			flex-direction: column !important;
			align-items: stretch !important;
		}

		.save-status {
			text-align: center;
		}
	}
</style>
