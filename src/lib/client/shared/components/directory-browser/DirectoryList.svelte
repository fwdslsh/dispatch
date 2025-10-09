<script>
	import DirectoryItem from './DirectoryItem.svelte';

	/**
	 * DirectoryList Component
	 *
	 * Displays a list of directory entries (directories and files).
	 * Handles parent directory navigation and empty state display.
	 */
	let {
		entries = [],
		selectedPath = '',
		currentPath = '/',
		loading = false,
		isAlwaysOpen = false,
		showFileActions = false,
		showParentDirectory = true,
		query = '',
		onNavigate,
		onGoUp,
		onSelectDirectory,
		onFileOpen
	} = $props();
</script>

<div class="directory-listing-container overflow-y-auto p-2">
	{#if showParentDirectory}
		<DirectoryItem isParentDirectory={true} {loading} onNavigate={onGoUp} />
	{/if}

	{#each entries as entry}
		<DirectoryItem
			{entry}
			isSelected={selectedPath === entry.path}
			{loading}
			{isAlwaysOpen}
			{showFileActions}
			onNavigate={entry.isDirectory ? onNavigate : null}
			onSelect={onSelectDirectory}
			{onFileOpen}
		/>
	{/each}

	{#if !loading && entries.length === 0}
		<div class="p-6 text-center text-muted font-medium">
			{query ? 'No matching items' : 'This directory is empty'}
		</div>
	{/if}
</div>

<style>
	.directory-listing-container {
		height: calc(100% - 218px);
		overflow-y: auto;
	}
</style>
