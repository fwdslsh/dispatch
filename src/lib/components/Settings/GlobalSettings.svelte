<script>
	import { onMount } from 'svelte';
	import { Button, Input } from '$lib/shared/components';
	import { STORAGE_CONFIG } from '$lib/shared/utils/constants.js';

	/**
	 * Global Settings Component
	 * Manages global application preferences and workspace defaults
	 */

	// Settings state
	let theme = $state('retro'); // Default theme
	let autoSaveEnabled = $state(true);
	let sessionTimeoutMinutes = $state(30);
	let defaultLayout = $state('2up');
	let enableAnimations = $state(true);
	let enableSoundEffects = $state(false);

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
	onMount(() => {
		try {
			const storedSettings = localStorage.getItem(STORAGE_CONFIG.SETTINGS_KEY);
			if (storedSettings) {
				const settings = JSON.parse(storedSettings);
				theme = settings.theme || 'retro';
				autoSaveEnabled = settings.autoSaveEnabled ?? true;
				sessionTimeoutMinutes = settings.sessionTimeoutMinutes || 30;
				defaultLayout = settings.defaultLayout || '2up';
				enableAnimations = settings.enableAnimations ?? true;
				enableSoundEffects = settings.enableSoundEffects ?? false;
			}

			// Also check existing theme storage
			const storedTheme = localStorage.getItem(STORAGE_CONFIG.THEME_KEY);
			if (storedTheme && !storedSettings) {
				theme = storedTheme;
			}
		} catch (error) {
			console.warn('Failed to load global settings:', error);
		}
	});

	// Save settings to localStorage
	async function saveSettings() {
		if (saving) return;
		
		saving = true;
		saveStatus = '';

		try {
			const settings = {
				theme,
				autoSaveEnabled,
				sessionTimeoutMinutes,
				defaultLayout,
				enableAnimations,
				enableSoundEffects,
				lastUpdated: Date.now()
			};

			localStorage.setItem(STORAGE_CONFIG.SETTINGS_KEY, JSON.stringify(settings));
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

	// Reset to defaults
	async function resetToDefaults() {
		theme = 'retro';
		autoSaveEnabled = true;
		sessionTimeoutMinutes = 30;
		defaultLayout = '2up';
		enableAnimations = true;
		enableSoundEffects = false;
		await saveSettings();
	}

	// Auto-save when settings change
	$effect(() => {
		// Debounced auto-save
		const timeoutId = setTimeout(saveSettings, 1000);
		return () => clearTimeout(timeoutId);
	});
</script>

<div class="global-settings">
	<header class="settings-header">
		<h3 class="settings-title">Global Preferences</h3>
		<p class="settings-description">
			Configure global application settings and workspace defaults.
		</p>
	</header>

	<div class="settings-content">
		<!-- Theme Settings -->
		<section class="settings-section">
			<h4 class="section-title">Appearance</h4>
			
			<div class="input-group">
				<label for="theme-select" class="input-label">Theme</label>
				<select id="theme-select" bind:value={theme} class="select-input">
					{#each themes as themeOption}
						<option value={themeOption.value}>{themeOption.label}</option>
					{/each}
				</select>
				<p class="input-help">Choose your preferred visual theme</p>
			</div>

			<div class="input-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={enableAnimations}
						class="checkbox-input"
					>
					<span class="checkbox-text">Enable animations and transitions</span>
				</label>
			</div>

			<div class="input-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={enableSoundEffects}
						class="checkbox-input"
					>
					<span class="checkbox-text">Enable sound effects</span>
				</label>
			</div>
		</section>

		<!-- Workspace Settings -->
		<section class="settings-section">
			<h4 class="section-title">Workspace</h4>
			
			<div class="input-group">
				<label for="layout-select" class="input-label">Default Layout</label>
				<select id="layout-select" bind:value={defaultLayout} class="select-input">
					{#each layouts as layoutOption}
						<option value={layoutOption.value}>{layoutOption.label}</option>
					{/each}
				</select>
				<p class="input-help">Default panel layout for new sessions</p>
			</div>

			<div class="input-group">
				<label class="checkbox-label">
					<input 
						type="checkbox" 
						bind:checked={autoSaveEnabled}
						class="checkbox-input"
					>
					<span class="checkbox-text">Auto-save session state</span>
				</label>
				<p class="input-help">Automatically save your workspace state</p>
			</div>
		</section>

		<!-- Session Settings -->
		<section class="settings-section">
			<h4 class="section-title">Sessions</h4>
			
			<div class="input-group">
				<label for="timeout-input" class="input-label">Session Timeout (minutes)</label>
				<Input
					id="timeout-input"
					type="number"
					bind:value={sessionTimeoutMinutes}
					min="5"
					max="720"
					placeholder="30"
				/>
				<p class="input-help">Inactive session timeout (5-720 minutes)</p>
			</div>
		</section>
	</div>

	<!-- Actions -->
	<footer class="settings-footer">
		<div class="save-status" class:success={saveStatus.includes('success')} class:error={saveStatus.includes('Failed')}>
			{saveStatus}
		</div>
		<div class="settings-actions">
			<Button
				onclick={resetToDefaults}
				variant="ghost"
				size="small"
				disabled={saving}
			>
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

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		cursor: pointer;
		font-family: var(--font-mono);
		color: var(--text-primary);
	}

	.checkbox-input {
		width: 16px;
		height: 16px;
		border: 1px solid var(--primary-dim);
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
	}

	.save-status.success {
		color: var(--primary);
	}

	.save-status.error {
		color: var(--accent-red);
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