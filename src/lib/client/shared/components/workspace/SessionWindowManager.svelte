<!--
	SessionWindowManager.svelte

	Desktop window manager wrapper that binds WindowViewModel state to the
	WindowManager layout component. WindowViewModel now owns the
	session-to-tile mapping; this wrapper simply renders tiles and proxies
	interactions back to the view model.
-->
<script>
	import WindowManager from '../window-manager/WindowManager.svelte';
	import SessionContainer from './SessionContainer.svelte';
	import SessionHeader from './SessionHeader.svelte';
	import SessionViewport from './SessionViewport.svelte';

	let {
		sessions = [],
		onSessionFocus = () => {},
		onSessionClose = () => {},
		onSessionAssignToTile = () => {},
		onCreateSession = () => {}
	} = $props();

	// Simple window manager configuration
	const windowConfig = {
		gap: 6,
		minSize: 200,
		keymap: {}
	};

	// Let WindowManager create its own layout
	const layoutTree = null;

	// Available tile IDs from WindowManager
	let tileIds = $state(new Set(['root']));
	let windowManagerRef = $state(null);

	const tileOrder = $derived.by(() => Array.from(tileIds));

	// Ensure there is enough layout surface for every session
	$effect(() => {
		if (!windowManagerRef?.splitBesideCurrent) return;
		const tilesAvailable = tileIds.size;
		const additionalTilesNeeded = sessions.length - tilesAvailable;
		if (additionalTilesNeeded <= 0) return;

		for (let i = 0; i < additionalTilesNeeded; i += 1) {
			try {
				windowManagerRef.splitBesideCurrent('row');
			} catch (error) {
				console.warn('[SessionWindowManager] Failed to auto-split layout', error);
				break;
			}
		}
	});

	// Simple positional mapping – session N is rendered in tile N
	const getTileSession = (tileId) => {
		const index = tileOrder.indexOf(tileId);
		if (index === -1) return null;
		return sessions[index] ?? null;
	};

	function handleFocusChange(event) {
		const tileId = event?.detail?.id;
		if (tileId) {
			const session = getTileSession(tileId);
			if (session) {
				onSessionFocus(session);
			}
		}
	}

	function handleLayoutChange(event) {
		// Update available tile IDs when layout changes
		const layout = event?.detail?.layout;
		if (layout) {
			const newTileIds = new Set();
			collectTileIds(layout, newTileIds);
			console.log('[SessionWindowManager] Layout changed, tile IDs:', Array.from(newTileIds));
			tileIds = newTileIds;
		}
	}

	function collectTileIds(node, tileIds) {
		if (node.type === 'leaf') {
			tileIds.add(node.id);
		} else if (node.type === 'split') {
			collectTileIds(node.a, tileIds);
			collectTileIds(node.b, tileIds);
		}
	}

	function handleSessionClose(sessionId) {
		onSessionClose(sessionId);
	}

	function handleCreateSessionInTile(type) {
		console.log('[SessionWindowManager] Creating session in tile:', type);
		// Call the direct creation function instead of opening modal
		if (typeof onCreateSession === 'function') {
			onCreateSession(type);
		}
	}
</script>

<div class="window-manager-wrapper">
	<WindowManager
		bind:this={windowManagerRef}
		initial={layoutTree}
		direction="row"
		gap={windowConfig.gap}
		minSize={windowConfig.minSize}
		keymap={windowConfig.keymap}
		onfocuschange={handleFocusChange}
		onlayoutchange={handleLayoutChange}
	>
		{#snippet tile({ focused, tileId })}
			{@const session = getTileSession(tileId)}
			{@const sessionIndex = session ? sessions.indexOf(session) : -1}
			{#if session}
				<SessionContainer
					{session}
					index={sessionIndex}
					onClose={handleSessionClose}
				>
					{#snippet header({ session, onClose, index })}
						<SessionHeader {session} {onClose} {index} />
					{/snippet}

					{#snippet content({ session, isLoading, index })}
						<SessionViewport {session} {isLoading} {index} />
					{/snippet}
				</SessionContainer>
			{:else}
				<div class="empty-tile" data-focused={String(focused === tileId)}>
					<div class="empty-tile-content">
						<p>No session assigned</p>
						<div class="empty-actions">
							<button
								class="create-session-btn"
								onclick={() => handleCreateSessionInTile('pty')}
							>
								+ Terminal
							</button>
							<button
								class="create-session-btn"
								onclick={() => handleCreateSessionInTile('claude')}
							>
								+ Claude
							</button>
							<button
								class="create-session-btn"
								onclick={() => handleCreateSessionInTile('file-editor')}
							>
								+ File Editor
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/snippet}
	</WindowManager>
</div>

<style>
	.window-manager-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
	}

	.empty-tile {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-direction: column;
		gap: 0.75rem;
		border: 2px dashed var(--surface-border);
		border-radius: 6px;
		background: var(--surface-hover);
		padding: 1.25rem;
		width: 100%;
		height: 100%;
		box-sizing: border-box;
	}

	.empty-tile[data-focused='true'] {
		border-color: var(--primary);
		background: var(--primary-alpha);
	}

	.empty-tile-content {
		text-align: center;
		color: var(--text-muted);
	}

	.empty-tile-content p {
		margin: 0;
		font-size: 0.9rem;
		opacity: 0.75;
	}

	.empty-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
		flex-wrap: wrap;
	}

	.create-session-btn {
		background: var(--primary);
		color: var(--primary-contrast);
		border: none;
		border-radius: var(--radius);
		padding: var(--space-2) var(--space-3);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.create-session-btn:hover {
		background: var(--primary-hover);
	}

	/* Ensure WindowManager fills container */
	:global(.wm-root) {
		width: 100%;
		height: 100%;
		display: flex;
		outline: none;
	}

	/* Split container styling - critical for horizontal/vertical splits */
	:global(.wm-split) {
		display: flex;
		width: 100%;
		height: 100%;
	}

	:global(.wm-split[data-dir='row']) {
		flex-direction: row;
	}

	:global(.wm-split[data-dir='column']) {
		flex-direction: column;
	}

	/* Pane styling */
	:global(.wm-pane) {
		display: flex;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}

	/* Divider styling for drag resize */
	:global(.wm-divider) {
		background: var(--surface-border);
		position: relative;
		transition: background-color 0.2s;
		flex-shrink: 0;
	}

	:global(.wm-divider:hover) {
		background: #777;
	}

	:global(.wm-divider[data-dir='row']) {
		width: 4px;
		cursor: col-resize;
	}

	:global(.wm-divider[data-dir='column']) {
		height: 4px;
		cursor: row-resize;
	}

	/* Basic tile button styling for WindowManager */
	:global(.wm-tile) {
		background: none;
		border: none;
		padding: 0;
		margin: 0;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		cursor: pointer;
		outline: none;
	}
</style>
