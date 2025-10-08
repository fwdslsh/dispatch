<script>
	import { onMount } from 'svelte';
	import IconFolder from '../Icons/IconFolder.svelte';
	import GitOperations from '../GitOperations.svelte';
	import DirectoryBreadcrumbs from './DirectoryBreadcrumbs.svelte';
	import DirectorySearchBar from './DirectorySearchBar.svelte';
	import NewDirectoryForm from './NewDirectoryForm.svelte';
	import CloneDirectoryForm from './CloneDirectoryForm.svelte';
	import DirectoryList from './DirectoryList.svelte';
	import { DirectoryBrowserViewModel } from './DirectoryBrowserViewModel.svelte.js';

	/**
	 * DirectoryBrowser Component
	 *
	 * Main orchestrator component for directory browsing.
	 * Composes sub-components and manages ViewModel for business logic.
	 *
	 * Follows MVVM pattern:
	 * - View: This component and sub-components (UI only)
	 * - ViewModel: DirectoryBrowserViewModel (state and business logic)
	 * - Model: Directory entries from API
	 */

	// Props
	let {
		selected = $bindable('./'), // selected directory path
		api = '/api/browse',
		startPath = '.',
		placeholder = 'Browse directories...',
		onSelect,
		onNavigate = null, // (path) => void - called when user navigates to a directory
		// Optional file operations
		showFileActions = false,
		showHidden = false,
		onFileOpen = null, // (file) => void
		onFileUpload = null, // (files, currentDirectory) => void
		// Control initial state
		isAlwaysOpen = false, // Force the browser to stay open (don't show collapsed state)
		// Root folder constraint
		rootFolder = '/', // Root folder that user cannot navigate outside of
		// UI customization
		showBreadcrumbs = true, // Show breadcrumb navigation
		showGitOperations = true // Show Git operations toolbar
	} = $props();

	// ViewModel instance
	const vm = new DirectoryBrowserViewModel({
		api,
		startPath,
		rootFolder,
		showHidden
	});

	// UI state
	let isOpen = $state(isAlwaysOpen);
	let fileInputId = $state(`file-upload-${Math.random().toString(36).substr(2, 9)}`);

	// Derived display value
	let displaySelection = $derived.by(() =>
		selected && String(selected).trim() ? selected : placeholder
	);

	/**
	 * Handle directory selection
	 * @param {string} path - Directory path to select
	 */
	function selectDirectory(path) {
		selected = path;
		onSelect?.(path);
		if (!isAlwaysOpen) {
			isOpen = false;
		}
	}

	/**
	 * Handle directory navigation
	 * @param {string} path - Directory path to navigate to
	 */
	function handleNavigate(path) {
		vm.navigateTo(path, onNavigate);
	}

	/**
	 * Handle breadcrumb navigation
	 * @param {string} path - Directory path from breadcrumb
	 */
	function handleBreadcrumbNavigate(path) {
		vm.navigateTo(path, onNavigate);
	}

	/**
	 * Select current directory
	 */
	function selectCurrent() {
		selectDirectory(vm.currentPath);
	}

	/**
	 * Handle parent directory navigation
	 */
	function handleGoUp() {
		vm.goUp(onNavigate);
	}

	/**
	 * Handle new directory creation
	 */
	async function handleCreateDirectory() {
		const newPath = await vm.createNewDirectory();
		if (newPath) {
			selectDirectory(newPath);
		}
	}

	/**
	 * Handle directory cloning
	 */
	async function handleCloneDirectory() {
		const newPath = await vm.cloneDirectory();
		if (newPath) {
			selectDirectory(newPath);
		}
	}

	/**
	 * Handle file upload
	 */
	async function handleFileUpload() {
		if (!vm.uploadFiles || vm.uploadFiles.length === 0 || !onFileUpload) return;
		await vm.handleFileUpload(vm.uploadFiles, onFileUpload);
	}

	/**
	 * Trigger file upload dialog
	 */
	function triggerFileUpload() {
		const fileInput = document.getElementById(fileInputId);
		if (fileInput) {
			fileInput.click();
		}
	}

	/**
	 * Handle file opening
	 * @param {object} file - File entry object
	 */
	function handleFileOpen(file) {
		if (onFileOpen) {
			onFileOpen(file);
		}
	}

	// Initialize on mount
	onMount(() => {
		console.log('[DirectoryBrowser] Initializing with startPath:', startPath, vm.currentPath);
		vm.browse(vm.currentPath).then(() => {
			// Initialize selected path if not set
			if (!selected && vm.currentPath) {
				selected = vm.currentPath;
			}
		});
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
		{#if showBreadcrumbs}
			<DirectoryBreadcrumbs
				breadcrumbs={vm.breadcrumbs}
				{selected}
				loading={vm.loading}
				{isAlwaysOpen}
				onNavigate={handleBreadcrumbNavigate}
				onClose={() => (isOpen = false)}
			/>
		{/if}

		<!-- Git Operations -->
		{#if showGitOperations}
			<div class="container">
				<GitOperations
					currentPath={vm.currentPath}
					onRefresh={() => vm.browse(vm.currentPath)}
					onError={(/** @type {string} */ err, /** @type {number?} */ status) => vm.handleGitError(err, status)}
				/>
			</div>
		{/if}

		<!-- Search bar and actions -->
		<DirectorySearchBar
			bind:query={vm.query}
			{placeholder}
			loading={vm.loading}
			showHidden={vm.showHidden}
			{isAlwaysOpen}
			{showFileActions}
			uploading={vm.uploading}
			onSelectCurrent={selectCurrent}
			onToggleNewDir={() => vm.toggleNewDirInput()}
			onToggleClone={() => vm.initCloneFromCurrent()}
			onToggleHidden={() => vm.toggleHidden()}
			onTriggerUpload={onFileUpload ? triggerFileUpload : null}
		/>

		<!-- File upload input (hidden) -->
		{#if showFileActions && onFileUpload}
			<input
				type="file"
				multiple
				bind:files={vm.uploadFiles}
				style="display: none"
				id={fileInputId}
				onchange={handleFileUpload}
			/>
		{/if}

		<!-- New directory form -->
		{#if vm.showNewDirInput}
			<NewDirectoryForm
				bind:dirName={vm.newDirName}
				creating={vm.creatingDir}
				onCreate={handleCreateDirectory}
				onCancel={() => vm.toggleNewDirInput()}
			/>
		{/if}

		<!-- Clone directory form -->
		{#if vm.showCloneDirInput}
			<CloneDirectoryForm
				bind:sourcePath={vm.cloneSourcePath}
				bind:targetPath={vm.cloneTargetPath}
				bind:overwrite={vm.cloneOverwrite}
				cloning={vm.cloningDir}
				onClone={handleCloneDirectory}
				onCancel={() => vm.toggleCloneDirInput()}
			/>
		{/if}

		<!-- Status bar (errors/loading) -->
		{#if vm.loading || vm.error}
			<div class="px-3 py-2 text-sm">
				{#if vm.loading}
					<span class="loading-state">Loading...</span>
				{/if}
				{#if vm.error}
					<span class="error-state">{vm.error}</span>
				{/if}
			</div>
		{/if}

		<!-- Directory listing -->
		<DirectoryList
			entries={vm.filtered}
			selectedPath={selected}
			currentPath={vm.currentPath}
			loading={vm.loading}
			{isAlwaysOpen}
			{showFileActions}
			showParentDirectory={!vm.isInRoot}
			query={vm.query}
			onNavigate={handleNavigate}
			onGoUp={handleGoUp}
			onSelectDirectory={selectDirectory}
			onFileOpen={handleFileOpen}
		/>
	</div>
{/if}

<style>
	/* ==================================================================
   ENHANCED DIRECTORY BROWSER UTILITIES
   Modern file browser with glassmorphism and micro-interactions
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
		border-radius: var(--radius-lg);
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

	.directory-icon-enhanced {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--space-5);
		height: var(--space-5);
		color: var(--accent-amber);
		transition: all 0.2s ease;
	}
</style>
