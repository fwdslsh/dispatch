<!--
  ProjectManager - Smart container component with ViewModel integration (80-100 lines)
  Manages overall project state and coordinates child components
-->
<script>
	import { onMount } from 'svelte';
	import { ProjectViewModel } from '../../viewmodels/ProjectViewModel.svelte.js';
	import { ProjectService } from '../../services/ProjectService.js';
	import ProjectHeader from './ProjectHeader.svelte';
	import ProjectForm from './ProjectForm.svelte';
	import ProjectList from './ProjectList.svelte';
	import { Modal } from '../foundation/index.js';
	import ConfirmationDialog from '../ConfirmationDialog.svelte';

	// Props
	let { terminalKey = '' } = $props();

	// Initialize services and ViewModel
	const projectService = new ProjectService();
	const viewModel = new ProjectViewModel(projectService);

	// Reactive state from ViewModel
	let projects = $derived(viewModel.projects);
	let loading = $derived(viewModel.loading);
	let error = $derived(viewModel.error);
	let showCreateForm = $derived(viewModel.showCreateForm);
	let showDeleteDialog = $derived(viewModel.showDeleteDialog);
	let projectToDelete = $derived(viewModel.projectToDelete);

	// Initialize on mount
	onMount(async () => {
		try {
			// Initialize service connection
			const connected = await projectService.initialize();
			
			if (connected) {
				// Load initial projects
				await viewModel.loadProjects();
			} else {
				viewModel.setError('Failed to connect to server');
			}
		} catch (err) {
			viewModel.setError('Initialization failed: ' + err.message);
		}

		// Cleanup on component destroy
		return () => {
			viewModel.dispose();
		};
	});

	// Event handlers
	function handleCreateProject() {
		viewModel.toggleCreateForm();
	}

	function handleProjectCreated() {
		// Project creation is handled in viewModel.createProject()
		// This just closes any forms
		viewModel.showCreateForm = false;
	}

	function handleProjectEdit(event) {
		const { projectId, currentName } = event.detail;
		viewModel.startRenaming(projectId, currentName);
	}

	function handleProjectDelete(event) {
		const project = event.detail;
		viewModel.confirmDeleteProject(project);
	}

	function handleProjectOpen(event) {
		const projectId = event.detail;
		viewModel.openProject(projectId);
	}

	function handleConfirmDelete() {
		viewModel.deleteProject();
	}

	function handleCancelDelete() {
		viewModel.cancelDeleteProject();
	}
</script>

<div class="project-manager">
	<ProjectHeader 
		onCreateProject={handleCreateProject}
		{loading}
	/>

	{#if error}
		<div class="error-message">
			{error}
		</div>
	{/if}

	<div class="project-content">
		<ProjectList 
			{projects}
			{loading}
			{viewModel}
			onProjectEdit={handleProjectEdit}
			onProjectDelete={handleProjectDelete}
			onProjectOpen={handleProjectOpen}
		/>
	</div>

	<!-- Create Project Modal -->
	{#if showCreateForm}
		<Modal 
			title="Create New Project" 
			show={showCreateForm}
			onClose={() => viewModel.toggleCreateForm()}
		>
			{#snippet children()}
				<ProjectForm 
					{viewModel}
					onProjectCreated={handleProjectCreated}
					onCancel={() => viewModel.toggleCreateForm()}
				/>
			{/snippet}
		</Modal>
	{/if}

	<!-- Delete Confirmation Dialog -->
	<ConfirmationDialog
		bind:show={showDeleteDialog}
		title="Delete Project"
		message="Are you sure you want to delete '{projectToDelete?.name}'? This will remove all sessions and data in this project."
		confirmText="Delete"
		cancelText="Cancel"
		dangerous={true}
		onconfirm={handleConfirmDelete}
		oncancel={handleCancelDelete}
	/>
</div>

<style>
	.project-manager {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 100vh;
	}

	.project-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: row;
	}

	.error-message {
		padding: var(--space-md);
		background: rgba(255, 99, 99, 0.1);
		color: var(--error);
		border: 1px solid rgba(255, 99, 99, 0.3);
		border-radius: 6px;
		margin: var(--space-sm) var(--space-md);
	}

	@media (max-width: 768px) {
		.project-content {
			flex-direction: column;
		}
	}
</style>