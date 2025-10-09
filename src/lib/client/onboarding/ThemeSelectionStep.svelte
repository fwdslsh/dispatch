<script>
	/**
	 * ThemeSelectionStep - Theme selection step in onboarding workflow
	 * Displays preset themes with previews and allows user to select one
	 * Sets selected theme as global default (optional step)
	 */

	import { onMount } from 'svelte';
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import ThemePreviewCard from '$lib/client/settings/ThemePreviewCard.svelte';
	import Button from '../shared/components/Button.svelte';

	// Props
	let { viewModel, onNext = () => {}, onSkip = () => {} } = $props();

	// Get service container at component initialization
	const serviceContainer = useServiceContainer();

	// Theme state management
	let themeState = $state(null);
	let selectedThemeId = $state('phosphor-green'); // Default selection
	let isActivating = $state(false);

	// Load themes on mount
	onMount(async () => {
		try {
			// Get themeState from ServiceContainer
			const themeStatePromise = serviceContainer.get('themeState');
			themeState = await (typeof themeStatePromise?.then === 'function'
				? themeStatePromise
				: Promise.resolve(themeStatePromise));

			if (themeState) {
				await themeState.loadThemes();
				// Set default selection to first preset theme if available
				if (themeState.presetThemes.length > 0 && !selectedThemeId) {
					selectedThemeId = themeState.presetThemes[0].id;
				}
			}
		} catch (error) {
			console.error('Failed to load themes:', error);
		}
	});

	// Handle theme selection
	function handleThemeSelect(themeId) {
		selectedThemeId = themeId;
		// Update viewModel formData so theme is included in form submission
		if (viewModel) {
			viewModel.formData.selectedTheme = themeId;
		}
	}

	// Handle continue with selected theme
	async function handleContinue() {
		// Update viewModel with selected theme
		if (selectedThemeId && viewModel) {
			viewModel.formData.selectedTheme = selectedThemeId;
		}

		// Also store in localStorage as backup
		// The theme will be applied after authentication is complete
		if (selectedThemeId) {
			localStorage.setItem('onboarding-selected-theme', selectedThemeId);
		}

		// Continue to next step without activating theme
		// (activation requires auth which user doesn't have yet during onboarding)
		onNext();
	}

	// Handle skip (keep default phosphor-green theme)
	function handleSkip() {
		onSkip();
	}
</script>

<div class="theme-selection-step" role="main" aria-label="Theme Selection">
	<div class="step-header">
		<h2>🎨 Choose Your Theme</h2>
		<p>Select a color theme for your Dispatch workspace</p>
	</div>

	{#if !themeState}
		<div class="loading-state">
			<div class="spinner"></div>
			<span>Initializing theme system...</span>
		</div>
	{:else if themeState.loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<span>Loading themes...</span>
		</div>
	{:else if themeState.error}
		<div class="error-state" role="alert">
			<p>Failed to load themes: {themeState.error}</p>
			<Button variant="secondary" onclick={handleSkip} text="Continue with Default Theme" />
		</div>
	{:else if themeState.presetThemes.length > 0}
		<div class="theme-grid">
			{#each themeState.presetThemes as theme (theme.id)}
				<div
					class="theme-option"
					class:selected={selectedThemeId === theme.id}
					onclick={() => handleThemeSelect(theme.id)}
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleThemeSelect(theme.id)}
					role="button"
					tabindex="0"
					aria-pressed={selectedThemeId === theme.id}
					aria-label={`Select ${theme.name} theme`}
				>
					<ThemePreviewCard
						{theme}
						isActive={selectedThemeId === theme.id}
						onActivate={() => handleThemeSelect(theme.id)}
						canDelete={false}
					/>
				</div>
			{/each}
		</div>

		<div class="actions">
			<Button
				variant="primary"
				onclick={handleContinue}
				disabled={isActivating}
				loading={isActivating}
			>
				{#if isActivating}
					Applying Theme...
				{:else}
					Continue with Selected Theme
				{/if}
			</Button>
			<Button
				variant="secondary"
				onclick={handleSkip}
				disabled={isActivating}
				text="Skip (use default)"
			/>
		</div>
	{:else}
		<div class="error-state">
			<p>No themes available. Continuing with default theme.</p>
			<Button variant="primary" onclick={handleSkip} text="Continue" />
		</div>
	{/if}

	{#if themeState?.error && !themeState?.loading}
		<div class="error-message" role="alert">
			{themeState.error}
		</div>
	{/if}
</div>

<style>
	.theme-selection-step {
		max-width: 1100px;
		margin: 0 auto;
		padding: 2rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.step-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.step-header h2 {
		margin: 0 0 0.5rem 0;
		color: #1f2937;
		font-size: 1.75rem;
	}

	.step-header p {
		margin: 0;
		color: #6b7280;
		font-size: 1.125rem;
	}

	.theme-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.theme-option {
		cursor: pointer;
		transition:
			transform 0.2s ease,
			box-shadow 0.2s ease;
		border-radius: var(--radius-md);
		outline-offset: var(--space-1);
	}

	.theme-option:hover {
		transform: translateY(-4px);
	}

	.theme-option:focus {
		outline: 2px solid #3b82f6;
	}

	.theme-option.selected {
		outline: 3px solid #3b82f6;
		outline-offset: var(--space-1);
	}

	.actions {
		display: flex;
		gap: 1rem;
		justify-content: center;
		margin-top: 2rem;
		flex-wrap: wrap;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 4rem 2rem;
		gap: 1rem;
	}

	.spinner {
		width: var(--space-6);
		height: var(--space-6);
		border: 3px solid #e5e7eb;
		border-top: 3px solid #3b82f6;
		border-radius: var(--radius-full);
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

	.loading-state span {
		color: #6b7280;
		font-size: var(--font-size-2);
	}

	.error-state {
		text-align: center;
		padding: 2rem;
		background: #fee;
		border: 1px solid #fcc;
		border-radius: var(--radius-md);
	}

	.error-state p {
		margin: 0 0 1rem 0;
		color: #dc2626;
	}

	.error-message {
		margin-top: 1rem;
		padding: 1rem;
		background: #fee;
		border: 1px solid #fcc;
		border-radius: var(--radius-sm);
		color: #dc2626;
		text-align: center;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.theme-selection-step {
			padding: 1rem;
		}

		.theme-grid {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.actions {
			flex-direction: column;
			width: 100%;
		}

		.actions :global(button) {
			width: 100%;
		}
	}

	/* Accessibility: Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.theme-option {
			transition: none;
		}

		.theme-option:hover {
			transform: none;
		}

		.spinner {
			animation: none;
		}
	}

	/* Accessibility: High contrast mode */
	@media (prefers-contrast: high) {
		.theme-option.selected {
			outline-width: var(--space-1);
		}

		.step-header h2,
		.step-header p {
			color: inherit;
		}
	}
</style>
