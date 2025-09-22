<script>
	import Button from '$lib/client/shared/components/Button.svelte';
	import IconFolder from './Icons/IconFolder.svelte';
	import IconFolderPlus from './Icons/IconFolderPlus.svelte';
	import IconFolderClone from './Icons/IconFolderClone.svelte';
	import IconEye from './Icons/IconEye.svelte';
	import IconEyeOff from './Icons/IconEyeOff.svelte';
	import IconX from './Icons/IconX.svelte';
	import IconFile from './Icons/IconFile.svelte';
	import IconCheck from './Icons/IconCheck.svelte';
	import { STORAGE_CONFIG } from '$lib/shared/constants.js';
	import IconButton from './IconButton.svelte';
	import Input from './Input.svelte';
	import IconUpload from './Icons/IconUpload.svelte';
	import { onMount } from 'svelte';
	import GitOperations from './GitOperations.svelte';

	// Svelte 5 Directory Browser Component
	let {
		selected = $bindable('./'), // selected directory path
		api = '/api/browse',
		startPath = '.',
		placeholder = 'Browse directories...',
		onSelect,
		onNavigate = null, // (path) => void - called when user navigates to a directory
		// Optional file operations
		showFileActions = false,
		onFileOpen = null, // (file) => void
		onFileUpload = null, // (files, currentDirectory) => void
		// Control initial state
		isAlwaysOpen = false // Force the browser to stay open (don't show collapsed state)
	} = $props();

	// Start with the provided startPath, or null to use server default
	let currentPath = $state(startPath || null);
	let loading = $state(false);
	let error = $state('');
	let entries = $state([]);
	let breadcrumbs = $state([]);
	let query = $state('');
	let showHidden = $state(false);
	let showNewDirInput = $state(false);
	let newDirName = $state('');
	let creatingDir = $state(false);
	let triedFallback = $state(false);
	let isOpen = $state(isAlwaysOpen);
	let uploadFiles = $state(null);
	let uploading = $state(false);
	let fileInputId = $state(`file-upload-${Math.random().toString(36).substr(2, 9)}`);

	// Clone directory state
	let showCloneDirInput = $state(false);
	let cloneSourcePath = $state('');
	let cloneTargetPath = $state('');
	let cloningDir = $state(false);
	let cloneOverwrite = $state(false);

	let displaySelection = $derived.by(() =>
		selected && String(selected).trim() ? selected : placeholder
	);

	// Parse path into breadcrumbs
	function updateBreadcrumbs(path) {
		const parts = path.split('/').filter(Boolean);
		breadcrumbs = [{ name: '/', path: '/' }];
		let accumulated = '';
		for (const part of parts) {
			accumulated += '/' + part;
			breadcrumbs.push({ name: part, path: accumulated });
		}
	}

	async function browse(path) {
		loading = true;
		error = '';
		try {
			// If path is null, don't send it as a param - let the server use its default
			const params = new URLSearchParams({ showHidden: showHidden.toString() });
			if (path !== null && path !== undefined) {
				params.set('path', path);
			}

			const res = await fetch(`${api}?${params}`);
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `HTTP ${res.status}`);
			}
			const data = await res.json();
			currentPath = data.path || path;
			entries = data.entries || [];
			updateBreadcrumbs(currentPath);
			if (!selected) {
				selected = currentPath;
				// Only call onSelect if this is user navigation, not initialization
				if (path !== null && path !== undefined) {
					onSelect?.(currentPath);
				}
			}
		} catch (e) {
			error = e.message || String(e);
			entries = [];
			// If the preferred start path was invalid, gracefully fall back to default base
			if (path && !triedFallback) {
				triedFallback = true;
				await browse(null); // Use null to get server's default
				return;
			}
		} finally {
			loading = false;
		}
	}

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return !q ? entries : entries.filter((e) => e.name.toLowerCase().includes(q));
	});

	function navigateTo(path) {
		query = '';
		browse(path);
		onNavigate?.(path);
	}

	function selectDirectory(path) {
		selected = path;
		onSelect?.(path);
		if (!isAlwaysOpen) {
			isOpen = false;
		}
	}

	function selectCurrent() {
		selectDirectory(currentPath);
	}

	function goUp() {
		const parent = currentPath.split('/').slice(0, -1).join('/') || '/';
		navigateTo(parent);
	}

	function toggleHidden() {
		showHidden = !showHidden;
		browse(currentPath);
	}

	async function createNewDirectory() {
		if (!newDirName.trim()) {
			error = 'Directory name cannot be empty';
			return;
		}

		creatingDir = true;
		error = '';
		const dirName = newDirName.trim();

		try {
			// Properly join paths, handling the case where currentPath ends with /
			const dirPath = currentPath.endsWith('/')
				? currentPath + dirName
				: currentPath + '/' + dirName;
			const res = await fetch('/api/browse/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ path: dirPath })
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || `Failed to create directory`);
			}

			// Refresh the directory listing
			await browse(currentPath);

			// Clear the input and hide the form
			newDirName = '';
			showNewDirInput = false;

			// Optionally select the new directory
			const newDir = entries.find((e) => e.name === dirName);
			if (newDir) {
				selectDirectory(newDir.path);
			}
		} catch (e) {
			error = e.message || 'Failed to create directory';
		} finally {
			creatingDir = false;
		}
	}

	function toggleNewDirInput() {
		showNewDirInput = !showNewDirInput;
		if (!showNewDirInput) {
			newDirName = '';
			error = '';
		}
	}

	// Clone directory functions
	function toggleCloneDirInput() {
		showCloneDirInput = !showCloneDirInput;
		if (!showCloneDirInput) {
			cloneSourcePath = '';
			cloneTargetPath = '';
			cloneOverwrite = false;
			error = '';
		} else {
			// When opening, provide fallback if currentPath is not available
			if (!currentPath) {
				cloneSourcePath = '';
				cloneTargetPath = '';
			} else {
				// Initialize with current path
				initCloneFromCurrent();
			}
		}
	}

	function initCloneFromCurrent() {
		if (!currentPath) {
			// If no current path, use a default or show error
			error = 'Please select a valid directory first';
			return;
		}

		cloneSourcePath = currentPath;
		const baseName = currentPath.split('/').pop() || 'directory';
		cloneTargetPath = currentPath.endsWith('/')
			? `${currentPath}${baseName}-clone`
			: `${currentPath}-clone`;
		showCloneDirInput = true;
	}

	async function cloneDirectory() {
		if (!cloneSourcePath.trim() || !cloneTargetPath.trim()) {
			error = 'Both source and target paths are required';
			return;
		}

		cloningDir = true;
		error = '';

		try {
			const res = await fetch('/api/browse/clone', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					sourcePath: cloneSourcePath.trim(),
					targetPath: cloneTargetPath.trim(),
					overwrite: cloneOverwrite
				})
			});

			if (!res.ok) {
				const data = await res.json();
				throw new Error(data.error || 'Failed to clone directory');
			}

			// Refresh the directory listing
			await browse(currentPath);

			// Clear the form and hide it
			cloneSourcePath = '';
			cloneTargetPath = '';
			cloneOverwrite = false;
			showCloneDirInput = false;

			// Optionally navigate to the cloned directory if it's in the current view
			const result = await res.json();
			const targetBaseName = result.targetPath.split('/').pop();
			const newDir = entries.find((e) => e.name === targetBaseName);
			if (newDir) {
				selectDirectory(newDir.path);
			}
		} catch (e) {
			error = e.message || 'Failed to clone directory';
		} finally {
			cloningDir = false;
		}
	}

	// Handle file opening
	function openFile(file) {
		if (onFileOpen) {
			onFileOpen(file);
		}
	}

	// Handle file upload
	async function handleFileUpload() {
		if (!uploadFiles || uploadFiles.length === 0 || !onFileUpload) return;

		uploading = true;
		error = '';

		try {
			await onFileUpload(uploadFiles, currentPath);
			uploadFiles = null;
			// Refresh directory after upload
			await browse(currentPath);
		} catch (e) {
			error = e.message || 'Failed to upload files';
		} finally {
			uploading = false;
		}
	}

	// Trigger file upload dialog
	function triggerFileUpload() {
		const fileInput = document.getElementById(fileInputId);
		if (fileInput) {
			fileInput.click();
		}
	}

	// Initialize on mount
	onMount(() => {
		console.log('[DirectoryBrowser] Initializing with startPath:', startPath, currentPath);
		browse(currentPath);
	});
</script>

{#if !isOpen}
	<button
		type="button"
		class="directory-summary"
		onclick={() => (isOpen = true)}
		aria-expanded={isOpen}
	>
		<span class="summary-icon"><IconFolder size={18} /></span>
		<span class="summary-text">{displaySelection}</span>
	</button>
{:else}
	<div class="directory-browser">
		<!-- Breadcrumb navigation -->
		<div class="breadcrumb-bar" class:selected={selected > ''} aria-label="Breadcrumbs">
			<div class="breadcrumbs">
				{#each breadcrumbs as crumb, i}
					{#if i > 0}
						<span class="separator">/</span>
					{/if}
					<button
						type="button"
						class="breadcrumb-item"
						onclick={() => navigateTo(crumb.path)}
						disabled={loading}
					>
						{crumb.name}
					</button>
				{/each}
			</div>
			<div class="breadcrumb-actions">
				{#if !isAlwaysOpen}
					<IconButton
						type="button"
						onclick={() => (isOpen = false)}
						title="Close directory browser"
						variant="ghost"
					>
						<IconX size={16} />
					</IconButton>
				{/if}
			</div>
		</div>

		<!-- Selected path display -->
		<!-- {#if selected}
		<div class="selected-display">
			<span class="selected-label">Selected:</span>
			<span class="selected-path">{selected}</span>

			<IconButton
				type="button"
				onclick={() => (selected = null)}
				class="clear-selection"
				title="Clear selection"
			>
				<IconX size={16} />
			</IconButton>
		</div>
	{/if} -->
		<!-- Search bar -->
		<div class="search-bar">
			<Input type="text" bind:value={query} {placeholder} disabled={loading} class="search-input" />
			<div class="btn-group">
				{#if !isAlwaysOpen}
					<IconButton
						type="button"
						onclick={selectCurrent}
						disabled={loading}
						title="Select current directory"
					>
						<IconCheck size={20} />
					</IconButton>
				{/if}
				<IconButton
					type="button"
					onclick={toggleNewDirInput}
					title="Create new directory"
					variant="ghost"
				>
					<IconFolderPlus size={16} />
				</IconButton>
				<IconButton
					type="button"
					onclick={initCloneFromCurrent}
					title="Clone current directory"
					variant="ghost"
					disabled={loading}
				>
					<IconFolderClone size={16} />
				</IconButton>
				{#if showFileActions && onFileUpload}
					<IconButton
						type="button"
						onclick={triggerFileUpload}
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
					onclick={toggleHidden}
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

		<!-- File upload input -->
		{#if showFileActions && onFileUpload}
			<input
				type="file"
				multiple
				bind:files={uploadFiles}
				style="display: none"
				id={fileInputId}
				onchange={handleFileUpload}
			/>
		{/if}

		<!-- New directory input -->
		{#if showNewDirInput}
			<div class="new-dir-form">
				<Input
					type="text"
					bind:value={newDirName}
					placeholder="Enter new directory name..."
					disabled={creatingDir}
					class="new-dir-input"
					onkeydown={(e) => e.key === 'Enter' && createNewDirectory()}
				/>
				<Button
					type="button"
					class="create-btn"
					onclick={createNewDirectory}
					disabled={creatingDir || !newDirName.trim()}
				>
					{creatingDir ? 'Creating...' : 'Create'}
				</Button>
				<Button type="button" class="cancel-btn" onclick={toggleNewDirInput} disabled={creatingDir}>
					Cancel
				</Button>
			</div>
		{/if}

		<!-- Clone directory input -->
		{#if showCloneDirInput}
			<div class="clone-dir-form">
				<div class="clone-dir-header">
					<h4>Clone Directory</h4>
				</div>
				<div class="clone-dir-fields">
					<Input
						type="text"
						bind:value={cloneSourcePath}
						placeholder="Source directory path..."
						disabled={cloningDir}
						class="clone-source-input"
						label="Source Directory"
					/>
					<Input
						type="text"
						bind:value={cloneTargetPath}
						placeholder="Target directory path..."
						disabled={cloningDir}
						class="clone-target-input"
						label="Target Directory"
						onkeydown={(e) => e.key === 'Enter' && cloneDirectory()}
					/>
					<label class="clone-overwrite-option">
						<input type="checkbox" bind:checked={cloneOverwrite} disabled={cloningDir} />
						Overwrite if target exists
					</label>
				</div>
				<div class="clone-dir-actions">
					<Button
						type="button"
						class="clone-btn"
						onclick={cloneDirectory}
						disabled={cloningDir || !cloneSourcePath.trim() || !cloneTargetPath.trim()}
					>
						{cloningDir ? 'Cloning...' : 'Clone Directory'}
					</Button>
					<Button
						type="button"
						class="cancel-btn"
						onclick={toggleCloneDirInput}
						disabled={cloningDir}
					>
						Cancel
					</Button>
				</div>
			</div>
		{/if}

		<!-- Status bar -->
		{#if loading || error}
			<div class="status-bar">
				{#if loading}
					<span class="loading-state">Loading...</span>
				{/if}
				{#if error}
					<span class="error-state">{error}</span>
				{/if}
			</div>
		{/if}

		<!-- Directory listing -->
		<div class="entries-list">
			{#if currentPath !== '/'}
				<div class="entry-item">
					<button type="button" onclick={goUp} disabled={loading} class="entry-button">
						<span class="entry-icon"><IconFolder size={20} /></span>
						<span class="entry-name">..</span>
						<span class="entry-type">parent directory</span>
					</button>
				</div>
			{/if}

			{#each filtered as entry}
				<div class="entry-item" class:selected={selected === entry.path}>
					{#if entry.isDirectory}
						<button
							type="button"
							onclick={() => navigateTo(entry.path)}
							disabled={loading}
							class="entry-button"
						>
							<span class="entry-icon"><IconFolder size={20} /></span>
							<span class="entry-name">{entry.name}</span>
							<span class="entry-type">directory</span>
						</button>
						{#if !isAlwaysOpen}
							<div class="entry-actions">
								<IconButton
									type="button"
									onclick={() => selectDirectory(entry.path)}
									disabled={loading}
									title="Select this directory"
									variant="ghost"
								>
									<IconCheck size={16} />
								</IconButton>
							</div>
						{/if}
					{:else if showFileActions && onFileOpen}
						<button
							type="button"
							class="entry-button interactive"
							onclick={() => openFile(entry)}
							disabled={loading}
							title="Open file"
						>
							<span class="icon"><IconFile size={20} /></span>
							<span class="name">{entry.name}</span>
							<span class="type">file</span>
						</button>
					{:else}
						<div class="item-button file">
							<span class="icon"><IconFile size={20} /></span>
							<span class="name">{entry.name}</span>
							<span class="type">file</span>
						</div>
					{/if}
				</div>
			{/each}

			{#if !loading && filtered.length === 0 && !error}
				<div class="empty-message">
					{query ? 'No matching items' : 'This directory is empty'}
				</div>
			{/if}
		</div>

		<!-- Git Operations -->
		<GitOperations
			{currentPath}
			onRefresh={() => browse(currentPath)}
			onError={(err) => (error = err)}
		/>
	</div>
{/if}


<style>
/* Component-specific overrides only */
.directory-summary {
height: 44px;
box-shadow:
0 2px 4px rgba(0, 0, 0, 0.1),
inset 0 1px 2px var(--primary-glow-10);
}

.directory-summary:hover {
transform: translateY(-1px);
box-shadow:
0 4px 12px rgba(0, 0, 0, 0.25),
inset 0 1px 3px var(--primary-glow-20);
}

.directory-summary:focus-visible {
outline: 2px solid var(--primary);
outline-offset: 2px;
}

/* Custom Git operations styling */
.git-section {
border-top: 1px solid var(--surface-border);
padding: var(--space-3);
background: color-mix(in oklab, var(--surface) 98%, var(--bg));
}

/* File upload styling */
.file-upload-area {
position: relative;
}

.file-upload-area.dragover {
background: var(--primary-glow-10);
border-color: var(--primary);
}

/* Loading and error states */
.loading-state {
padding: var(--space-4);
text-align: center;
color: var(--muted);
font-style: italic;
}

.error-state {
padding: var(--space-3);
background: color-mix(in oklab, var(--err) 10%, transparent);
border: 1px solid color-mix(in oklab, var(--err) 30%, transparent);
border-radius: 4px;
margin: var(--space-2);
color: var(--err);
}
</style>
