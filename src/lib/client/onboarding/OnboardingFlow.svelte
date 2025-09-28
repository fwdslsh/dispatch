<script>
	/**
	 * OnboardingFlow - Progressive onboarding component
	 * Implements step-by-step workflow for first-time users
	 * Follows constitutional requirement for minimal first experience
	 */

	import { goto } from '$app/navigation';
	import { useServiceContainer } from '../shared/services/ServiceContainer.svelte.js';
	import { OnboardingViewModel } from '../state/OnboardingViewModel.svelte.js';

	// Props
	const { onComplete = () => {}, onSkip = () => {} } = $props();

	// Get services from context
	const serviceContainer = useServiceContainer();

	// State for viewModel initialization
	let viewModel = $state(null);

	// Initialize ViewModel with async apiClient
	$effect(async () => {
		const apiClient = await serviceContainer.get('sessionApi');
		viewModel = new OnboardingViewModel(apiClient);
		await viewModel.loadState();
	});

	// Local state for form inputs
	let terminalKey = $state('');
	let confirmTerminalKey = $state('');
	let workspaceName = $state('My Project');
	let workspacePath = $state('/workspace/my-project');
	let autoCleanup = $state(true);
	let rememberWorkspace = $state(true);
	let isSettingUpAuth = $state(false);
	let authError = $state(null);

	// Handle authentication setup
	async function handleAuthentication() {
		// Validation
		if (!terminalKey.trim()) {
			authError = 'Please enter a terminal key';
			return;
		}

		if (terminalKey.length < 8) {
			authError = 'Terminal key must be at least 8 characters long';
			return;
		}

		if (terminalKey !== confirmTerminalKey) {
			authError = 'Terminal keys do not match';
			return;
		}

		isSettingUpAuth = true;
		authError = null;

		try {
			// Store the new terminal key in localStorage
			localStorage.setItem('dispatch-auth-key', terminalKey);
			localStorage.setItem('terminalKey', terminalKey);

			// Move to next step
			await handleStepComplete('workspace');
		} catch (error) {
			authError = 'Failed to set up authentication. Please try again.';
			console.error('Authentication setup error:', error);
		} finally {
			isSettingUpAuth = false;
		}
	}

	// Handle step completion
	async function handleStepComplete(step, data = {}) {
		if (!viewModel) return;
		try {
			await viewModel.updateStep(step, data);
		} catch (error) {
			console.error('Failed to complete step:', error);
		}
	}

	// Handle onboarding completion
	async function handleComplete(workspaceId) {
		if (!viewModel) return;
		try {
			await viewModel.complete(workspaceId);
			onComplete();

			// Mark onboarding as complete in localStorage
			localStorage.setItem('dispatch-onboarding-complete', 'true');

			// Redirect to workspace after completion
			await goto('/workspace');
		} catch (error) {
			console.error('Failed to complete onboarding:', error);
		}
	}

	// Skip onboarding (minimal approach)
	async function handleSkip() {
		onSkip();

		// Mark onboarding as complete even when skipping
		if (viewModel) {
			try {
				await viewModel.complete('default-workspace');
			} catch (error) {
				console.error('Failed to mark onboarding as complete:', error);
			}
		}

		// Redirect to workspace after skipping
		await goto('/workspace');
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
	{:else if viewModel.isComplete}
		<div class="flex flex-col items-center justify-center py-16">
			<h2 class="text-2xl font-bold text-success mb-2">🎉 Welcome to Dispatch!</h2>
			<p class="text-base-content/70">Your setup is complete. You can now start creating sessions and managing workspaces.</p>
		</div>
	{:else}
		<div class="bg-base-100 rounded-xl shadow-lg p-8 flex flex-col gap-8">
			<!-- Progress indicator -->
			<div class="w-full">
				<progress class="progress progress-primary w-full h-2" value={viewModel.progressPercentage} max="100"></progress>
				<div class="text-center text-xs text-base-content/60 mt-1">{viewModel.progressPercentage}% Complete</div>
			</div>

			<!-- Step content -->
			<div>
				{#if viewModel.currentStep === 'auth'}
					<div class="flex flex-col gap-6">
						<div>
							<h2 class="text-xl font-semibold mb-1">🔐 Authentication Setup</h2>
							<p class="text-base-content/70 mb-4">Create a secure terminal key to protect access to your Dispatch instance. This key will be used to authenticate all requests.</p>
							<div class="flex flex-col gap-3">
								<input
									type="password"
									placeholder="Create terminal key (min 8 characters)"
									class="input input-bordered w-full"
									bind:value={terminalKey}
									disabled={isSettingUpAuth}
								/>
								<input
									type="password"
									placeholder="Confirm terminal key"
									class="input input-bordered w-full"
									bind:value={confirmTerminalKey}
									disabled={isSettingUpAuth}
									onkeydown={(e) => e.key === 'Enter' && handleAuthentication()}
								/>
								{#if authError}
									<div class="alert alert-error text-sm mt-2" role="alert">
										{authError}
									</div>
								{/if}
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
							<button
								class="btn btn-primary"
								onclick={handleAuthentication}
								disabled={isSettingUpAuth || !terminalKey.trim() || !confirmTerminalKey.trim()}
							>
								{#if isSettingUpAuth}
									<span class="loading loading-spinner loading-xs mr-2"></span>
									Setting up...
								{:else}
									Continue to Workspace Setup
								{/if}
							</button>
							<button
								class="btn btn-ghost"
								onclick={handleSkip}
								disabled={isSettingUpAuth}
							>
								Skip Setup
							</button>
						</div>
					</div>
				{:else if viewModel.currentStep === 'workspace'}
					<div class="flex flex-col gap-6">
						<div>
							<h2 class="text-xl font-semibold mb-1">📁 Workspace Setup</h2>
							<p class="text-base-content/70 mb-4">Create your first workspace to organize your development projects.</p>
							<div class="flex flex-col gap-3">
								<input
									type="text"
									placeholder="Workspace name"
									class="input input-bordered w-full"
									bind:value={workspaceName}
								/>
								<input
									type="text"
									placeholder="Workspace path"
									class="input input-bordered w-full"
									bind:value={workspacePath}
								/>
							</div>
						</div>
						<div class="flex gap-3 justify-end mt-4">
							<button
								class="btn btn-primary"
								onclick={() => handleStepComplete('settings', { workspaceName, workspacePath })}
								disabled={viewModel.isLoading || !workspaceName || !workspacePath}
							>
								Create Workspace
							</button>
							<button
								class="btn btn-ghost"
								onclick={() => handleStepComplete('settings')}
							>
								Skip for Now
							</button>
						</div>
					</div>
				{:else if viewModel.currentStep === 'settings'}
					<div class="flex flex-col gap-6">
						<div>
							<h2 class="text-xl font-semibold mb-1">⚙️ Basic Settings</h2>
							<p class="text-base-content/70 mb-4">Configure essential settings for your Dispatch experience.</p>
							<div class="flex flex-col gap-2">
								<label class="label cursor-pointer justify-start gap-2">
									<input type="checkbox" class="checkbox checkbox-primary" bind:checked={autoCleanup} />
									<span class="label-text">Enable automatic cleanup of old sessions</span>
								</label>
								<label class="label cursor-pointer justify-start gap-2">
									<input type="checkbox" class="checkbox checkbox-primary" bind:checked={rememberWorkspace} />
									<span class="label-text">Remember last used workspace</span>
								</label>
							</div>
						</div>
						<div class="flex gap-3 justify-end mt-4">
							<button
								class="btn btn-primary"
								onclick={() => handleComplete('default-workspace')}
								disabled={viewModel.isLoading}
							>
								Complete Setup
							</button>
							<button
								class="btn btn-ghost"
								onclick={() => handleComplete('default-workspace')}
							>
								Use Defaults
							</button>
						</div>
					</div>
				{/if}
			</div>

			<!-- Loading indicator -->
			{#if viewModel.isLoading}
				<div class="flex items-center gap-2 mt-4">
					<span class="loading loading-spinner loading-xs text-primary"></span>
					<span class="text-base-content/70">Setting up...</span>
				</div>
			{/if}

			<!-- Error display -->
			{#if viewModel.error}
				<div class="alert alert-error mt-4" role="alert">
					<strong>Setup Error:</strong> {viewModel.error}
				</div>
			{/if}
		</div>
	{/if}
</div>


