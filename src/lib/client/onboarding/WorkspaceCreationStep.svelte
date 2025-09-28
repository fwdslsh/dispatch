<script>
	/**
	 * WorkspaceCreationStep - Second step in onboarding workflow
	 * Handles first workspace creation for new users
	 * Part of progressive onboarding system
	 */

	import { getContext } from 'svelte';

	// Props
	export let onComplete = () => {};
	export let onSkip = () => {};

	// Get services from context
	const serviceContainer = getContext('services');
	const apiClient = serviceContainer?.get('apiClient');

	// Local state
	let workspaceName = 'My First Project';
	let workspacePath = '/workspace/my-first-project';
	let isCreating = false;
	let error = null;
	let successWorkspace = null;

	// Validation
	$: isValidName = workspaceName.trim().length > 0;
	$: isValidPath = workspacePath.trim().length > 0 && workspacePath.startsWith('/');
	$: canCreate = isValidName && isValidPath && !isCreating;

	// Handle workspace creation
	async function handleCreateWorkspace() {
		if (!canCreate) return;

		isCreating = true;
		error = null;

		try {
			if (!apiClient) {
				throw new Error('API client not available');
			}

			// Get auth key from storage
			const authKey = localStorage.getItem('dispatch-auth-key');
			if (!authKey) {
				throw new Error('Authentication required');
			}

			// Create workspace via API
			const response = await fetch('/api/workspaces', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: workspaceName.trim(),
					path: workspacePath.trim(),
					authKey
				})
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to create workspace');
			}

			const workspace = await response.json();
			successWorkspace = workspace;

			// Complete the step
			onComplete({
				workspace,
				workspaceName: workspaceName.trim(),
				workspacePath: workspacePath.trim()
			});

		} catch (err) {
			error = err.message || 'Failed to create workspace';
		} finally {
			isCreating = false;
		}
	}

	// Skip workspace creation
	function handleSkipWorkspace() {
		onSkip();
	}

	// Generate workspace path from name
	function generatePath() {
		const safeName = workspaceName
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.trim();

		if (safeName) {
			workspacePath = `/workspace/${safeName}`;
		}
	}

	// Auto-generate path when name changes
	$: if (workspaceName) {
		generatePath();
	}
</script>

<div class="workspace-step" role="main" aria-label="Workspace Creation">
	<div class="step-header">
		<h2>📁 Create Your First Workspace</h2>
		<p>Set up a workspace to organize your development projects</p>
	</div>

	{#if !successWorkspace}
		<div class="workspace-form">
			<div class="form-group">
				<label for="workspace-name" class="form-label">
					Workspace Name
					<span class="form-help">A friendly name for your project</span>
				</label>
				<input
					id="workspace-name"
					type="text"
					class="form-input"
					class:error={!isValidName && workspaceName.length > 0}
					bind:value={workspaceName}
					placeholder="e.g., My First Project"
					disabled={isCreating}
				/>
				{#if !isValidName && workspaceName.length > 0}
					<div class="error-text">Workspace name is required</div>
				{/if}
			</div>

			<div class="form-group">
				<label for="workspace-path" class="form-label">
					Workspace Path
					<span class="form-help">Directory path where your project will be located</span>
				</label>
				<input
					id="workspace-path"
					type="text"
					class="form-input"
					class:error={!isValidPath && workspacePath.length > 0}
					bind:value={workspacePath}
					placeholder="/workspace/my-project"
					disabled={isCreating}
				/>
				{#if !isValidPath && workspacePath.length > 0}
					<div class="error-text">Path must start with / and be valid</div>
				{/if}
			</div>

			{#if error}
				<div class="error-message" role="alert">
					<strong>Error:</strong> {error}
				</div>
			{/if}

			<div class="form-actions">
				<button
					class="btn btn-primary"
					onclick={handleCreateWorkspace}
					disabled={!canCreate}
				>
					{#if isCreating}
						Creating Workspace...
					{:else}
						Create Workspace
					{/if}
				</button>

				<button
					class="btn btn-secondary"
					onclick={handleSkipWorkspace}
					disabled={isCreating}
				>
					Skip for Now
				</button>
			</div>

			<div class="info-box">
				<h4>💡 What is a workspace?</h4>
				<ul>
					<li>A workspace organizes your project files and sessions</li>
					<li>You can create terminal and Claude sessions within a workspace</li>
					<li>Switch between workspaces to work on different projects</li>
					<li>You can always create more workspaces later</li>
				</ul>
			</div>
		</div>
	{:else}
		<div class="success-state">
			<div class="success-icon">🎉</div>
			<h3>Workspace Created Successfully!</h3>
			<div class="workspace-details">
				<p><strong>Name:</strong> {successWorkspace.name}</p>
				<p><strong>Path:</strong> {successWorkspace.path}</p>
			</div>
			<p>Your workspace is ready for development</p>
		</div>
	{/if}

	{#if isCreating}
		<div class="loading-indicator">
			<div class="spinner"></div>
			<span>Setting up your workspace...</span>
		</div>
	{/if}
</div>

<style>
	.workspace-step {
		max-width: 600px;
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

	.workspace-form {
		background: white;
		border-radius: 8px;
		padding: 2rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-label {
		display: block;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
	}

	.form-help {
		display: block;
		font-size: 0.875rem;
		font-weight: normal;
		color: #6b7280;
		margin-top: 0.25rem;
	}

	.form-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
		transition: border-color 0.2s;
		box-sizing: border-box;
	}

	.form-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.form-input.error {
		border-color: #dc2626;
	}

	.form-input:disabled {
		background-color: #f9fafb;
		cursor: not-allowed;
	}

	.error-text {
		color: #dc2626;
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.error-message {
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		color: #dc2626;
		padding: 1rem;
		border-radius: 6px;
		margin-bottom: 1.5rem;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		margin-bottom: 2rem;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		min-width: 140px;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #2563eb;
	}

	.btn-secondary {
		background-color: #e5e7eb;
		color: #374151;
	}

	.btn-secondary:hover:not(:disabled) {
		background-color: #d1d5db;
	}

	.info-box {
		background-color: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 6px;
		padding: 1.5rem;
	}

	.info-box h4 {
		margin: 0 0 1rem 0;
		color: #0369a1;
		font-size: 1rem;
	}

	.info-box ul {
		margin: 0;
		padding-left: 1.5rem;
		color: #0c4a6e;
	}

	.info-box li {
		margin-bottom: 0.5rem;
		line-height: 1.5;
	}

	.success-state {
		background: white;
		border-radius: 8px;
		padding: 3rem 2rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
		text-align: center;
	}

	.success-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.success-state h3 {
		margin: 0 0 1rem 0;
		color: #16a34a;
		font-size: 1.5rem;
	}

	.workspace-details {
		background-color: #f9fafb;
		border-radius: 6px;
		padding: 1rem;
		margin: 1rem 0;
		text-align: left;
	}

	.workspace-details p {
		margin: 0.5rem 0;
		color: #374151;
	}

	.success-state > p {
		margin: 0;
		color: #6b7280;
		font-size: 1.125rem;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		margin-top: 2rem;
		color: #6b7280;
	}

	.spinner {
		width: 20px;
		height: 20px;
		border: 2px solid #e5e7eb;
		border-top: 2px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	/* Responsive design */
	@media (max-width: 640px) {
		.workspace-step {
			padding: 1rem;
		}

		.workspace-form {
			padding: 1.5rem;
		}

		.form-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}
	}
</style>