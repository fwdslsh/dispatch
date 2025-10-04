<script>
	/**
	 * OnboardingFlow - Progressive o			// Store authentication in localStorage after successful submission
		if (viewModel.formData.terminalKey) {
			localStorage.setItem('dispatch-auth-token', viewModel.formData.terminalKey);
		}
		localStorage.setItem('onboarding-complete', 'true');

		// Call parent's onComplete callback
		onComplete({ detail: result });

		// Redirect to main workspace
		await goto('/');
	} catch (error) {auth data for immediate use
			localStorage.setItem('dispatch-auth-token', viewModel.formData.terminalKey);oarding component
	 * Implements step-by-step workflow for first-time users
	 * Follows constitutional requirement for minimal first experience
	 *
	 * NOTE: This component collects all onboarding data locally and submits
	 * it in a single atomic POST request at the end of the flow.
	 */

	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { useServiceContainer } from '../shared/services/ServiceContainer.svelte.js';
	import { OnboardingViewModel } from './OnboardingViewModel.svelte.js';
	import Button from '../shared/components/Button.svelte';
	import ThemeSelectionStep from './ThemeSelectionStep.svelte';

	// Props
	let { onComplete = () => {}, onSkip = () => {} } = $props();

	// Get services from context
	const serviceContainer = useServiceContainer();

	// ViewModel instance
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

	// Handle final submission
	async function handleSubmit() {
		try {
			const result = await viewModel.submit();

			// Store authentication in localStorage after successful submission
			if (viewModel.formData.terminalKey) {
				localStorage.setItem('dispatch-auth-token', viewModel.formData.terminalKey);
			}
			localStorage.setItem('onboarding-complete', 'true');

			// Call parent's onComplete callback
			onComplete({ detail: result });

			// Redirect to main workspace
			await goto('/');
		} catch (error) {
			console.error('Onboarding submission failed:', error);
			// Error is already set in viewModel.error
		}
	}

	// Skip onboarding (minimal approach)
	async function handleSkip() {
		onSkip();
		await goto('/');
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
				{#if viewModel.currentStep === 'auth'}
					<div class="flex flex-col gap-6">
						<div>
							<h2 class="text-xl font-semibold mb-1">🔐 Authentication Setup</h2>
							<p class="text-base-content/70 mb-4">
								Create a secure terminal key to protect access to your Dispatch instance. This key
								will be used to authenticate all requests.
							</p>
							<div class="flex flex-col gap-3">
								<input
									type="password"
									placeholder="Create terminal key (min 8 characters)"
									class="input input-bordered w-full"
									bind:value={viewModel.formData.terminalKey}
									oninput={(e) => viewModel.updateFormData('terminalKey', e.target.value)}
									disabled={viewModel.isLoading}
								/>
								<input
									type="password"
									placeholder="Confirm terminal key"
									class="input input-bordered w-full"
									bind:value={viewModel.formData.confirmTerminalKey}
									oninput={(e) => viewModel.updateFormData('confirmTerminalKey', e.target.value)}
									disabled={viewModel.isLoading}
									onkeydown={(e) =>
										e.key === 'Enter' && viewModel.canProceedFromAuth && handleNextStep()}
								/>
								<div class="bg-base-200 rounded p-3 text-xs mt-2">
									<div class="font-semibold mb-1">Tips for a strong terminal key:</div>
									<ul class="list-disc pl-5 space-y-1">
										<li>Use at least 8 characters</li>
										<li>Include letters, numbers, and symbols</li>
										<li>Keep it private and secure</li>
									</ul>
								</div>
							</div>
						</div>
						<div class="flex gap-3 justify-end mt-4">
							<Button
								variant="primary"
								onclick={handleNextStep}
								disabled={viewModel.isLoading || !viewModel.canProceedFromAuth}
							>
								Continue to Workspace Setup
							</Button>
							<Button variant="ghost" onclick={handleSkip} disabled={viewModel.isLoading}>
								Skip Setup
							</Button>
						</div>
					</div>
				{:else if viewModel.currentStep === 'workspace'}
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
									oninput={(e) => viewModel.updateFormData('workspaceName', e.target.value)}
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
							<Button variant="ghost" onclick={handlePreviousStep} disabled={viewModel.isLoading}>
								Back
							</Button>
							<Button variant="primary" onclick={handleNextStep} disabled={viewModel.isLoading}>
								{viewModel.formData.workspaceName ? 'Continue' : 'Skip Workspace'}
							</Button>
						</div>
					</div>
				{:else if viewModel.currentStep === 'theme'}
					<ThemeSelectionStep onNext={handleNextStep} onSkip={handleNextStep} />
				{:else if viewModel.currentStep === 'settings'}
					<div class="flex flex-col gap-6">
						<div>
							<h2 class="text-xl font-semibold mb-1">⚙️ Basic Settings</h2>
							<p class="text-base-content/70 mb-4">
								Configure essential settings for your Dispatch experience. These can be changed
								later in the settings page.
							</p>
							<div class="flex flex-col gap-2">
								<label class="label cursor-pointer justify-start gap-2">
									<input
										type="checkbox"
										class="checkbox checkbox-primary"
										checked={viewModel.formData.preferences.autoCleanup !== false}
										onchange={(e) => {
											viewModel.formData.preferences.autoCleanup = e.target.checked;
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
											viewModel.formData.preferences.rememberWorkspace = e.target.checked;
										}}
									/>
									<span class="label-text">Remember last used workspace</span>
								</label>
							</div>
						</div>
						<div class="flex gap-3 justify-end mt-4">
							<Button variant="ghost" onclick={handlePreviousStep} disabled={viewModel.isLoading}>
								Back
							</Button>
							<Button
								variant="primary"
								onclick={handleSubmit}
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
