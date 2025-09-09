<script>
	// Svelte 5 (runes)
	let {
		selected = $bindable(), // { name, path, sessionCount, lastModified }
		api = '/api/cc/projects',
		placeholder = 'Browse Claude Code projects…',
		onSelect
	} = $props();

	let open = $state(false);
	let query = $state('');
	let loading = $state(false);
	let error = $state('');
	let projects = $state([]);
	let filtered = $state([]);
	let highlight = $state(0);

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await fetch(api);
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			projects = data.projects || [];
			filter();
		} catch (e) {
			error = e.message || String(e);
		} finally {
			loading = false;
		}
	}

	// Function to create user-friendly names from paths
	function formatProjectName(project) {
		if (!project.path) return project.name || 'Untitled Project';
		
		// Extract the last meaningful part of the path
		const pathParts = project.path.split('/');
		const lastPart = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
		
		// Remove encoded characters and clean up
		const cleaned = lastPart
			.replace(/-/g, ' ')
			.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '')
			.replace(/\s+/g, ' ')
			.trim();
		
		return cleaned || project.name || 'Project';
	}

	function filter() {
		const q = query.trim().toLowerCase();
		filtered = !q
			? projects
			: projects.filter(
					(p) => formatProjectName(p).toLowerCase().includes(q) || p.path?.toLowerCase().includes(q)
				);
		highlight = 0;
	}

	function choose(p) {
		selected = p;
		onSelect?.(p);
		open = false;
		query = '';
	}

	function toggle() {
		open = !open;
		if (open && projects.length === 0) load();
	}

	function clear() {
		selected = null;
		query = '';
	}

	function key(e) {
		if (!open) return;
		if (e.key === 'ArrowDown') {
			highlight = (highlight + 1) % Math.max(1, filtered.length);
			e.preventDefault();
		} else if (e.key === 'ArrowUp') {
			highlight = (highlight - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length);
			e.preventDefault();
		} else if (e.key === 'Enter' && filtered[highlight]) {
			choose(filtered[highlight]);
			e.preventDefault();
		} else if (e.key === 'Escape') {
			open = false;
			e.preventDefault();
		}
	}
</script>

<div class="cc-picker">
	{#if selected}
		<div class="selected-display">
			<div class="selected-name">{formatProjectName(selected)}</div>
			<div class="selected-meta">
				<span>{selected.sessionCount || 0} sessions</span>
				{#if selected.lastModified}
					<span>• {new Date(selected.lastModified).toLocaleDateString()}</span>
				{/if}
			</div>
			<button type="button" class="clear-btn" onclick={clear} aria-label="Clear selection">✕</button>
		</div>
	{:else}
		<div class="row">
			<input
				type="text"
				{placeholder}
				bind:value={query}
				oninput={filter}
				onkeydown={key}
				aria-expanded={open}
				aria-controls="cc-panel"
			/>
			<button type="button" class="browse-btn" onclick={toggle} aria-label="Browse projects">📁</button>
		</div>
	{/if}

	{#if open}
		<div id="cc-panel" class="panel" role="dialog" aria-label="Choose a Claude Code project">
			<div class="bar">
				<strong>Projects</strong>
				<span class="spacer"></span>
				{#if loading}<span>Loading…</span>{/if}
				{#if error}<span class="err">{error}</span>{/if}
			</div>
			<ul class="list" role="listbox">
				{#each filtered as p, i}
					<li class={i === highlight ? 'is-active' : ''}>
						<button type="button" onclick={() => choose(p)}>
							<div class="name">{formatProjectName(p)}</div>
							<div class="meta">
								<span>{p.sessionCount || 0} sessions</span>
								{#if p.lastModified}<span>• {new Date(p.lastModified).toLocaleDateString()}</span>{/if}
							</div>
						</button>
					</li>
				{/each}
				{#if !loading && filtered.length === 0}
					<li class="empty">No projects</li>
				{/if}
			</ul>
		</div>
	{/if}
</div>

<style>
	.cc-picker {
		position: relative;
		display: grid;
		gap: var(--space-3);
	}

	.selected-display {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in oklab, var(--bg) 90%, var(--primary) 10%);
		border: 2px solid var(--primary);
		border-radius: 8px;
		font-family: var(--font-mono);
	}

	.selected-name {
		font-weight: 600;
		color: var(--primary);
		font-size: var(--font-size-2);
	}

	.selected-meta {
		flex: 1;
		font-size: var(--font-size-1);
		color: var(--text-muted);
	}

	.clear-btn {
		background: transparent;
		border: 1px solid var(--text-muted);
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--space-1);
		border-radius: 4px;
		transition: all 0.2s ease;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
	}

	.clear-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-2);
		align-items: center;
	}

	.row input {
		padding: var(--space-4);
		font-size: var(--font-size-2);
		background: var(--bg-input);
		border: 2px solid var(--primary-dim);
		color: var(--text);
		border-radius: 8px;
		font-family: var(--font-mono);
		transition: all 0.3s ease;
	}

	.row input:focus {
		outline: none;
		border-color: var(--primary);
		background: var(--bg);
		box-shadow: 0 0 0 2px rgba(46, 230, 107, 0.2);
	}

	.row input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.browse-btn {
		padding: var(--space-4);
		background: linear-gradient(135deg, var(--bg-panel), var(--bg-dark));
		border: 2px solid var(--primary-dim);
		color: var(--primary);
		cursor: pointer;
		border-radius: 8px;
		transition: all 0.3s ease;
		font-size: var(--font-size-3);
		min-width: 48px;
	}

	.browse-btn:hover {
		border-color: var(--primary);
		background: linear-gradient(135deg, var(--bg-dark), var(--bg-panel));
		box-shadow: 0 0 10px rgba(46, 230, 107, 0.3);
	}

	.panel {
		position: absolute;
		inset-inline: 0;
		top: calc(100% + var(--space-3));
		background: var(--bg-panel);
		border: 2px solid var(--primary-dim);
		border-radius: 8px;
		max-height: 40vh;
		overflow: hidden;
		box-shadow: 
			0 8px 32px rgba(0, 0, 0, 0.4),
			0 0 0 1px rgba(46, 230, 107, 0.1);
		z-index: 1000;
		backdrop-filter: blur(8px);
	}

	.bar {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--bg-dark);
		border-bottom: 1px solid var(--primary-dim);
		font-family: var(--font-mono);
	}

	.bar strong {
		color: var(--primary);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		font-weight: 600;
	}

	.spacer {
		visibility: hidden;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: var(--space-2);
		max-height: calc(40vh - 60px);
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--primary) transparent;
	}

	.list::-webkit-scrollbar {
		width: 6px;
	}

	.list::-webkit-scrollbar-thumb {
		background: var(--primary);
		border-radius: 3px;
	}

	.list li {
		margin-bottom: var(--space-1);
	}

	.list li button {
		width: 100%;
		text-align: left;
		padding: var(--space-3);
		display: grid;
		gap: var(--space-1);
		background: var(--bg);
		border: 1px solid var(--primary-dim);
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		color: var(--text);
	}

	.list li button:hover {
		background: var(--bg-panel);
		border-color: var(--primary);
		transform: translateY(-1px);
	}

	.name {
		font-weight: 600;
		font-size: var(--font-size-2);
		color: var(--text);
		font-family: var(--font-mono);
	}

	.meta {
		font-size: var(--font-size-1);
		color: var(--text-muted);
		font-family: var(--font-mono);
	}

	.meta span:first-child {
		color: var(--accent-amber);
		font-weight: 600;
	}

	.is-active button {
		background: var(--bg-panel);
		border-color: var(--primary);
		box-shadow: 0 0 0 1px var(--primary);
	}

	.is-active .name {
		color: var(--primary);
	}

	.empty,
	.err {
		padding: var(--space-4);
		text-align: center;
		font-family: var(--font-mono);
		font-style: italic;
		color: var(--text-muted);
	}

	.err {
		color: var(--error, #ff6b6b);
	}

	.bar span:not(.spacer) {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--text-muted);
		font-style: italic;
	}
</style>