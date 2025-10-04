<script>
	/**
	 * PreferencesPanel - User preferences configuration component
	 * Manages UI preferences, workspace settings, and authentication options
	 * Follows constitutional requirement for progressive disclosure
	 */

	import { getContext, onMount } from 'svelte';
	import { PreferencesViewModel } from '../state/PreferencesViewModel.svelte.js';
	import Button from '../shared/components/Button.svelte';

	let { onSave = () => {} } = $props();

	// Get services from context
	const serviceContainer = getContext('services');
	let viewModel = $state(null);

	// Initialize ViewModel on mount
	onMount(async () => {
		try {
			const apiClient = await serviceContainer?.get('apiClient');
			const authKey = localStorage.getItem('dispatch-auth-token');

			if (!authKey) {
				throw new Error('Authentication required');
			}

			viewModel = new PreferencesViewModel(apiClient, authKey);
			await viewModel.loadPreferences();
		} catch (err) {
			console.error('Failed to initialize PreferencesViewModel:', err);
		}
	});

	// Handle form submission
	async function handleSave() {
		if (!viewModel) return;
		try {
			await viewModel.savePreferences(onSave);
		} catch (err) {
			console.error('Failed to save preferences:', err);
		}
	}

	// Handle reset to defaults
	async function handleResetToDefaults() {
		if (!viewModel) return;
		try {
			await viewModel.resetToDefaults();
		} catch (err) {
			console.error('Failed to reset preferences:', err);
		}
	}

	// Handle discard changes
	function handleDiscardChanges() {
		if (!viewModel) return;
		viewModel.discardChanges();
	}
</script>

<div class="preferences-panel" role="main" aria-label="User preferences">
	<div>
		<h2>User Preferences</h2>
		<p>Customize your Dispatch experience</p>
	</div>

	{#if !viewModel || viewModel.isLoading}
		<div class="loading-indicator">
			<div class="spinner"></div>
			<span>Loading preferences...</span>
		</div>
	{:else}
		<div class="preferences-form">
			<!-- UI Preferences -->
			<div class="preference-section">
				<h3>🎨 User Interface</h3>

				<div class="form-group">
					<label for="theme-select" class="form-label">Theme</label>
					<select id="theme-select" bind:value={viewModel.preferences.ui.theme} class="form-select">
						<option value="auto">Auto (system)</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</div>

				<div class="form-group">
					<label class="checkbox-container">
						<input type="checkbox" bind:checked={viewModel.preferences.ui.showWorkspaceInTitle} />
						<span class="checkmark"></span>
						<span class="checkbox-label">Show workspace name in title bar</span>
					</label>
				</div>

				<div class="form-group">
					<label for="auto-hide-tabs" class="form-label">
						Auto-hide inactive tabs (minutes)
						<span class="form-help">0 = never hide</span>
					</label>
					<input
						id="auto-hide-tabs"
						type="number"
						class="form-input"
						bind:value={viewModel.preferences.ui.autoHideInactiveTabsMinutes}
						min="0"
						max="1440"
					/>
				</div>
			</div>

			<!-- Authentication Preferences -->
			<div class="preference-section">
				<h3>🔐 Authentication</h3>

				<div class="form-group">
					<label for="session-duration" class="form-label">
						Session duration (days)
						<span class="form-help">Rolling window that resets with each browser session</span>
					</label>
					<input
						id="session-duration"
						type="number"
						class="form-input"
						bind:value={viewModel.preferences.auth.sessionDuration}
						min="1"
						max="365"
					/>
				</div>

				<div class="form-group">
					<label class="checkbox-container">
						<input
							type="checkbox"
							bind:checked={viewModel.preferences.auth.rememberLastWorkspace}
						/>
						<span class="checkmark"></span>
						<span class="checkbox-label">Remember last used workspace</span>
					</label>
				</div>
			</div>

			<!-- Workspace Preferences -->
			<div class="preference-section">
				<h3>📁 Workspace</h3>

				<div class="form-group">
					<label for="default-workspace-path" class="form-label">
						Default workspace path
						<span class="form-help">Default location for new workspaces</span>
					</label>
					<input
						id="default-workspace-path"
						type="text"
						class="form-input"
						bind:value={viewModel.preferences.workspace.defaultPath}
						placeholder="/workspace"
					/>
				</div>

				<div class="form-group">
					<label class="checkbox-container">
						<input
							type="checkbox"
							bind:checked={viewModel.preferences.workspace.autoCreateMissingDirectories}
						/>
						<span class="checkmark"></span>
						<span class="checkbox-label">Auto-create missing directories</span>
					</label>
				</div>
			</div>

			<!-- Terminal Preferences -->
			<div class="preference-section">
				<h3>💻 Terminal</h3>

				<div class="form-group">
					<label for="terminal-font-size" class="form-label">Font size (px)</label>
					<input
						id="terminal-font-size"
						type="number"
						class="form-input"
						bind:value={viewModel.preferences.terminal.fontSize}
						min="8"
						max="32"
					/>
				</div>

				<div class="form-group">
					<label for="terminal-font-family" class="form-label">Font family</label>
					<select
						id="terminal-font-family"
						bind:value={viewModel.preferences.terminal.fontFamily}
						class="form-select"
					>
						<option value="Monaco, monospace">Monaco</option>
						<option value="'Fira Code', monospace">Fira Code</option>
						<option value="'JetBrains Mono', monospace">JetBrains Mono</option>
						<option value="'Cascadia Code', monospace">Cascadia Code</option>
						<option value="Consolas, monospace">Consolas</option>
						<option value="monospace">System Monospace</option>
					</select>
				</div>

				<div class="form-group">
					<label for="terminal-scrollback" class="form-label">
						Scrollback buffer (lines)
						<span class="form-help">Number of lines to keep in terminal history</span>
					</label>
					<input
						id="terminal-scrollback"
						type="number"
						class="form-input"
						bind:value={viewModel.preferences.terminal.scrollback}
						min="100"
						max="10000"
						step="100"
					/>
				</div>
			</div>

			<!-- Form Actions -->
			<div class="form-actions">
				<Button
					variant="secondary"
					onclick={handleResetToDefaults}
					disabled={viewModel.isSaving}
					text="Reset to Defaults"
				/>

				{#if viewModel.hasChanges}
					<Button
						variant="secondary"
						onclick={handleDiscardChanges}
						disabled={viewModel.isSaving}
						text="Discard Changes"
					/>
				{/if}

				<Button
					variant="primary"
					onclick={handleSave}
					disabled={!viewModel.canSave}
					loading={viewModel.isSaving}
				>
					{#if viewModel.isSaving}
						Saving...
					{:else}
						Save Preferences
					{/if}
				</Button>
			</div>
		</div>

		<!-- Messages -->
		{#if viewModel.error}
			<div class="error-message" role="alert">
				<strong>Error:</strong>
				{viewModel.error}
			</div>
		{/if}

		{#if viewModel.successMessage}
			<div class="success-message" role="alert">
				<strong>Success:</strong>
				{viewModel.successMessage}
			</div>
		{/if}
	{/if}
</div>

<style>
	@import '$lib/client/shared/styles/settings.css';

	/* Preferences panel container */
	.preferences-panel {
		container-type: inline-size;
	}

	.preferences-panel > div:first-child {
		margin-bottom: var(--space-5);
	}

	.preferences-panel h2 {
		font-family: var(--font-accent);
		font-size: var(--font-size-4);
		color: var(--primary);
		margin: 0 0 var(--space-2) 0;
		text-shadow: 0 0 10px var(--primary-glow);
		letter-spacing: 0.5px;
	}

	.preferences-panel p {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--muted);
		margin: 0;
	}

	/* Preference sections with retro styling */
	.preference-section {
		margin-bottom: var(--space-6);
		padding: var(--space-5);
		background: var(--surface-primary-98);
		border: 1px solid var(--primary-glow-15);
		border-radius: var(--radius-sm);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.preference-section:last-child {
		margin-bottom: 0;
	}

	.preference-section h3 {
		font-family: var(--font-mono);
		font-size: var(--font-size-3);
		font-weight: 600;
		color: var(--primary);
		margin: 0 0 var(--space-4) 0;
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--primary-glow-25);
		letter-spacing: 0.3px;
	}

	/* Override form input max-width for preferences */
	.form-input,
	.form-select {
		width: 100%;
		max-width: 400px;
	}

	.form-help {
		display: block;
		font-size: var(--font-size-0);
		color: var(--muted);
		margin-top: var(--space-1);
		font-style: italic;
	}

	/* Action buttons with border top */
	.form-actions {
		border-top: 1px solid var(--line);
		padding-top: var(--space-5);
		margin-top: var(--space-6);
	}

	/* Loading and message states */
	.loading-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		padding: var(--space-6) var(--space-5);
		color: var(--muted);
	}

	.loading-indicator .spinner {
		/* Use shared spinner from settings.css */
	}

	.success-message,
	.error-message {
		margin-top: var(--space-4);
	}

	/* Responsive adjustments */
	@container (max-width: 500px) {
		.preference-section {
			padding: var(--space-4);
		}

		.form-input,
		.form-select {
			max-width: 100%;
		}
	}
</style>
