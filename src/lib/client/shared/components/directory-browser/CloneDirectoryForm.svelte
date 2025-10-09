<script>
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '../Input.svelte';

	/**
	 * CloneDirectoryForm Component
	 *
	 * Form for cloning a directory from source to target path.
	 * Displays inputs for source, target paths and overwrite option.
	 */
	let {
		sourcePath = $bindable(''),
		targetPath = $bindable(''),
		overwrite = $bindable(false),
		cloning = false,
		onClone,
		onCancel
	} = $props();

	function handleKeydown(e) {
		if (e.key === 'Enter' && !cloning && sourcePath.trim() && targetPath.trim()) {
			onClone();
		}
	}
</script>

<div class="p-3 bg-surface-highlight border-b border-surface-border">
	<div>
		<h4 class="text-sm font-medium mb-2 text-text">Clone Directory</h4>
	</div>
	<div class="space-y-2">
		<Input
			type="text"
			bind:value={sourcePath}
			placeholder="Source directory path..."
			disabled={cloning}
			class="flex-1"
			label="Source Directory"
		/>
		<Input
			type="text"
			bind:value={targetPath}
			placeholder="Target directory path..."
			disabled={cloning}
			class="flex-1"
			label="Target Directory"
			onkeydown={handleKeydown}
		/>
		<label class="flex items-center gap-2 text-sm text-muted cursor-pointer">
			<input type="checkbox" bind:checked={overwrite} disabled={cloning} class="w-4 h-4" />
			Overwrite if target exists
		</label>
	</div>
	<div class="flex items-center gap-2 mt-3">
		<Button
			type="button"
			class="clone-btn"
			onclick={onClone}
			disabled={cloning || !sourcePath.trim() || !targetPath.trim()}
		>
			{cloning ? 'Cloning...' : 'Clone Directory'}
		</Button>
		<Button type="button" class="cancel-btn" onclick={onCancel} disabled={cloning}>Cancel</Button>
	</div>
</div>
