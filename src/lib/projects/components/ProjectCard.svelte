<!--
  ProjectCard - Individual project display with actions (40-60 lines)
  Shows project details and handles inline editing
-->
<script>
	import Button from '$lib/shared/components/Button.svelte';
	import Input from '$lib/shared/components/Input.svelte';
	import ValidationMessage from '$lib/shared/components/ValidationMessage.svelte';
	import EditIcon from '$lib/shared/components/Icons/EditIcon.svelte';
	import DeleteProject from '$lib/shared/components/Icons/DeleteProject.svelte';
	import SessionIcon from '$lib/shared/components/Icons/SessionIcon.svelte';

	// Props
	let {
		project,
		isActive = false,
		isRenaming = false,
		renameValue = '',
		renameValidation = { isValid: true, message: '' },
		onEdit,
		onDelete,
		onOpen,
		onRenameConfirm,
		onRenameCancel,
		onRenameValueChange
	} = $props();

	// Derived state
	let sessionCount = $derived(project.sessionCount || 0);

	// Event handlers
	function handleCardClick() {
		if (!isRenaming && onOpen) {
			onOpen();
		}
	}

	function handleEditClick(event) {
		event.stopPropagation();
		if (onEdit && !isRenaming) {
			onEdit(project.name);
		}
	}

	function handleDeleteClick(event) {
		event.stopPropagation();
		if (onDelete) {
			onDelete();
		}
	}

	function handleRenameKeyDown(event) {
		event.stopPropagation();
		if (event.key === 'Enter' && onRenameConfirm) {
			onRenameConfirm();
		} else if (event.key === 'Escape' && onRenameCancel) {
			onRenameCancel();
		}
	}

	function handleRenameConfirm(event) {
		event.stopPropagation();
		if (onRenameConfirm) {
			onRenameConfirm();
		}
	}

	function handleRenameCancel(event) {
		event.stopPropagation();
		if (onRenameCancel) {
			onRenameCancel();
		}
	}

	function handleRenameInput(event) {
		if (onRenameValueChange) {
			onRenameValueChange(event.target.value);
		}
	}
</script>

<div
	class="project-card"
	class:active={isActive}
	data-augmented-ui="tl-clip tr-clip br-clip bl-clip both"
	onclick={handleCardClick}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && handleCardClick()}
>
	<div class="project-actions">
		{#if !isRenaming}
			<Button variant="ghost" size="small" onclick={handleEditClick} title="Rename project">
				{#snippet icon()}
					<EditIcon />
				{/snippet}
			</Button>

			<Button variant="danger" size="small" onclick={handleDeleteClick} title="Delete project">
				{#snippet icon()}
					<DeleteProject />
				{/snippet}
			</Button>
		{/if}
	</div>

	<div class="project-info">
		{#if isRenaming}
			<div class="rename-container" onclick={(e) => e.stopPropagation()}>
				<Input
					value={renameValue}
					placeholder="Project name"
					invalid={!renameValidation.isValid}
					oninput={handleRenameInput}
					onkeydown={handleRenameKeyDown}
					focus={true}
				/>

				<div class="rename-actions">
					<Button
						variant="primary"
						size="small"
						onclick={handleRenameConfirm}
						disabled={!renameValidation.isValid}
					>
						✓
					</Button>
					<Button variant="secondary" size="small" onclick={handleRenameCancel}>✕</Button>
				</div>

				{#if !renameValidation.isValid && renameValidation.message}
					<ValidationMessage message={renameValidation.message} severity="error" />
				{/if}
			</div>
		{:else}
			<div class="project-name">
				{project.name}
			</div>

			{#if project.description}
				<div class="project-description">
					{project.description}
				</div>
			{/if}
		{/if}

		<div class="project-meta">
			<span class="session-count">{sessionCount} session{sessionCount !== 1 ? 's' : ''}</span>
			{#if isActive}
				<span class="active-badge">(active)</span>
			{/if}
		</div>
	</div>

	<div class="project-open-action">
		<Button variant="ghost" size="medium" onclick={handleCardClick} title="Open project">
			{#snippet icon()}
				<SessionIcon />
			{/snippet}
		</Button>
	</div>
</div>

<style>
	.project-card {
		display: flex;
		align-items: center;
		gap: var(--space-md);
		padding: var(--space-md);
		background: rgba(26, 26, 26, 0.8);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
		backdrop-filter: blur(10px);
		position: relative;
	}

	.project-card:hover {
		background: rgba(0, 255, 136, 0.1);
		border-color: rgba(0, 255, 136, 0.6);
		transform: translateY(-1px);
	}

	.project-card.active {
		border-color: var(--accent);
		background: rgba(0, 255, 136, 0.05);
	}

	.project-actions {
		display: flex;
		gap: var(--space-xs);
		align-self: flex-start;
	}

	.project-info {
		flex: 1;
		min-width: 0;
	}

	.project-name {
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: var(--space-xs);
		font-size: 1.1rem;
	}

	.project-description {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin-bottom: var(--space-xs);
		line-height: 1.4;
	}

	.project-meta {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		font-size: 0.8rem;
		color: var(--text-muted);
	}

	.active-badge {
		color: var(--accent);
		font-weight: 500;
	}

	.rename-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.rename-actions {
		display: flex;
		gap: var(--space-xs);
	}

	.project-open-action {
		align-self: center;
	}

	@media (max-width: 480px) {
		.project-card {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-sm);
		}

		.project-actions {
			align-self: center;
		}

		.project-open-action {
			align-self: center;
		}
	}
</style>
