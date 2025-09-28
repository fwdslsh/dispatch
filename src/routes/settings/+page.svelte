<script>
	/**
	 * Settings page - User preferences and configuration management
	 * Provides comprehensive settings interface including:
	 * - User interface preferences
	 * - Authentication settings
	 * - Workspace configuration
	 * - Terminal preferences
	 * - Data retention policies
	 */

	import { onMount, setContext } from 'svelte';
	import { goto } from '$app/navigation';
	import PreferencesPanel from '$lib/client/settings/PreferencesPanel.svelte';
	import RetentionSettings from '$lib/client/settings/RetentionSettings.svelte';
	import { useServiceContainer, provideServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import WorkspaceHeader from '$lib/client/shared/components/workspace/WorkspaceHeader.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import IconUser from '$lib/client/shared/components/Icons/IconUser.svelte';
	import IconArchive from '$lib/client/shared/components/Icons/IconArchive.svelte';

	// State management
	let currentSection = $state('preferences'); // 'preferences', 'retention'
	let isLoading = $state(true);
	let error = $state(null);
	let savedMessage = $state(null);

	// Service container
	let serviceContainer = $state(null);

	onMount(async () => {
		try {
			// Try to get existing service container, or create a new one
			try {
				serviceContainer = useServiceContainer();
			} catch {
				// No service container found, create one
				serviceContainer = provideServiceContainer({
					apiBaseUrl: '',
					authTokenKey: 'terminalKey',
					debug: false
				});
			}

			// Provide context for child components
			setContext('services', serviceContainer);

			isLoading = false;
		} catch (err) {
			console.error('Failed to initialize settings:', err);
			error = 'Failed to load settings system';
			isLoading = false;
		}
	});

	/**
	 * Handle navigation back to main app
	 */
	async function handleGoBack() {
		await goto('/workspace');
	}

	/**
	 * Handle logout action
	 */
	async function handleLogout() {
		localStorage.removeItem('dispatch-auth-key');
		await goto('/');
	}

	/**
	 * Handle preferences save
	 * @param {object} preferences - Saved preferences
	 */
	function handlePreferencesSave(preferences) {
		savedMessage = 'Preferences saved successfully';
		// Clear message after 3 seconds
		setTimeout(() => {
			savedMessage = null;
		}, 3000);
	}

	/**
	 * Handle retention policy save
	 * @param {object} policy - Saved retention policy
	 */
	function handleRetentionSave(policy) {
		savedMessage = 'Retention policy saved successfully';
		// Clear message after 3 seconds
		setTimeout(() => {
			savedMessage = null;
		}, 3000);
	}

	/**
	 * Handle section change
	 * @param {string} section - New section to display
	 */
	function changeSection(section) {
		currentSection = section;
		error = null;
		savedMessage = null;
	}
</script>

<svelte:head>
	<title>Settings - Dispatch</title>
	<meta name="description" content="Configure your Dispatch preferences, authentication, and data retention settings." />
</svelte:head>

<div class="dispatch-workspace">
	<!-- Use main application header -->
	<WorkspaceHeader onLogout={handleLogout} />

	<!-- Main Content -->
	<main class="main-content">
		{#if isLoading}
			<div class="loading-container">
				<div class="spinner"></div>
				<p>Loading settings...</p>
			</div>
		{:else if error}
			<div class="error-container">
				<h2>Settings Error</h2>
				<p class="error-message">{error}</p>
			</div>
		{:else}
			<div class="settings-page">
				<!-- Success Message -->
				{#if savedMessage}
					<div class="success-message" role="alert">
						{savedMessage}
					</div>
				{/if}

				<!-- Navigation Tabs -->
				<div class="tab-buttons" role="tablist" aria-label="Settings tabs">
					<Button
						variant="ghost"
						augmented="none"
						class={currentSection === 'preferences' ? 'active' : ''}
						onclick={() => changeSection('preferences')}
						role="tab"
						aria-selected={currentSection === 'preferences'}
						aria-controls="preferences-panel"
					>
						{#snippet icon()}<IconUser size={16} />{/snippet}
						{#snippet children()}User Preferences{/snippet}
					</Button>
					<Button
						variant="ghost"
						augmented="none"
						class={currentSection === 'retention' ? 'active' : ''}
						onclick={() => changeSection('retention')}
						role="tab"
						aria-selected={currentSection === 'retention'}
						aria-controls="retention-panel"
					>
						{#snippet icon()}<IconArchive size={16} />{/snippet}
						{#snippet children()}Data Retention{/snippet}
					</Button>
				</div>

				<!-- Content Sections -->
				<div class="settings-content">
					{#if currentSection === 'preferences'}
						<div id="preferences-panel" role="tabpanel" aria-labelledby="preferences-tab">
							<PreferencesPanel onSave={handlePreferencesSave} />
						</div>
					{:else if currentSection === 'retention'}
						<div id="retention-panel" role="tabpanel" aria-labelledby="retention-tab">
							<RetentionSettings onSave={handleRetentionSave} />
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	/* Match WorkspacePage grid layout */
	.dispatch-workspace {
		position: relative;
		height: 100vh;
		height: 100dvh;
		display: grid;
		grid-template-columns: 1fr;
		grid-template-rows: min-content 1fr;
		grid-template-areas:
			'header'
			'main';
		background: transparent;
		color: var(--text-primary);
		overflow: hidden;
		max-width: 100svw;
		width: 100%;
		transition: grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1);
		overscroll-behavior: none;
		touch-action: pan-x pan-y;
	}

	/* Background image overlay like WorkspacePage */
	.dispatch-workspace::before {
		content: '';
		position: absolute;
		inset: 0;
		opacity: 0.09;
		background-image: url('/fwdslsh-green-bg.png');
		background-repeat: no-repeat;
		background-position: center center;
		background-size: contain;
		pointer-events: none;
	}

	/* Main content area */
	.main-content {
		grid-area: main;
		overflow: hidden;
		position: relative;
		min-width: 0;
		overscroll-behavior: none;
		touch-action: pan-x pan-y;
	}

	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		height: 100%;
	}

	.spinner {
		width: 24px;
		height: 24px;
		border: 2px solid currentColor;
		border-top: 2px solid transparent;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.settings-page {
		height: 100%;
		overflow-y: auto;
		padding: 2rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.tab-buttons {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
	}
</style>
