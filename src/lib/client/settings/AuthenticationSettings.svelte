<!--
	AuthenticationSettings Component
	Displays and manages authentication-related settings including terminal key and OAuth configuration
-->

<script>
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

	<div>
		<!-- Current Authentication Status -->
		<AuthStatus />

		<!-- Terminal Key Settings Section -->
		<section class="auth-section">
			<h4>Terminal Key</h4>
			<p class="subsection-description">
				Secure authentication key for terminal and Claude Code sessions.
			</p>
			<TerminalKeySettings {settingsViewModel} />
		</section>

		<!-- OAuth Settings Section -->
		<section class="auth-section">
			<h4>OAuth Configuration</h4>
			<p class="subsection-description">
				Configure OAuth authentication for secure user access to your application.
			</p>
			<OAuthSettings {settingsViewModel} />
		</section>

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
