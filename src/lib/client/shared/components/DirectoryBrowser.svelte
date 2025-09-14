<script>
	import { Button } from '$lib/client/shared/components';
	import {
		IconFolder,
		IconFolderPlus,
		IconEye,
		IconEyeOff,
		IconX,
		IconFile,
		IconCheck
	} from '@tabler/icons-svelte';
	import { STORAGE_CONFIG } from '$lib/shared/constants.js';
	import IconButton from './IconButton.svelte';
	import Input from './Input.svelte';

	// Svelte 5 Directory Browser Component
	let {
		selected = $bindable(), // selected directory path
		api = '/api/browse',
		startPath = '',
		placeholder = 'Browse directories...',
		onSelect
	} = $props();

	// Determine initial path:
	// - Prefer explicit startPath prop if provided
	// - Otherwise use user's saved defaultWorkingDirectory from settings (if any)
	// - Otherwise leave empty and let API default to WORKSPACES_ROOT
	function getUserDefaultDirectory() {
		try {
			if (typeof localStorage === 'undefined') return '';
			const raw = localStorage.getItem(STORAGE_CONFIG.SETTINGS_KEY);
			if (!raw) return '';
			const settings = JSON.parse(raw);
			return settings?.defaultWorkingDirectory || '';
		} catch (e) {
			return '';
		}
	}

	let initialPath = startPath || getUserDefaultDirectory() || '';

	// Start in the user's default directory when set; otherwise API defaults to WORKSPACES_ROOT
	let currentPath = $state(initialPath);
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
	let triedFallback = $state(false);

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
			// If the preferred start path was invalid, gracefully fall back to default base
			if (path && !triedFallback) {
				triedFallback = true;
				await browse('');
				return;
			}
		} finally {
			loading = false;
		}
	}

	function filter() {
		const q = query.trim().toLowerCase();
		filtered = !q ? entries : entries.filter((e) => e.name.toLowerCase().includes(q));
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
	<div class="breadcrumb-bar" aria-label="Breadcrumbs">
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
		<!-- <div class="breadcrumb-actions">
			<Button
				type="button"
				class="action-btn"
				onclick={toggleNewDirInput}
				title="Create new directory"
				active={showNewDirInput}
			>
				<IconFolderPlus size={16} />
			</Button>
			<Button
				type="button"
				class="action-btn"
				onclick={toggleHidden}
				title={showHidden ? 'Hide hidden files' : 'Show hidden files'}
				active={showHidden}
			>
				{#if showHidden}
					<IconEye size={16} />
				{:else}
					<IconEyeOff size={16} />
				{/if}
			</Button>
		</div> -->
	</div>

	<!-- Selected path display -->
	{#if selected}
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
	{/if}
	<!-- Search bar -->
	<div class="search-bar">
		<Input type="text" bind:value={query} {placeholder} disabled={loading} class="search-input" />
		<Button
			type="button"
			
			onclick={selectCurrent}
			disabled={loading}
			title="Select current directory"
		>
			<IconCheck size={20} />
		</Button>
		<Button type="button" onclick={toggleNewDirInput} title="Create new directory" variant="ghost">
			<IconFolderPlus size={16} />
		</Button>
		<Button
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
		</Button>
	</div>

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
					<IconButton
						type="button"
						onclick={() => selectDirectory(entry.path)}
						disabled={loading}
						class="quick-select"
						title="Select this directory"
					>
						<IconCheck size={16} />
					</IconButton>
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
</div>

<style>
	/* CSS Variables for theming */
	.directory-browser {
		--db-primary: #2ee66b;
		--db-primary-bright: #4dff85;
		--db-primary-dim: rgba(46, 230, 107, 0.3);
		--db-primary-glow: rgba(46, 230, 107, 0.5);
		--db-accent: #1fa758;
		--db-bg-gradient-start: #0a1410;
		--db-bg-gradient-end: #061008;
		--db-surface: rgba(15, 25, 20, 0.8);
		--db-surface-elevated: rgba(20, 35, 28, 0.9);
		--db-border-subtle: rgba(46, 230, 107, 0.15);
		--db-border-strong: rgba(46, 230, 107, 0.4);
		--db-text-primary: #e8f5ed;
		--db-text-secondary: #a8d5ba;
		--db-text-muted: #6b9f7f;
		--db-shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.3);
		--db-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
		--db-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
		--db-shadow-glow: 0 0 20px var(--db-primary-glow);
		--db-transition-fast: 0.15s cubic-bezier(0.4, 0, 0.2, 1);
		--db-transition-smooth: 0.3s cubic-bezier(0.23, 1, 0.32, 1);
		--db-transition-bounce: 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
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
		position: relative;
		overflow: hidden;
		box-shadow:
			var(--db-shadow-lg),
			inset 0 2px 4px rgba(46, 230, 107, 0.05),
			inset 0 -1px 2px rgba(0, 0, 0, 0.5);
		transition: all var(--db-transition-smooth);
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

	@keyframes shimmer {
		0% {
			background-position: -200% 0;
		}
		100% {
			background-position: 200% 0;
		}
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

	.breadcrumb-actions {
		display: flex;
		gap: var(--space-2);
	}

	.action-btn {
		background: var(--db-surface);
		border: 1px solid var(--db-border-subtle);
		color: var(--db-text-muted);
		padding: calc(var(--space-1) * 1.3) calc(var(--space-2) * 1.2);
		border-radius: 8px;
		cursor: pointer;
		font-size: calc(var(--font-size-1) * 1.1);
		transition: all var(--db-transition-fast);
		position: relative;
		overflow: hidden;
		box-shadow: var(--db-shadow-sm);
	}

	.action-btn::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		background: radial-gradient(circle, var(--db-primary-glow) 0%, transparent 70%);
		transition: all var(--db-transition-smooth);
		transform: translate(-50%, -50%);
		border-radius: 50%;
	}

	.action-btn:hover {
		border-color: var(--db-border-strong);
		color: var(--db-primary-bright);
		transform: translateY(-2px);
		box-shadow:
			var(--db-shadow-md),
			0 0 12px var(--db-primary-glow);
	}

	.action-btn:hover::before {
		width: 100px;
		height: 100px;
	}

	.action-btn:active {
		transform: translateY(0);
	}

	.action-btn.active {
		background: linear-gradient(135deg, var(--db-primary) 0%, var(--db-accent) 100%);
		color: var(--bg);
		border-color: var(--db-primary);
		box-shadow:
			var(--db-shadow-md),
			0 0 16px var(--db-primary-glow),
			inset 0 1px 2px rgba(255, 255, 255, 0.2);
	}

	/* Search bar */
	.search-bar {
		display: flex;
		gap: calc(var(--space-2) * 1.3);
		align-items: center;
	}

	.search-input {
		flex: 1;
		padding: calc(var(--space-2) * 1.3) calc(var(--space-3) * 1.1);
		background: linear-gradient(135deg, var(--db-surface) 0%, var(--db-surface-elevated) 100%);
		border: 1px solid var(--db-border-subtle);
		color: var(--db-text-primary);
		font-family: var(--font-mono);
		font-size: calc(var(--font-size-1) * 0.95);
		font-weight: 400;
		letter-spacing: 0.01em;
		border-radius: 10px;
		transition: all var(--db-transition-fast);
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.2),
			inset 0 -1px 2px rgba(0, 0, 0, 0.1);
	}

	.search-input:hover {
		border-color: var(--db-border-strong);
		background: var(--db-surface-elevated);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--db-primary);
		box-shadow:
			0 0 0 3px var(--db-primary-dim),
			inset 0 2px 4px rgba(0, 0, 0, 0.1);
		background: linear-gradient(
			135deg,
			var(--db-surface-elevated) 0%,
			rgba(46, 230, 107, 0.05) 100%
		);
	}

	.search-input::placeholder {
		color: var(--db-text-muted);
		opacity: 0.6;
		font-style: italic;
	}

	.select-btn {
		padding: calc(var(--space-2) * 1.4) calc(var(--space-4) * 1.1);
		background: linear-gradient(135deg, var(--db-primary) 0%, var(--db-accent) 100%);
		color: var(--bg-dark);
		border: 1px solid var(--db-primary);
		font-family: var(--font-mono);
		font-size: calc(var(--font-size-1) * 0.95);
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		border-radius: 10px;
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--db-transition-smooth);
		box-shadow:
			0 4px 12px var(--db-primary-dim),
			inset 0 2px 4px rgba(255, 255, 255, 0.15),
			inset 0 -2px 4px rgba(0, 0, 0, 0.2);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
		position: relative;
		overflow: hidden;
		transform: perspective(1px) translateZ(0);
	}

	.select-btn::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 120%;
		height: 120%;
		background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
		transform: translate(-50%, -50%) scale(0);
		transition: transform var(--db-transition-smooth);
		border-radius: 50%;
	}

	.select-btn::after {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
		transition: left 0.6s ease;
	}

	.select-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, var(--db-primary-bright) 0%, var(--db-primary) 100%);
		transform: translateY(-2px) scale(1.02);
		box-shadow:
			0 6px 20px var(--db-primary-glow),
			0 0 30px var(--db-primary-dim),
			inset 0 2px 4px rgba(255, 255, 255, 0.25);
	}

	.select-btn:hover:not(:disabled)::before {
		transform: translate(-50%, -50%) scale(1);
	}

	.select-btn:hover:not(:disabled)::after {
		left: 100%;
	}

	.select-btn:active:not(:disabled) {
		transform: translateY(0) scale(1);
		box-shadow:
			0 2px 8px var(--db-primary-dim),
			inset 0 2px 4px rgba(0, 0, 0, 0.2);
	}

	.select-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		filter: grayscale(0.5);
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

	@keyframes expandIn {
		from {
			opacity: 0;
			transform: scaleY(0.8) translateY(-20px);
		}
		to {
			opacity: 1;
			transform: scaleY(1) translateY(0);
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

	.new-dir-input {
		flex: 1;
		padding: calc(var(--space-2) * 1.3) calc(var(--space-3) * 1.1);
		background: var(--db-bg-gradient-start);
		border: 1px solid var(--db-border-strong);
		color: var(--db-text-primary);
		font-family: var(--font-mono);
		font-size: calc(var(--font-size-1) * 0.95);
		font-weight: 400;
		letter-spacing: 0.01em;
		border-radius: 8px;
		transition: all var(--db-transition-fast);
		box-shadow:
			inset 0 2px 4px rgba(0, 0, 0, 0.3),
			inset 0 -1px 2px rgba(0, 0, 0, 0.2);
		z-index: 1;
	}

	.new-dir-input:hover {
		border-color: var(--db-primary);
		background: linear-gradient(
			135deg,
			var(--db-bg-gradient-start) 0%,
			rgba(46, 230, 107, 0.05) 100%
		);
	}

	.new-dir-input:focus {
		outline: none;
		border-color: var(--db-primary-bright);
		box-shadow:
			0 0 0 3px var(--db-primary-dim),
			inset 0 2px 4px rgba(0, 0, 0, 0.2);
		background: linear-gradient(
			135deg,
			var(--db-surface-elevated) 0%,
			rgba(46, 230, 107, 0.08) 100%
		);
	}

	.new-dir-input::placeholder {
		color: var(--db-text-muted);
		opacity: 0.5;
		font-style: italic;
	}

	.create-btn {
		padding: calc(var(--space-2) * 1.3) calc(var(--space-4) * 1.1);
		background: linear-gradient(135deg, var(--db-primary) 0%, var(--db-accent) 100%);
		color: var(--bg-dark);
		border: 1px solid var(--db-primary);
		font-family: var(--font-mono);
		font-size: calc(var(--font-size-1) * 0.95);
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		border-radius: 8px;
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--db-transition-fast);
		box-shadow:
			0 3px 10px var(--db-primary-dim),
			inset 0 2px 4px rgba(255, 255, 255, 0.2);
		position: relative;
		z-index: 1;
	}

	.create-btn:hover:not(:disabled) {
		background: linear-gradient(135deg, var(--db-primary-bright) 0%, var(--db-primary) 100%);
		transform: translateY(-2px);
		box-shadow:
			0 5px 15px var(--db-primary-glow),
			inset 0 2px 4px rgba(255, 255, 255, 0.3);
	}

	.create-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.create-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		filter: grayscale(0.3);
	}

	.cancel-btn {
		padding: calc(var(--space-2) * 1.2) calc(var(--space-3) * 1.1);
		background: rgba(0, 0, 0, 0.4);
		color: var(--db-text-secondary);
		border: 1px solid var(--db-border-subtle);
		font-family: var(--font-mono);
		font-size: calc(var(--font-size-1) * 0.95);
		font-weight: 500;
		letter-spacing: 0.02em;
		border-radius: 8px;
		cursor: pointer;
		transition: all var(--db-transition-fast);
		box-shadow: var(--db-shadow-sm);
		position: relative;
		z-index: 1;
	}

	.cancel-btn:hover:not(:disabled) {
		background: var(--db-surface-elevated);
		color: var(--db-text-primary);
		border-color: var(--db-border-strong);
		transform: translateY(-1px);
		box-shadow: var(--db-shadow-md);
	}

	.cancel-btn:active:not(:disabled) {
		transform: translateY(0);
	}

	.cancel-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
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

	@keyframes statusSweep {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	.loading {
		color: var(--db-primary-bright);
		font-style: italic;
		font-weight: 500;
		letter-spacing: 0.02em;
		animation: loadingPulse 1.5s ease-in-out infinite;
	}

	@keyframes loadingPulse {
		0%,
		100% {
			opacity: 0.7;
		}
		50% {
			opacity: 1;
		}
	}

	.error {
		color: #ff6b6b;
		font-weight: 500;
		letter-spacing: 0.01em;
		animation: errorShake 0.5s ease-in-out;
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
			transform: translateX(-2px);
		}
		20%,
		40%,
		60%,
		80% {
			transform: translateX(2px);
		}
	}

	/* Directory list */
	.directory-list {
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: thin;
		scrollbar-color: var(--db-primary-dim) transparent;
		min-height: 220px;
		height: 280px;
		max-height: 400px;
		/* background: 
			linear-gradient(180deg, 
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

	.quick-select {
		padding: calc(var(--space-1) * 1.2) calc(var(--space-2) * 1.1);
		background: var(--db-surface);
		border: 1px solid var(--db-border-strong);
		color: var(--db-primary);
		font-weight: 600;
		border-radius: 6px;
		cursor: pointer;
		transition: all var(--db-transition-fast);
		flex-shrink: 0;
		box-shadow: var(--db-shadow-sm);
		position: relative;
		overflow: hidden;
	}

	.quick-select::before {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		width: 0;
		height: 0;
		background: var(--db-primary);
		transition: all var(--db-transition-smooth);
		transform: translate(-50%, -50%);
		border-radius: 50%;
		z-index: 0;
	}

	.quick-select:hover:not(:disabled) {
		color: var(--bg-dark);
		border-color: var(--db-primary);
		transform: scale(1.05);
		box-shadow:
			0 0 12px var(--db-primary-glow),
			var(--db-shadow-md);
	}

	.quick-select:hover:not(:disabled)::before {
		width: 100px;
		height: 100px;
	}

	.quick-select:active:not(:disabled) {
		transform: scale(0.98);
	}

	.quick-select:disabled {
		opacity: 0.3;
		cursor: not-allowed;
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

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 0.8;
		}
	}

	/* Selected display */
	.selected-display {
		display: flex;
		align-items: center;
		gap: calc(var(--space-2) * 1.3);
		padding: calc(var(--space-2) * 1.4) calc(var(--space-3) * 1.2);
		background: linear-gradient(0deg, var(--db-surface-elevated) 100%);
		border: 1px solid var(--db-primary);
		border-radius: 10px;
		font-size: calc(var(--font-size-1) * 0.95);
		position: relative;
		overflow: hidden;
		opacity: 0;
		box-shadow:
			0 4px 12px var(--db-primary-glow),
			inset 0 2px 4px rgba(46, 230, 107, 0.15),
			inset 0 -1px 2px rgba(0, 0, 0, 0.3);
		animation: slideInScale 0.4s var(--db-transition-bounce) forwards;
	}

	/* .selected-display::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 2px;
		background: linear-gradient(90deg, 
			var(--db-primary), 
			var(--db-primary-bright), 
			var(--db-primary));
		animation: scanline 2s linear infinite;
	} */

	@keyframes slideInScale {
		0% {
			opacity: 0;
			transform: scale(0.9) translateY(10px);
		}
		100% {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	@keyframes scanline {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(100%);
		}
	}

	.selected-label {
		color: var(--db-primary-bright);
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: calc(var(--font-size-0) * 0.85);
		text-shadow: 0 0 8px var(--db-primary-glow);
	}

	.selected-path {
		flex: 1;
		color: var(--db-text-primary);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-family: var(--font-mono);
		font-weight: 500;
		letter-spacing: 0.01em;
	}

	.clear-selection {
		background: rgba(0, 0, 0, 0.3);
		border: 1px solid var(--db-border-strong);
		color: var(--db-text-secondary);
		padding: 4px 8px;
		border-radius: 6px;
		cursor: pointer;
		font-size: calc(var(--font-size-0) * 0.9);
		font-weight: 600;
		transition: all var(--db-transition-fast);
		box-shadow: var(--db-shadow-sm);
	}

	.clear-selection:hover {
		border-color: var(--db-primary);
		color: var(--db-primary-bright);
		background: rgba(46, 230, 107, 0.1);
		transform: scale(1.05);
		box-shadow:
			0 0 8px var(--db-primary-glow),
			var(--db-shadow-sm);
	}

	.clear-selection:active {
		transform: scale(0.95);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.directory-browser {
			border-radius: 8px;
			padding: var(--space-3);
		}

		.directory-list {
			height: 40vh;
			max-height: 400px;
		}

		.breadcrumb-bar {
			flex-wrap: wrap;
			gap: var(--space-2);
		}

		.breadcrumb-actions {
			width: 100%;
			justify-content: flex-end;
		}

		.search-bar {
			flex-direction: column;
		}

		.search-input,
		.select-btn {
			width: 100%;
		}

		.new-dir-form {
			flex-wrap: wrap;
		}

		.new-dir-input {
			width: 100%;
		}

		.create-btn,
		.cancel-btn {
			flex: 1;
		}
	}

	@media (min-width: 769px) {
		.directory-list {
			height: clamp(300px, 40vh, 500px);
		}
	}
</style>
