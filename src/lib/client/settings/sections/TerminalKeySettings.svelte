<!--
	TerminalKeySettings Section
	Handles terminal key configuration with validation and security features
-->

<script>
	import { SettingsViewModel } from '../SettingsViewModel.svelte.js';
	import SettingField from '$lib/client/shared/components/SettingField.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';

	/**
	 * @type {SettingsViewModel}
	 */
	let { settingsViewModel } = $props();

	// Get terminal key setting using getter method
	let terminalKeySetting = $derived.by(() => {
		return settingsViewModel.getSetting('terminal_key');
	});

	// Current value with pending changes
	let currentValue = $derived.by(() => {
		if (!terminalKeySetting) return '';
		return settingsViewModel.getCurrentValue('terminal_key');
	});

	// Validation errors
	let validationErrors = $derived.by(() => {
		return settingsViewModel.getValidationErrors('terminal_key');
	});

	let hasChanges = $derived.by(() => {
		return settingsViewModel.hasChanges('terminal_key');
	});

	// Input state
	let showPassword = $state(false);
	let inputElement = $state(null);

	// Handle input changes
	function handleInput(event) {
		const value = event.target.value;
		settingsViewModel.updateSetting('terminal_key', value);
	}

	// Toggle password visibility
	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	// Handle key generation suggestion
	function generateSecureKey() {
		// Generate a secure random key
		const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
		let result = '';
		for (let i = 0; i < 16; i++) {
			result += charset.charAt(Math.floor(Math.random() * charset.length));
		}

		// Update the setting
		settingsViewModel.updateSetting('terminal_key', result);

		// Focus the input to show the generated value
		if (inputElement) {
			inputElement.focus();
		}
	}
</script>

<div class="terminal-key-settings">
	<div class="setting-group">
		{#if terminalKeySetting}
			<div class="password-field-wrapper">
				<SettingField
					setting={terminalKeySetting}
					value={currentValue}
					errors={validationErrors}
					hasChanges={hasChanges}
					onInput={handleInput}
					type={showPassword ? 'text' : 'password'}
					placeholder="Enter secure terminal key (min 8 characters)"
					autocomplete="new-password"
					testId="terminal-key-input"
				/>

				<button
					type="button"
					class="btn-icon-toggle"
					onclick={togglePasswordVisibility}
					title={showPassword ? 'Hide key' : 'Show key'}
					aria-label={showPassword ? 'Hide terminal key' : 'Show terminal key'}
				>
					{#if showPassword}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
							<path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
							<path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.708zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
						</svg>
					{:else}
						<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
							<path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8zM1.173 8a13.133 13.133 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.133 13.133 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5c-2.12 0-3.879-1.168-5.168-2.457A13.134 13.134 0 0 1 1.172 8z"/>
							<path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
						</svg>
					{/if}
				</button>
			</div>

			<!-- Key Generation Helper -->
			<div class="setting-helper">
				<Button
					type="button"
					variant="secondary"
					onclick={generateSecureKey}
					ariaLabel="Generate a secure random key"
					text="Generate Secure Key"
				/>
			</div>

			<!-- Security Notice -->
			<div class="security-notice">
				<div class="notice-icon">🔒</div>
				<div class="notice-content">
					<strong>Security:</strong>
					Keep your terminal key secure and don't share it.
					Changing this key will invalidate all active sessions.
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	@import '$lib/client/shared/styles/settings.css';

	.terminal-key-settings {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.setting-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.password-field-wrapper {
		position: relative;
	}

	.password-field-wrapper :global(.setting-input) {
		padding-right: 3rem; /* Space for toggle button */
	}

	.btn-icon-toggle {
		position: absolute;
		top: 38px; /* Align with input field after label */
		right: var(--space-2);
		background: transparent;
		border: none;
		color: var(--muted);
		padding: var(--space-2);
		width: 2rem;
		height: 2rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: all 0.15s ease;
		z-index: 1;
	}

	.btn-icon-toggle:hover {
		color: var(--text);
		background: color-mix(in oklab, var(--accent) 10%, transparent);
	}

	.btn-icon-toggle:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.setting-helper {
		display: flex;
		justify-content: flex-end;
	}

	.security-notice {
		display: flex;
		align-items: flex-start;
		gap: var(--space-2);
		padding: var(--space-3);
		background: color-mix(in oklab, var(--accent) 8%, transparent);
		border: 1px solid color-mix(in oklab, var(--accent) 20%, transparent);
		border-radius: 8px;
		font-size: var(--font-size-1);
		line-height: 1.5;
	}

	.notice-icon {
		flex-shrink: 0;
	}

	.notice-content strong {
		font-weight: 700;
	}
</style>