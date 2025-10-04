<!--
	AuthenticationSettingsSection Component
	Initializes SettingsViewModel and renders AuthenticationSettings component
	This component bridges the settings page with the AuthenticationSettings view
-->

<script>
	import { onMount, getContext } from 'svelte';
	import AuthenticationSettings from './AuthenticationSettings.svelte';
	import { SettingsViewModel } from './SettingsViewModel.svelte.js';
	import Button from '$lib/client/shared/components/Button.svelte';

	/**
	 * Callbacks from parent settings page
	 * @type {{ onSave?: Function, onError?: Function }}
	 */
	let { onSave, onError } = $props();

	let serviceContainer = getContext('services');
	let settingsViewModel = $state(null);
	let loading = $state(true);
	let error = $state(null);

	onMount(async () => {
		try {
			const settingsService = await serviceContainer?.get('settingsService');
			if (!settingsService) {
				throw new Error('Settings service not available');
			}

			settingsViewModel = new SettingsViewModel(settingsService);
			await settingsViewModel.loadSettings();

			loading = false;
		} catch (err) {
			console.error('Failed to initialize authentication settings:', err);
			error = err.message || 'Failed to load authentication settings';
			loading = false;

			if (onError) {
				onError({ type: 'component-load', message: error });
			}
		}
	});

	// Watch for successful saves and notify parent
	$effect(() => {
		if (settingsViewModel?.successMessage && onSave) {
			onSave(settingsViewModel.successMessage);
		}
	});

	// Watch for errors and notify parent
	$effect(() => {
		if (settingsViewModel?.error && onError) {
			onError({ type: 'save-error', message: settingsViewModel.error });
		}
	});
</script>

{#if loading}
	<div class="loading-container">
		<div class="loading-spinner"></div>
		<p>Loading authentication settings...</p>
	</div>
{:else if error}
	<div class="error-container">
		<h4>Authentication Settings Error</h4>
		<p>{error}</p>
		<Button
			type="button"
			variant="primary"
			onclick={() => window.location.reload()}
			text="Refresh Page"
		/>
	</div>
{:else if settingsViewModel}
	<AuthenticationSettings {settingsViewModel} />
{/if}

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		gap: 1rem;
		color: var(--text-secondary);
	}

	.loading-spinner {
		width: 2rem;
		height: 2rem;
		border: 2px solid transparent;
		border-top: 2px solid currentColor;
		border-radius: var(--radius-full);
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem;
		gap: 1rem;
		text-align: center;
		color: var(--error-color, #dc3545);
	}

	.error-container h4 {
		margin: 0;
		color: var(--text-primary);
	}
</style>
