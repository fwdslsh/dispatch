<!--
	GlobalSettings Component
	Displays and manages global/general settings including workspace, UI, and system configuration
-->

<script>
	import { SettingsViewModel } from './SettingsViewModel.svelte.js';

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

	// Get settings for each category
	let workspaceSettings = $derived.by(() => {
		return settingsViewModel.workspaceSettings;
	});

	let uiSettings = $derived.by(() => {
		return settingsViewModel.uiSettings;
	});

	let systemSettings = $derived.by(() => {
		return settingsViewModel.systemSettings;
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
			<button
				type="button"
				class="btn btn-primary"
				class:btn-loading={settingsViewModel.saving}
				disabled={!canSave}
				onclick={handleSave}
				data-testid="save-global-settings-button"
			>
				{#if settingsViewModel.saving}
					<span class="loading-spinner"></span>
					Saving...
				{:else}
					Save General Settings
				{/if}
			</button>

			{#if hasChanges}
				<button
					type="button"
					class="btn btn-secondary"
					disabled={settingsViewModel.saving}
					onclick={handleDiscard}
					data-testid="discard-global-changes-button"
				>
					Discard Changes
				</button>
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
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 1.5rem;
		margin-bottom: 1.5rem;
	}

	.settings-header h3 {
		margin: 0 0 0.5rem 0;
		color: var(--text-primary);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.settings-description {
		margin: 0 0 1.5rem 0;
		color: var(--text-secondary);
		font-size: 0.875rem;
		line-height: 1.4;
	}

	.settings-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.settings-section {
		border-top: 1px solid var(--border-color);
		padding-top: 1.5rem;
	}

	.settings-section:first-child {
		border-top: none;
		padding-top: 0;
	}

	.section-title {
		margin: 0 0 1rem 0;
		color: var(--text-primary);
		font-size: 1rem;
		font-weight: 600;
	}

	.settings-group {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.setting-item {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.setting-label {
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.required-indicator {
		color: var(--error-color, #dc3545);
		font-weight: bold;
	}

	.setting-description {
		font-size: 0.8125rem;
		color: var(--text-secondary);
		line-height: 1.4;
		margin: 0;
	}

	.setting-input,
	.setting-select {
		padding: 0.75rem;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		font-size: 0.875rem;
		background: var(--input-bg, white);
		color: var(--text-primary);
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
		min-height: 44px; /* Touch target */
	}

	.setting-input:focus,
	.setting-select:focus {
		outline: none;
		border-color: var(--focus-color, #007bff);
		box-shadow: 0 0 0 3px var(--focus-shadow, rgba(0, 123, 255, 0.25));
	}

	.setting-input.input-error,
	.setting-select.input-error {
		border-color: var(--error-color, #dc3545);
	}

	.setting-input.input-error:focus,
	.setting-select.input-error:focus {
		border-color: var(--error-color, #dc3545);
		box-shadow: 0 0 0 3px var(--error-shadow, rgba(220, 53, 69, 0.25));
	}

	.checkbox-wrapper {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
	}

	.setting-checkbox {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
	}

	.checkbox-label {
		color: var(--text-primary);
		cursor: pointer;
	}

	.error-message {
		padding: 0.75rem;
		background: var(--error-bg, #f8d7da);
		border: 1px solid var(--error-border, #f5c6cb);
		border-radius: 4px;
		color: var(--error-text, #721c24);
		font-size: 0.8125rem;
	}

	.error-item {
		margin-bottom: 0.25rem;
	}

	.error-item:last-child {
		margin-bottom: 0;
	}

	.env-fallback {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--info-bg, #d1ecf1);
		border: 1px solid var(--info-border, #bee5eb);
		border-radius: 4px;
		color: var(--info-text, #0c5460);
		font-size: 0.8125rem;
	}

	.env-icon {
		flex-shrink: 0;
	}

	.env-content code {
		background: rgba(0, 0, 0, 0.1);
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
		font-family: monospace;
		font-size: 0.75rem;
	}

	.settings-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
		margin-top: 1rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--border-color);
	}

	.btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem 1.5rem;
		border: 1px solid transparent;
		border-radius: 6px;
		font-size: 0.875rem;
		font-weight: 500;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 44px; /* Touch target */
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background: var(--primary-color, #007bff);
		color: white;
		border-color: var(--primary-color, #007bff);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--primary-color-hover, #0056b3);
		border-color: var(--primary-color-hover, #0056b3);
	}

	.btn-secondary {
		background: transparent;
		color: var(--text-secondary);
		border-color: var(--border-color);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--hover-bg);
		color: var(--text-primary);
	}

	.btn-loading {
		cursor: wait;
	}

	.loading-spinner {
		width: 1rem;
		height: 1rem;
		border: 2px solid transparent;
		border-top: 2px solid currentColor;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.success-message {
		padding: 1rem;
		background: var(--success-bg, #d4edda);
		border: 1px solid var(--success-border, #c3e6cb);
		border-radius: 6px;
		color: var(--success-text, #155724);
		font-size: 0.875rem;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.global-settings {
			padding: 1rem;
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
	.btn:focus-visible {
		outline: 2px solid var(--focus-color, #007bff);
		outline-offset: 2px;
	}

	.setting-checkbox:focus-visible {
		outline: 2px solid var(--focus-color, #007bff);
		outline-offset: 2px;
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.global-settings {
			border-width: 2px;
		}

		.setting-input,
		.setting-select {
			border-width: 2px;
		}

		.btn {
			border-width: 2px;
		}
	}
</style>