<!--
	GlobalSettingsWrapper Component
	Wrapper that bridges the GlobalSettings component with the existing settings page structure
-->

<script>
	import { onMount, getContext } from 'svelte';
	import GlobalSettings from './GlobalSettings.svelte';
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
			console.error('Failed to initialize global settings:', err);
			error = err.message || 'Failed to load global settings';
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
			onError({ type: 'service-error', message: settingsViewModel.error });
		}
	});
</script>

{#if loading}
	<div class="loading-container">
		<div class="spinner" aria-label="Loading global settings"></div>
		<p>Loading global settings...</p>
	</div>
{:else if error}
	<div class="error-container">
		<p class="error-message">⚠️ {error}</p>
		<button type="button" onclick={() => window.location.reload()}>Retry</button>
	</div>
{:else if settingsViewModel}
	<GlobalSettings {settingsViewModel} />
{:else}
	<div class="error-container">
		<p class="error-message">Settings system not ready</p>
	</div>
{/if}

<style>
	.loading-container,
	.error-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		gap: 1rem;
		text-align: center;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid var(--color-border);
		border-top: 2px solid var(--color-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-message {
		color: var(--color-error);
		margin: 0;
	}

	button {
		padding: 0.5rem 1rem;
		background: var(--color-primary);
		color: var(--color-primary-fg);
		border: none;
		border-radius: var(--radius);
		cursor: pointer;
	}

	button:hover {
		background: var(--color-primary-hover);
	}
</style>