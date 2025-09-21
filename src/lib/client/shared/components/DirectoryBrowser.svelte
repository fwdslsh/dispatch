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
					<span class="loading">Loading...</span>
				{/if}
				{#if error}
					<span class="error">{error}</span>
				{/if}
			</div>
		{/if}

		<!-- Directory listing -->
		<div class="directory-list">
			{#if currentPath !== '/'}
				<div class="list-item parent-dir">
					<button type="button" onclick={goUp} disabled={loading} class="item-button">
						<span class="icon"><IconFolder size={20} /></span>
						<span class="name">..</span>
						<span class="type">parent directory</span>
					</button>
				</div>
			{/if}

			{#each filtered as entry}
				<div class="list-item">
					{#if entry.isDirectory}
						<button
							type="button"
							onclick={() => navigateTo(entry.path)}
							disabled={loading}
							class="item-button"
						>
							<span class="icon"><IconFolder size={20} /></span>
							<span class="name">{entry.name}</span>
							<span class="type">directory</span>
						</button>
						{#if !isAlwaysOpen}
							<IconButton
								type="button"
								onclick={() => selectDirectory(entry.path)}
								disabled={loading}
								class="quick-select"
								title="Select this directory"
							>
								<IconCheck size={16} />
							</IconButton>
						{/if}
					{:else if showFileActions && onFileOpen}
						<button
							type="button"
							class="item-button file interactive"
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
	.directory-summary {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		height: 44px;
		width: 100%;
		padding: 0 calc(var(--space-3) * 1.1);
		border-radius: 10px;
		border: 1px solid var(--db-border-subtle);
		background:
			linear-gradient(135deg, rgba(15, 25, 20, 0.35) 0%, rgba(10, 20, 15, 0.2) 100%),
			linear-gradient(180deg, rgba(46, 230, 107, 0.05) 0%, transparent 100%);
		color: var(--db-text-secondary);
		font-family: var(--font-mono);
		font-size: calc(var(--font-size-1) * 0.95);
		cursor: pointer;
		transition: all var(--db-transition-fast);
		box-shadow:
			var(--db-shadow-sm),
			inset 0 1px 2px rgba(46, 230, 107, 0.08);
	}

	.directory-summary:hover {
		transform: translateY(-1px);
		box-shadow:
			0 4px 12px rgba(0, 0, 0, 0.25),
			inset 0 1px 3px rgba(46, 230, 107, 0.12);
		border-color: rgba(46, 230, 107, 0.35);
	}

	.directory-summary:focus-visible {
		outline: 2px solid var(--db-primary);
		outline-offset: 2px;
	}

	.summary-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--db-primary);
	}

	.summary-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
	}

	.directory-browser {
		display: flex;
		flex-direction: column;
		gap: calc(var(--space-3) * 1.2);
		background:
			linear-gradient(135deg, var(--db-bg-gradient-start) 0%, var(--db-bg-gradient-end) 100%),
			radial-gradient(circle at 20% 80%, var(--db-primary-dim) 0%, transparent 50%);
		border: 1px solid var(--db-border-subtle);
		border-radius: 12px;
		padding: calc(var(--space-3) * 1);
		font-family: var(--font-mono);
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		box-shadow:
			var(--db-shadow-lg),
			inset 0 2px 4px rgba(46, 230, 107, 0.05),
			inset 0 -1px 2px rgba(0, 0, 0, 0.5);
		transition: all var(--db-transition-smooth);
	}

	.breadcrumb-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.directory-browser::before {
		content: '';
		position: absolute;
		top: -2px;
		left: -2px;
		right: -2px;
		bottom: -2px;
		background: linear-gradient(45deg, var(--db-primary-dim), transparent, var(--db-primary-dim));
		border-radius: 16px;
		opacity: 0;
		transition: opacity var(--db-transition-smooth);
		z-index: -1;
	}

	.directory-browser:hover::before {
		opacity: 0.3;
		animation: shimmer 3s linear infinite;
	}

	/* Breadcrumb bar */
	.breadcrumb-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: calc(var(--space-2) * 1.25) calc(var(--space-3) * 1.1);
		background:
			linear-gradient(90deg, var(--db-surface-elevated) 0%, var(--db-surface) 100%),
			linear-gradient(180deg, rgba(46, 230, 107, 0.03) 0%, transparent 100%);
		border: 1px solid var(--db-border-subtle);
		border-radius: 10px;
		min-height: 44px;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--db-primary-dim) transparent;
		backdrop-filter: blur(10px) saturate(1.2);
		box-shadow:
			var(--db-shadow-sm),
			inset 0 2px 4px rgba(46, 230, 107, 0.02),
			inset 0 -1px 2px rgba(0, 0, 0, 0.3);
		position: relative;
	}

	.breadcrumb-bar::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--db-primary-dim), transparent);
		opacity: 0.5;
	}

	.breadcrumb-bar.selected::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: linear-gradient(90deg, transparent, var(--db-primary-glow), transparent);
		opacity: 0.5;
	}
	.breadcrumbs {
		display: flex;
		align-items: center;
		flex: 1;
		min-width: 0;
	}

	.breadcrumb-item {
		background: transparent;
		border: none;
		color: var(--db-text-muted);
		font-family: var(--font-mono);
		font-size: calc(var(--font-size-1) * 0.95);
		font-weight: 500;
		padding: calc(var(--space-1) * 1.2) calc(var(--space-2) * 1.1);
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--db-transition-fast);
		border-radius: 6px;
		position: relative;
		letter-spacing: 0.02em;
	}

	.breadcrumb-item::after {
		content: '';
		position: absolute;
		bottom: 2px;
		left: 50%;
		width: 0;
		height: 2px;
		background: var(--db-primary);
		transition: all var(--db-transition-fast);
		transform: translateX(-50%);
		border-radius: 1px;
	}

	.breadcrumb-item:hover:not(:disabled) {
		color: var(--db-primary-bright);
		background: linear-gradient(135deg, var(--db-primary-dim) 0%, transparent 100%);
		transform: translateY(-1px);
	}

	.breadcrumb-item:hover:not(:disabled)::after {
		width: 80%;
		box-shadow: 0 0 8px var(--db-primary-glow);
	}

	.breadcrumb-item:active:not(:disabled) {
		transform: translateY(0);
	}

	.breadcrumb-item:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.separator {
		color: var(--db-text-muted);
		opacity: 0.3;
		font-size: calc(var(--font-size-1) * 0.9);
		margin: 0 calc(var(--space-1) * 0.5);
	}

	/* Search bar */
	.search-bar {
		display: flex;
		flex-direction: row;
		gap: calc(var(--space-2) * 1.3);
		align-items: center;
	}

	/* New directory form */
	.new-dir-form {
		display: flex;
		gap: calc(var(--space-2) * 1.3);
		padding: calc(var(--space-3) * 1.2);
		background:
			linear-gradient(135deg, var(--db-primary-dim) 0%, var(--db-surface-elevated) 100%),
			radial-gradient(circle at 0% 50%, var(--db-accent) 0%, transparent 30%);
		border: 1px solid var(--db-primary);
		border-radius: 10px;
		align-items: center;
		position: relative;
		box-shadow:
			0 6px 16px var(--db-primary-dim),
			inset 0 2px 4px rgba(46, 230, 107, 0.15),
			inset 0 -2px 4px rgba(0, 0, 0, 0.3);
		animation: expandIn 0.4s var(--db-transition-bounce);
		overflow: hidden;
	}

	.new-dir-form::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle, var(--db-primary-glow) 0%, transparent 70%);
		animation: rotate 10s linear infinite;
		opacity: 0.1;
	}

	/* Clone directory form */
	.clone-dir-form {
		display: flex;
		flex-direction: column;
		gap: calc(var(--space-3) * 1.2);
		padding: calc(var(--space-3) * 1.2);
		background:
			linear-gradient(135deg, var(--db-primary-dim) 0%, var(--db-surface-elevated) 100%),
			radial-gradient(circle at 0% 50%, var(--db-accent) 0%, transparent 30%);
		border: 1px solid var(--db-primary);
		border-radius: 10px;
		position: relative;
		box-shadow:
			0 6px 16px var(--db-primary-dim),
			inset 0 2px 4px rgba(46, 230, 107, 0.15),
			inset 0 -2px 4px rgba(0, 0, 0, 0.3);
		animation: expandIn 0.4s var(--db-transition-bounce);
		/* Fix overflow issues */
		max-width: 100%;
		box-sizing: border-box;
		overflow: hidden;
		/* Ensure it doesn't exceed the modal width */
		width: 100%;
	}

	.clone-dir-form::before {
		content: '';
		position: absolute;
		top: -50%;
		left: -50%;
		width: 200%;
		height: 200%;
		background: radial-gradient(circle, var(--db-primary-glow) 0%, transparent 70%);
		animation: rotate 10s linear infinite;
		opacity: 0.1;
	}

	.clone-dir-header h4 {
		margin: 0;
		font-size: calc(var(--font-size-1) * 1.1);
		color: var(--db-text-primary);
		font-weight: 600;
		position: relative;
		z-index: 1;
	}

	.clone-dir-fields {
		display: flex;
		flex-direction: column;
		gap: calc(var(--space-2) * 1.3);
		position: relative;
		z-index: 1;
		/* Ensure proper spacing and prevent overflow */
		width: 100%;
		box-sizing: border-box;
	}

	/* Make input fields responsive */
	.clone-dir-fields :global(.clone-source-input),
	.clone-dir-fields :global(.clone-target-input) {
		width: 100%;
		min-width: 0; /* Allow inputs to shrink properly */
		box-sizing: border-box;
	}

	.clone-overwrite-option {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: calc(var(--font-size-1) * 0.95);
		color: var(--db-text-secondary);
		cursor: pointer;
		position: relative;
		z-index: 1;
	}

	.clone-overwrite-option input[type='checkbox'] {
		accent-color: var(--db-primary);
	}

	.clone-dir-actions {
		display: flex;
		gap: calc(var(--space-2) * 1.3);
		align-items: center;
		position: relative;
		z-index: 1;
		/* Ensure buttons wrap on smaller screens */
		flex-wrap: wrap;
		justify-content: flex-start;
	}

	/* Make action buttons responsive */
	.clone-dir-actions :global(.clone-btn),
	.clone-dir-actions :global(.cancel-btn) {
		flex: 0 1 auto;
		min-width: fit-content;
	}

	/* Media query for smaller screens */
	@media (max-width: 600px) {
		.clone-dir-actions {
			flex-direction: column;
			align-items: stretch;
		}

		.clone-dir-actions :global(.clone-btn),
		.clone-dir-actions :global(.cancel-btn) {
			width: 100%;
		}
	}

	/* Status bar */
	.status-bar {
		padding: calc(var(--space-2) * 1.3) calc(var(--space-3) * 1.1);
		background: linear-gradient(135deg, var(--db-surface) 0%, var(--db-surface-elevated) 100%);
		border: 1px solid var(--db-border-subtle);
		border-radius: 8px;
		font-size: calc(var(--font-size-1) * 0.95);
		box-shadow:
			var(--db-shadow-sm),
			inset 0 1px 2px rgba(0, 0, 0, 0.2);
		position: relative;
		overflow: hidden;
	}

	.status-bar::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, var(--db-primary-dim), transparent);
		animation: statusSweep 2s linear infinite;
		opacity: 0.3;
	}

	.loading {
		color: var(--db-primary-bright);
		font-style: italic;
		font-weight: 500;
		letter-spacing: 0.02em;
		animation: loadingPulse 1.5s ease-in-out infinite;
	}

	.error {
		color: #ff6b6b;
		font-weight: 500;
		letter-spacing: 0.01em;
		animation: errorShake 0.5s ease-in-out;
	}

	/* Directory list */
	.directory-list {
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--db-primary-dim) transparent;
		min-height: 220px;
		height: 100%;

		/* background: linear-gradient(180deg, 
				var(--db-surface) 0%, 
				var(--db-surface-elevated) 100%),
			radial-gradient(ellipse at top right, 
				var(--db-primary-dim) 0%, 
				transparent 40%); */
		border: 1px solid var(--db-border-subtle);
		border-radius: 12px;
		padding: calc(var(--space-3) * 1.1);
		backdrop-filter: blur(6px) saturate(1.1);
		box-shadow:
			inset 0 4px 12px rgba(0, 0, 0, 0.3),
			inset 0 -2px 4px rgba(0, 0, 0, 0.2),
			inset 0 1px 2px var(--db-primary-dim);
		position: relative;
	}
	.directory-list::-webkit-scrollbar {
		width: 8px;
	}

	.directory-list::-webkit-scrollbar-track {
		background: rgba(0, 0, 0, 0.2);
		border-radius: 4px;
		margin: 8px 0;
	}

	.directory-list::-webkit-scrollbar-thumb {
		background: linear-gradient(180deg, var(--db-primary-dim) 0%, var(--db-accent) 100%);
		border-radius: 4px;
		border: 1px solid var(--db-border-subtle);
	}

	.directory-list::-webkit-scrollbar-thumb:hover {
		background: linear-gradient(180deg, var(--db-primary) 0%, var(--db-accent) 100%);
	}

	.list-item {
		display: flex;
		align-items: center;
		gap: calc(var(--space-2) * 1.1);
		margin-bottom: calc(var(--space-1) * 1.5);
		animation: fadeInUp 0.3s ease-out backwards;
	}

	.list-item:nth-child(1) {
		animation-delay: 0.05s;
	}
	.list-item:nth-child(2) {
		animation-delay: 0.1s;
	}
	.list-item:nth-child(3) {
		animation-delay: 0.15s;
	}
	.list-item:nth-child(4) {
		animation-delay: 0.2s;
	}
	.list-item:nth-child(5) {
		animation-delay: 0.25s;
	}

	.item-button {
		flex: 1;
		display: flex;
		align-items: center;
		gap: calc(var(--space-2) * 1.2);
		padding: calc(var(--space-2) * 1.3) calc(var(--space-3) * 1.1);
		background: linear-gradient(135deg, rgba(15, 25, 20, 0.6) 0%, rgba(10, 20, 15, 0.4) 100%);
		border: 1px solid transparent;
		color: var(--db-text-secondary);
		font-family: var(--font-mono);
		font-size: calc(var(--font-size-1) * 0.95);
		font-weight: 400;
		letter-spacing: 0.01em;
		text-align: left;
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--db-transition-fast);
		position: relative;
		overflow: hidden;
		box-shadow:
			0 1px 3px rgba(0, 0, 0, 0.2),
			inset 0 1px 2px rgba(0, 0, 0, 0.1);
	}

	.item-button::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 3px;
		height: 100%;
		background: var(--db-primary);
		transform: translateX(-3px);
		transition: transform var(--db-transition-fast);
	}

	.item-button::after {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, var(--db-primary-dim), transparent);
		transition: left 0.4s ease;
	}

	.item-button:hover:not(:disabled):not(.file)::before {
		transform: translateX(0);
	}

	.item-button:active:not(:disabled):not(.file) {
		transform: translateX(2px);
	}

	.item-button.file {
		opacity: 0.5;
		cursor: default;
		background: linear-gradient(135deg, rgba(10, 15, 12, 0.4) 0%, rgba(5, 10, 8, 0.3) 100%);
	}

	.item-button.file.interactive {
		opacity: 0.8;
		cursor: pointer;
		background: linear-gradient(135deg, rgba(15, 25, 20, 0.6) 0%, rgba(10, 20, 15, 0.4) 100%);
	}

	.item-button.file.interactive:hover {
		opacity: 1;
		border-color: rgba(46, 230, 107, 0.3);
		box-shadow:
			0 3px 10px rgba(46, 230, 107, 0.2),
			inset 0 2px 4px rgba(46, 230, 107, 0.1);
	}

	.item-button:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.parent-dir .item-button {
		color: var(--accent-amber);
		background: linear-gradient(135deg, rgba(255, 193, 7, 0.08) 0%, rgba(15, 25, 20, 0.4) 100%);
	}

	.parent-dir .item-button:hover {
		border-color: rgba(255, 193, 7, 0.3);
		box-shadow:
			0 3px 10px rgba(255, 193, 7, 0.2),
			inset 0 2px 4px rgba(255, 193, 7, 0.1);
	}

	.icon {
		font-size: 1.3em;
		flex-shrink: 0;
		filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3));
		transition: transform var(--db-transition-fast);
	}

	.item-button:hover .icon {
		transform: scale(1.1) rotate(5deg);
	}

	.name {
		flex: 1;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: 0.02em;
	}

	.type {
		font-size: calc(var(--font-size-0) * 0.9);
		color: var(--db-text-muted);
		font-style: italic;
		opacity: 0.7;
		text-transform: lowercase;
		letter-spacing: 0.03em;
	}

	.empty-message {
		text-align: center;
		padding: calc(var(--space-6) * 1.5);
		color: var(--db-text-muted);
		font-style: italic;
		font-size: calc(var(--font-size-1) * 0.95);
		letter-spacing: 0.02em;
		opacity: 0.7;
		animation: pulse 2s ease-in-out infinite;
	}

	/* Animations */
	@keyframes pulse {
		0%,
		100% {
			opacity: 0.7;
		}
		50% {
			opacity: 0.4;
		}
	}

	@keyframes fadeInUp {
		from {
			opacity: 0;
			transform: translateY(10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes expandIn {
		from {
			opacity: 0;
			transform: scaleY(0.8);
		}
		to {
			opacity: 1;
			transform: scaleY(1);
		}
	}

	@keyframes rotate {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes statusSweep {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	@keyframes loadingPulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	@keyframes errorShake {
		0%,
		100% {
			transform: translateX(0);
		}
		10%,
		30%,
		50%,
		70%,
		90% {
			transform: translateX(-3px);
		}
		20%,
		40%,
		60%,
		80% {
			transform: translateX(3px);
		}
	}

	@keyframes shimmer {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}
</style>
