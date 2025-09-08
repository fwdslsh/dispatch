<script>
	import { onMount } from 'svelte';
	import { io } from 'socket.io-client';
	import TerminalPane from '$lib/components/TerminalPane.svelte';
	import ClaudePane from '$lib/components/ClaudePane.svelte';
	import { Container, Button, Card } from '$lib/shared/components';

	let sessions = $state([]);
	let workspaceRoot = $state('/workspaces');
	let chosenWorkspace = $state('');
	let workspaces = $state([]);

	// Session grid state
	let layoutPreset = $state('2up'); // '1up' | '2up' | '4up'
	let pinned = $state([]); // array of session IDs to display in grid order
	let cols = $derived(layoutPreset === '1up' ? 1 : layoutPreset === '2up' ? 2 : 2);
	let visible = $derived(pinned
		.map((id) => sessions.find((s) => s.id === id))
		.filter(Boolean)
		.slice(0, layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1));

	async function listWorkspaces() {
		const r = await fetch('/api/workspaces');
		const j = await r.json();
		return j.list;
	}

	async function loadSessions() {
		const r = await fetch('/api/sessions');
		const j = await r.json();
		return j.sessions;
	}
	async function openWorkspace(p) {
		chosenWorkspace = p;
		await fetch('/api/workspaces', {
			method: 'POST',
			body: JSON.stringify({ action: 'open', path: p })
		});
	}
	async function create(type) {
		if (!chosenWorkspace) return;

		if (type === 'pty') {
			// Create terminal via Socket.IO
			const socket = io();
			const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';

			socket.emit('terminal.start', { key, workspacePath: chosenWorkspace }, (response) => {
				if (response.success) {
					const s = { id: response.id, type, workspacePath: chosenWorkspace };
					sessions = [...sessions, s];
					// auto-pin newest into grid if there's room
					if (pinned.length < (layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1))
						pinned = [...pinned, response.id];
				} else {
					console.error('Failed to create terminal:', response.error);
				}
				socket.disconnect();
			});
		} else {
			// Create Claude session via API (for now)
			const r = await fetch('/api/sessions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ type, workspacePath: chosenWorkspace, options: {} })
			});
			const { id } = await r.json();
			const s = { id, type, workspacePath: chosenWorkspace };
			sessions = [...sessions, s];
			// auto-pin newest into grid if there's room
			if (pinned.length < (layoutPreset === '4up' ? 4 : layoutPreset === '2up' ? 2 : 1))
				pinned = [...pinned, id];
		}
	}

	function togglePin(id) {
		pinned = pinned.includes(id) ? pinned.filter((x) => x !== id) : [...pinned, id];
	}

	onMount(async () => {
		workspaces = await listWorkspaces();
		sessions = await loadSessions();
	});
</script>

<Container sessionContainer={true}>
	{#snippet children()}
		<section class="toolbar">
			<div class="workspace-controls">
				<label>Workspace</label>
				<select bind:value={chosenWorkspace} on:change={(e) => openWorkspace(e.target.value)}>
					<option value="" disabled selected>Select…</option>
					{#each workspaces as w}<option value={w}>{w}</option>{/each}
				</select>
				<Button
					onclick={() => create('pty')}
					disabled={!chosenWorkspace}
					text="+ Terminal"
					variant="secondary"
					size="small"
				/>
				<Button
					onclick={() => create('claude')}
					disabled={!chosenWorkspace}
					text="+ Claude"
					variant="primary"
					size="small"
				/>
			</div>

			<div class="layout-controls">
				<span>Layout:</span>
				<Button
					onclick={() => (layoutPreset = '1up')}
					text="1-up"
					variant={layoutPreset === '1up' ? 'primary' : 'ghost'}
					size="small"
				/>
				<Button
					onclick={() => (layoutPreset = '2up')}
					text="2-up"
					variant={layoutPreset === '2up' ? 'primary' : 'ghost'}
					size="small"
				/>
				<Button
					onclick={() => (layoutPreset = '4up')}
					text="4-up"
					variant={layoutPreset === '4up' ? 'primary' : 'ghost'}
					size="small"
				/>
			</div>
		</section>

		<!-- Session switcher palette -->
		<Card variant="outlined" padding="small">
			{#snippet children()}
				<div class="sessions-section">
					<strong>Sessions</strong>
					<div class="session-buttons">
						{#each sessions as s}
							<Button
								onclick={() => togglePin(s.id)}
								text="{s.type}:{s.id.slice(0, 10)} {pinned.includes(s.id) ? '📌' : ''}"
								variant={pinned.includes(s.id) ? 'primary' : 'ghost'}
								size="small"
							/>
						{/each}
					</div>
				</div>
			{/snippet}
		</Card>

		<!-- Grid -->
		<div class="grid" style={`--cols:${cols}; margin-top:12px;`}>
			{#each visible as s}
				<div class="tile">
					{#if s.type === 'pty'}
						<TerminalPane ptyId={s.id} />
					{:else}
						<ClaudePane sessionId={s.id} />
					{/if}
				</div>
			{/each}
		</div>
	{/snippet}
</Container>

<style>
	.toolbar {
		display: flex;
		gap: var(--space-md);
		align-items: center;
		flex-wrap: wrap;
		padding: var(--space-sm);
		background: var(--surface);
		border-bottom: 1px solid var(--border);
	}

	.workspace-controls {
		display: flex;
		gap: var(--space-sm);
		align-items: center;
	}

	.layout-controls {
		margin-left: auto;
		display: flex;
		gap: var(--space-xs);
		align-items: center;
	}

	.sessions-section {
		display: flex;
		flex-direction: column;
		gap: var(--space-sm);
	}

	.session-buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-xs);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(var(--cols), 1fr);
		gap: var(--space-sm);
		flex: 1;
		overflow: hidden;
	}

	.tile {
		display: flex;
		flex-direction: column;
		min-height: 400px;
		background: var(--surface);
		border: 1px solid var(--border);
		border-radius: 4px;
		overflow: hidden;
	}

	select {
		background: var(--surface);
		border: 1px solid var(--border);
		color: var(--text-primary);
		padding: var(--space-xs) var(--space-sm);
		border-radius: 4px;
		min-width: 200px;
	}

	label {
		color: var(--text-secondary);
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.toolbar {
			flex-direction: column;
			align-items: stretch;
		}

		.layout-controls {
			margin-left: 0;
			justify-content: center;
		}

		.grid {
			grid-template-columns: 1fr;
		}

		.tile {
			min-height: 300px;
		}
	}
</style>
