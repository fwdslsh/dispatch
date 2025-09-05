<!--
  ProjectActions - Project operation buttons (40-60 lines)
  Handles project-level actions like export, settings, etc.
-->
<script>
	import Button from '$lib/shared/components/Button.svelte';

	// Props
	let { 
		project, 
		onExport,
		onSettings,
		onSetActive,
		onArchive,
		disabled = false
	} = $props();

	// Event handlers
	function handleExport() {
		if (onExport && !disabled) {
			onExport(project);
		}
	}

	function handleSettings() {
		if (onSettings && !disabled) {
			onSettings(project);
		}
	}

	function handleSetActive() {
		if (onSetActive && !disabled) {
			onSetActive(project.id);
		}
	}

	function handleArchive() {
		if (onArchive && !disabled) {
			onArchive(project);
		}
	}
</script>

<div class="project-actions">
	<div class="primary-actions">
		<Button
			variant="primary"
			size="small"
			onclick={handleSetActive}
			{disabled}
			title="Set as active project"
		>
			Set Active
		</Button>
	</div>

	<div class="secondary-actions">
		<Button
			variant="ghost"
			size="small"
			onclick={handleSettings}
			{disabled}
			title="Project settings"
		>
			Settings
		</Button>

		<Button
			variant="ghost"
			size="small"
			onclick={handleExport}
			{disabled}
			title="Export project data"
		>
			Export
		</Button>

		<Button
			variant="ghost"
			size="small"
			onclick={handleArchive}
			{disabled}
			title="Archive project"
		>
			Archive
		</Button>
	</div>
</div>

<style>
	.project-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
		padding: var(--space-sm);
	}

	.primary-actions {
		display: flex;
		gap: var(--space-xs);
	}

	.secondary-actions {
		display: flex;
		gap: var(--space-xs);
		flex-wrap: wrap;
	}

	@media (max-width: 768px) {
		.project-actions {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}

		.secondary-actions {
			gap: var(--space-xs);
		}
	}

	@media (max-width: 480px) {
		.project-actions {
			flex-direction: column;
			gap: var(--space-xs);
		}

		.primary-actions,
		.secondary-actions {
			justify-content: center;
		}

		.secondary-actions {
			gap: var(--space-xs);
		}
	}
</style>