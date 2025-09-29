<!--
	AuthenticationSettingsWrapper Component
	Wrapper that bridges the new AuthenticationSettings component with the existing settings page structure
-->

<script>
	import { onMount, getContext } from 'svelte';
	import AuthenticationSettings from './AuthenticationSettings.svelte';
	import { SettingsViewModel } from './SettingsViewModel.svelte.js';

	/**
	 * Legacy props from settings page
	 * @type {function}
	 */
	let { onSave, onError } = $props();

	let serviceContainer = getContext('services');
	let settingsViewModel = $state(null);
	let loading = $state(true);
	let error = $state(null);

	onMount(async () => {
		try {
			// Initialize the settings view model with settingsService from container
			const settingsService = await serviceContainer?.get('settingsService');
			if (!settingsService) {
				throw new Error('Settings service not available');
			}

			settingsViewModel = new SettingsViewModel(settingsService);

			// Load initial settings data
			await settingsViewModel.loadSettings();

			loading = false;
		} catch (err) {
			console.error('Failed to initialize authentication settings:', err);
			error = err.message || 'Failed to load authentication settings';
			loading = false;

			// Notify parent of error
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
		<button type="button" onclick={() => window.location.reload()}>Refresh Page</button>
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
		border-radius: 50%;
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

	.error-container button {
		padding: 0.75rem 1.5rem;
		border: 1px solid var(--border-color);
		border-radius: 6px;
		background: var(--bg-secondary);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.error-container button:hover {
		background: var(--hover-bg);
	}
</style>