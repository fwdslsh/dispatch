<script>
	/**
	 * PreferencesPanel - User preferences configuration component
	 * Manages UI preferences, workspace settings, and authentication options
	 * Follows constitutional requirement for progressive disclosure
	 */

	import { getContext, onMount } from 'svelte';

	let { onSave = () => {} } = $props();

	const serviceContainer = getContext('services');
	const apiClient = serviceContainer?.get('apiClient');

	const createDefaultPreferences = () => ({
		ui: {
			theme: 'auto',
			showWorkspaceInTitle: true,
			autoHideInactiveTabsMinutes: 0
		},
		auth: {
			sessionDuration: 30,
			rememberLastWorkspace: true
		},
		workspace: {
			defaultPath: '',
			autoCreateMissingDirectories: true
		},
		terminal: {
			fontSize: 14,
			fontFamily: 'Monaco, monospace',
			scrollback: 1000
		}
	});

	let preferences = $state(createDefaultPreferences());
	let originalPreferences = $state.raw(
		structuredClone($state.snapshot(preferences))
	);
	let isLoading = $state(false);
	let isSaving = $state(false);
	let error = $state(null);
	let successMessage = $state(null);

	let hasChanges = $derived(
		JSON.stringify($state.snapshot(preferences)) !== JSON.stringify(originalPreferences)
	);
	let canSave = $derived(hasChanges && !isSaving);

	onMount(() => {
		loadPreferences();
	});

	async function loadPreferences() {
		isLoading = true;
		error = null;

		try {
			if (!apiClient) {
				throw new Error('API client not available');
			}

			const authKey = localStorage.getItem('dispatch-auth-key');
			if (!authKey) {
				throw new Error('Authentication required');
			}

			const response = await fetch(`/api/preferences?authKey=${authKey}`);
			if (!response.ok) {
				throw new Error('Failed to load preferences');
			}

			const data = await response.json();
			const current = $state.snapshot(preferences);

			preferences = {
				ui: { ...current.ui, ...data.ui },
				auth: { ...current.auth, ...data.auth },
				workspace: { ...current.workspace, ...data.workspace },
				terminal: { ...current.terminal, ...data.terminal }
			};

			originalPreferences = structuredClone($state.snapshot(preferences));
		} catch (err) {
			error = err.message || 'Failed to load preferences';
		} finally {
			isLoading = false;
		}
	}

	async function handleSave() {
		if (!canSave) return;

		isSaving = true;
		error = null;
		successMessage = null;

		try {
			const authKey = localStorage.getItem('dispatch-auth-key');
			if (!authKey) {
				throw new Error('Authentication required');
			}

			const preferencesSnapshot = $state.snapshot(preferences);

			for (const [category, categoryPrefs] of Object.entries(preferencesSnapshot)) {
				const response = await fetch('/api/preferences', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						authKey,
						category,
						preferences: categoryPrefs
					})
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || `Failed to save ${category} preferences`);
				}
			}

			originalPreferences = structuredClone(preferencesSnapshot);
			successMessage = 'Preferences saved successfully';
			onSave(preferencesSnapshot);

			setTimeout(() => {
				successMessage = null;
			}, 3000);
		} catch (err) {
			error = err.message || 'Failed to save preferences';
		} finally {
			isSaving = false;
		}
	}

	async function handleResetToDefaults() {
		try {
			const authKey = localStorage.getItem('dispatch-auth-key');
			if (!authKey) {
				throw new Error('Authentication required');
			}

			for (const category of Object.keys($state.snapshot(preferences))) {
				const response = await fetch('/api/preferences', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'reset',
						authKey,
						category
					})
				});

				if (!response.ok) {
					throw new Error(`Failed to reset ${category} preferences`);
				}
			}

			await loadPreferences();
			successMessage = 'Preferences reset to defaults';
		} catch (err) {
			error = err.message || 'Failed to reset preferences';
		}
	}

	function handleDiscardChanges() {
		preferences = structuredClone(originalPreferences);
	}
</script>

<div class="preferences-panel" role="main" aria-label="User preferences">
	<div >
		<h2>User Preferences</h2>
		<p>Customize your Dispatch experience</p>
	</div>

	{#if isLoading}
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
					<label class="form-label">Theme</label>
					<select bind:value={preferences.ui.theme} class="form-select">
						<option value="auto">Auto (system)</option>
						<option value="light">Light</option>
						<option value="dark">Dark</option>
					</select>
				</div>

				<div class="form-group">
					<label class="checkbox-container">
						<input
							type="checkbox"
							bind:checked={preferences.ui.showWorkspaceInTitle}
						/>
						<span class="checkmark"></span>
						<span class="checkbox-label">Show workspace name in title bar</span>
					</label>
				</div>

				<div class="form-group">
					<label class="form-label">
						Auto-hide inactive tabs (minutes)
						<span class="form-help">0 = never hide</span>
					</label>
					<input
						type="number"
						class="form-input"
						bind:value={preferences.ui.autoHideInactiveTabsMinutes}
						min="0"
						max="1440"
					/>
				</div>
			</div>

			<!-- Authentication Preferences -->
			<div class="preference-section">
				<h3>🔐 Authentication</h3>

				<div class="form-group">
					<label class="form-label">
						Session duration (days)
						<span class="form-help">Rolling window that resets with each browser session</span>
					</label>
					<input
						type="number"
						class="form-input"
						bind:value={preferences.auth.sessionDuration}
						min="1"
						max="365"
					/>
				</div>

				<div class="form-group">
					<label class="checkbox-container">
						<input
							type="checkbox"
							bind:checked={preferences.auth.rememberLastWorkspace}
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
					<label class="form-label">
						Default workspace path
						<span class="form-help">Default location for new workspaces</span>
					</label>
					<input
						type="text"
						class="form-input"
						bind:value={preferences.workspace.defaultPath}
						placeholder="/workspace"
					/>
				</div>

				<div class="form-group">
					<label class="checkbox-container">
						<input
							type="checkbox"
							bind:checked={preferences.workspace.autoCreateMissingDirectories}
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
					<label class="form-label">Font size (px)</label>
					<input
						type="number"
						class="form-input"
						bind:value={preferences.terminal.fontSize}
						min="8"
						max="32"
					/>
				</div>

				<div class="form-group">
					<label class="form-label">Font family</label>
					<select bind:value={preferences.terminal.fontFamily} class="form-select">
						<option value="Monaco, monospace">Monaco</option>
						<option value="'Fira Code', monospace">Fira Code</option>
						<option value="'JetBrains Mono', monospace">JetBrains Mono</option>
						<option value="'Cascadia Code', monospace">Cascadia Code</option>
						<option value="Consolas, monospace">Consolas</option>
						<option value="monospace">System Monospace</option>
					</select>
				</div>

				<div class="form-group">
					<label class="form-label">
						Scrollback buffer (lines)
						<span class="form-help">Number of lines to keep in terminal history</span>
					</label>
					<input
						type="number"
						class="form-input"
						bind:value={preferences.terminal.scrollback}
						min="100"
						max="10000"
						step="100"
					/>
				</div>
			</div>

			<!-- Form Actions -->
			<div class="form-actions">
				<button
					class="btn btn-outline"
					onclick={handleResetToDefaults}
					disabled={isSaving}
				>
					Reset to Defaults
				</button>

				{#if hasChanges}
					<button
						class="btn btn-outline"
						onclick={handleDiscardChanges}
						disabled={isSaving}
					>
						Discard Changes
					</button>
				{/if}

				<button
					class="btn btn-primary"
					onclick={handleSave}
					disabled={!canSave}
				>
					{#if isSaving}
						Saving...
					{:else}
						Save Preferences
					{/if}
				</button>
			</div>
		</div>

		<!-- Messages -->
		{#if error}
			<div class="error-message" role="alert">
				<strong>Error:</strong> {error}
			</div>
		{/if}

		{#if successMessage}
			<div class="success-message" role="alert">
				<strong>Success:</strong> {successMessage}
			</div>
		{/if}
	{/if}
</div>

<style>
	/* Essential layout styles only */
	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-label {
		display: block;
		margin-bottom: 0.5rem;
	}

	.form-input,
	.form-select {
		width: 100%;
		max-width: 300px;
		padding: 0.75rem;
	}

	.checkbox-container {
		display: flex;
		align-items: center;
		cursor: pointer;
		padding: 0.75rem;
		margin: 0.5rem 0;
	}

	.checkbox-container input[type="checkbox"] {
		margin-right: 0.75rem;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		padding-top: 2rem;
		margin-top: 2rem;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		cursor: pointer;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		padding: 3rem;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid currentColor;
		border-top: 2px solid transparent;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
