<script>
	import DirectoryBrowser from '$lib/client/shared/components/directory-browser/DirectoryBrowser.svelte';
	import FileEditor from '$lib/client/shared/components/FileEditor.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import InfoBox from '$lib/client/shared/components/InfoBox.svelte';
	import { onMount } from 'svelte';
	import { getAuthHeaders } from '$lib/shared/api-helpers.js';

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
	let initializing = $state(true); // Track if we're still loading the home directory

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
		} catch (_error) {
			// State save failed - non-critical, will use server defaults on next load
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
		} catch (_error) {
			// State load failed - will use server defaults
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
			const response = await fetch(`/api/files?path=${encodeURIComponent(file.path)}`, {
				headers: getAuthHeaders()
			});
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
			const response = await fetch(`/api/files?path=${encodeURIComponent(selectedFile.path)}`, {
				method: 'PUT',
				headers: getAuthHeaders(),
				body: JSON.stringify({ content: fileContent })
			});

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

			const authHeaders = getAuthHeaders();
			delete authHeaders['Content-Type'];

			const response = await fetch('/api/files/upload', {
				method: 'POST',
				headers: authHeaders,
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

	// Initialize home directory by getting it from the server environment API
	async function initializeHomeDirectory() {
		try {
			initializing = true;
			// Get the server's home directory from the environment API
			const response = await fetch('/api/environment', {
				headers: getAuthHeaders()
			});
			const data = await response.json();

			if (response.ok && data.homeDirectory) {
				homeDirectory = data.homeDirectory;
				if (!currentDirectory) {
					currentDirectory = homeDirectory;
				}
			} else {
				error = 'Failed to load home directory from server';
			}
		} catch (_e) {
			error = 'Failed to connect to environment service';
		} finally {
			initializing = false;
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
	<header class="settings-header">
		<h3>Home Directory Manager</h3>
		<p class="settings-description">
			Browse and manage files in your home directory ({homeDirectory})
		</p>
	</header>

	<!-- Error display -->
	{#if error}
		<InfoBox variant="error">
			{error}
			<Button
				variant="ghost"
				size="small"
				augmented="none"
				onclick={() => (error = null)}
				ariaLabel="Dismiss error"
				class="error-dismiss"
				text="×"
			/>
		</InfoBox>
	{/if}

	<!-- Main content -->
	{#if initializing}
		<div class="loading-container">
			<p class="loading-text">Loading home directory...</p>
		</div>
	{:else if !isEditing}
		<!-- File browser view using DirectoryBrowser component -->
		<div class="directory-browser-container">
			<DirectoryBrowser
				api="/api/browse"
				startPath={currentDirectory}
				placeholder="Browse home directory..."
				showFileActions={true}
				showBreadcrumbs={false}
				showGitOperations={false}
				showHidden={true}
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
