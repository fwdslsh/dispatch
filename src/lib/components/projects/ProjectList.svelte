<!--
  ProjectList - Pure presentation component for project listing (80-120 lines)
  Displays list of projects with empty state handling
-->
<script>
	import { LoadingSpinner } from '../foundation/index.js';
	import ProjectCard from './ProjectCard.svelte';

	// Props
	let { 
		projects = [], 
		loading = false, 
		viewModel,
		onProjectEdit, 
		onProjectDelete, 
		onProjectOpen 
	} = $props();

	// Derived state
	let hasProjects = $derived(projects.length > 0);
	let projectsWithSessionCount = $derived(viewModel ? viewModel.projectsWithSessionCount : projects);

	// Event handlers for project actions
	function handleProjectEdit(projectId, currentName) {
		if (onProjectEdit) {
			onProjectEdit({ detail: { projectId, currentName } });
		}
	}

	function handleProjectDelete(project) {
		if (onProjectDelete) {
			onProjectDelete({ detail: project });
		}
	}

	function handleProjectOpen(projectId) {
		if (onProjectOpen) {
			onProjectOpen({ detail: projectId });
		}
	}

	function handleRenameConfirm(projectId) {
		if (viewModel) {
			viewModel.confirmRename();
		}
	}

	function handleRenameCancel() {
		if (viewModel) {
			viewModel.cancelRenaming();
		}
	}
</script>

<div class="project-list">
	{#if loading && !hasProjects}
		<div class="loading-state">
			<LoadingSpinner size="large" />
			<p>Loading projects...</p>
		</div>
	{:else if !hasProjects}
		<div class="empty-state">
			<div class="empty-content">
				<h2>No projects yet</h2>
				<p>Create your first project to get started with organized development sessions.</p>
			</div>
		</div>
	{:else}
		<div class="projects-grid">
			{#each projectsWithSessionCount as project (project.id)}
				<ProjectCard
					{project}
					isActive={viewModel?.activeProject === project.id}
					isRenaming={viewModel?.renamingProjectId === project.id}
					renameValue={viewModel?.renameValue || ''}
					renameValidation={viewModel?.renameValidation || { isValid: true, message: '' }}
					onEdit={(currentName) => handleProjectEdit(project.id, currentName)}
					onDelete={() => handleProjectDelete(project)}
					onOpen={() => handleProjectOpen(project.id)}
					onRenameConfirm={() => handleRenameConfirm(project.id)}
					onRenameCancel={handleRenameCancel}
					onRenameValueChange={(value) => {
						if (viewModel) {
							viewModel.renameValue = value;
						}
					}}
				/>
			{/each}
		</div>

		{#if loading}
			<div class="loading-overlay">
				<LoadingSpinner size="small" />
				<span>Updating projects...</span>
			</div>
		{/if}
	{/if}
</div>

<style>
	.project-list {
		flex: 1;
		padding: var(--space-md);
		overflow-y: auto;
		position: relative;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		gap: var(--space-md);
		color: var(--text-secondary);
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 300px;
		padding: var(--space-xl);
	}

	.empty-content {
		text-align: center;
		max-width: 400px;
	}

	.empty-content h2 {
		font-size: 1.4rem;
		color: var(--text-secondary);
		margin-bottom: var(--space-md);
		font-weight: 500;
	}

	.empty-content p {
		font-size: 0.95rem;
		color: var(--text-muted);
		line-height: 1.5;
		margin: 0;
	}

	.projects-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
		gap: var(--space-md);
		padding-bottom: var(--space-md);
	}

	.loading-overlay {
		position: absolute;
		top: var(--space-md);
		right: var(--space-md);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		background: rgba(26, 26, 26, 0.9);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 6px;
		padding: var(--space-sm) var(--space-md);
		font-size: 0.85rem;
		color: var(--text-secondary);
		backdrop-filter: blur(10px);
	}

	@media (max-width: 768px) {
		.projects-grid {
			grid-template-columns: 1fr;
			gap: var(--space-sm);
		}

		.project-list {
			padding: var(--space-sm);
		}
	}

	@media (max-width: 480px) {
		.empty-content h2 {
			font-size: 1.2rem;
		}

		.empty-content p {
			font-size: 0.9rem;
		}
	}
</style>