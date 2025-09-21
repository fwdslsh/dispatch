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

	// Dropdown state for move session menu
	let activeMoveDropdown = $state(null); // stores { sessionId, tileId } when dropdown is open

	const tileOrder = $derived.by(() => Array.from(tileIds));

	// Ensure there is enough layout surface for every session and auto-assign unassigned sessions
	$effect(() => {
		if (!windowManagerRef?.splitBesideCurrent) return;

		// Count sessions that need tile assignments
		const unassignedSessions = sessions.filter((session) => !session.tileId);
		const assignedSessions = sessions.filter((session) => session.tileId);
		const tilesAvailable = tileIds.size;
		const occupiedTiles = new Set(assignedSessions.map((s) => s.tileId));
		const availableTiles = Array.from(tileIds).filter((tileId) => !occupiedTiles.has(tileId));

		// Auto-assign unassigned sessions to available tiles
		unassignedSessions.forEach((session, index) => {
			if (index < availableTiles.length) {
				const targetTileId = availableTiles[index];
				console.log(
					'[SessionWindowManager] Auto-assigning session',
					session.id,
					'to tile',
					targetTileId
				);
				if (typeof onSessionAssignToTile === 'function') {
					onSessionAssignToTile(session.id, targetTileId);
				}
			}
		});

		// Create additional tiles if needed
		const additionalTilesNeeded = unassignedSessions.length - availableTiles.length;
		if (additionalTilesNeeded > 0) {
			for (let i = 0; i < additionalTilesNeeded; i += 1) {
				try {
					windowManagerRef.splitBesideCurrent('row');
				} catch (error) {
					console.warn('[SessionWindowManager] Failed to auto-split layout', error);
					break;
				}
			}
		}
	});

	// Map sessions to tiles based on their tileId property
	const getTileSession = (tileId) => {
		return sessions.find((session) => session.tileId === tileId) || null;
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

	// Toggle dropdown for session move
	function handleSessionMove(sessionId, currentTileId) {
		// Toggle dropdown - close if clicking same button, otherwise open
		if (activeMoveDropdown?.sessionId === sessionId) {
			activeMoveDropdown = null;
		} else {
			activeMoveDropdown = { sessionId, tileId: currentTileId };
		}
	}

	// Handle selecting a target tile from dropdown - swaps if target is occupied
	function handleMoveToTile(sessionId, targetTileId) {
		const sourceSession = sessions.find((s) => s.id === sessionId);
		const sourceTileId = sourceSession?.tileId;
		const targetSession = getTileSession(targetTileId);

		if (targetSession) {
			// Target tile is occupied - perform swap
			console.log('[SessionWindowManager] Swapping sessions:', {
				source: { sessionId, tileId: sourceTileId },
				target: { sessionId: targetSession.id, tileId: targetTileId }
			});

			// Move source session to target tile
			if (typeof onSessionAssignToTile === 'function') {
				onSessionAssignToTile(sessionId, targetTileId);
			}

			// Move target session to source tile (swap)
			if (sourceTileId && typeof onSessionAssignToTile === 'function') {
				// Small delay to ensure first assignment is processed
				setTimeout(() => {
					onSessionAssignToTile(targetSession.id, sourceTileId);
				}, 50);
			}
		} else {
			// Target tile is empty - simple move
			console.log(
				'[SessionWindowManager] Moving session',
				sessionId,
				'to empty tile:',
				targetTileId
			);

			if (typeof onSessionAssignToTile === 'function') {
				onSessionAssignToTile(sessionId, targetTileId);
			}
		}

		// Close the dropdown
		activeMoveDropdown = null;
	}

	// Close dropdown when clicking outside
	function handleClickOutside(event) {
		if (activeMoveDropdown && !event.target.closest('.move-dropdown-container')) {
			activeMoveDropdown = null;
		}
	}

	// Add global click handler for closing dropdown
	$effect(() => {
		if (activeMoveDropdown) {
			document.addEventListener('click', handleClickOutside);
			return () => {
				document.removeEventListener('click', handleClickOutside);
			};
		}
	});

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
								<div class="session-controls move-dropdown-container">
									<button
										class="control-btn move-session"
										onclick={() => handleSessionMove(session.id, tileId)}
										title="Move Session to Another Tile"
									>
										<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
											<path d="M8 2L12 6H9V10H7V6H4L8 2ZM2 12H14V14H2V12Z" fill="currentColor" />
										</svg>
									</button>

									{#if activeMoveDropdown?.sessionId === session.id}
										{@const availableTiles = Array.from(tileIds).filter((id) => id !== tileId)}
										{@const occupiedTiles = sessions
											.filter((s) => s.tileId && s.id !== session.id)
											.map((s) => s.tileId)}
										<div class="move-dropdown">
											{#if availableTiles.length === 0}
												<div class="dropdown-item disabled">No other tiles available</div>
											{:else}
												{#each availableTiles as targetTileId}
													{@const targetSession = getTileSession(targetTileId)}
													<button
														class="dropdown-item {targetSession ? 'will-swap' : ''}"
														onclick={() => handleMoveToTile(session.id, targetTileId)}
														title={targetSession
															? `Swap with ${targetSession.name || 'Session'}`
															: 'Move to empty tile'}
													>
														<div class="dropdown-item-content">
															<span class="tile-name">
																{targetTileId === 'root'
																	? 'Root Tile'
																	: `Tile ${targetTileId.slice(0, 6)}`}
															</span>
															{#if targetSession}
																<span class="tile-status occupied">
																	<svg
																		class="swap-icon"
																		width="12"
																		height="12"
																		viewBox="0 0 16 16"
																		fill="currentColor"
																	>
																		<path d="M3 9V7h8v2H3zm0-4V3l4 3-4 3V5zm10 6v2l-4-3 4-3v2z" />
																	</svg>
																	{targetSession.name || `Session ${targetSession.id.slice(0, 6)}`}
																</span>
															{:else}
																<span class="tile-status empty">• Empty</span>
															{/if}
														</div>
													</button>
												{/each}
											{/if}
										</div>
									{/if}
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
		position: relative;
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

	/* Dropdown Menu Styles */
	.move-dropdown-container {
		position: relative;
	}

	.move-dropdown {
		position: absolute;
		top: calc(100% + var(--space-1));
		right: 0;
		background: var(--surface-raised);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		padding: var(--space-1);
		min-width: 220px;
		max-width: 300px;
		box-shadow: var(--shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
		z-index: 100;
		animation: slideDown 0.2s ease;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.dropdown-item {
		display: block;
		width: 100%;
		padding: var(--space-2) var(--space-2);
		background: transparent;
		border: none;
		border-radius: var(--radius);
		color: var(--text-primary);
		font-family: var(--font-mono);
		font-size: var(--text-sm);
		text-align: left;
		cursor: pointer;
		transition: all 0.15s ease;
		position: relative;
	}

	.dropdown-item-content {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
	}

	.dropdown-item:hover:not(.disabled) {
		background: var(--surface-hover);
	}

	.dropdown-item.will-swap:hover {
		background: var(--warning-alpha, rgba(245, 158, 11, 0.1));
		border-left: 2px solid var(--warning, #f59e0b);
		padding-left: calc(var(--space-2) - 2px);
	}

	.dropdown-item.disabled {
		opacity: 0.5;
		cursor: not-allowed;
		font-style: italic;
	}

	.dropdown-item + .dropdown-item {
		margin-top: 2px;
	}

	.tile-name {
		font-weight: 500;
		flex: 1;
	}

	.tile-status {
		font-size: var(--text-xs);
		opacity: 0.7;
		margin-left: var(--space-2);
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	.tile-status.occupied {
		color: var(--warning, #f59e0b);
	}

	.tile-status.empty {
		color: var(--success, #10b981);
	}

	.swap-icon {
		display: inline-block;
		vertical-align: middle;
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 0.7;
		}
		50% {
			opacity: 1;
		}
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
