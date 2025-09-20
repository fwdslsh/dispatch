<script>
	import Button from '../shared/components/Button.svelte';
	import IconButton from '../shared/components/IconButton.svelte';
	import IconFile from '../shared/components/Icons/IconFile.svelte';
	import IconFileCode from '../shared/components/Icons/IconFileCode.svelte';
	import IconFileText from '../shared/components/Icons/IconFileText.svelte';
	import IconFolder from '../shared/components/Icons/IconFolder.svelte';
	import IconUpload from '../shared/components/Icons/IconUpload.svelte';
	import IconDownload from '../shared/components/Icons/IconDownload.svelte';
	import IconEdit from '../shared/components/Icons/IconEdit.svelte';
	import IconCheck from '../shared/components/Icons/IconCheck.svelte';
	import IconX from '../shared/components/Icons/IconX.svelte';
	import IconTrash from '../shared/components/Icons/IconTrash.svelte';
	import IconArrowLeft from '../shared/components/Icons/IconArrowLeft.svelte';
	import { onMount, onDestroy } from 'svelte';

	// Props
	let { sessionId, workspacePath = '' } = $props();

	// State
	let currentDirectory = $state(workspacePath || '');
	let files = $state([]);
	let selectedFile = $state(null);
	let fileContent = $state('');
	let originalContent = $state('');
	let isEditing = $state(false);
	let hasChanges = $state(false);
	let loading = $state(false);
	let error = $state(null);
	let uploadFiles = $state(null);

	// Reactive derivations
	let isDirty = $derived(fileContent !== originalContent);
	let canSave = $derived(isDirty && selectedFile && !loading);

	// File browsing
	async function loadDirectory(path = currentDirectory) {
		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to load directory');
			}

			files = result.entries || [];
			currentDirectory = path;
		} catch (err) {
			error = err.message;
			files = [];
		} finally {
			loading = false;
		}
	}

	// Navigate to parent directory
	function goUp() {
		if (currentDirectory === '/') return;
		const parent = currentDirectory.split('/').slice(0, -1).join('/') || '/';
		loadDirectory(parent);
	}

	// Navigate to subdirectory
	function enterDirectory(dir) {
		const newPath = currentDirectory === '/' ? `/${dir.name}` : `${currentDirectory}/${dir.name}`;
		loadDirectory(newPath);
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
			// Refresh the file list to show updated timestamps
			await loadDirectory(currentDirectory);
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	// Upload files
	async function handleFileUpload() {
		if (!uploadFiles || uploadFiles.length === 0) return;

		loading = true;
		error = null;

		try {
			const formData = new FormData();
			for (const file of uploadFiles) {
				formData.append('files', file);
			}
			formData.append('directory', currentDirectory);

			const response = await fetch('/api/files/upload', {
				method: 'POST',
				body: formData
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to upload files');
			}

			// Refresh the file list to show uploaded files
			await loadDirectory(currentDirectory);
			uploadFiles = null;
		} catch (err) {
			error = err.message;
		} finally {
			loading = false;
		}
	}

	// Close file editor
	function closeFile() {
		if (isDirty && !confirm('You have unsaved changes. Are you sure you want to close?')) {
			return;
		}

		selectedFile = null;
		fileContent = '';
		originalContent = '';
		isEditing = false;
	}

	// Format file size
	function formatFileSize(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
	}

	// Format file modification time
	function formatModified(isoString) {
		return new Date(isoString).toLocaleString();
	}

	// Initialize
	onMount(() => {
		loadDirectory(currentDirectory);
	});
</script>

<div class="file-editor-pane">
	<!-- Header -->
	<div class="file-editor-header">
		<div class="header-title">
			<IconEdit size={20} />
			<span>File Editor</span>
		</div>
		
		{#if selectedFile}
			<div class="file-actions">
				<IconButton 
					icon={IconCheck} 
					title="Save file" 
					disabled={!canSave}
					onclick={saveFile}
				/>
				<IconButton 
					icon={IconX} 
					title="Close file" 
					onclick={closeFile}
				/>
			</div>
		{/if}
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
			<!-- File browser view -->
			<div class="file-browser">
				<!-- Directory navigation -->
				<div class="directory-nav">
					<div class="current-path">
						<IconFolder size={16} />
						<span>{currentDirectory}</span>
					</div>
					
					<div class="nav-actions">
						{#if currentDirectory !== '/'}
							<IconButton 
								icon={IconArrowLeft} 
								title="Go up" 
								onclick={goUp}
							/>
						{/if}
					</div>
				</div>

				<!-- File upload area -->
				<div class="upload-area">
					<input 
						type="file" 
						multiple 
						bind:files={uploadFiles} 
						style="display: none" 
						id="file-upload"
						onchange={handleFileUpload}
					/>
					<Button 
						variant="secondary" 
						onclick={() => document.getElementById('file-upload').click()}
						disabled={loading}
					>
						<IconUpload size={16} />
						Upload Files
					</Button>
				</div>

				<!-- File list -->
				<div class="file-list">
					{#if loading}
						<div class="loading">Loading...</div>
					{:else if files.length === 0}
						<div class="empty">No files in this directory</div>
					{:else}
						{#each files as file (file.path)}
							<div class="file-item" class:directory={file.isDirectory}>
								<button 
									class="file-button"
									onclick={() => file.isDirectory ? enterDirectory(file) : loadFile(file)}
									disabled={loading}
								>
									<div class="file-icon">
										{#if file.isDirectory}
											<IconFolder size={16} />
										{:else}
											{@const ext = file.name.split('.').pop()?.toLowerCase()}
											{@const codeExtensions = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml', 'yml', 'yaml']}
											{@const textExtensions = ['txt', 'md', 'log', 'cfg', 'ini', 'conf']}
											{#if codeExtensions.includes(ext)}
												<IconFileCode size={16} />
											{:else if textExtensions.includes(ext)}
												<IconFileText size={16} />
											{:else}
												<IconFile size={16} />
											{/if}
										{/if}
									</div>
									<div class="file-info">
										<div class="file-name">{file.name}</div>
										{#if !file.isDirectory}
											<div class="file-meta">
												{formatFileSize(file.size)} • {formatModified(file.modified)}
											</div>
										{/if}
									</div>
								</button>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{:else}
			<!-- File editor view -->
			<div class="file-editor">
				<!-- File header -->
				<div class="file-header">
					<div class="file-title">
						{#if selectedFile.isDirectory}
							<IconFolder size={16} />
						{:else}
							{@const ext = selectedFile.name.split('.').pop()?.toLowerCase()}
							{@const codeExtensions = ['js', 'ts', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml', 'yml', 'yaml']}
							{@const textExtensions = ['txt', 'md', 'log', 'cfg', 'ini', 'conf']}
							{#if codeExtensions.includes(ext)}
								<IconFileCode size={16} />
							{:else if textExtensions.includes(ext)}
								<IconFileText size={16} />
							{:else}
								<IconFile size={16} />
							{/if}
						{/if}
						<span>{selectedFile.name}</span>
						{#if isDirty}
							<span class="dirty-indicator">*</span>
						{/if}
					</div>
				</div>

				<!-- Editor -->
				<div class="editor-container">
					<textarea
						bind:value={fileContent}
						placeholder="File content..."
						disabled={loading}
						class="editor-textarea"
						spellcheck="false"
					></textarea>
				</div>

				<!-- Editor footer -->
				<div class="editor-footer">
					<div class="file-info">
						{selectedFile.path}
					</div>
					<div class="editor-actions">
						{#if isDirty}
							<span class="changes-indicator">Unsaved changes</span>
						{/if}
						<Button 
							variant="primary" 
							onclick={saveFile} 
							disabled={!canSave}
							loading={loading}
						>
							<IconCheck size={16} />
							Save
						</Button>
					</div>
				</div>
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

	.file-actions {
		display: flex;
		gap: 0.5rem;
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
	}

	.directory-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.current-path {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	.nav-actions {
		display: flex;
		gap: 0.5rem;
	}

	.upload-area {
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.file-list {
		flex: 1;
		overflow-y: auto;
	}

	.file-item {
		border-bottom: 1px solid var(--color-border);
	}

	.file-button {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: none;
		border: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.file-button:hover {
		background: var(--color-surface-hover);
	}

	.file-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.file-icon {
		flex-shrink: 0;
	}

	.file-info {
		flex: 1;
		min-width: 0;
	}

	.file-name {
		font-weight: 500;
		word-break: break-word;
	}

	.file-meta {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		margin-top: 0.25rem;
	}

	.directory .file-name {
		color: var(--color-primary);
	}

	.loading, .empty {
		padding: 2rem;
		text-align: center;
		color: var(--color-text-secondary);
	}

	.file-editor {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	.file-header {
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.file-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: 600;
	}

	.dirty-indicator {
		color: var(--color-warning);
		font-weight: bold;
	}

	.editor-container {
		flex: 1;
		display: flex;
		overflow: hidden;
	}

	.editor-textarea {
		flex: 1;
		padding: 1rem;
		border: none;
		background: var(--color-surface);
		color: var(--color-text);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		line-height: 1.5;
		resize: none;
		outline: none;
		tab-size: 2;
	}

	.editor-textarea:disabled {
		opacity: 0.7;
	}

	.editor-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 1rem;
		border-top: 1px solid var(--color-border);
		background: var(--color-surface-elevated);
	}

	.file-info {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		word-break: break-all;
	}

	.editor-actions {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.changes-indicator {
		font-size: 0.75rem;
		color: var(--color-warning);
	}
</style>