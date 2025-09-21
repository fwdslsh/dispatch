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
	import SessionHeaderRenderer from './SessionHeaderRenderer.svelte';
	import SessionViewport from './SessionViewport.svelte';

	let {
		sessions = [],
		onSessionFocus = () => {},
		onSessionClose = () => {},
		onSessionAssignToTile = () => {},
		onCreateSession = () => {},
		/** @type {boolean} */ showEditMode = false
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

	// Edit mode state
	let editMode = $state(showEditMode);

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

	// Handle session move between tiles
	function handleSessionMove(sessionId, currentTileId) {
		console.log('[SessionWindowManager] Moving session:', sessionId, 'from tile:', currentTileId);

		// Get all available tile IDs
		const availableTiles = Array.from(tileIds).filter((id) => id !== currentTileId);

		if (availableTiles.length === 0) {
			alert('No other tiles available. Create a split first.');
			return;
		}

		// Simple prompt for now - could be enhanced with a modal
		const targetTileOptions = availableTiles
			.map(
				(id, index) => `${index + 1}. ${id === 'root' ? 'Root Tile' : `Tile ${id.slice(0, 8)}...`}`
			)
			.join('\n');
		const choice = prompt(
			`Move session to which tile?\n\n${targetTileOptions}\n\nEnter the number (1-${availableTiles.length}):`
		);

		if (choice && !isNaN(choice)) {
			const choiceIndex = parseInt(choice) - 1;
			if (choiceIndex >= 0 && choiceIndex < availableTiles.length) {
				const targetTileId = availableTiles[choiceIndex];
				console.log('[SessionWindowManager] Moving session to tile:', targetTileId);

				// Call the assign function to move the session
				if (typeof onSessionAssignToTile === 'function') {
					onSessionAssignToTile(sessionId, targetTileId);
				}
			}
		}
	}

	// Handle edit mode toggle
	function handleEditModeToggle(event) {
		editMode = event.detail.editMode;
	}

	// Sync edit mode with prop
	$effect(() => {
		editMode = showEditMode;
	});
</script>

<div class="window-manager-wrapper">
	<WindowManager
		bind:this={windowManagerRef}
		initial={layoutTree}
		direction="row"
		gap={windowConfig.gap}
		minSize={windowConfig.minSize}
		keymap={windowConfig.keymap}
		showEditMode={editMode}
		onfocuschange={handleFocusChange}
		onlayoutchange={handleLayoutChange}
		oneditmodetoggle={handleEditModeToggle}
	>
		{#snippet tile({ focused, tileId, editMode, onSplitRight, onSplitDown, onClose })}
			{@const session = getTileSession(tileId)}
			{@const sessionIndex = session ? sessions.indexOf(session) : -1}
			<div class="tile-wrapper" class:edit-mode={editMode} class:has-session={!!session}>
				<!-- Tile Controls for Edit Mode - shown for ALL tiles when edit mode is active -->
				{#if editMode}
					<div class="tile-controls">
						<div class="tile-controls-group">
							<button class="control-btn split-right" onclick={onSplitRight} title="Split Right">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
									<rect
										x="1"
										y="2"
										width="6"
										height="12"
										rx="1"
										stroke="currentColor"
										fill="none"
										stroke-width="1.5"
									/>
									<rect
										x="9"
										y="2"
										width="6"
										height="12"
										rx="1"
										stroke="currentColor"
										fill="none"
										stroke-width="1.5"
									/>
								</svg>
							</button>

							<button class="control-btn split-down" onclick={onSplitDown} title="Split Down">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
									<rect
										x="2"
										y="1"
										width="12"
										height="6"
										rx="1"
										stroke="currentColor"
										fill="none"
										stroke-width="1.5"
									/>
									<rect
										x="2"
										y="9"
										width="12"
										height="6"
										rx="1"
										stroke="currentColor"
										fill="none"
										stroke-width="1.5"
									/>
								</svg>
							</button>

							<button class="control-btn close" onclick={onClose} title="Close Tile">
								<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
									<path
										d="M12 4L4 12M4 4l8 8"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
									/>
								</svg>
							</button>

							{#if session && editMode}
								<!-- Session assignment controls -->
								<div class="session-controls">
									<button
										class="control-btn move-session"
										onclick={() => handleSessionMove(session.id, tileId)}
										title="Move Session to Another Tile"
									>
										<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
											<path d="M8 2L12 6H9V10H7V6H4L8 2ZM2 12H14V14H2V12Z" fill="currentColor" />
										</svg>
									</button>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if session}
					<SessionContainer {session} index={sessionIndex} onClose={handleSessionClose}>
						{#snippet header({ session, onClose, index })}
							<SessionHeaderRenderer {session} {onClose} {index} />
						{/snippet}

						{#snippet content({ session, isLoading, index })}
							<SessionViewport {session} {isLoading} {index} />
						{/snippet}
					</SessionContainer>
				{:else}
					<div class="empty-tile-content">
						<p>No session assigned {editMode ? '• Edit Mode Active' : ''}</p>
						<div class="empty-actions">
							<button class="create-session-btn" onclick={() => handleCreateSessionInTile('pty')}>
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
				{/if}
			</div>
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

	/* Tile Controls for Edit Mode */
	.tile-wrapper {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.tile-controls {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 10;
		background: var(--surface-raised);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		padding: var(--space-1);
		backdrop-filter: blur(4px);
		box-shadow: var(--shadow-sm);
	}

	.tile-controls-group {
		display: flex;
		gap: var(--space-1);
		align-items: center;
		flex-wrap: wrap;
	}

	.session-controls {
		display: flex;
		gap: var(--space-1);
		border-left: 1px solid var(--surface-border);
		padding-left: var(--space-1);
		margin-left: var(--space-1);
	}

	.control-btn {
		background: var(--surface-active);
		border: 1px solid var(--surface-border);
		color: var(--text-primary);
		padding: var(--space-1);
		border-radius: var(--radius);
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
	}

	.control-btn:hover {
		background: var(--surface-hover);
		border-color: var(--primary);
		transform: translateY(-1px);
	}

	.control-btn.split-right:hover,
	.control-btn.split-down:hover {
		background: var(--primary);
		color: var(--primary-contrast);
	}

	.control-btn.close:hover {
		background: var(--danger);
		color: var(--danger-contrast);
	}

	.control-btn.move-session:hover {
		background: var(--warning, #f59e0b);
		color: var(--warning-contrast, #fff);
	}

	.tile-wrapper.edit-mode {
		position: relative;
	}

	.empty-tile-content {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: var(--surface);
		border: 2px dashed var(--surface-border);
		border-radius: var(--radius);
		padding: var(--space-4);
	}
</style>
