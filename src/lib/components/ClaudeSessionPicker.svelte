<script>
	// Props
	export let project = ''; // required
	export let apiBase = '/api/cc/session'; // base for endpoints
	export let placeholder = 'Select a session…';
	let selected = $bindable(null); // { id, lastModified, size }

	// State
	let open = $state(false);
	let loading = $state(false);
	let error = $state('');
	let list = $state([]);
	let filterText = $state('');
	let filtered = $state([]);
	let highlight = $state(0);
	let preview = $state([]); // peek lines (tail)

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

	function applyFilter() {
		const q = filterText.trim().toLowerCase();
		filtered = !q ? list : list.filter((s) => s.id.toLowerCase().includes(q));
		highlight = 0;
	}

	function toggle() {
		open = !open;
		if (open && list.length === 0) load();
	}

	async function choose(s) {
		selected = s;
		open = false;
	}

	async function peekTail(s) {
		const res = await fetch(
			`${apiBase}/${encodeURIComponent(project)}/${encodeURIComponent(s.id)}/peek?tail=1&n=10`
		);
		if (res.ok) preview = (await res.json()).lines;
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
	<div class="row">
		<input
			type="text"
			{placeholder}
			bind:value={filterText}
			on:input={applyFilter}
			on:keydown={key}
			aria-expanded={open}
			aria-controls="cc-session-panel"
		/>
		<button type="button" on:click={toggle} aria-label="Browse sessions">🗂️</button>
	</div>

	{#if open}
		<div
			id="cc-session-panel"
			class="panel"
			role="dialog"
			aria-label="Choose a Claude Code session"
		>
			<div class="bar">
				<strong>Sessions in {project}</strong>
				<span class="spacer" />
				{#if loading}<span>Loading…</span>{/if}
				{#if error}<span class="err">{error}</span>{/if}
			</div>
			<ul class="list" role="listbox">
				{#each filtered as s, i}
					<li class={i === highlight ? 'is-active' : ''}>
						<button
							type="button"
							on:mouseover={() => peekTail(s)}
							on:focus={() => peekTail(s)}
							on:click={() => choose(s)}
						>
							<div class="row2">
								<div class="id">{s.id}</div>
								<div class="meta">
									<span>{Math.round((s.size || 0) / 1024)} KB</span>
									{#if s.lastModified}<span>• {new Date(s.lastModified).toLocaleString()}</span
										>{/if}
								</div>
							</div>
							{#if preview?.length}
								<pre class="preview">{preview.join('\n')}</pre>
							{/if}
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
	/* minimal structure; theme externally */
	.cc-session-picker {
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
		gap: 0.25rem;
	}
	.row2 {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
	}
	.id {
		font-weight: 600;
	}
	.meta {
		opacity: 0.8;
		font-size: 0.9em;
	}
	.preview {
		margin: 0;
		padding: 0.5rem;
		background: var(--preview-bg, #f6f6f6);
		border-radius: 0.25rem;
		max-height: 8rem;
		overflow: auto;
	}
	.is-active button {
		outline: 2px solid var(--accent, #999);
	}
	.empty,
	.err {
		padding: 0.75rem;
	}
</style>
