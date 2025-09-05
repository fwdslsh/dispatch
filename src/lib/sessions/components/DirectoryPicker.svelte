<script>
	let {
		socket = null,
		projectId = null,
		selectedPath = '',
		disabled = false,
		onselect = () => {}
	} = $props();

	let isOpen = $state(false);
	let currentPath = $state('');
	let directories = $state([]);
	let loading = $state(false);
	let error = $state(null);
	let pathHistory = $state([]);

	// Navigation state
	let breadcrumbs = $state([]);

	$effect(() => {
		if (currentPath) {
			breadcrumbs = ['/', ...currentPath.split('/').filter(Boolean)];
		} else {
			breadcrumbs = ['/'];
		}
	});

	$effect(() => {
		// Load root directories when component mounts
		if (socket && projectId) {
			loadDirectories('');
		}
	});

	function togglePicker() {
		if (disabled) return;

		isOpen = !isOpen;
		if (isOpen && (!directories.length || currentPath !== '')) {
			loadDirectories('');
		}
	}

	async function loadDirectories(relativePath) {
		if (!socket || !projectId) return;

		loading = true;
		error = null;

		try {
			const response = await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => {
					reject(new Error('Request timeout'));
				}, 5000);

				socket.emit(
					'list-project-directories',
					{
						projectId,
						relativePath
					},
					(res) => {
						clearTimeout(timeout);
						if (res.success) {
							resolve(res);
						} else {
							reject(new Error(res.error || 'Failed to load directories'));
						}
					}
				);
			});

			directories = response.directories || [];
			currentPath = relativePath;
		} catch (err) {
			console.error('Failed to load directories:', err);
			error = err.message;
			directories = [];
		} finally {
			loading = false;
		}
	}

	function navigateToDirectory(dirName) {
		const newPath = currentPath ? `${currentPath}/${dirName}` : dirName;
		pathHistory.push(currentPath);
		loadDirectories(newPath);
	}

	function navigateToBreadcrumb(index) {
		let newPath = '';
		if (index > 0) {
			newPath = breadcrumbs.slice(1, index + 1).join('/');
		}
		pathHistory.push(currentPath);
		loadDirectories(newPath);
	}

	function goBack() {
		if (pathHistory.length > 0) {
			const previousPath = pathHistory.pop();
			loadDirectories(previousPath);
		}
	}

	function selectCurrentDirectory() {
		selectedPath = currentPath;
		onselect({ detail: { path: currentPath } });
		isOpen = false;
	}

	function clearSelection() {
		selectedPath = '';
		onselect({ detail: { path: '' } });
	}

	function selectDirectory(dirName) {
		const fullPath = currentPath ? `${currentPath}/${dirName}` : dirName;
		selectedPath = fullPath;
		onselect({ detail: { path: fullPath } });
		isOpen = false;
	}
</script>

<div class="directory-picker">
	<div class="picker-input">
		<label>Working Directory (optional)</label>
		<div class="input-container">
			<input
				type="text"
				bind:value={selectedPath}
				placeholder="/ (project root)"
				readonly
				class="directory-input"
				class:disabled
			/>
			<button
				type="button"
				class="browse-btn"
				onclick={togglePicker}
				disabled={disabled || !socket || !projectId}
				title="Browse directories"
			>
				📁
			</button>
			{#if selectedPath}
				<button
					type="button"
					class="clear-btn"
					onclick={clearSelection}
					{disabled}
					title="Clear selection"
				>
					✕
				</button>
			{/if}
		</div>
		<div class="help-text">
			Select a specific folder within the project as the working directory for this Claude session.
		</div>
	</div>

	{#if isOpen}
		<div class="picker-dropdown">
			<div class="picker-header">
				<div class="breadcrumbs">
					{#each breadcrumbs as crumb, index}
						<button
							class="breadcrumb"
							class:active={index === breadcrumbs.length - 1}
							onclick={() => navigateToBreadcrumb(index)}
						>
							{crumb === '/' ? '🏠' : crumb}
						</button>
						{#if index < breadcrumbs.length - 1}
							<span class="breadcrumb-separator">/</span>
						{/if}
					{/each}
				</div>
				<div class="picker-actions">
					{#if pathHistory.length > 0}
						<button class="nav-btn" onclick={goBack} title="Go back"> ← </button>
					{/if}
					<button
						class="select-current-btn"
						onclick={selectCurrentDirectory}
						title="Select current directory"
					>
						Select "{currentPath || '/'}"
					</button>
				</div>
			</div>

			<div class="picker-content">
				{#if loading}
					<div class="loading">Loading directories...</div>
				{:else if error}
					<div class="error">
						Error: {error}
						<button class="retry-btn" onclick={() => loadDirectories(currentPath)}> Retry </button>
					</div>
				{:else if directories.length === 0}
					<div class="empty">No subdirectories found</div>
				{:else}
					<div class="directories-list">
						{#each directories as dir}
							<div class="directory-item">
								<button
									class="directory-name"
									onclick={() => navigateToDirectory(dir.name)}
									title="Navigate into {dir.name}"
								>
									📁 {dir.name}
								</button>
								<button
									class="select-dir-btn"
									onclick={() => selectDirectory(dir.name)}
									title="Select {dir.name}"
								>
									Select
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.directory-picker {
		position: relative;
		margin-bottom: var(--space-sm);
	}

	.picker-input label {
		display: block;
		margin-bottom: var(--space-xs);
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	.input-container {
		display: flex;
		gap: var(--space-xs);
		align-items: stretch;
	}

	.directory-input {
		flex: 1;
		padding: var(--space-xs) var(--space-sm);
		background: rgba(26, 26, 26, 0.8);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 4px;
		color: var(--text-primary);
		font-size: 0.9rem;
		font-family: 'Courier New', monospace;
	}

	.directory-input:focus {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.1);
	}

	.directory-input.disabled {
		background: rgba(26, 26, 26, 0.4);
		color: var(--text-muted);
		cursor: not-allowed;
	}

	.browse-btn,
	.clear-btn {
		padding: var(--space-xs);
		background: rgba(0, 255, 136, 0.1);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 4px;
		color: var(--accent);
		cursor: pointer;
		transition: all 0.2s ease;
		font-size: 0.9rem;
		width: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.browse-btn:hover:not(:disabled),
	.clear-btn:hover:not(:disabled) {
		background: rgba(0, 255, 136, 0.2);
		border-color: var(--accent);
	}

	.browse-btn:disabled,
	.clear-btn:disabled {
		background: rgba(26, 26, 26, 0.4);
		color: var(--text-muted);
		cursor: not-allowed;
	}

	.help-text {
		margin-top: var(--space-xs);
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.3;
	}

	.picker-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 1000;
		background: rgba(26, 26, 26, 0.95);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 6px;
		backdrop-filter: blur(10px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		max-height: 300px;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.picker-header {
		padding: var(--space-sm);
		border-bottom: 1px solid rgba(0, 255, 136, 0.2);
		background: rgba(26, 26, 26, 0.8);
	}

	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin-bottom: var(--space-xs);
		flex-wrap: wrap;
	}

	.breadcrumb {
		background: rgba(0, 255, 136, 0.1);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 3px;
		padding: var(--space-xs);
		color: var(--accent);
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s ease;
	}

	.breadcrumb:hover {
		background: rgba(0, 255, 136, 0.2);
	}

	.breadcrumb.active {
		background: var(--accent);
		color: var(--bg);
	}

	.breadcrumb-separator {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.picker-actions {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
	}

	.nav-btn,
	.select-current-btn,
	.retry-btn {
		padding: var(--space-xs) var(--space-sm);
		background: rgba(0, 255, 136, 0.1);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 4px;
		color: var(--accent);
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s ease;
	}

	.nav-btn:hover,
	.select-current-btn:hover,
	.retry-btn:hover {
		background: rgba(0, 255, 136, 0.2);
		border-color: var(--accent);
	}

	.select-current-btn {
		background: var(--accent);
		color: var(--bg);
		font-weight: 500;
	}

	.select-current-btn:hover {
		background: rgba(0, 255, 136, 0.8);
	}

	.picker-content {
		flex: 1;
		overflow-y: auto;
		max-height: 200px;
	}

	.loading,
	.error,
	.empty {
		padding: var(--space-md);
		text-align: center;
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	.error {
		color: var(--error);
	}

	.directories-list {
		padding: var(--space-xs);
	}

	.directory-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs);
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.directory-item:hover {
		background: rgba(0, 255, 136, 0.05);
	}

	.directory-name {
		flex: 1;
		text-align: left;
		background: none;
		border: none;
		color: var(--text-primary);
		cursor: pointer;
		padding: var(--space-xs);
		border-radius: 3px;
		transition: background-color 0.2s ease;
		font-size: 0.9rem;
	}

	.directory-name:hover {
		background: rgba(0, 255, 136, 0.1);
	}

	.select-dir-btn {
		padding: var(--space-xs) var(--space-sm);
		background: rgba(0, 255, 136, 0.1);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 3px;
		color: var(--accent);
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s ease;
	}

	.select-dir-btn:hover {
		background: var(--accent);
		color: var(--bg);
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.picker-dropdown {
			max-height: 250px;
		}

		.breadcrumbs {
			font-size: 0.75rem;
		}

		.directory-item {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-xs);
		}

		.directory-name {
			text-align: center;
		}

		.select-dir-btn {
			align-self: stretch;
			text-align: center;
		}
	}
</style>
