<script>
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

	// Function to create user-friendly session names
	function formatSessionName(session) {
		if (!session.id) return 'Session';
		
		// Clean up session ID for display
		const cleaned = session.id
			.replace(/^claude_/, 'Session ')
			.replace(/_/g, ' ')
			.replace(/\b\w/g, l => l.toUpperCase());
		
		return cleaned || 'Session';
	}

	function applyFilter() {
		const q = filterText.trim().toLowerCase();
		filtered = !q ? list : list.filter((s) => formatSessionName(s).toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
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
								<div class="id">{formatSessionName(s)}</div>
								<div class="meta">
									<span>{Math.round((s.size || 0) / 1024)} KB</span>
									{#if s.lastModified}<span>• {new Date(s.lastModified).toLocaleDateString()}</span
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
	/* Neural Session Interface - Award-Winning Cyberpunk Design */
	
	.cc-session-picker {
		position: relative;
		display: grid;
		gap: var(--space-3);
		isolation: isolate;
	}
	
	.row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-2);
		align-items: stretch;
		position: relative;
	}
	
	/* Neural Input Field */
	.row input {
		padding: var(--space-4) var(--space-5);
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: var(--font-size-2);
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 95%, var(--accent-cyan) 5%),
			color-mix(in oklab, var(--surface) 98%, var(--accent-cyan) 2%)
		);
		border: 1px solid color-mix(in oklab, var(--accent-cyan) 25%, transparent);
		border-radius: 12px;
		color: var(--text);
		box-shadow: 
			inset 0 1px 3px rgba(0, 0, 0, 0.1),
			0 0 0 1px color-mix(in oklab, var(--accent-cyan) 15%, transparent),
			0 4px 12px -4px rgba(0, 194, 255, 0.3);
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}
	
	.row input:focus {
		border-color: var(--accent-cyan);
		box-shadow: 
			inset 0 1px 3px rgba(0, 0, 0, 0.1),
			0 0 0 2px color-mix(in oklab, var(--accent-cyan) 30%, transparent),
			0 0 20px rgba(0, 194, 255, 0.4),
			0 8px 25px -8px rgba(0, 194, 255, 0.3);
		outline: none;
	}
	
	.row input::placeholder {
		color: color-mix(in oklab, var(--muted) 70%, transparent);
		font-style: italic;
	}
	
	/* Session Browser Button */
	.row button {
		padding: var(--space-4);
		background: linear-gradient(135deg, var(--surface), var(--elev));
		border: 1px solid color-mix(in oklab, var(--accent-cyan) 30%, transparent);
		border-radius: 12px;
		font-size: var(--font-size-3);
		color: var(--accent-cyan);
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 
			0 0 0 1px color-mix(in oklab, var(--accent-cyan) 10%, transparent),
			0 4px 12px -4px rgba(0, 194, 255, 0.3);
		position: relative;
		overflow: hidden;
	}
	
	.row button::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, 
			transparent, 
			color-mix(in oklab, var(--accent-cyan) 20%, transparent), 
			transparent
		);
		transition: left 0.5s ease;
	}
	
	.row button:hover {
		border-color: var(--accent-cyan);
		box-shadow: 
			0 0 0 2px color-mix(in oklab, var(--accent-cyan) 25%, transparent),
			0 0 20px rgba(0, 194, 255, 0.4),
			0 8px 25px -8px rgba(0, 194, 255, 0.3);
		transform: translateY(-1px);
	}
	
	.row button:hover::before {
		left: 100%;
	}
	
	/* Session Data Stream Panel */
	.panel {
		position: absolute;
		inset-inline: 0;
		top: calc(100% + var(--space-3));
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--surface) 95%, var(--accent-cyan) 5%),
				color-mix(in oklab, var(--elev) 90%, var(--accent-cyan) 10%)
			);
		border: 1px solid color-mix(in oklab, var(--accent-cyan) 30%, transparent);
		border-radius: 16px;
		max-height: 45vh;
		overflow: hidden;
		box-shadow: 
			0 0 0 1px color-mix(in oklab, var(--accent-cyan) 15%, transparent),
			0 20px 40px -10px rgba(0, 0, 0, 0.3),
			0 0 60px rgba(0, 194, 255, 0.3),
			inset 0 1px 0 color-mix(in oklab, var(--accent-cyan) 10%, transparent);
		z-index: 1000;
		backdrop-filter: blur(8px);
		animation: sessionPanelSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}
	
	@keyframes sessionPanelSlideIn {
		from {
			opacity: 0;
			transform: translateY(-10px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}
	
	/* Session Stream Header */
	.bar {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: var(--space-4);
		padding: var(--space-5) var(--space-6);
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 90%, var(--accent-cyan) 10%),
			color-mix(in oklab, var(--elev) 85%, var(--accent-cyan) 15%)
		);
		border-bottom: 1px solid color-mix(in oklab, var(--accent-cyan) 25%, transparent);
		position: relative;
		overflow: hidden;
	}
	
	.bar::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 1px;
		background: linear-gradient(90deg, 
			transparent, 
			var(--accent-cyan), 
			transparent
		);
		animation: sessionScanLine 3s ease-in-out infinite;
	}
	
	.bar strong {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--accent-cyan);
		font-size: var(--font-size-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		text-shadow: 0 0 10px rgba(0, 194, 255, 0.3);
	}
	
	@keyframes sessionScanLine {
		0%, 100% { opacity: 0.3; }
		50% { opacity: 1; }
	}
	
	.spacer {
		visibility: hidden;
	}
	
	/* Session Data Stream */
	.list {
		list-style: none;
		margin: 0;
		padding: var(--space-3);
		max-height: calc(45vh - 120px);
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--accent-cyan) transparent;
	}
	
	.list::-webkit-scrollbar {
		width: 8px;
	}
	
	.list::-webkit-scrollbar-thumb {
		background: linear-gradient(180deg, var(--accent-cyan), #0091cc);
		border-radius: 8px;
	}
	
	/* Session Data Packets */
	.list li {
		margin-bottom: var(--space-2);
		position: relative;
		overflow: hidden;
		border-radius: 12px;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
	}
	
	.list li::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, 
			transparent, 
			color-mix(in oklab, var(--accent-cyan) 15%, transparent), 
			transparent
		);
		transition: left 0.6s ease;
		pointer-events: none;
		z-index: 1;
	}
	
	.list li:hover::before {
		left: 100%;
	}
	
	.list li button {
		width: 100%;
		text-align: left;
		padding: var(--space-5) var(--space-6);
		display: grid;
		gap: var(--space-4);
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 98%, var(--accent-cyan) 2%),
			color-mix(in oklab, var(--surface) 95%, var(--accent-cyan) 5%)
		);
		border: 1px solid color-mix(in oklab, var(--accent-cyan) 20%, transparent);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		position: relative;
		z-index: 2;
		box-shadow: 
			0 2px 8px -2px rgba(0, 0, 0, 0.1),
			0 0 0 1px color-mix(in oklab, var(--accent-cyan) 10%, transparent);
	}
	
	.list li button:hover {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 95%, var(--accent-cyan) 5%),
			color-mix(in oklab, var(--surface) 90%, var(--accent-cyan) 10%)
		);
		border-color: color-mix(in oklab, var(--accent-cyan) 40%, transparent);
		transform: translateY(-2px);
		box-shadow: 
			0 8px 25px -8px rgba(0, 0, 0, 0.2),
			0 0 0 1px color-mix(in oklab, var(--accent-cyan) 20%, transparent),
			0 0 20px rgba(0, 194, 255, 0.4);
	}
	
	/* Session Header Info */
	.row2 {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-4);
		align-items: start;
	}
	
	/* Session ID - Data Stream Identifier */
	.id {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: var(--font-size-2);
		color: var(--text);
		letter-spacing: 0.02em;
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	
	.id::before {
		content: '•';
		color: var(--accent-cyan);
		font-weight: 700;
		animation: sessionPulse 3s ease-in-out infinite;
	}
	
	@keyframes sessionPulse {
		0%, 100% { opacity: 0.6; transform: scale(1); }
		50% { opacity: 1; transform: scale(1.2); }
	}
	
	/* Session Metadata - Terminal Info */
	.meta {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--muted);
		font-weight: 500;
		text-align: right;
	}
	
	.meta span {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-3);
		background: color-mix(in oklab, var(--accent-cyan) 8%, transparent);
		border: 1px solid color-mix(in oklab, var(--accent-cyan) 15%, transparent);
		border-radius: 6px;
		transition: all 0.2s ease;
		min-width: max-content;
	}
	
	.meta span:first-child::after {
		content: '📁';
		color: var(--accent-amber);
		font-size: 0.8em;
	}
	
	.meta span:last-child::after {
		content: '🕒';
		color: var(--accent-cyan);
		font-size: 0.8em;
	}
	
	/* Session Preview - Code Stream Display */
	.preview {
		margin: 0;
		padding: var(--space-4);
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--bg) 95%, var(--accent-cyan) 5%),
			color-mix(in oklab, var(--surface) 90%, var(--accent-cyan) 10%)
		);
		border: 1px solid color-mix(in oklab, var(--accent-cyan) 20%, transparent);
		border-radius: 8px;
		max-height: 10rem;
		overflow: auto;
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: color-mix(in oklab, var(--text) 90%, var(--accent-cyan) 10%);
		line-height: 1.4;
		position: relative;
		scrollbar-width: thin;
		scrollbar-color: var(--accent-cyan) transparent;
		box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.1);
	}
	
	.preview::before {
		content: '// Session Preview';
		position: absolute;
		top: var(--space-1);
		right: var(--space-3);
		font-size: var(--font-size-0);
		color: var(--muted);
		font-style: italic;
		opacity: 0.6;
	}
	
	.preview::-webkit-scrollbar {
		width: 6px;
	}
	
	.preview::-webkit-scrollbar-thumb {
		background: color-mix(in oklab, var(--accent-cyan) 40%, transparent);
		border-radius: 6px;
	}
	
	/* Active Session State */
	
	.is-active button {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--surface) 90%, var(--accent-cyan) 10%),
			color-mix(in oklab, var(--surface) 85%, var(--accent-cyan) 15%)
		);
		border-color: var(--accent-cyan);
		box-shadow: 
			0 0 0 2px color-mix(in oklab, var(--accent-cyan) 30%, transparent),
			0 8px 25px -8px rgba(0, 0, 0, 0.2),
			0 0 30px rgba(0, 194, 255, 0.4),
			inset 0 1px 0 color-mix(in oklab, var(--accent-cyan) 20%, transparent);
		transform: translateY(-2px);
		outline: none;
	}
	
	.is-active .id::before {
		content: '●';
		color: var(--accent-cyan);
		animation: activeSessionPulse 1.5s ease-in-out infinite;
	}
	
	@keyframes activeSessionPulse {
		0%, 100% { 
			opacity: 1; 
			text-shadow: 0 0 5px rgba(0, 194, 255, 0.4); 
			transform: scale(1);
		}
		50% { 
			opacity: 0.7; 
			text-shadow: 0 0 15px rgba(0, 194, 255, 0.6);
			transform: scale(1.1);
		}
	}
	
	/* Empty and Error States */
	.empty,
	.err {
		padding: var(--space-6);
		text-align: center;
		font-family: var(--font-mono);
		font-style: italic;
		color: var(--muted);
	}
	
	.err {
		color: var(--err);
		background: color-mix(in oklab, var(--err) 5%, transparent);
		border: 1px solid color-mix(in oklab, var(--err) 20%, transparent);
		border-radius: 8px;
		margin: var(--space-3);
	}
	
	/* Loading State Enhancement */
	.bar span:not(.spacer) {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		color: var(--muted);
		font-style: italic;
	}
</style>
