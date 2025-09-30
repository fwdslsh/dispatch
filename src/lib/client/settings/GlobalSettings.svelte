<!--
	GlobalSettings Component
	Displays and manages global/general settings including workspace, UI, and system configuration
-->

<script>
	import { SettingsViewModel } from './SettingsViewModel.svelte.js';
	import Button from '$lib/client/shared/components/Button.svelte';

	/**
	 * @type {SettingsViewModel}
	 */
	let { settingsViewModel } = $props();

	// Reactive state for workspace and ui categories
	let workspaceCategory = $derived.by(() => {
		return settingsViewModel.settingsByCategory.find(cat => cat.id === 'workspace');
	});

	let uiCategory = $derived.by(() => {
		return settingsViewModel.settingsByCategory.find(cat => cat.id === 'ui');
	});

	let systemCategory = $derived.by(() => {
		return settingsViewModel.settingsByCategory.find(cat => cat.id === 'system');
	});

	// Check for changes across all global categories
	let hasChanges = $derived.by(() => {
		return (
			settingsViewModel.categoryHasChanges('workspace') ||
			settingsViewModel.categoryHasChanges('ui') ||
			settingsViewModel.categoryHasChanges('system')
		);
	});

	let canSave = $derived.by(() => {
		return hasChanges && !settingsViewModel.hasValidationErrors && !settingsViewModel.saving;
	});

	// Get settings for each category using getter method
	let workspaceSettings = $derived.by(() => {
		return settingsViewModel.getSettingsByCategory('workspace');
	});

	let uiSettings = $derived.by(() => {
		return settingsViewModel.getSettingsByCategory('ui');
	});

	let systemSettings = $derived.by(() => {
		return settingsViewModel.getSettingsByCategory('system');
	});

	// Handle input changes for different setting types
	function handleInput(settingKey, event) {
		const value = event.target.value;
		settingsViewModel.updateSetting(settingKey, value);
	}

	function handleCheckbox(settingKey, event) {
		const value = event.target.checked;
		settingsViewModel.updateSetting(settingKey, value);
	}

	function handleSelect(settingKey, event) {
		const value = event.target.value;
		settingsViewModel.updateSetting(settingKey, value);
	}

	// Handle saving all global settings
	async function handleSave() {
		try {
			const categoriesToSave = [];
			if (settingsViewModel.categoryHasChanges('workspace')) categoriesToSave.push('workspace');
			if (settingsViewModel.categoryHasChanges('ui')) categoriesToSave.push('ui');
			if (settingsViewModel.categoryHasChanges('system')) categoriesToSave.push('system');

			for (const category of categoriesToSave) {
				await settingsViewModel.saveCategory(category);
			}
		} catch (error) {
			console.error('Failed to save global settings:', error);
		}
	}

	// Handle discarding changes
	function handleDiscard() {
		// Find all settings in global categories and discard their changes
		[...workspaceSettings, ...uiSettings, ...systemSettings].forEach(setting => {
			settingsViewModel.discardSetting(setting.key);
		});
	}

	// Helper function to get current value with pending changes
	function getCurrentValue(settingKey) {
		return settingsViewModel.getCurrentValue(settingKey);
	}

	// Helper function to get validation errors
	function getValidationErrors(settingKey) {
		return settingsViewModel.getValidationErrors(settingKey);
	}

	// Helper function to check if setting has changes
	function hasSettingChanges(settingKey) {
		return settingsViewModel.hasChanges(settingKey);
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
		<!-- Workspace Settings Section -->
		{#if workspaceCategory && workspaceSettings.length > 0}
			<div class="settings-section">
				<h4 class="section-title">Workspace Configuration</h4>
				<div class="settings-group">
					{#each workspaceSettings as setting}
						{@const currentValue = getCurrentValue(setting.key)}
						{@const validationErrors = getValidationErrors(setting.key)}
						{@const hasErrors = validationErrors.length > 0}
						{@const hasChanges = hasSettingChanges(setting.key)}

						<div class="setting-item">
							<label for={setting.key} class="setting-label">
								{setting.display_name}
								{#if setting.is_required}
									<span class="required-indicator" aria-label="Required">*</span>
								{/if}
							</label>

							{#if setting.description}
								<div class="setting-description">{setting.description}</div>
							{/if}

							{#if setting.type === 'STRING' || setting.type === 'PATH'}
								<input
									id={setting.key}
									type="text"
									class="setting-input"
									class:input-error={hasErrors}
									placeholder={setting.placeholder || ''}
									value={currentValue || ''}
									oninput={(e) => handleInput(setting.key, e)}
									data-testid="{setting.key}-input"
									aria-describedby={hasErrors ? `${setting.key}-error` : undefined}
								/>
							{:else if setting.type === 'NUMBER'}
								<input
									id={setting.key}
									type="number"
									class="setting-input"
									class:input-error={hasErrors}
									placeholder={setting.placeholder || ''}
									value={currentValue || ''}
									min={setting.validation?.min}
									max={setting.validation?.max}
									oninput={(e) => handleInput(setting.key, e)}
									data-testid="{setting.key}-input"
									aria-describedby={hasErrors ? `${setting.key}-error` : undefined}
								/>
							{:else if setting.type === 'BOOLEAN'}
								<label class="checkbox-wrapper">
									<input
										id={setting.key}
										type="checkbox"
										class="setting-checkbox"
										checked={currentValue === 'true' || currentValue === true}
										onchange={(e) => handleCheckbox(setting.key, e)}
										data-testid="{setting.key}-checkbox"
									/>
									<span class="checkbox-label">{setting.description || 'Enable'}</span>
								</label>
							{/if}

							<!-- Validation Errors -->
							{#if hasErrors}
								<div class="error-message" id="{setting.key}-error" data-testid="{setting.key}-error">
									{#each validationErrors as error}
										<div class="error-item">{error}</div>
									{/each}
								</div>
							{/if}

							<!-- Environment Variable Fallback Info -->
							{#if setting.env_var_name && !hasChanges}
								<div class="env-fallback" data-testid="{setting.key}-env-fallback">
									<div class="env-icon">🔧</div>
									<div class="env-content">
										<strong>Environment Variable:</strong>
										Currently using value from <code>{setting.env_var_name}</code> environment
										variable. Set a value here to override the environment setting.
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- UI Settings Section -->
		{#if uiCategory && uiSettings.length > 0}
			<div class="settings-section">
				<h4 class="section-title">UI Preferences</h4>
				<div class="settings-group">
					{#each uiSettings as setting}
						{@const currentValue = getCurrentValue(setting.key)}
						{@const validationErrors = getValidationErrors(setting.key)}
						{@const hasErrors = validationErrors.length > 0}
						{@const hasChanges = hasSettingChanges(setting.key)}

						<div class="setting-item">
							<label for={setting.key} class="setting-label">
								{setting.display_name}
								{#if setting.is_required}
									<span class="required-indicator" aria-label="Required">*</span>
								{/if}
							</label>

							{#if setting.description}
								<div class="setting-description">{setting.description}</div>
							{/if}

							{#if setting.options && setting.options.length > 0}
								<select
									id={setting.key}
									class="setting-select"
									class:input-error={hasErrors}
									value={currentValue || setting.default_value}
									onchange={(e) => handleSelect(setting.key, e)}
									data-testid="{setting.key}-select"
									aria-describedby={hasErrors ? `${setting.key}-error` : undefined}
								>
									{#each setting.options as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							{:else if setting.type === 'BOOLEAN'}
								<label class="checkbox-wrapper">
									<input
										id={setting.key}
										type="checkbox"
										class="setting-checkbox"
										checked={currentValue === 'true' || currentValue === true}
										onchange={(e) => handleCheckbox(setting.key, e)}
										data-testid="{setting.key}-checkbox"
									/>
									<span class="checkbox-label">{setting.description || 'Enable'}</span>
								</label>
							{:else}
								<input
									id={setting.key}
									type="text"
									class="setting-input"
									class:input-error={hasErrors}
									placeholder={setting.placeholder || ''}
									value={currentValue || ''}
									oninput={(e) => handleInput(setting.key, e)}
									data-testid="{setting.key}-input"
									aria-describedby={hasErrors ? `${setting.key}-error` : undefined}
								/>
							{/if}

							<!-- Validation Errors -->
							{#if hasErrors}
								<div class="error-message" id="{setting.key}-error" data-testid="{setting.key}-error">
									{#each validationErrors as error}
										<div class="error-item">{error}</div>
									{/each}
								</div>
							{/if}

							<!-- Environment Variable Fallback Info -->
							{#if setting.env_var_name && !hasChanges}
								<div class="env-fallback" data-testid="{setting.key}-env-fallback">
									<div class="env-icon">🔧</div>
									<div class="env-content">
										<strong>Environment Variable:</strong>
										Currently using value from <code>{setting.env_var_name}</code> environment
										variable.
									</div>
								</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- System Settings Section -->
		{#if systemCategory && systemSettings.length > 0}
			<div class="settings-section">
				<h4 class="section-title">System Configuration</h4>
				<div class="settings-group">
					{#each systemSettings as setting}
						{@const currentValue = getCurrentValue(setting.key)}
						{@const validationErrors = getValidationErrors(setting.key)}
						{@const hasErrors = validationErrors.length > 0}
						{@const hasChanges = hasSettingChanges(setting.key)}

						<div class="setting-item">
							<label for={setting.key} class="setting-label">
								{setting.display_name}
								{#if setting.is_required}
									<span class="required-indicator" aria-label="Required">*</span>
								{/if}
							</label>

							{#if setting.description}
								<div class="setting-description">{setting.description}</div>
							{/if}

							{#if setting.type === 'BOOLEAN'}
								<label class="checkbox-wrapper">
									<input
										id={setting.key}
										type="checkbox"
										class="setting-checkbox"
										checked={currentValue === 'true' || currentValue === true}
										onchange={(e) => handleCheckbox(setting.key, e)}
										data-testid="{setting.key}-checkbox"
									/>
									<span class="checkbox-label">{setting.description || 'Enable'}</span>
								</label>
							{:else if setting.type === 'NUMBER'}
								<input
									id={setting.key}
									type="number"
									class="setting-input"
									class:input-error={hasErrors}
									placeholder={setting.placeholder || ''}
									value={currentValue || ''}
									min={setting.validation?.min}
									max={setting.validation?.max}
									oninput={(e) => handleInput(setting.key, e)}
									data-testid="{setting.key}-input"
									aria-describedby={hasErrors ? `${setting.key}-error` : undefined}
								/>
							{:else}
								<input
									id={setting.key}
									type="text"
									class="setting-input"
									class:input-error={hasErrors}
									placeholder={setting.placeholder || ''}
									value={currentValue || ''}
									oninput={(e) => handleInput(setting.key, e)}
									data-testid="{setting.key}-input"
									aria-describedby={hasErrors ? `${setting.key}-error` : undefined}
								/>
							{/if}

							<!-- Validation Errors -->
							{#if hasErrors}
								<div class="error-message" id="{setting.key}-error" data-testid="{setting.key}-error">
									{#each validationErrors as error}
										<div class="error-item">{error}</div>
									{/each}
								</div>
							{/if}

							<!-- Environment Variable Fallback Info -->
							{#if setting.env_var_name && !hasChanges}
								<div class="env-fallback" data-testid="{setting.key}-env-fallback">
									<div class="env-icon">🔧</div>
									<div class="env-content">
										<strong>Environment Variable:</strong>
										Currently using value from <code>{setting.env_var_name}</code> environment
										variable.
									</div>
								</div>
							{/if}
						</div>
					{/each}
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
	@import '$lib/client/shared/styles/settings.css';

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

	.btn-loading .loading-spinner {
		/* Use shared spinner from settings.css */
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

		.btn {
			justify-content: center;
		}
	}

	/* Focus styles for accessibility */
	.btn:focus-visible,
	.setting-checkbox:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.global-settings,
		.setting-input,
		.setting-select,
		.btn {
			border-width: 2px;
		}
	}
</style>