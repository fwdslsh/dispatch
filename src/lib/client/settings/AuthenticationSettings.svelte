<!--
	AuthenticationSettings Component
	Displays and manages authentication-related settings including terminal key and OAuth configuration
-->

<script>
	import { SettingsViewModel } from './SettingsViewModel.svelte.js';
	import TerminalKeySettings from './sections/TerminalKeySettings.svelte';
	import OAuthSettings from './sections/OAuthSettings.svelte';

	/**
	 * @type {SettingsViewModel}
	 */
	let { settingsViewModel } = $props();

	// Reactive state for authentication category
	let authenticationCategory = $derived.by(() => {
		return settingsViewModel.settingsByCategory.find(cat => cat.id === 'authentication');
	});

	let hasChanges = $derived.by(() => {
		return settingsViewModel.categoryHasChanges('authentication');
	});

	let canSave = $derived.by(() => {
		return hasChanges && !settingsViewModel.hasValidationErrors && !settingsViewModel.saving;
	});

	// Handle saving authentication settings
	async function handleSave() {
		try {
			await settingsViewModel.saveCategory('authentication');
		} catch (error) {
			console.error('Failed to save authentication settings:', error);
		}
	}

	// Handle discarding changes
	function handleDiscard() {
		// Find all authentication settings and discard their changes
		const authSettings = settingsViewModel.authenticationSettings;
		authSettings.forEach(setting => {
			settingsViewModel.discardSetting(setting.key);
		});
	}
</script>

<div class="authentication-settings" data-testid="authentication-settings">
	<div class="settings-header">
		<h3>Authentication</h3>
		<p class="settings-description">
			Configure terminal access and OAuth authentication settings for secure access to your development environment.
		</p>
	</div>

	{#if authenticationCategory}
		<div class="settings-content">
			<!-- Terminal Key Settings Section -->
			<TerminalKeySettings {settingsViewModel} />

			<!-- OAuth Settings Section -->
			<OAuthSettings {settingsViewModel} />

			<!-- Session Invalidation Warning -->
			{#if hasChanges}
				<div class="session-warning" data-testid="session-warning">
					<div class="warning-icon">⚠️</div>
					<div class="warning-content">
						<strong>Security Notice:</strong>
						Changing authentication settings will invalidate all active sessions for security.
						You will need to re-authenticate with the new credentials.
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
					data-testid="save-settings-button"
				>
					{#if settingsViewModel.saving}
						<span class="loading-spinner"></span>
						Saving...
					{:else}
						Save Authentication Settings
					{/if}
				</button>

				{#if hasChanges}
					<button
						type="button"
						class="btn btn-secondary"
						disabled={settingsViewModel.saving}
						onclick={handleDiscard}
						data-testid="discard-changes-button"
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
	{:else}
		<div class="loading-state">
			<div class="loading-spinner"></div>
			<p>Loading authentication settings...</p>
		</div>
	{/if}
</div>

<style>
	.authentication-settings {
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
		gap: 1.5rem;
	}

	.session-warning {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		background: var(--warning-bg, #fff3cd);
		border: 1px solid var(--warning-border, #ffeaa7);
		border-radius: 6px;
		color: var(--warning-text, #856404);
	}

	.warning-icon {
		font-size: 1.25rem;
		flex-shrink: 0;
	}

	.warning-content strong {
		font-weight: 600;
	}

	.settings-actions {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
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

	.error-message {
		padding: 1rem;
		background: var(--error-bg, #f8d7da);
		border: 1px solid var(--error-border, #f5c6cb);
		border-radius: 6px;
		color: var(--error-text, #721c24);
		font-size: 0.875rem;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		color: var(--text-secondary);
	}

	.loading-state .loading-spinner {
		width: 2rem;
		height: 2rem;
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.authentication-settings {
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

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.authentication-settings {
			border-width: 2px;
		}

		.btn {
			border-width: 2px;
		}
	}
</style>