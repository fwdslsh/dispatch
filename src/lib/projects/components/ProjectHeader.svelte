<!--
  ProjectHeader - Navigation and title component (40-60 lines)
  Displays page title and main action buttons
-->
<script>
	import Button from '$lib/shared/components/Button.svelte';
	import LoadingSpinner from '$lib/shared/components/LoadingSpinner.svelte';
	import StartSession from '$lib/shared/components/Icons/StartSession.svelte';

	// Props
	let { onCreateProject, loading = false } = $props();

	function handleCreateClick() {
		if (onCreateProject && !loading) {
			onCreateProject();
		}
	}
</script>

<header class="project-header" data-augmented-ui="tl-clip tr-clip br-clip bl-clip both">
	<div class="header-content">
		<div class="title-section">
			<h1>Projects</h1>
			<p class="subtitle">Manage your development projects and sessions</p>
		</div>

		<div class="actions-section">
			{#if loading}
				<div class="loading-indicator">
					<LoadingSpinner size="small" />
					<span>Loading...</span>
				</div>
			{:else}
				<Button
					variant="primary"
					size="medium"
					onclick={handleCreateClick}
					disabled={loading}
				>
					{#snippet icon()}
						<StartSession />
					{/snippet}
					Create Project
				</Button>
			{/if}
		</div>
	</div>
</header>

<style>
	.project-header {
		background: rgba(26, 26, 26, 0.9);
		border: 1px solid rgba(0, 255, 136, 0.3);
		backdrop-filter: blur(10px);
		padding: var(--space-lg);
		margin: var(--space-md);
		border-radius: 8px;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-lg);
	}

	.title-section h1 {
		margin: 0 0 var(--space-xs) 0;
		color: var(--text-primary);
		font-size: 1.8rem;
		font-weight: 600;
	}

	.subtitle {
		margin: 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.actions-section {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	@media (max-width: 768px) {
		.header-content {
			flex-direction: column;
			align-items: stretch;
			text-align: center;
		}

		.title-section h1 {
			font-size: 1.5rem;
		}
	}
</style>