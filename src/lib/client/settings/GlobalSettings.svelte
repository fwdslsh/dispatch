<!--
	GlobalSettings Component
	Displays and manages global/general settings including workspace, UI, and system configuration
-->

<script>
	import { SettingsViewModel } from './SettingsViewModel.svelte.js';
	import Button from '$lib/client/shared/components/Button.svelte';

	let {
		/**
		 * @type {SettingsViewModel}
		 */
		settingsViewModel
	} = $props();

	// Direct access to category objects (reactive via $state proxy)
	let globalSettings = $derived(settingsViewModel.categories.global || {});
	let workspaceSettings = $derived(settingsViewModel.categories.workspace || {});

	// Check for changes
	let hasChanges = $derived(
		settingsViewModel.categoryHasChanges('global') ||
			settingsViewModel.categoryHasChanges('workspace')
	);

	let canSave = $derived(
		hasChanges && !settingsViewModel.hasValidationErrors && !settingsViewModel.saving
	);

	// Handle input with validation
	function handleInput(category, field, event) {
		const value = event.target.value;
		settingsViewModel.validateField(category, field, value);
	}

	function handleCheckbox(category, field, event) {
		const value = event.target.checked;
		settingsViewModel.validateField(category, field, value);
	}

	// Handle saving settings
	async function handleSave() {
		try {
			if (settingsViewModel.categoryHasChanges('global')) {
				await settingsViewModel.saveCategory('global');
			}
			if (settingsViewModel.categoryHasChanges('workspace')) {
				await settingsViewModel.saveCategory('workspace');
			}
		} catch (error) {
			console.error('Failed to save global settings:', error);
		}
	}

	// Handle discarding changes
	function handleDiscard() {
		if (settingsViewModel.categoryHasChanges('global')) {
			settingsViewModel.discardCategory('global');
		}
		if (settingsViewModel.categoryHasChanges('workspace')) {
			settingsViewModel.discardCategory('workspace');
		}
	}
</script>

<div class="global-settings" data-testid="global-settings">
	<div class="settings-header">
		<h3>General Settings</h3>
		<p class="settings-description">
			Configure workspace paths, UI preferences, and system settings for your development
			environment.
		</p>
	</div>

	<div class="settings-content">
		<!-- Global Settings Section -->
		<div class="settings-section">
			<h4 class="section-title">Global Settings</h4>
			<div class="settings-group">
				<div class="setting-item">
					<label for="theme" class="setting-label">Theme</label>
					<div class="setting-description">Application color theme</div>
					<select
						id="theme"
						class="setting-select"
						bind:value={globalSettings.theme}
						oninput={(e) => handleInput('global', 'theme', e)}
					>
						<option value="dark">Dark</option>
						<option value="light">Light</option>
						<option value="retro">Retro</option>
					</select>
					{#if settingsViewModel.getFieldErrors('global', 'theme').length > 0}
						<div class="error-message">
							{settingsViewModel.getFieldErrors('global', 'theme').join(', ')}
						</div>
					{/if}
				</div>

				<div class="setting-item">
					<label for="defaultWorkspaceDirectory" class="setting-label">
						Default Workspace Directory
					</label>
					<div class="setting-description">Default path for new workspaces</div>
					<input
						id="defaultWorkspaceDirectory"
						type="text"
						class="setting-input"
						bind:value={globalSettings.defaultWorkspaceDirectory}
						oninput={(e) => handleInput('global', 'defaultWorkspaceDirectory', e)}
						placeholder="/workspace"
					/>
					{#if settingsViewModel.getFieldErrors('global', 'defaultWorkspaceDirectory').length > 0}
						<div class="error-message">
							{settingsViewModel.getFieldErrors('global', 'defaultWorkspaceDirectory').join(', ')}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Workspace Settings Section -->
		{#if Object.keys(workspaceSettings).length > 0}
			<div class="settings-section">
				<h4 class="section-title">Workspace Configuration</h4>
				<div class="settings-group">
					{#if workspaceSettings.envVariables !== undefined}
						<div class="setting-item">
							<label class="setting-label">Environment Variables</label>
							<div class="setting-description">
								Environment variables for workspace sessions (JSON format)
							</div>
							<textarea
								class="setting-textarea"
								value={JSON.stringify(workspaceSettings.envVariables, null, 2)}
								oninput={(e) => handleInput('workspace', 'envVariables', e)}
								placeholder="&#123;&#125;"
								rows="4"
							></textarea>
							{#if settingsViewModel.getFieldErrors('workspace', 'envVariables').length > 0}
								<div class="error-message">
									{settingsViewModel.getFieldErrors('workspace', 'envVariables').join(', ')}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="settings-actions">
			<Button
				type="button"
				variant="primary"
				disabled={!canSave}
				loading={settingsViewModel.saving}
				onclick={handleSave}
				text={settingsViewModel.saving ? 'Saving...' : 'Save General Settings'}
				data-testid="save-global-settings-button"
			/>

			{#if hasChanges}
				<Button
					type="button"
					variant="secondary"
					disabled={settingsViewModel.saving}
					onclick={handleDiscard}
					text="Discard Changes"
					data-testid="discard-global-changes-button"
				/>
			{/if}
		</div>

		<!-- Success Message -->
		{#if settingsViewModel.successMessage}
			<div class="success-message" data-testid="save-success-message">
				{settingsViewModel.successMessage}
			</div>
		{/if}

		<!-- Error Message -->
		{#if settingsViewModel.error}
			<div class="error-message" data-testid="save-error-message">
				{settingsViewModel.error}
			</div>
		{/if}
	</div>
</div>

<style>

	.global-settings {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius-md);
		padding: var(--space-5);
		margin-bottom: var(--space-5);
		container-type: inline-size;
	}

	.settings-header h3 {
		margin: 0 0 var(--space-2) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-4);
		font-weight: 600;
		text-shadow: 0 0 8px var(--primary-glow);
	}

	.settings-description {
		margin: 0 0 var(--space-5) 0;
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	.settings-content {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}

	.settings-section {
		border-top: 1px solid var(--line);
		padding-top: var(--space-5);
	}

	.settings-section:first-child {
		border-top: none;
		padding-top: 0;
	}

	.section-title {
		margin: 0 0 var(--space-4) 0;
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-3);
		font-weight: 600;
	}

	.settings-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}

	.setting-item {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.setting-label {
		font-weight: 500;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.required-indicator {
		color: var(--err);
		font-weight: bold;
	}

	.setting-description {
		font-size: var(--font-size-0);
		color: var(--muted);
		font-family: var(--font-mono);
		line-height: 1.5;
		margin: 0;
	}

	.setting-input,
	.setting-select {
		padding: var(--space-3);
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
		background: var(--bg);
		color: var(--text);
		transition: all 0.2s ease;
		min-height: 44px;
	}

	.setting-input:focus,
	.setting-select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: var(--focus-ring);
	}

	.setting-input.input-error,
	.setting-select.input-error {
		border-color: var(--err);
	}

	.setting-input.input-error:focus,
	.setting-select.input-error:focus {
		border-color: var(--err);
		box-shadow: var(--focus-ring-error);
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		cursor: pointer;
		padding: var(--space-2);
		min-height: 44px;
	}

	.setting-checkbox {
		width: 20px;
		height: 20px;
		cursor: pointer;
		accent-color: var(--primary);
	}

	.checkbox-label {
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		cursor: pointer;
	}

	.error-message {
		padding: var(--space-3);
		background: var(--err-dim);
		border: 1px solid var(--err);
		border-radius: var(--radius-xs);
		color: var(--err);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
	}

	.error-item {
		margin-bottom: var(--space-1);
	}

	.error-item:last-child {
		margin-bottom: 0;
	}

	.env-fallback {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-3);
		background: color-mix(in oklab, var(--info) 15%, var(--surface));
		border: 1px solid var(--info);
		border-radius: var(--radius-xs);
		color: var(--info);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
	}

	.env-icon {
		flex-shrink: 0;
	}

	.env-content code {
		background: color-mix(in oklab, var(--bg) 80%, transparent);
		padding: var(--space-0) var(--space-1);
		border-radius: var(--radius-xs);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
	}

	.settings-actions {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		flex-wrap: wrap;
		margin-top: var(--space-4);
		padding-top: var(--space-5);
		border-top: 1px solid var(--line);
	}

	.success-message {
		padding: var(--space-4);
		background: color-mix(in oklab, var(--ok) 15%, var(--surface));
		border: 1px solid var(--ok);
		border-radius: var(--radius-sm);
		color: var(--ok);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	/* Responsive Design */
	@container (max-width: 600px) {
		.global-settings {
			padding: var(--space-4);
		}

		.settings-actions {
			flex-direction: column;
			align-items: stretch;
		}
	}

	/* Focus styles for accessibility */
	.setting-checkbox:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.global-settings,
		.setting-input,
		.setting-select {
			border-width: 2px;
		}
	}
</style>
