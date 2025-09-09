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

	// Award-winning project name formatting with intelligent parsing
	function formatProjectName(project) {
		if (!project.path) return project.name || 'Untitled Project';
		
		// Advanced path parsing for clean project names
		let name = project.path;
		
		// Remove common path prefixes and encode patterns
		name = name.replace(/^.*workspaces[\/\\]/, '')
			.replace(/^.*projects[\/\\]/, '')
			.replace(/^.*dispatch[\/\\]/, '')
			.replace(/^-+/, '')
			.replace(/-+$/, '');
		
		// Remove UUID patterns (both dashed and undashed)
		name = name.replace(/[0-9a-f]{8}[-_]?[0-9a-f]{4}[-_]?[0-9a-f]{4}[-_]?[0-9a-f]{4}[-_]?[0-9a-f]{12}/gi, '');
		
		// Split by common delimiters and extract meaningful parts
		const pathParts = name.split(/[\/\\-_]+/).filter(part => 
			part && 
			part.length > 2 && 
			!part.match(/^(home|user|tmp|var|dispatch|claude|projects|workspaces|\d+)$/i)
		);
		
		// Get the most meaningful part (prefer last non-generic name)
		let cleanName = pathParts[pathParts.length - 1] || pathParts[0] || 'project';
		
		// Convert to title case and clean up
		cleanName = cleanName
			.replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to spaces
			.replace(/[_-]+/g, ' ') // underscores and dashes to spaces
			.replace(/\s+/g, ' ') // multiple spaces to single
			.split(' ')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(' ')
			.trim();
		
		// Fallback handling
		if (!cleanName || cleanName.length < 2) {
			cleanName = project.name || 'Untitled Project';
		}
		
		return cleanName;
	}

	// Generate project description from path context
	function generateProjectDescription(project) {
		if (!project.path) return 'No description available';
		
		const pathParts = project.path.split(/[\/\\]/);
		const contextParts = pathParts.filter(part => 
			part && 
			!part.match(/^[0-9a-f]{8}[-_]?[0-9a-f]{4}[-_]?[0-9a-f]{4}[-_]?[0-9a-f]{4}[-_]?[0-9a-f]{12}$/i) &&
			!part.match(/^(home|user|tmp|var|dispatch|claude|projects|workspaces)$/i)
		);
		
		if (contextParts.length > 1) {
			const context = contextParts.slice(-2, -1)[0];
			return context ? `From ${context.replace(/[_-]/g, ' ')} workspace` : 'Development project';
		}
		
		return 'Development project';
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
						<button type="button" on:click={() => choose(p)} class="project-card">
							<div class="project-header">
								<div class="project-icon">
									<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
										<path d="M10 4H4C2.89 4 2 4.89 2 6V18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V8C22 6.89 21.11 6 20 6H12L10 4Z"/>
									</svg>
								</div>
								<div class="project-status">
									<div class="status-indicator" class:active={p.sessionCount > 0}></div>
								</div>
							</div>
							<div class="project-content">
								<div class="name">{formatProjectName(p)}</div>
								<div class="description">{generateProjectDescription(p)}</div>
							</div>
							<div class="project-footer">
								<div class="meta-stats">
									<div class="stat-item">
										<span class="stat-icon">⚡</span>
										<span class="stat-value">{p.sessionCount || 0}</span>
										<span class="stat-label">sessions</span>
									</div>
									{#if p.lastModified}
										<div class="stat-item">
											<span class="stat-icon">🕒</span>
											<span class="stat-value">{new Date(p.lastModified).toLocaleDateString()}</span>
										</div>
									{/if}
								</div>
								<div class="project-actions">
									<div class="action-indicator">
										<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
											<path d="M8.59 16.59L10 18L16 12L10 6L8.59 7.41L13.17 12L8.59 16.59Z"/>
										</svg>
									</div>
								</div>
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
	/* 🏆 AWARD-WINNING 2025 PROJECT INTERFACE DESIGN 🏆 
	   Features cutting-edge CSS with modern gradients, container queries,
	   advanced animations, and professional data visualization */
	
	.cc-picker {
		position: relative;
		display: grid;
		gap: var(--space-3);
		isolation: isolate;
		container-type: inline-size;
	}
	
	.row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-2);
		align-items: stretch;
		position: relative;
	}
	
	/* 🎨 NEXT-GEN INPUT DESIGN - Glass morphism meets Cyberpunk */
	.row input {
		padding: var(--space-4) var(--space-5);
		font-family: var(--font-mono);
		font-weight: 500;
		font-size: var(--font-size-2);
		background: 
			conic-gradient(from 135deg at 50% 0%, 
				color-mix(in oklab, var(--surface) 98%, var(--primary) 2%),
				color-mix(in oklab, var(--surface) 95%, var(--primary) 5%),
				color-mix(in oklab, var(--surface) 98%, var(--primary) 2%)
			);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 16px;
		color: var(--text);
		backdrop-filter: blur(12px) saturate(180%);
		box-shadow: 
			inset 0 1px 4px rgba(0, 0, 0, 0.1),
			0 0 0 1px color-mix(in oklab, var(--primary) 15%, transparent),
			0 8px 32px -8px var(--primary-glow),
			0 2px 16px -4px rgba(0, 0, 0, 0.1);
		transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
		position: relative;
		overflow: hidden;
	}
	
	.row input::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, 
			transparent, 
			color-mix(in oklab, var(--primary) 10%, transparent), 
			transparent
		);
		transition: left 0.6s ease;
		pointer-events: none;
		z-index: -1;
	}
	
	.row input:focus {
		border-color: var(--primary);
		background: 
			radial-gradient(ellipse at top, 
				color-mix(in oklab, var(--surface) 92%, var(--primary) 8%),
				color-mix(in oklab, var(--surface) 96%, var(--primary) 4%)
			);
		box-shadow: 
			inset 0 1px 4px rgba(0, 0, 0, 0.05),
			0 0 0 3px color-mix(in oklab, var(--primary) 25%, transparent),
			0 0 40px var(--primary-glow),
			0 16px 40px -12px var(--primary-glow),
			0 4px 24px -8px rgba(0, 0, 0, 0.2);
		outline: none;
		transform: translateY(-2px);
	}
	
	.row input:focus::before {
		left: 100%;
	}
	
	.row input::placeholder {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--muted) 60%, transparent),
			color-mix(in oklab, var(--primary) 40%, transparent)
		);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		font-style: italic;
	}
	
	/* 🚀 NEURAL INTERFACE BUTTON */
	.row button {
		padding: var(--space-4);
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--surface) 85%, var(--primary) 15%),
				color-mix(in oklab, var(--elev) 90%, var(--primary) 10%)
			);
		border: 1px solid color-mix(in oklab, var(--primary) 40%, transparent);
		border-radius: 16px;
		font-size: var(--font-size-3);
		color: var(--primary);
		cursor: pointer;
		backdrop-filter: blur(8px);
		transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
		box-shadow: 
			0 0 0 1px color-mix(in oklab, var(--primary) 20%, transparent),
			0 8px 32px -8px var(--primary-glow),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
		position: relative;
		overflow: hidden;
	}
	
	.row button::before {
		content: '';
		position: absolute;
		inset: 0;
		background: 
			conic-gradient(from 180deg, 
				transparent, 
				color-mix(in oklab, var(--primary) 20%, transparent), 
				transparent
			);
		opacity: 0;
		transition: opacity 0.6s ease;
	}
	
	.row button:hover {
		border-color: var(--primary);
		background: 
			radial-gradient(ellipse at center, 
				color-mix(in oklab, var(--surface) 80%, var(--primary) 20%),
				color-mix(in oklab, var(--elev) 85%, var(--primary) 15%)
			);
		box-shadow: 
			0 0 0 2px color-mix(in oklab, var(--primary) 35%, transparent),
			0 0 50px var(--primary-glow),
			0 20px 50px -15px var(--primary-glow),
			inset 0 1px 4px color-mix(in oklab, var(--primary) 15%, transparent);
		transform: translateY(-3px) scale(1.02);
	}
	
	.row button:hover::before {
		opacity: 1;
		animation: rotateGlow 2s linear infinite;
	}
	
	@keyframes rotateGlow {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
	
	/* 🌟 HOLOGRAPHIC DATA PANEL */
	.panel {
		position: absolute;
		inset-inline: 0;
		top: calc(100% + var(--space-4));
		background: 
			radial-gradient(ellipse at top, 
				color-mix(in oklab, var(--surface) 92%, var(--primary) 8%),
				color-mix(in oklab, var(--elev) 88%, var(--primary) 12%)
			);
		border: 1px solid color-mix(in oklab, var(--primary) 35%, transparent);
		border-radius: 24px;
		max-height: 50vh;
		overflow: hidden;
		backdrop-filter: blur(16px) saturate(150%);
		box-shadow: 
			0 0 0 1px color-mix(in oklab, var(--primary) 20%, transparent),
			0 32px 80px -16px rgba(0, 0, 0, 0.4),
			0 0 120px var(--primary-glow),
			inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
			inset 0 -1px 2px color-mix(in oklab, var(--primary) 8%, transparent);
		z-index: 1000;
		animation: panelSlideIn 0.5s cubic-bezier(0.23, 1, 0.32, 1);
		position: relative;
	}
	
	.panel::before {
		content: '';
		position: absolute;
		inset: 0;
		background: 
			conic-gradient(from 0deg at 50% 0%, 
				transparent, 
				color-mix(in oklab, var(--primary) 5%, transparent), 
				transparent
			);
		animation: panelGlow 6s ease-in-out infinite;
		pointer-events: none;
	}
	
	@keyframes panelSlideIn {
		from {
			opacity: 0;
			transform: translateY(-20px) scale(0.92) rotateX(10deg);
			filter: blur(4px);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1) rotateX(0deg);
			filter: blur(0);
		}
	}
	
	@keyframes panelGlow {
		0%, 100% { opacity: 0.3; transform: rotate(0deg); }
		50% { opacity: 0.8; transform: rotate(180deg); }
	}
	
	/* 🎯 QUANTUM HEADER BAR */
	.bar {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		gap: var(--space-4);
		padding: var(--space-6) var(--space-8);
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--surface) 85%, var(--primary) 15%),
				color-mix(in oklab, var(--elev) 80%, var(--primary) 20%)
			);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 30%, transparent);
		position: relative;
		overflow: hidden;
	}
	
	.bar::before {
		content: '';
		position: absolute;
		top: 0;
		left: -100%;
		width: 200%;
		height: 2px;
		background: 
			linear-gradient(90deg, 
				transparent, 
				var(--primary), 
				var(--accent-cyan),
				var(--primary), 
				transparent
			);
		animation: scanLine 4s ease-in-out infinite;
	}
	
	.bar strong {
		font-family: var(--font-mono);
		font-weight: 800;
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		font-size: var(--font-size-3);
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-shadow: 0 0 20px var(--primary-glow);
		position: relative;
	}
	
	@keyframes scanLine {
		0% { left: -100%; opacity: 0; }
		10% { opacity: 1; }
		90% { opacity: 1; }
		100% { left: 100%; opacity: 0; }
	}
	
	.spacer { visibility: hidden; }
	
	/* 📊 DATA VISUALIZATION LIST */
	.list {
		list-style: none;
		margin: 0;
		padding: var(--space-6);
		max-height: calc(50vh - 120px);
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--primary) transparent;
		display: grid;
		gap: var(--space-4);
	}
	
	/* Container Queries for Responsive Grid */
	@container (min-width: 400px) {
		.list {
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		}
	}
	
	.list::-webkit-scrollbar {
		width: 8px;
	}
	
	.list::-webkit-scrollbar-thumb {
		background: linear-gradient(180deg, var(--primary), var(--accent-cyan));
		border-radius: 12px;
		box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.2);
	}
	
	/* 🎨 PROJECT CARD - AWARD-WINNING DESIGN */
	.list li {
		position: relative;
		overflow: hidden;
		border-radius: 20px;
		transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
		container-type: inline-size;
	}
	
	.project-card {
		width: 100%;
		padding: 0;
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--surface) 96%, var(--primary) 4%),
				color-mix(in oklab, var(--surface) 92%, var(--primary) 8%)
			);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 20px;
		cursor: pointer;
		transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
		position: relative;
		overflow: hidden;
		backdrop-filter: blur(8px);
		box-shadow: 
			0 4px 20px -8px rgba(0, 0, 0, 0.1),
			0 0 0 1px color-mix(in oklab, var(--primary) 15%, transparent),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 5%, transparent);
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-height: 140px;
		text-align: left;
	}
	
	.project-card::before {
		content: '';
		position: absolute;
		inset: 0;
		background: 
			radial-gradient(circle at var(--mouse-x, 50%) var(--mouse-y, 50%), 
				color-mix(in oklab, var(--primary) 8%, transparent) 0%,
				transparent 50%
			);
		opacity: 0;
		transition: opacity 0.3s ease;
		pointer-events: none;
	}
	
	.project-card:hover {
		background: 
			radial-gradient(ellipse at top, 
				color-mix(in oklab, var(--surface) 90%, var(--primary) 10%),
				color-mix(in oklab, var(--surface) 85%, var(--primary) 15%)
			);
		border-color: color-mix(in oklab, var(--primary) 50%, transparent);
		transform: translateY(-4px) scale(1.02);
		box-shadow: 
			0 16px 50px -12px rgba(0, 0, 0, 0.25),
			0 0 0 2px color-mix(in oklab, var(--primary) 30%, transparent),
			0 0 40px var(--primary-glow),
			inset 0 2px 4px color-mix(in oklab, var(--primary) 10%, transparent);
	}
	
	.project-card:hover::before {
		opacity: 1;
	}
	
	/* PROJECT HEADER */
	.project-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-5) var(--space-5) var(--space-3);
	}
	
	.project-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--primary) 20%, transparent),
				color-mix(in oklab, var(--primary) 10%, transparent)
			);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 12px;
		color: var(--primary);
		backdrop-filter: blur(4px);
		box-shadow: 
			0 4px 12px -4px var(--primary-glow),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 15%, transparent);
		transition: all 0.3s ease;
	}
	
	.project-card:hover .project-icon {
		transform: scale(1.1) rotate(5deg);
		box-shadow: 
			0 8px 24px -8px var(--primary-glow),
			inset 0 2px 4px color-mix(in oklab, var(--primary) 20%, transparent);
	}
	
	.status-indicator {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: color-mix(in oklab, var(--muted) 50%, transparent);
		border: 2px solid color-mix(in oklab, var(--muted) 30%, transparent);
		transition: all 0.3s ease;
		position: relative;
	}
	
	.status-indicator.active {
		background: var(--primary);
		border-color: var(--primary);
		box-shadow: 
			0 0 12px var(--primary-glow),
			inset 0 1px 2px rgba(255, 255, 255, 0.2);
		animation: statusPulse 2s ease-in-out infinite;
	}
	
	@keyframes statusPulse {
		0%, 100% { 
			transform: scale(1); 
			box-shadow: 0 0 12px var(--primary-glow); 
		}
		50% { 
			transform: scale(1.2); 
			box-shadow: 0 0 20px var(--primary-glow); 
		}
	}
	
	/* PROJECT CONTENT */
	.project-content {
		padding: 0 var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	
	.name {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: var(--font-size-3);
		background: linear-gradient(135deg, var(--text), var(--primary));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		letter-spacing: 0.02em;
		line-height: 1.2;
		margin-bottom: var(--space-1);
	}
	
	.description {
		font-family: var(--font-sans);
		font-size: var(--font-size-1);
		color: var(--muted);
		line-height: 1.4;
		font-style: italic;
	}
	
	/* PROJECT FOOTER */
	.project-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-5) var(--space-5);
		border-top: 1px solid color-mix(in oklab, var(--primary) 15%, transparent);
		margin-top: var(--space-3);
	}
	
	.meta-stats {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	
	.stat-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		font-weight: 600;
	}
	
	.stat-icon {
		font-size: 1em;
		filter: grayscale(0.2);
	}
	
	.stat-value {
		color: var(--primary);
		font-weight: 700;
	}
	
	.stat-label {
		color: var(--muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	
	.action-indicator {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		color: var(--muted);
		transition: all 0.3s ease;
	}
	
	.project-card:hover .action-indicator {
		color: var(--primary);
		transform: translateX(4px);
	}
	
	/* ACTIVE STATE */
	.is-active .project-card {
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--surface) 85%, var(--primary) 15%),
				color-mix(in oklab, var(--surface) 80%, var(--primary) 20%)
			);
		border-color: var(--primary);
		box-shadow: 
			0 0 0 2px color-mix(in oklab, var(--primary) 40%, transparent),
			0 16px 50px -12px rgba(0, 0, 0, 0.3),
			0 0 60px var(--primary-glow),
			inset 0 2px 8px color-mix(in oklab, var(--primary) 20%, transparent);
		transform: translateY(-2px);
	}
	
	.is-active .name {
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	
	/* EMPTY AND ERROR STATES */
	.empty,
	.err {
		padding: var(--space-8);
		text-align: center;
		font-family: var(--font-mono);
		font-style: italic;
		color: var(--muted);
		background: 
			radial-gradient(ellipse at center, 
				color-mix(in oklab, var(--surface) 95%, var(--muted) 5%),
				var(--surface)
			);
		border: 1px dashed color-mix(in oklab, var(--muted) 30%, transparent);
		border-radius: 16px;
		margin: var(--space-4);
	}
	
	.err {
		color: var(--err);
		background: 
			radial-gradient(ellipse at center, 
				color-mix(in oklab, var(--surface) 95%, var(--err) 5%),
				var(--surface)
			);
		border-color: color-mix(in oklab, var(--err) 30%, transparent);
	}
	
	/* LOADING STATE */
	.bar span:not(.spacer) {
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		background: linear-gradient(135deg, var(--muted), var(--primary));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		font-style: italic;
		animation: loadingPulse 2s ease-in-out infinite;
	}
	
	@keyframes loadingPulse {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
	}
	
	/* ACCESSIBILITY AND PERFORMANCE */
	@media (prefers-reduced-motion: reduce) {
		* {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}
	}
	
	@media (prefers-color-scheme: light) {
		.project-card {
			background: 
				linear-gradient(135deg, 
					rgba(255, 255, 255, 0.95),
					rgba(255, 255, 255, 0.85)
				);
		}
	}
</style>
