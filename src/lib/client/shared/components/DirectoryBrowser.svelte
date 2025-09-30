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
		isAlwaysOpen = false, // Force the browser to stay open (don't show collapsed state)
		// Root folder constraint
		rootFolder = '/' // Root folder that user cannot navigate outside of
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
		const normalizedRoot = rootFolder.endsWith('/') ? rootFolder.slice(0, -1) : rootFolder;
		const parts = path.split('/').filter(Boolean);

		// Start breadcrumbs from the root folder
		if (normalizedRoot === '/') {
			breadcrumbs = [{ name: '/', path: '/' }];
		} else {
			// If we have a custom root folder, start from there
			const rootParts = normalizedRoot.split('/').filter(Boolean);
			breadcrumbs = [{ name: rootParts[rootParts.length - 1] || '/', path: normalizedRoot }];
		}

		// Add breadcrumbs for parts beyond the root folder
		let accumulated = normalizedRoot === '/' ? '' : normalizedRoot;
		for (const part of parts) {
			// Skip parts that are already included in the root folder
			const testPath = accumulated + '/' + part;
			if (testPath.length > normalizedRoot.length) {
				accumulated = testPath;
				breadcrumbs.push({ name: part, path: accumulated });
			} else if (accumulated === '' || testPath === normalizedRoot) {
				accumulated = testPath;
			}
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
		// Check if the target path is within the rootFolder boundary
		const normalizedRoot = rootFolder.endsWith('/') ? rootFolder.slice(0, -1) : rootFolder;
		const normalizedPath = path === '/' ? '/' : path;

		// Only navigate if the path is within the root folder
		if (
			normalizedPath.length >= normalizedRoot.length &&
			normalizedPath.startsWith(normalizedRoot)
		) {
			query = '';
			browse(path);
			onNavigate?.(path);
		}
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
		// Check if the parent directory is within the rootFolder boundary
		const normalizedRoot = rootFolder.endsWith('/') ? rootFolder.slice(0, -1) : rootFolder;
		const normalizedParent = parent === '/' ? '/' : parent;

		// Only navigate up if the parent is not outside the root folder
		if (
			normalizedParent.length >= normalizedRoot.length &&
			normalizedParent.startsWith(normalizedRoot)
		) {
			navigateTo(parent);
		}
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
		class="directory-summary-enhanced w-full text-left"
		onclick={() => (isOpen = true)}
		aria-expanded={isOpen}
	>
		<span class="directory-icon-enhanced"><IconFolder size={18} /></span>
		<span class="flex-1 text-primary font-medium">{displaySelection}</span>
	</button>
{:else}
	<div class="directory-browser-enhanced">
		<!-- Breadcrumb navigation -->
		<div
			class="directory-breadcrumb-enhanced {selected > '' ? 'bg-primary-glow-10' : ''}"
			aria-label="Breadcrumbs"
		>
			<div class="flex items-center gap-1 overflow-x-auto flex-1">
				{#each breadcrumbs as crumb, i}
					{#if i > 0}
						<span class="breadcrumb-separator">/</span>
					{/if}
					<button
						type="button"
						class="breadcrumb-item-enhanced"
						onclick={() => navigateTo(crumb.path)}
						disabled={loading}
					>
						{crumb.name}
					</button>
				{/each}
			</div>
			<div class="flex items-center gap-1 ml-auto shrink-0">
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

		<div class="container">
			<!-- Git Operations -->
			<GitOperations
				{currentPath}
				onRefresh={() => browse(currentPath)}
				onError={(err) => (error = err)}
			/>
		</div>
		<!-- Search bar -->
		<div class="flex-between gap-3 p-4 border-b border-surface-border bg-surface-glass">
			<Input type="text" bind:value={query} {placeholder} disabled={loading} class="flex-1" />
			<div class="flex items-center gap-2">
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
			<div class="p-4 bg-surface-highlight border-b border-surface-border">
				<div class="flex items-center gap-3">
					<Input
						type="text"
						bind:value={newDirName}
						placeholder="Enter new directory name..."
						disabled={creatingDir}
						class="flex-1"
						onkeydown={(e) => e.key === 'Enter' && createNewDirectory()}
					/>
					<Button
						type="button"
						class="wm-action-button"
						onclick={createNewDirectory}
						disabled={creatingDir || !newDirName.trim()}
					>
						{creatingDir ? 'Creating...' : 'Create'}
					</Button>
					<Button
						type="button"
						class="btn-icon-only ghost"
						onclick={toggleNewDirInput}
						disabled={creatingDir}
					>
						Cancel
					</Button>
				</div>
			</div>
		{/if}

		<!-- Clone directory input -->
		{#if showCloneDirInput}
			<div class="p-3 bg-surface-highlight border-b border-surface-border">
				<div>
					<h4 class="text-sm font-medium mb-2 text-text">Clone Directory</h4>
				</div>
				<div class="space-y-2">
					<Input
						type="text"
						bind:value={cloneSourcePath}
						placeholder="Source directory path..."
						disabled={cloningDir}
						class="flex-1"
						label="Source Directory"
					/>
					<Input
						type="text"
						bind:value={cloneTargetPath}
						placeholder="Target directory path..."
						disabled={cloningDir}
						class="flex-1"
						label="Target Directory"
						onkeydown={(e) => e.key === 'Enter' && cloneDirectory()}
					/>
					<label class="flex items-center gap-2 text-sm text-muted cursor-pointer">
						<input
							type="checkbox"
							bind:checked={cloneOverwrite}
							disabled={cloningDir}
							class="w-4 h-4"
						/>
						Overwrite if target exists
					</label>
				</div>
				<div class="flex items-center gap-2 mt-3">
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
			<div class="px-3 py-2 text-sm">
				{#if loading}
					<span class="loading-state">Loading...</span>
				{/if}
				{#if error}
					<span class="error-state">{error}</span>
				{/if}
			</div>
		{/if}

		<!-- Directory listing -->
		<div class="directory-listing-container overflow-y-auto p-2">
			{#if currentPath !== '/'}
				<div class="directory-item-enhanced">
					<span class="directory-icon-enhanced"><IconFolder size={20} /></span>
					<button
						type="button"
						onclick={goUp}
						disabled={loading}
						class="flex-1 text-left font-medium disabled:opacity-50 disabled:cursor-not-allowed bg-transparent border-none cursor-pointer"
					>
						..
					</button>
					<span class="text-xs text-muted opacity-75">parent directory</span>
				</div>
			{/if}

			{#each filtered as entry}
				<div class="directory-item-enhanced {selected === entry.path ? 'selected' : ''}">
					{#if entry.isDirectory}
						<span class="directory-icon-enhanced"><IconFolder size={20} /></span>
						<button
							type="button"
							onclick={() => navigateTo(entry.path)}
							disabled={loading}
							class="flex-1 text-left font-medium cursor-pointer"
						>
							{entry.name}
						</button>
						<span class="text-xs text-muted opacity-75">directory</span>
						{#if !isAlwaysOpen}
							<div class="px-2">
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
						<span class="directory-icon-enhanced"><IconFile size={20} /></span>
						<button
							type="button"
							class="flex-1 text-left font-medium bg-transparent border-none cursor-pointer hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
							onclick={() => openFile(entry)}
							disabled={loading}
							title="Open file"
						>
							{entry.name}
						</button>
						<span class="text-xs text-muted opacity-75">file</span>
					{:else}
						<span class="directory-icon-enhanced"><IconFile size={20} /></span>
						<span class="flex-1 font-medium text-muted">{entry.name}</span>
						<span class="text-xs text-muted opacity-75">file</span>
					{/if}
				</div>
			{/each}

			{#if !loading && filtered.length === 0 && !error}
				<div class="p-6 text-center text-muted font-medium">
					{query ? 'No matching items' : 'This directory is empty'}
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	/* ==================================================================
   ENHANCED DIRECTORY BROWSER UTILITIES
   Modern file browser with glass morphism and micro-interactions
   ================================================================== */
	.directory-browser-enhanced {
		display: contents;
		height: calc(100% - 50px);
	}
	.directory-summary-enhanced {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-4);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 90%, var(--primary) 10%),
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
		position: relative;
		overflow: hidden;
	}

	.directory-summary-enhanced::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, var(--primary-glow-10), transparent);
		transition: left 0.5s ease;
	}

	.directory-summary-enhanced:hover {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 25%, var(--surface)),
			color-mix(in oklab, var(--primary) 15%, var(--surface))
		);
		border-color: var(--primary);
		transform: translateY(-2px);
		box-shadow:
			0 12px 40px -12px var(--primary-glow),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 15%, transparent);
	}

	.directory-summary-enhanced:hover::before {
		left: 100%;
	}

	.directory-item-enhanced {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		border: 1px solid transparent;
		position: relative;
	}

	.directory-item-enhanced:hover {
		background: color-mix(in oklab, var(--primary) 8%, transparent);
		border-color: color-mix(in oklab, var(--primary) 20%, transparent);
		transform: translateX(4px);
	}

	.directory-item-enhanced.selected {
		background: color-mix(in oklab, var(--primary) 15%, transparent);
		border-color: var(--primary);
		color: var(--primary);
	}

	.directory-icon-enhanced {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		color: var(--accent-amber);
		transition: all 0.2s ease;
	}

	.directory-item-enhanced:hover .directory-icon-enhanced {
		color: var(--primary);
		transform: scale(1.1);
	}

	/* Fix button and link styles within directory items */
	.directory-item-enhanced button {
		color: var(--text);
		text-decoration: none;
		transition: color 0.2s ease;
		font-family: inherit;
		font-size: inherit;
		background-color: transparent;
		border: none;
	}

	.directory-item-enhanced button:hover:enabled {
		color: var(--primary);
		text-decoration: none;
	}

	.directory-item-enhanced button:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.directory-item-enhanced button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.directory-breadcrumb-enhanced {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in oklab, var(--surface) 95%, var(--primary) 5%);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 10%, transparent);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		overflow-x: auto;
	}

	.breadcrumb-item-enhanced {
		padding: var(--space-1) var(--space-2);
		border: none;
		background: transparent;
		color: var(--text);
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.breadcrumb-item-enhanced:hover {
		color: var(--primary);
	}

	.breadcrumb-separator {
		color: var(--muted);
		opacity: 0.5;
		margin: 0 var(--space-1);
	}

	.directory-listing-container {
		height: 100%;
		overflow-y: auto;
	}

	/* Mobile-friendly directory browser styles */
	@media (max-width: 768px) {
		.directory-browser-enhanced {
			font-size: 16px; /* Prevent zoom on iOS */
		}

		.directory-item-enhanced {
			padding: var(--space-4);
			min-height: 48px; /* Better touch target */
		}

		.directory-item-enhanced button {
			min-height: 44px;
			display: flex;
			align-items: center;
		}

		.directory-breadcrumb-enhanced {
			padding: var(--space-4);
			gap: var(--space-3);
		}

		.breadcrumb-item-enhanced {
			padding: var(--space-2) var(--space-3);
			min-height: 40px;
		}

		/* Larger icons on mobile */
		.directory-icon-enhanced {
			width: 28px;
			height: 28px;
		}
	}
</style>
