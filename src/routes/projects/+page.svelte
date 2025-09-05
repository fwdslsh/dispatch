<script>
	import { goto } from '$app/navigation';
	import HeaderToolbar from '$lib/shared/components/HeaderToolbar.svelte';
	import Container from '$lib/shared/components/Container.svelte';
	import PublicUrlDisplay from '$lib/shared/components/PublicUrlDisplay.svelte';
	import Projects from '$lib/projects/components/Projects.svelte';
	import ExitIcon from '$lib/shared/components/Icons/ExitIcon.svelte';
	import ProjectManager from '$lib/projects/components/ProjectManager.svelte';

	let { data } = $props();

	function logout() {
		localStorage.removeItem('dispatch-auth-token');
		goto('/');
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
				<h2>Projects</h2>
			{/snippet}
		</HeaderToolbar>
	{/snippet}

	{#snippet children()}
		<PublicUrlDisplay />
		<ProjectManager terminalKey={data?.terminalKey} />
	{/snippet}
</Container>
