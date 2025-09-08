<script>
	import { Modal, Button } from '$lib/shared/components';

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
		<Button onclick={handleClose} text="Cancel" variant="ghost" disabled={creating} />
		<Button
			onclick={handleCreate}
			text={creating ? 'Creating...' : 'Create Terminal'}
			variant="primary"
			disabled={!selectedWorkspace || creating}
		/>
	{/snippet}
</Modal>

<style>
	.form {
		display: flex;
		flex-direction: column;
		gap: var(--space-md);
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	label {
		font-weight: 500;
		color: var(--text-primary);
		font-size: 0.9rem;
	}

	select {
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
		padding: var(--space-sm);
		border-radius: 4px;
		font-size: 0.9rem;
	}

	select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-alpha);
	}

	select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
