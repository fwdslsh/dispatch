<script>
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '../Input.svelte';

	/**
	 * NewDirectoryForm Component
	 *
	 * Form for creating a new directory.
	 * Displays input for directory name and handles creation.
	 */
	let { dirName = $bindable(''), creating = false, onCreate, onCancel } = $props();

	function handleKeydown(e) {
		if (e.key === 'Enter' && !creating && dirName.trim()) {
			onCreate();
		}
	}
</script>

<div class="p-4 bg-surface-highlight border-b border-surface-border">
	<div class="flex items-center gap-3">
		<Input
			type="text"
			bind:value={dirName}
			placeholder="Enter new directory name..."
			disabled={creating}
			class="flex-1"
			onkeydown={handleKeydown}
		/>
		<Button
			type="button"
			class="wm-action-button"
			onclick={onCreate}
			disabled={creating || !dirName.trim()}
		>
			{creating ? 'Creating...' : 'Create'}
		</Button>
		<Button type="button" class="btn-icon-ghost" onclick={onCancel} disabled={creating}>
			Cancel
		</Button>
	</div>
</div>
