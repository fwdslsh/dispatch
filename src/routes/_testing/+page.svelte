<script>
	/**
	 * @typedef {Object} TestingPageProps
	 * @property {import('./$types').PageData & { workspaces?: Array<{path: string, name: string}> }} data
	 */

	/** @type {TestingPageProps} */
	let { data } = $props();

	const workspaces = data?.workspaces ?? [];
</script>

<div class="testing-list">
	{#each workspaces as ws (ws.path)}
		<div class="project-item" data-path={ws.path} role="button">
			<strong>{ws.name}</strong>
			<div class="session-item">No sessions (placeholder)</div>
		</div>
	{/each}
</div>

<style>
	.testing-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: var(--space-4);
	}

	.project-item {
		padding: 12px;
		border: 1px solid var(--border-color, #ddd);
		border-radius: var(--radius-sm);
		background: var(--surface, #fff);
	}

	.session-item {
		margin-left: var(--space-4);
		padding: 8px;
		font-size: 0.9rem;
		color: #444;
	}
</style>
