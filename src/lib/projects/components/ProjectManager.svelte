<!--
  ProjectManager - Smart container component with ViewModel integration (80-100 lines)
  Manages overall project state and coordinates child components
-->
<script>
	import { onMount } from 'svelte';
	import ProjectHeader from './ProjectHeader.svelte';
	import ProjectForm from './ProjectForm.svelte';
	import ProjectList from './ProjectList.svelte';
	import Modal from '$lib/shared/components/Modal.svelte';
	import ConfirmationDialog from '$lib/shared/components/ConfirmationDialog.svelte';
	import { ProjectViewModel } from './ProjectViewModel.svelte.js';
	import { ProjectClient } from '../io/ProjectClient.js';

	// Props
	let { terminalKey = '' } = $props();

	// State management
	let projectService;
	let viewModel;
	let io;

	// Reactive state (will be set after initialization)
	let projects = $state([]);
	let loading = $state(false);
	let error = $state(null);
	let showCreateForm = $state(false);
	let showDeleteDialog = $state(false);
	let projectToDelete = $state(null);

	// Initialize on mount
	onMount(async () => {
		try {
			// Initialize Socket.IO
			const { io: socketIO } = await import('socket.io-client');
			io = socketIO();

			// Initialize services and ViewModel
			projectService = new ProjectClient(io, { terminalKey });
			viewModel = new ProjectViewModel(projectService);

			// Set up reactive state bindings
			projects = viewModel.projects;
			loading = viewModel.loading;
			error = viewModel.error;
			showCreateForm = viewModel.showCreateForm;
			showDeleteDialog = viewModel.showDeleteDialog;
			projectToDelete = viewModel.projectToDelete;

			// Wait for connection and load projects
			await viewModel.loadProjects();
		} catch (err) {
			error = 'Initialization failed: ' + err.message;
		}

		// Cleanup on component destroy
		return () => {
			viewModel.dispose();
		};
	});

	// Event handlers
	function handleCreateProject() {
		if (viewModel) viewModel.toggleCreateForm();
	}

	function handleProjectCreated() {
		// Project creation is handled in viewModel.createProject()
		// This just closes any forms
		if (viewModel) viewModel.showCreateForm = false;
	}

	function handleProjectEdit(event) {
		const { projectId, currentName } = event.detail;
		if (viewModel) viewModel.startRenaming(projectId, currentName);
	}

	function handleProjectDelete(event) {
		const project = event.detail;
		if (viewModel) viewModel.confirmDeleteProject(project);
	}

	function handleProjectOpen(event) {
		const projectId = event.detail;
		if (viewModel) viewModel.openProject(projectId);
	}

	function handleConfirmDelete() {
		if (viewModel) viewModel.deleteProject();
	}

	function handleCancelDelete() {
		if (viewModel) viewModel.cancelDeleteProject();
	}
</script>

<div class="project-manager">
	<ProjectHeader onCreateProject={handleCreateProject} {loading} />

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
			open={showCreateForm}
			onClose={() => viewModel?.toggleCreateForm()}
		>
			<ProjectForm
				{viewModel}
				onProjectCreated={handleProjectCreated}
				onCancel={() => viewModel?.toggleCreateForm()}
			/>
			{#snippet footer()}
				<span></span>
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
