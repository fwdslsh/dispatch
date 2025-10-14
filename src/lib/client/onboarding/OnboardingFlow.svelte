<script>
	/**
	 * OnboardingFlow - Progressive onboarding component
	 * Implements step-by-step workflow for first-time users
	 * Follows constitutional requirement for minimal first experience
	 *
	 * NOTE: This component collects all onboarding data locally and submits
	 * it in a single atomic POST request at the end of the flow using SvelteKit form actions.
	 */

	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import { useServiceContainer } from '../shared/services/ServiceContainer.svelte.js';
	import { OnboardingViewModel } from './OnboardingViewModel.svelte.js';
	import Button from '../shared/components/Button.svelte';
	import ThemeSelectionStep from './ThemeSelectionStep.svelte';

	// Props
	let { onComplete = () => {} } = $props();

	// Get services from context
	const serviceContainer = useServiceContainer();

	// ViewModel instance (for local state management only)
	let viewModel = $state(null);

	// Initialize ViewModel with async apiClient
	onMount(async () => {
		const apiClient = await serviceContainer.get('sessionApi');
		viewModel = new OnboardingViewModel(apiClient);
	});

	// Handle navigation between steps
	function handleNextStep() {
		const validation = viewModel.validateCurrentStep();
		if (validation.valid) {
			viewModel.nextStep();
		}
	}

	function handlePreviousStep() {
		viewModel.previousStep();
	}

	// Form submission handler using SvelteKit's enhance
	function handleFormSubmit() {
		return async ({ result, update }) => {
			// Set loading state before submission
			viewModel.isLoading = true;
			viewModel.error = null;

			try {
				if (result.type === 'success') {
					console.log('[OnboardingFlow] Form submission success, result.data:', result.data);

					// Session cookie is set by the server during onboarding submission
					// Only store UI preference in localStorage
					localStorage.setItem('onboarding-complete', 'true');

					// Call parent's onComplete callback with form result
					// Pass data directly - parent function expects result as parameter, not event object
					onComplete(result.data);

					// DON'T call update() for successful onboarding
					// The page load function will redirect to / if onboarding is complete
					// We want to show the API key display first, so we skip update()
				} else if (result.type === 'failure') {
					console.log('[OnboardingFlow] Form submission failure:', result.data);
					// Handle error
					viewModel.error = result.data?.error || 'Onboarding failed';
					// Call update() for failures to show error state
					await update();
				}
			} finally {
				// Clear loading state after submission completes
				viewModel.isLoading = false;
			}
		};
	}
</script>

<div class="w-full max-w-xl mx-auto py-12" role="main" aria-label="Setup wizard">
	{#if !viewModel}
		<div class="flex flex-col items-center justify-center min-h-[200px]">
			<div class="mb-4">
				<span class="loading loading-spinner loading-lg text-primary"></span>
			</div>
			<span class="text-base-content/70">Loading...</span>
		</div>
	{:else if viewModel.currentStep === 'complete'}
		<div class="flex flex-col items-center justify-center py-16">
			<h2 class="text-2xl font-bold text-success mb-2">🎉 Welcome to Dispatch!</h2>
			<p class="text-base-content/70">Your setup is complete. Redirecting to your workspace...</p>
		</div>
	{:else}
		<div class="bg-base-100 rounded-xl shadow-lg p-8 flex flex-col gap-8">
			<!-- Progress indicator -->
			<div class="w-full">
				<progress
					class="progress progress-primary w-full h-2"
					value={viewModel.progressPercentage}
					max="100"
				></progress>
				<div class="text-center text-xs text-base-content/60 mt-1">
					{viewModel.progressPercentage}% Complete
				</div>
			</div>

			<!-- Step content -->
			<div>
				{#if viewModel.currentStep === 'workspace'}
					<div class="flex flex-col gap-6">
						<div>
							<h2 class="text-xl font-semibold mb-1">📁 Workspace Setup</h2>
							<p class="text-base-content/70 mb-4">
								Create your first workspace to organize your development projects. This step is
								optional - you can create workspaces later.
							</p>
							<div class="flex flex-col gap-3">
								<input
									type="text"
									placeholder="Workspace name (e.g., My Project)"
									class="input input-bordered w-full"
									bind:value={viewModel.formData.workspaceName}
									oninput={(e) =>
										viewModel.updateFormData(
											'workspaceName',
											/** @type {HTMLInputElement} */ (e.target).value
										)}
									disabled={viewModel.isLoading}
								/>
								<input
									type="text"
									placeholder="Workspace path (auto-generated)"
									class="input input-bordered w-full"
									bind:value={viewModel.formData.workspacePath}
									disabled={viewModel.isLoading}
									readonly
								/>
							</div>
						</div>
						<div class="flex gap-3 justify-end mt-4">
							<Button variant="primary" onclick={handleNextStep} disabled={viewModel.isLoading}>
								{viewModel.formData.workspaceName ? 'Continue' : 'Skip Workspace'}
							</Button>
						</div>
					</div>
				{:else if viewModel.currentStep === 'theme'}
					<ThemeSelectionStep {viewModel} onNext={handleNextStep} onSkip={handleNextStep} />
				{:else if viewModel.currentStep === 'settings'}
					<form method="POST" action="?/submit" use:enhance={handleFormSubmit}>
						<div class="flex flex-col gap-6">
							<div>
								<h2 class="text-xl font-semibold mb-1">⚙️ Basic Settings</h2>
								<p class="text-base-content/70 mb-4">
									Configure essential settings for your Dispatch experience. These can be changed
									later in the settings page.
								</p>

								<!-- Hidden fields for workspace data -->
								{#if viewModel.formData.workspaceName}
									<input
										type="hidden"
										name="workspaceName"
										value={viewModel.formData.workspaceName}
									/>
									<input
										type="hidden"
										name="workspacePath"
										value={viewModel.formData.workspacePath}
									/>
								{/if}

								<!-- Hidden field for selected theme -->
								{#if viewModel.formData.selectedTheme}
									<input
										type="hidden"
										name="selectedTheme"
										value={viewModel.formData.selectedTheme}
									/>
								{/if}

								<!-- Hidden field for preferences -->
								<input
									type="hidden"
									name="preferences"
									value={JSON.stringify(viewModel.formData.preferences)}
								/>

								<div class="flex flex-col gap-2">
									<label class="label cursor-pointer justify-start gap-2">
										<input
											type="checkbox"
											class="checkbox checkbox-primary"
											checked={viewModel.formData.preferences.autoCleanup !== false}
											onchange={(e) => {
												viewModel.formData.preferences.autoCleanup =
													/** @type {HTMLInputElement} */ (e.target).checked;
											}}
										/>
										<span class="label-text">Enable automatic cleanup of old sessions</span>
									</label>
									<label class="label cursor-pointer justify-start gap-2">
										<input
											type="checkbox"
											class="checkbox checkbox-primary"
											checked={viewModel.formData.preferences.rememberWorkspace !== false}
											onchange={(e) => {
												viewModel.formData.preferences.rememberWorkspace =
													/** @type {HTMLInputElement} */ (e.target).checked;
											}}
										/>
										<span class="label-text">Remember last used workspace</span>
									</label>
								</div>
							</div>
							<div class="flex gap-3 justify-end mt-4">
								<Button
									variant="ghost"
									onclick={handlePreviousStep}
									disabled={viewModel.isLoading}
									type="button"
								>
									Back
								</Button>
								<Button
									variant="primary"
									type="submit"
									disabled={viewModel.isLoading}
									loading={viewModel.isLoading}
								>
									{#if viewModel.isLoading}
										Completing Setup...
									{:else}
										Complete Setup
									{/if}
								</Button>
							</div>
						</div>
					</form>
				{/if}
			</div>

			<!-- Error display -->
			{#if viewModel.error}
				<div class="alert alert-error mt-4" role="alert">
					<strong>Setup Error:</strong>
					{viewModel.error}
				</div>
			{/if}
		</div>
	{/if}
</div>
