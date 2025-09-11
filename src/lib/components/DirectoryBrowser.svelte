<script>
	// Svelte 5 Directory Browser Component
	let {
		selected = $bindable(), // selected directory path
		api = '/api/browse',
		startPath = '',
		placeholder = 'Browse directories...',
		onSelect
	} = $props();

	let currentPath = $state(startPath || '/');
	let loading = $state(false);
	let error = $state('');
	let entries = $state([]);
	let breadcrumbs = $state([]);
	let query = $state('');
	let filtered = $state([]);
	let showHidden = $state(false);
	let showNewDirInput = $state(false);
	let newDirName = $state('');
	let creatingDir = $state(false);

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
			const params = new URLSearchParams({ path, showHidden: showHidden.toString() });
			const res = await fetch(`${api}?${params}`);
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || `HTTP ${res.status}`);
			}
			const data = await res.json();
			currentPath = data.path || path;
			entries = data.entries || [];
			updateBreadcrumbs(currentPath);
			filter();
		} catch (e) {
			error = e.message || String(e);
			entries = [];
		} finally {
			loading = false;
		}
	}

	function filter() {
		const q = query.trim().toLowerCase();
		filtered = !q
			? entries
			: entries.filter((e) => e.name.toLowerCase().includes(q));
	}

	function navigateTo(path) {
		query = '';
		browse(path);
	}

	function selectDirectory(path) {
		selected = path;
		onSelect?.(path);
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
			const newDir = entries.find(e => e.name === dirName);
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

	// Initialize on mount
	$effect(() => {
		if (!entries.length && !loading && !error) {
			browse(currentPath);
		}
	});

	// Update filter when query changes
	$effect(() => {
		filter();
	});
</script>

<div class="directory-browser">
	<!-- Breadcrumb navigation -->
	<div class="breadcrumb-bar">
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
			<button
				type="button"
				class="action-btn"
				onclick={toggleNewDirInput}
				title="Create new directory"
				class:active={showNewDirInput}
			>
				📁+
			</button>
			<button
				type="button"
				class="action-btn"
				onclick={toggleHidden}
				title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
				class:active={showHidden}
			>
				{showHidden ? '👁️' : '👁️‍🗨️'}
			</button>
		</div>
	</div>

	<!-- Search bar -->
	<div class="search-bar">
		<input
			type="text"
			bind:value={query}
			placeholder={placeholder}
			disabled={loading}
			class="search-input"
		/>
		<button
			type="button"
			class="select-btn"
			onclick={selectCurrent}
			disabled={loading}
			title="Select current directory"
		>
			Select This Directory
		</button>
	</div>

	<!-- New directory input -->
	{#if showNewDirInput}
		<div class="new-dir-form">
			<input
				type="text"
				bind:value={newDirName}
				placeholder="Enter new directory name..."
				disabled={creatingDir}
				class="new-dir-input"
				onkeydown={(e) => e.key === 'Enter' && createNewDirectory()}
			/>
			<button
				type="button"
				class="create-btn"
				onclick={createNewDirectory}
				disabled={creatingDir || !newDirName.trim()}
			>
				{creatingDir ? 'Creating...' : 'Create'}
			</button>
			<button
				type="button"
				class="cancel-btn"
				onclick={toggleNewDirInput}
				disabled={creatingDir}
			>
				Cancel
			</button>
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
					<span class="icon">📁</span>
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
						<span class="icon">📁</span>
						<span class="name">{entry.name}</span>
						<span class="type">directory</span>
					</button>
					<button
						type="button"
						onclick={() => selectDirectory(entry.path)}
						disabled={loading}
						class="quick-select"
						title="Select this directory"
					>
						✓
					</button>
				{:else}
					<div class="item-button file">
						<span class="icon">📄</span>
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

	<!-- Selected path display -->
	{#if selected}
		<div class="selected-display">
			<span class="selected-label">Selected:</span>
			<span class="selected-path">{selected}</span>
			<button
				type="button"
				onclick={() => (selected = null)}
				class="clear-selection"
				title="Clear selection"
			>
				✕
			</button>
		</div>
	{/if}
</div>

<style>
	.directory-browser {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		border-radius: 8px;
		padding: var(--space-3);
		font-family: var(--font-mono);
		max-height: 400px;
		overflow: hidden;
	}

	/* Breadcrumb bar */
	.breadcrumb-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-panel);
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		min-height: 36px;
		overflow-x: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--primary-dim) transparent;
	}

	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		flex: 1;
		min-width: 0;
	}

	.breadcrumb-item {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		padding: var(--space-1) var(--space-2);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.2s ease;
		border-radius: 3px;
	}

	.breadcrumb-item:hover:not(:disabled) {
		color: var(--primary);
		background: rgba(46, 230, 107, 0.1);
	}

	.breadcrumb-item:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.separator {
		color: var(--text-muted);
		opacity: 0.5;
		font-size: var(--font-size-1);
	}

	.breadcrumb-actions {
		display: flex;
		gap: var(--space-2);
	}

	.action-btn {
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		color: var(--text-muted);
		padding: var(--space-1) var(--space-2);
		border-radius: 3px;
		cursor: pointer;
		font-size: var(--font-size-1);
		transition: all 0.2s ease;
	}

	.action-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.action-btn.active {
		background: var(--primary);
		color: var(--bg);
		border-color: var(--primary);
	}

	/* Search bar */
	.search-bar {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}

	.search-input {
		flex: 1;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-panel);
		border: 1px solid var(--primary-dim);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.search-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 1px var(--primary);
	}

	.search-input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.select-btn {
		padding: var(--space-2) var(--space-4);
		background: var(--primary);
		color: var(--bg);
		border: 1px solid var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 600;
		border-radius: 4px;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.2s ease;
	}

	.select-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--primary) 90%, white 10%);
		box-shadow: 0 0 8px rgba(46, 230, 107, 0.3);
	}

	.select-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* New directory form */
	.new-dir-form {
		display: flex;
		gap: var(--space-2);
		padding: var(--space-3);
		background: var(--bg-panel);
		border: 1px solid var(--primary);
		border-radius: 4px;
		align-items: center;
	}

	.new-dir-input {
		flex: 1;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-dark);
		border: 1px solid var(--primary-dim);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		border-radius: 4px;
		transition: all 0.2s ease;
	}

	.new-dir-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 1px var(--primary);
	}

	.new-dir-input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.create-btn {
		padding: var(--space-2) var(--space-4);
		background: var(--primary);
		color: var(--bg);
		border: 1px solid var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 600;
		border-radius: 4px;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.2s ease;
	}

	.create-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--primary) 90%, white 10%);
		box-shadow: 0 0 8px rgba(46, 230, 107, 0.3);
	}

	.create-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.cancel-btn {
		padding: var(--space-2) var(--space-3);
		background: var(--bg-dark);
		color: var(--text-muted);
		border: 1px solid var(--surface-border);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.cancel-btn:hover:not(:disabled) {
		background: var(--surface);
		color: var(--text);
		border-color: var(--primary-dim);
	}

	.cancel-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Status bar */
	.status-bar {
		padding: var(--space-2);
		background: var(--bg-panel);
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		font-size: var(--font-size-1);
	}

	.loading {
		color: var(--primary);
		font-style: italic;
	}

	.error {
		color: var(--error, #ff6b6b);
	}

	/* Directory list */
	.directory-list {
		flex: 1;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--primary-dim) transparent;
		min-height: 200px;
		background: var(--bg);
		border: 1px solid var(--primary-dim);
		border-radius: 4px;
		padding: var(--space-2);
	}

	.directory-list::-webkit-scrollbar {
		width: 6px;
	}

	.directory-list::-webkit-scrollbar-thumb {
		background: var(--primary-dim);
		border-radius: 3px;
	}

	.list-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-1);
	}

	.item-button {
		flex: 1;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: var(--bg-dark);
		border: 1px solid transparent;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		text-align: left;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.item-button:hover:not(:disabled):not(.file) {
		background: var(--bg-panel);
		border-color: var(--primary-dim);
		transform: translateX(2px);
	}

	.item-button.file {
		opacity: 0.6;
		cursor: default;
	}

	.item-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.parent-dir .item-button {
		color: var(--accent-amber);
	}

	.icon {
		font-size: 1.2em;
		flex-shrink: 0;
	}

	.name {
		flex: 1;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.type {
		font-size: var(--font-size-0);
		color: var(--text-muted);
		font-style: italic;
	}

	.quick-select {
		padding: var(--space-1) var(--space-2);
		background: var(--bg-panel);
		border: 1px solid var(--primary-dim);
		color: var(--primary);
		font-weight: bold;
		border-radius: 3px;
		cursor: pointer;
		transition: all 0.2s ease;
		flex-shrink: 0;
	}

	.quick-select:hover:not(:disabled) {
		background: var(--primary);
		color: var(--bg);
		border-color: var(--primary);
	}

	.quick-select:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.empty-message {
		text-align: center;
		padding: var(--space-6);
		color: var(--text-muted);
		font-style: italic;
	}

	/* Selected display */
	.selected-display {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: color-mix(in oklab, var(--bg) 90%, var(--primary) 10%);
		border: 1px solid var(--primary);
		border-radius: 4px;
		font-size: var(--font-size-1);
	}

	.selected-label {
		color: var(--primary);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: var(--font-size-0);
	}

	.selected-path {
		flex: 1;
		color: var(--text);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: var(--font-mono);
	}

	.clear-selection {
		background: transparent;
		border: 1px solid var(--text-muted);
		color: var(--text-muted);
		padding: 2px 6px;
		border-radius: 3px;
		cursor: pointer;
		font-size: var(--font-size-0);
		transition: all 0.2s ease;
	}

	.clear-selection:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.directory-browser {
			max-height: 60vh;
		}

		.breadcrumb-bar {
			flex-wrap: wrap;
		}

		.search-bar {
			flex-direction: column;
		}

		.select-btn {
			width: 100%;
		}
	}
</style>