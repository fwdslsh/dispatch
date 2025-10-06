<!--
	AuthenticationSettings Component
	Displays and manages authentication-related settings including terminal key and OAuth configuration
-->

<script>
	import { SettingsViewModel } from './SettingsViewModel.svelte.js';
	import TerminalKeySettings from './sections/TerminalKeySettings.svelte';
	import OAuthSettings from './sections/OAuthSettings.svelte';
	import AuthStatus from '../shared/components/AuthStatus.svelte';
	import Button from '../shared/components/Button.svelte';

	let {
		/**
		 * @type {SettingsViewModel}
		 */
		settingsViewModel
	} = $props();

	// Direct access to authentication category (reactive via $state proxy)
	let authenticationSettings = $derived(settingsViewModel.categories.authentication || {});

	let hasChanges = $derived(settingsViewModel.categoryHasChanges('authentication'));

	let canSave = $derived(
		hasChanges && !settingsViewModel.hasValidationErrors && !settingsViewModel.saving
	);

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
		settingsViewModel.discardCategory('authentication');
	}
</script>

<div class="authentication-settings" data-testid="authentication-settings">
	<div class="settings-header">
		<h3>Authentication</h3>
		<p class="settings-description">
			Configure terminal access and OAuth authentication settings for secure access to your
			development environment.
		</p>
	</div>

	<div class="settings-content">
		<!-- Current Authentication Status -->
		<AuthStatus />

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
					Changing authentication settings will invalidate all active sessions for security. You will
					need to re-authenticate with the new credentials.
				</div>
			</div>
		{/if}

		<!-- Action Buttons -->
		<div class="settings-actions">
			<Button
				type="button"
				variant="primary"
				disabled={!canSave}
				onclick={handleSave}
				loading={settingsViewModel.saving}
				id="save-settings-button"
			>
				{#if settingsViewModel.saving}
					Saving...
				{:else}
					Save Authentication Settings
				{/if}
			</Button>

			{#if hasChanges}
				<Button
					type="button"
					variant="secondary"
					disabled={settingsViewModel.saving}
					onclick={handleDiscard}
					id="discard-changes-button"
					text="Discard Changes"
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

	.authentication-settings {
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
		gap: var(--space-5);
	}

	/* Warning alert styling */
	.session-warning {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
		padding: var(--space-4);
		background: color-mix(in oklab, var(--warn) 15%, var(--surface));
		border: 1px solid var(--warn);
		border-radius: var(--radius-sm);
		color: var(--warn);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.warning-icon {
		font-size: var(--font-size-4);
		flex-shrink: 0;
		line-height: 1;
	}

	.warning-content {
		flex: 1;
	}

	.warning-content strong {
		font-weight: 600;
		display: block;
		margin-bottom: var(--space-1);
	}

	/* Action buttons */
	.settings-actions {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		flex-wrap: wrap;
		padding-top: var(--space-5);
		margin-top: var(--space-4);
		border-top: 1px solid var(--line);
	}

	/* Message states */
	.success-message {
		padding: var(--space-4);
		background: color-mix(in oklab, var(--ok) 15%, var(--surface));
		border: 1px solid var(--ok);
		border-radius: var(--radius-sm);
		color: var(--ok);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	.error-message {
		padding: var(--space-4);
		background: var(--err-dim);
		border: 1px solid var(--err);
		border-radius: var(--radius-sm);
		color: var(--err);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
	}

	/* Loading state */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-6);
		color: var(--muted);
		font-family: var(--font-mono);
	}

	.loading-state .loading-spinner {
		width: 32px;
		height: 32px;
		border-width: 3px;
	}

	/* Responsive Design */
	@container (max-width: 600px) {
		.authentication-settings {
			padding: var(--space-4);
		}

		.settings-actions {
			flex-direction: column;
			align-items: stretch;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.authentication-settings {
			border-width: 2px;
		}
	}
</style>
