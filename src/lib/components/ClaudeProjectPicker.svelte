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

	function filter() {
		const q = query.trim().toLowerCase();
		filtered = !q
			? projects
			: projects.filter(
					(p) => p.name.toLowerCase().includes(q) || p.path?.toLowerCase().includes(q)
				);
		highlight = 0;
	}

	function choose(p) {
		selected = p;
		onSelect?.(p);
		open = false;
	}

	function toggle() {
		open = !open;
		if (open && projects.length === 0) load();
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
	<div class="row">
		<input
			type="text"
			{placeholder}
			bind:value={query}
			on:input={filter}
			on:keydown={key}
			aria-expanded={open}
			aria-controls="cc-panel"
		/>
		<button type="button" on:click={toggle} aria-label="Browse projects">📁</button>
	</div>

	{#if open}
		<div id="cc-panel" class="panel" role="dialog" aria-label="Choose a Claude Code project">
			<div class="bar">
				<strong>Projects</strong>
				<span class="spacer" />
				{#if loading}<span>Loading…</span>{/if}
				{#if error}<span class="err">{error}</span>{/if}
			</div>
			<ul class="list" role="listbox">
				{#each filtered as p, i}
					<li class={i === highlight ? 'is-active' : ''}>
						<button type="button" on:click={() => choose(p)}>
							<div class="name">{p.name}</div>
							<div class="meta">
								<span>{p.sessionCount} sessions</span>
								{#if p.lastModified}<span>• {new Date(p.lastModified).toLocaleString()}</span>{/if}
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
		gap: 0.25rem;
	}
	.row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.25rem;
		align-items: center;
	}
	.panel {
		position: absolute;
		inset-inline: 0;
		top: calc(100% + 0.25rem);
		border: 1px solid var(--panel-border, #ccc);
		background: var(--panel-bg, #fff);
		border-radius: 0.25rem;
		max-height: 60vh;
		overflow: auto;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.12);
		z-index: 10;
	}
	.bar {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: 0.5rem;
		padding: 0.5rem;
		border-bottom: 1px solid var(--panel-border, #ccc);
	}
	.spacer {
		visibility: hidden;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0.25rem;
	}
	li button {
		width: 100%;
		text-align: left;
		padding: 0.5rem;
		display: grid;
		gap: 0.125rem;
	}
	.name {
		font-weight: 600;
	}
	.meta {
		opacity: 0.8;
		font-size: 0.9em;
	}
	.is-active button {
		outline: 2px solid var(--accent, #999);
	}
	.empty,
	.err {
		padding: 0.75rem;
	}
</style>
