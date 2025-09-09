<script>
	import { Modal } from '$lib/shared/components';

	let { open = $bindable(false), workspaces = [], onSessionCreate } = $props();

	let selectedWorkspace = $state('');
	let creating = $state(false);

	async function handleCreate() {
		if (!selectedWorkspace) return;

		creating = true;
		try {
			await onSessionCreate?.(selectedWorkspace);
			open = false;
			selectedWorkspace = '';
		} catch (error) {
			console.error('Failed to create terminal session:', error);
		} finally {
			creating = false;
		}
	}

	function handleClose() {
		selectedWorkspace = '';
		open = false;
	}
</script>

<Modal bind:open title="Create Terminal Session" size="small" onclose={handleClose}>
	{#snippet children()}
		<div class="form">
			<div class="form-group">
				<label for="workspace-select">Working Directory</label>
				<select id="workspace-select" bind:value={selectedWorkspace} disabled={creating}>
					<option value="" disabled>Select workspace...</option>
					{#each workspaces as workspace}
						<option value={workspace}>{workspace}</option>
					{/each}
				</select>
			</div>
		</div>
	{/snippet}

	{#snippet footer()}
		<button class="button aug" data-augmented-ui="l-clip r-clip both" onclick={handleClose} disabled={creating}>Cancel</button>
		<button class="button aug primary" data-augmented-ui="l-clip r-clip both" onclick={handleCreate} disabled={!selectedWorkspace || creating}>
			{creating ? 'Creating...' : 'Create Terminal'}
		</button>
	{/snippet}
</Modal>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	label {
		font-weight: 500;
		color: var(--text);
		font-size: 0.875rem;
	}
</style>
