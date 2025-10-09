<script>
	import IconCheck from '../Icons/IconCheck.svelte';
	import IconFolderPlus from '../Icons/IconFolderPlus.svelte';
	import IconFolderClone from '../Icons/IconFolderClone.svelte';
	import IconEye from '../Icons/IconEye.svelte';
	import IconEyeOff from '../Icons/IconEyeOff.svelte';
	import IconUpload from '../Icons/IconUpload.svelte';
	import IconButton from '../IconButton.svelte';
	import Input from '../Input.svelte';

	/**
	 * DirectorySearchBar Component
	 *
	 * Displays search input and action buttons for directory browser.
	 * Handles search query, directory actions (create, clone), file upload, and hidden files toggle.
	 */
	let {
		query = $bindable(''),
		placeholder = 'Browse directories...',
		loading = false,
		showHidden = false,
		isAlwaysOpen = false,
		showFileActions = false,
		uploading = false,
		onSelectCurrent,
		onToggleNewDir,
		onToggleClone,
		onToggleHidden,
		onTriggerUpload
	} = $props();
</script>

<div class="flex-between gap-3 p-4 border-b border-surface-border bg-surface-glass">
	<Input type="text" bind:value={query} {placeholder} disabled={loading} class="flex-1" />
	<div class="flex items-center gap-2">
		{#if !isAlwaysOpen}
			<IconButton
				type="button"
				onclick={onSelectCurrent}
				disabled={loading}
				title="Select current directory"
			>
				<IconCheck size={20} />
			</IconButton>
		{/if}
		<IconButton
			type="button"
			onclick={onToggleNewDir}
			title="Create new directory"
			variant="ghost"
		>
			<IconFolderPlus size={16} />
		</IconButton>
		<IconButton
			type="button"
			onclick={onToggleClone}
			title="Clone current directory"
			variant="ghost"
			disabled={loading}
		>
			<IconFolderClone size={16} />
		</IconButton>
		{#if showFileActions && onTriggerUpload}
			<IconButton
				type="button"
				onclick={onTriggerUpload}
				title="Upload files"
				variant="ghost"
				disabled={uploading}
			>
				<IconUpload size={16} />
			</IconButton>
		{/if}
		<IconButton
			type="button"
			class="action-btn"
			onclick={onToggleHidden}
			title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
			variant="ghost"
		>
			{#if showHidden}
				<IconEye size={16} />
			{:else}
				<IconEyeOff size={16} />
			{/if}
		</IconButton>
	</div>
</div>
