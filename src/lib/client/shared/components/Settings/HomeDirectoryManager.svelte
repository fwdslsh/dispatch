<script>
	import DirectoryBrowser from '../DirectoryBrowser.svelte';
	import FileEditor from '../FileEditor.svelte';
	import { onMount } from 'svelte';

	// State
	let currentDirectory = $state(''); // Will be set to home directory
	let fileDirectory = $state(''); // Track the directory containing the currently opened file
	let selectedFile = $state(null);
	let fileContent = $state('');
	let originalContent = $state('');
	let isEditing = $state(false);
	let loading = $state(false);
	let error = $state(null);
	let homeDirectory = $state('');

	// Reactive derivations
	let isDirty = $derived(fileContent !== originalContent);
	let canSave = $derived(isDirty && selectedFile && !loading);

	// Storage key for home directory manager state
	const HOME_MANAGER_STATE_KEY = 'dispatch-home-manager-state';

	// Save current state to localStorage
	function saveManagerState() {
		if (typeof localStorage === 'undefined') return;

		const state = {
			currentDirectory,
			fileDirectory,
			selectedFile,
			timestamp: Date.now()
		};

		try {
			localStorage.setItem(HOME_MANAGER_STATE_KEY, JSON.stringify(state));
		} catch (error) {
			console.warn('[HomeDirectoryManager] Failed to save state:', error);
		}
	}

	// Load state from localStorage
	function loadManagerState() {
		if (typeof localStorage === 'undefined') return null;

		try {
			const saved = localStorage.getItem(HOME_MANAGER_STATE_KEY);
			if (saved) {
				const state = JSON.parse(saved);
				// Only load if state is recent (within 24 hours)
				if (Date.now() - state.timestamp < 24 * 60 * 60 * 1000) {
					return state;
				}
			}
		} catch (error) {
			console.warn('[HomeDirectoryManager] Failed to load state:', error);
		}
		return null;
	}

	// Load a file for editing
	async function loadFile(file) {
		if (!file || !file.path) {
			error = 'Invalid file selected';
			return;
		}

		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/files?path=${encodeURIComponent(file.path)}`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to load file');
			}

			selectedFile = file;
			fileContent = data.content || '';
			originalContent = fileContent;
			fileDirectory = currentDirectory; // Remember where we loaded the file from
			isEditing = true;
			saveManagerState();
		} catch (e) {
			error = e.message || 'Failed to load file';
			console.error('[HomeDirectoryManager] Load file error:', e);
		} finally {
			loading = false;
		}
	}

	// Save file
	async function saveFile() {
		if (!selectedFile || !canSave) return;

		loading = true;
		error = null;

		try {
			const response = await fetch(
				`/api/files?path=${encodeURIComponent(selectedFile.path)}`,
				{
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({ content: fileContent })
				}
			);

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to save file');
			}

			originalContent = fileContent;
			// Update file object with new stats
			selectedFile = { ...selectedFile, size: data.size, modified: data.modified };
			saveManagerState();
		} catch (e) {
			error = e.message || 'Failed to save file';
			console.error('[HomeDirectoryManager] Save file error:', e);
		} finally {
			loading = false;
		}
	}

	// Handle file upload
	async function handleFileUpload(files, currentPath) {
		if (!files || files.length === 0) return;

		loading = true;
		error = null;

		try {
			const formData = new FormData();
			Array.from(files).forEach((file) => {
				formData.append('files', file);
			});
			formData.append('directory', currentPath);

			const response = await fetch('/api/files/upload', {
				method: 'POST',
				body: formData
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Failed to upload files');
			}

			// Refresh the directory browser by setting currentDirectory again
			currentDirectory = currentPath;
			saveManagerState();
		} catch (e) {
			error = e.message || 'Failed to upload files';
			console.error('[HomeDirectoryManager] Upload error:', e);
		} finally {
			loading = false;
		}
	}

	// Handle file selection for opening
	function handleFileOpen(file) {
		// Save current directory for when we return
		fileDirectory = currentDirectory;
		loadFile(file);
	}

	// Handle directory selection from DirectoryBrowser
	function handleDirectorySelect(path) {
		currentDirectory = path;
		saveManagerState();
	}

	// Handle directory navigation from DirectoryBrowser
	function handleDirectoryNavigate(path) {
		currentDirectory = path;
		saveManagerState();
	}

	// Handle file cancel
	function handleFileCancel() {
		// Reset content to original
		fileContent = originalContent;
		// Return to directory browser at file's directory
		currentDirectory = fileDirectory;
		closeFile();
	}

	// Close file editor
	function closeFile() {
		const isDirty = fileContent !== originalContent;
		if (isDirty && !confirm('You have unsaved changes. Are you sure you want to close?')) {
			return;
		}

		selectedFile = null;
		fileContent = '';
		originalContent = '';
		isEditing = false;
		// Restore the file's directory when closing
		if (fileDirectory) {
			currentDirectory = fileDirectory;
		}
		saveManagerState();
	}

	// Initialize home directory by getting the base directory from the browse API
	async function initializeHomeDirectory() {
		try {
			// Get the base directory first to understand the structure
			const response = await fetch('/api/browse');
			const data = await response.json();
			
			if (response.ok) {
				// In development, WORKSPACES_ROOT is .testing-home/workspaces  
				// So the HOME directory is one level up from that
				const workspacesPath = data.path;
				if (workspacesPath.includes('workspaces')) {
					homeDirectory = workspacesPath.replace('/workspaces', '');
				} else {
					// Fallback to the path itself
					homeDirectory = workspacesPath;
				}
				
				if (!currentDirectory) {
					currentDirectory = homeDirectory;
				}
			} else {
				error = 'Failed to load home directory';
			}
		} catch (e) {
			error = 'Failed to connect to directory service';
			console.error('[HomeDirectoryManager] Init error:', e);
		}
	}

	// Initialize
	onMount(async () => {
		await initializeHomeDirectory();

		const savedState = loadManagerState();
		if (savedState?.currentDirectory && savedState.currentDirectory.startsWith(homeDirectory)) {
			currentDirectory = savedState.currentDirectory;
		}
		if (savedState?.fileDirectory && savedState.fileDirectory.startsWith(homeDirectory)) {
			fileDirectory = savedState.fileDirectory;
		}
	});
</script>

<div class="home-directory-manager">
	<!-- Header -->
	<div class="manager-header">
		<h3 class="manager-title">Home Directory Manager</h3>
		<p class="manager-description">
			Browse and manage files in your home directory ({homeDirectory})
		</p>
	</div>

	<!-- Error display -->
	{#if error}
		<div class="error-banner">
			<span class="error-text">{error}</span>
			<button class="error-dismiss" onclick={() => (error = null)}>×</button>
		</div>
	{/if}

	<!-- Main content -->
	{#if !isEditing}
		<!-- File browser view using DirectoryBrowser component -->
		<div class="directory-browser-container">
			<DirectoryBrowser
				api="/api/browse"
				startPath={currentDirectory}
				placeholder="Browse home directory..."
				showFileActions={true}
				isAlwaysOpen={true}
				rootFolder={homeDirectory}
				onSelect={handleDirectorySelect}
				onNavigate={handleDirectoryNavigate}
				onFileOpen={handleFileOpen}
				onFileUpload={handleFileUpload}
			/>
		</div>
	{:else}
		<!-- File editor view -->
		<div class="file-editor-container">
			<FileEditor
				file={selectedFile}
				bind:content={fileContent}
				{originalContent}
				{loading}
				onSave={saveFile}
				onCancel={handleFileCancel}
				onClose={closeFile}
			/>
		</div>
	{/if}
</div>

<style>
	.home-directory-manager {
		height: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.manager-header {
		padding: var(--space-3) 0;
		border-bottom: 1px solid var(--border-color);
	}

	.manager-title {
		margin: 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary);
		font-family: var(--font-mono);
	}

	.manager-description {
		margin: var(--space-2) 0 0 0;
		font-size: 0.875rem;
		color: var(--text-muted);
		font-family: var(--font-mono);
	}

	.error-banner {
		background: var(--color-error, #dc2626);
		color: var(--color-error-text, white);
		padding: var(--space-3);
		border-radius: var(--radius);
		font-size: 0.875rem;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}

	.error-text {
		flex: 1;
	}

	.error-dismiss {
		background: transparent;
		border: none;
		color: inherit;
		cursor: pointer;
		font-size: 1.125rem;
		font-weight: bold;
		padding: 0;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		transition: background-color 0.2s ease;
	}

	.error-dismiss:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.directory-browser-container {
		flex: 1;
		overflow: hidden;
	}

	.file-editor-container {
		flex: 1;
		overflow: hidden;
	}
</style>
