<script>
	import IconX from '../shared/components/Icons/IconX.svelte';
	import IconArchive from '../shared/components/Icons/IconArchive.svelte';
	import IconButton from '../shared/components/IconButton.svelte';

	// Props
	let {
		project = '', // required
		apiBase = '/api/cc/session', // base for endpoints
		placeholder = 'Select a session…',
		selected = $bindable()
	} = $props(); // { id, lastModified, size }

	// State
	let open = $state(false);
	let loading = $state(false);
	let error = $state('');
	let list = $state([]);
	let filterText = $state('');
	let filtered = $state([]);
	let highlight = $state(0);

	async function load() {
		loading = true;
		error = '';
		try {
			const res = await fetch(`${apiBase}/${encodeURIComponent(project)}`);
			if (!res.ok) throw new Error(await res.text());
			const data = await res.json();
			list = data.sessions || [];
			applyFilter();
		} catch (e) {
			error = e.message || String(e);
		} finally {
			loading = false;
		}
	}

	// Function to create user-friendly session names
	function formatSessionName(session) {
		if (!session.id) return 'Session';

		// For UUID-style IDs, just show a simple session name with first 8 chars
		if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.id)) {
			return `Session ${session.id.substring(0, 8)}`;
		}

		// Clean up session ID for display
		const cleaned = session.id
			.replace(/^claude_/, 'Session ')
			.replace(/_/g, ' ')
			.replace(/\b\w/g, (l) => l.toUpperCase());

		return cleaned || 'Session';
	}

	function applyFilter() {
		const q = filterText.trim().toLowerCase();
		filtered = !q
			? list
			: list.filter(
					(s) => formatSessionName(s).toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
				);
		highlight = 0;
	}

	function toggle() {
		open = !open;
		if (open && list.length === 0) load();
	}

	async function choose(s) {
		selected = s;
		open = false;
		filterText = '';
	}

	function clear() {
		selected = null;
		filterText = '';
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

<div class="cc-session-picker">
	{#if selected}
		<div class="selected-display">
			<div class="selected-name">{formatSessionName(selected)}</div>
			<div class="selected-meta">
				<span>{Math.round((selected.size || 0) / 1024)} KB</span>
				{#if selected.lastModified}
					<span>• {new Date(selected.lastModified).toLocaleDateString()}</span>
				{/if}
			</div>
			<IconButton type="button" class="clear-btn" onclick={clear} aria-label="Clear selection"
				><IconX size={14} /></IconButton
			>
		</div>
	{:else}
		<div class="row">
			<input
				type="text"
				{placeholder}
				bind:value={filterText}
				oninput={applyFilter}
				onkeydown={key}
				aria-controls="cc-session-panel"
			/>
			<button type="button" class="browse-btn" onclick={toggle} aria-label="Browse sessions"
				><IconArchive size={18} /></button
			>
		</div>
	{/if}

	{#if open}
		<div
			id="cc-session-panel"
			class="panel"
			role="dialog"
			aria-label="Choose a Claude Code session"
		>
			<div class="bar">
				<strong>Sessions in {project}</strong>
				<span class="spacer"></span>
				{#if loading}<span>Loading…</span>{/if}
				{#if error}<span class="err">{error}</span>{/if}
			</div>
			<ul class="list" role="listbox">
				{#each filtered as s, i (s.id || i)}
					<li class={i === highlight ? 'is-active' : ''}>
						<button type="button" onclick={() => choose(s)}>
							<div class="row2">
								<div class="id">{formatSessionName(s)}</div>
								<div class="meta">
									<span>{Math.round((s.size || 0) / 1024)} KB</span>
									{#if s.lastModified}<span>• {new Date(s.lastModified).toLocaleDateString()}</span
										>{/if}
								</div>
							</div>
						</button>
					</li>
				{/each}
				{#if !loading && filtered.length === 0}
					<li class="empty">No sessions</li>
				{/if}
			</ul>
		</div>
	{/if}
</div>

<style>
	.cc-session-picker {
		position: relative;
		display: grid;
		gap: var(--space-3);
	}

	.selected-display {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in oklab, var(--bg) 90%, var(--accent-cyan) 10%);
		border: 2px solid var(--accent-cyan);
		border-radius: var(--radius-md);
		font-family: var(--font-mono);
	}

	.selected-name {
		font-weight: 600;
		color: var(--accent-cyan);
		font-size: var(--font-size-2);
	}

	.selected-meta {
		flex: 1;
		font-size: var(--font-size-1);
		color: var(--text-muted);
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
		border: 2px solid color-mix(in oklab, var(--accent-cyan) 50%, transparent);
		color: var(--text);
		border-radius: var(--radius-md);
		font-family: var(--font-mono);
		transition: all 0.3s ease;
	}

	.row input:focus {
		outline: none;
		border-color: var(--accent-cyan);
		background: var(--bg);
		box-shadow: 0 0 0 2px rgba(0, 194, 255, 0.2);
	}

	.row input::placeholder {
		color: var(--text-muted);
		opacity: 0.7;
	}

	.browse-btn {
		padding: var(--space-4);
		background: linear-gradient(135deg, var(--bg-panel), var(--bg-dark));
		border: 2px solid color-mix(in oklab, var(--accent-cyan) 50%, transparent);
		color: var(--accent-cyan);
		cursor: pointer;
		border-radius: var(--radius-md);
		transition: all 0.3s ease;
		font-size: var(--font-size-3);
		min-width: var(--space-7);
	}

	.browse-btn:hover {
		border-color: var(--accent-cyan);
		background: linear-gradient(135deg, var(--bg-dark), var(--bg-panel));
		box-shadow: 0 0 10px rgba(0, 194, 255, 0.3);
	}

	.panel {
		inset-inline: 0;
		background: var(--bg-panel);
		border: 2px solid color-mix(in oklab, var(--accent-cyan) 50%, transparent);
		border-radius: var(--radius-md);
		box-shadow:
			0 8px 32px rgba(0, 0, 0, 0.4),
			0 0 0 1px rgba(0, 194, 255, 0.1);
		z-index: 1000;
		backdrop-filter: blur(8px);
	}

	.bar {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: var(--space-3);
		padding: var(--space-4);
		background: var(--bg-dark);
		border-bottom: 1px solid color-mix(in oklab, var(--accent-cyan) 50%, transparent);
		font-family: var(--font-mono);
	}

	.bar strong {
		color: var(--accent-cyan);
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
		max-height: calc(45vh - 60px);
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--accent-cyan) transparent;
	}

	.list::-webkit-scrollbar {
		width: 6px;
	}

	.list::-webkit-scrollbar-thumb {
		background: var(--accent-cyan);
		border-radius: var(--radius-xs);
	}

	.list li {
		margin-bottom: var(--space-1);
	}

	.list li button {
		width: 100%;
		text-align: left;
		padding: var(--space-3);
		display: grid;
		gap: var(--space-2);
		background: var(--bg);
		border: 1px solid color-mix(in oklab, var(--accent-cyan) 30%, transparent);
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all 0.2s ease;
		color: var(--text);
	}

	.list li button:hover {
		background: var(--bg-panel);
		border-color: var(--accent-cyan);
		transform: translateY(-1px);
	}

	.row2 {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-3);
		align-items: start;
	}

	.id {
		font-weight: 600;
		font-size: var(--font-size-2);
		color: var(--text);
		font-family: var(--font-mono);
	}

	.meta {
		font-size: var(--font-size-1);
		color: var(--text-muted);
		font-family: var(--font-mono);
		text-align: right;
	}

	.meta span:first-child {
		color: var(--accent-amber);
		font-weight: 600;
	}

	.is-active button {
		background: var(--bg-panel);
		border-color: var(--accent-cyan);
		box-shadow: 0 0 0 1px var(--accent-cyan);
	}

	.is-active .id {
		color: var(--accent-cyan);
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
