<script>
	import { goto } from '$app/navigation';
	import HeaderToolbar from '$lib/shared/components/HeaderToolbar.svelte';
	import Container from '$lib/shared/components/Container.svelte';
	import PublicUrlDisplay from '$lib/shared/components/PublicUrlDisplay.svelte';
	import Button from '$lib/shared/components/Button.svelte';
	import ExitIcon from '$lib/shared/components/Icons/ExitIcon.svelte';
	import StartSession from '$lib/shared/components/Icons/StartSession.svelte';
	import ProjectManager from '$lib/projects/components/ProjectManager.svelte';

	let { data } = $props();
	let projectManager;

	function logout() {
		localStorage.removeItem('dispatch-auth-token');
		goto('/');
	}

	function handleCreateProject() {
		projectManager?.handleCreateProject();
	}
</script>

<Container>
	{#snippet header()}
		<HeaderToolbar>
			{#snippet left()}
				<button
					class="btn-icon-only button-danger"
					onclick={() => logout()}
					title="Logout"
					aria-label="Logout"
				>
					<ExitIcon />
				</button>
			{/snippet}
			{#snippet right()}
				<div class="header-title-section">
					<h2>Projects</h2>
					<Button variant="primary" size="small" onclick={handleCreateProject}>
						{#snippet icon()}
							<StartSession />
						{/snippet}
						Create Project
					</Button>
				</div>
			{/snippet}
		</HeaderToolbar>
	{/snippet}

	{#snippet children()}
		<PublicUrlDisplay />
		<ProjectManager bind:this={projectManager} terminalKey={data?.terminalKey} />
	{/snippet}
</Container>

<style>
	.header-title-section {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.header-title-section h2 {
		margin: 0;
		color: var(--text-primary);
	}
</style>
