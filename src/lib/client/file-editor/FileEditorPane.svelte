<script>
	import IconEdit from '../shared/components/Icons/IconEdit.svelte';
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
	}


	// Initialize
	onMount(() => {
		// DirectoryBrowser will handle initialization
	});
</script>

<div class="file-editor-pane">
	<!-- Header -->
	<div class="file-editor-header">
		<div class="header-title">
			<IconEdit size={20} />
			<span>File Editor</span>
		</div>
	</div>

	<!-- Error display -->
	{#if error}
		<div class="error-banner">
			{error}
		</div>
	{/if}

	<!-- Main content -->
	<div class="file-editor-content">
		{#if !isEditing}
			<!-- File browser view using DirectoryBrowser component -->
			<div class="file-browser">
				<DirectoryBrowser
					bind:selected={currentDirectory}
					startPath={currentDirectory || workspacePath}
					placeholder="Browse files and directories..."
					showFileActions={true}
					forceOpen={true}
					onSelect={handleDirectorySelect}
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
					originalContent={originalContent}
					loading={loading}
					onSave={saveFile}
					onCancel={handleFileCancel}
					onClose={closeFile}
				/>
			</div>
		{/if}
	</div>
</div>

<style>
	.file-editor-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-mono);
	}

	.file-editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
		background: var(--color-surface-elevated);
	}

	.header-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}


	.error-banner {
		background: var(--color-error);
		color: var(--color-error-text);
		padding: 0.75rem 1rem;
		font-size: 0.875rem;
	}

	.file-editor-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.file-browser {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 1rem;
		height: 100%;
	}

	.file-editor-container{
		height: 100%;
	}

</style>