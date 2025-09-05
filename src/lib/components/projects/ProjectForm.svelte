<!--
  ProjectForm - Create/edit form with validation (60-100 lines)
  Handles project creation and editing with real-time validation
-->
<script>
	import { Button, Input, ValidationMessage } from '../foundation/index.js';
	import StartSession from '../Icons/StartSession.svelte';

	// Props
	let { viewModel, onProjectCreated, onCancel } = $props();

	// Reactive state from ViewModel
	let formData = $derived(viewModel.formData);
	let formValidation = $derived(viewModel.formValidation);
	let nameValidation = $derived(viewModel.nameValidation);
	let canCreateProject = $derived(viewModel.canCreateProject);
	let loading = $derived(viewModel.loading);

	// Form submission
	async function handleSubmit() {
		if (!canCreateProject) return;

		try {
			const result = await viewModel.createProject();
			if (result && onProjectCreated) {
				onProjectCreated();
			}
		} catch (error) {
			// Error is handled in ViewModel
			console.error('Failed to create project:', error);
		}
	}

	// Handle Enter key
	function handleKeyDown(event) {
		if (event.key === 'Enter' && canCreateProject) {
			handleSubmit();
		}
	}

	// Cancel handler
	function handleCancel() {
		viewModel.clearForm();
		if (onCancel) {
			onCancel();
		}
	}
</script>

<form class="project-form" on:submit|preventDefault={handleSubmit}>
	<div class="form-fields">
		<div class="form-group">
			<Input
				label="Project Name"
				bind:value={formData.name}
				placeholder="Enter project name"
				required={true}
				invalid={!nameValidation.isValid}
				disabled={loading}
				onkeydown={handleKeyDown}
			/>
			
			{#if nameValidation.message}
				<ValidationMessage
					message={nameValidation.message}
					severity={nameValidation.severity}
				/>
			{/if}
		</div>

		<div class="form-group">
			<Input
				label="Description (optional)"
				bind:value={formData.description}
				placeholder="Enter project description"
				disabled={loading}
				onkeydown={handleKeyDown}
			/>
		</div>

		{#if !formValidation.isValid && formValidation.message}
			<ValidationMessage
				message={formValidation.message}
				severity="error"
			/>
		{/if}
	</div>

	<div class="form-actions">
		<Button
			type="button"
			variant="secondary"
			onclick={handleCancel}
			disabled={loading}
		>
			Cancel
		</Button>
		
		<Button
			type="submit"
			variant="primary"
			onclick={handleSubmit}
			disabled={!canCreateProject}
			loading={loading}
		>
			{#snippet icon()}
				{#if !loading}
					<StartSession />
				{/if}
			{/snippet}
			{loading ? 'Creating...' : 'Create Project'}
		</Button>
	</div>
</form>

<style>
	.project-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-lg);
		padding: var(--space-sm);
	}

	.form-fields {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-md);
		padding-top: var(--space-md);
		border-top: 1px solid rgba(0, 255, 136, 0.2);
	}

	@media (max-width: 480px) {
		.form-actions {
			flex-direction: column-reverse;
		}

		.form-actions :global(button) {
			width: 100%;
		}
	}
</style>