<script>
	import DirectoryBrowser from '../shared/components/DirectoryBrowser.svelte';
	import FileEditor from '../shared/components/FileEditor.svelte';
	import { onMount } from 'svelte';

	// Props
	let { sessionId, workspacePath = '' } = $props();

	// State
	let currentDirectory = $state(workspacePath || '');
	let fileDirectory = $state(''); // Track the directory containing the currently opened file
	let selectedFile = $state(null);
	let fileContent = $state('');
	let originalContent = $state('');
	let isEditing = $state(false);
	let loading = $state(false);
	let error = $state(null);

	// Reactive derivations
	let isDirty = $derived(fileContent !== originalContent);
	let canSave = $derived(isDirty && selectedFile && !loading);

	// Storage key for this session's file editor state
	const FILE_EDITOR_STATE_KEY = `dispatch-file-editor-${sessionId}`;

	// Save current state to localStorage
	function saveEditorState() {
		if (typeof localStorage === 'undefined') return;

		const state = {
			currentDirectory,
			fileDirectory,
			selectedFile,
			isEditing
		};

		try {
			localStorage.setItem(FILE_EDITOR_STATE_KEY, JSON.stringify(state));
		} catch (e) {
			console.warn('Failed to save file editor state:', e);
		}
	}

	// Load state from localStorage
	function loadEditorState() {
		if (typeof localStorage === 'undefined') return null;

		try {
			const raw = localStorage.getItem(FILE_EDITOR_STATE_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (e) {
			console.warn('Failed to load file editor state:', e);
			return null;
		}
	}

	// Load file content
	async function loadFile(file) {
		if (isDirty && !confirm('You have unsaved changes. Are you sure you want to switch files?')) {
			return;
		}

		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/files?path=${encodeURIComponent(file.path)}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load file');
			}

			selectedFile = file;
			fileContent = result.content;
			originalContent = result.content;
			isEditing = true;
			saveEditorState();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	// Save file content
	async function saveFile() {
		if (!selectedFile || !canSave) return;

		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/files?path=${encodeURIComponent(selectedFile.path)}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ content: fileContent })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to save file');
			}

			originalContent = fileContent;
			// File saved successfully - return to directory browser at file's directory
			currentDirectory = fileDirectory;
			closeFile();
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	// Handle file upload from DirectoryBrowser
	async function handleFileUpload(files, directory) {
		if (!files || files.length === 0) return;

		loading = true;
		error = null;

		try {
			const formData = new FormData();
			for (const file of files) {
				formData.append('files', file);
			}
			formData.append('directory', directory);

			const response = await fetch('/api/files/upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to upload files');
			}
		} catch (err) {
			error = err.message;
			throw err; // Re-throw so DirectoryBrowser can handle it
		} finally {
			loading = false;
		}
	}

	// Handle file opening from DirectoryBrowser
	function handleFileOpen(file) {
		// Store the file's directory
		fileDirectory = file.path.substring(0, file.path.lastIndexOf('/')) || '/';
		loadFile(file);
	}

	// Handle directory selection from DirectoryBrowser
	function handleDirectorySelect(path) {
		currentDirectory = path;
		saveEditorState();
	}

	// Handle directory navigation from DirectoryBrowser
	function handleDirectoryNavigate(path) {
		currentDirectory = path;
		saveEditorState();
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
		saveEditorState();
	}

	// Initialize
	onMount(() => {
		const savedState = loadEditorState();
		if (savedState?.currentDirectory) {
			currentDirectory = savedState.currentDirectory;
		}
		if (savedState?.fileDirectory) {
			fileDirectory = savedState.fileDirectory;
		}
	});
</script>

<div class="file-editor-pane">
	<!-- Error display -->
	{#if error}
		<div class="error-banner">
			{error}
		</div>
	{/if}

	<!-- Main content -->
	{#if !isEditing}
		<!-- File browser view using DirectoryBrowser component -->
		<div class="directory-browser-container">
			<DirectoryBrowser
				startPath={currentDirectory}
				placeholder="Browse files and directories..."
				showFileActions={true}
				isAlwaysOpen={true}
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
	/* FileEditorPane specific styles - minimal */
	.file-editor-pane {
		display: contents;
	}

	.error-banner {
		background: var(--color-error);
		color: var(--color-error-text);
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
	}

	.file-editor-container {
		height: 100%;
	}
	.directory-browser-container {
		height: 100%;
		overflow-y: auto;
	}
</style>
