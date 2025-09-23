<!--
	SessionWindowManager.svelte

	Desktop window manager wrapper that binds WindowViewModel state to the
	WindowManager layout component. WindowViewModel now owns the
	session-to-tile mapping; this wrapper simply renders tiles and proxies
	interactions back to the view model.
-->
<script>
	import WindowManager from '../window-manager/WindowManager.svelte';
	import EmptySessionPane from './EmptySessionPane.svelte';
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

<div class="relative w-full h-full">
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
			<div
				class="relative w-full h-full flex flex-col"
				class:edit-mode={editMode}
				class:has-session={!!session}
			>
				<!-- Tile Controls for Edit Mode - shown for ALL tiles when edit mode is active -->
				{#if editMode}
					<div
						class="tile-controls surface-raised border border-surface-border radius p-1 shadow-sm"
					>
						<div class="flex gap-1 flex-wrap">
							<button
								class="control-btn split-right surface-active border border-surface-border text-primary p-1 radius cursor-pointer transition-all flex items-center justify-center"
								onclick={onSplitRight}
								title="Split Right"
								aria-label="Split Right"
							>
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

							<button
								class="control-btn split-down surface-active border border-surface-border text-primary p-1 radius cursor-pointer transition-all flex items-center justify-center"
								onclick={onSplitDown}
								aria-label="Split Down"
								title="Split Down"
							>
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

							<button
								class="control-btn close surface-active border border-surface-border text-primary p-1 radius cursor-pointer transition-all flex items-center justify-center"
								onclick={onClose}
								aria-label="Close Tile"
								title="Close Tile"
							>
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
								<div class="flex gap-1 border-l border-surface-border pl-1 ml-1 relative">
									<button
										class="control-btn move-session surface-active border border-surface-border text-primary p-1 radius cursor-pointer transition-all flex items-center justify-center"
										onclick={() => handleSessionMove(session.id, tileId)}
										title="Move Session to Another Tile"
										aria-label="Move Session to Another Tile"
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
										<div
											class="move-dropdown surface-raised border border-surface-border radius p-1 shadow-md"
										>
											{#if availableTiles.length === 0}
												<div
													class="dropdown-item block w-full p-2 bg-transparent border-0 radius text-primary font-mono text-sm text-left cursor-pointer transition-all opacity-50 cursor-not-allowed italic"
												>
													No other tiles available
												</div>
											{:else}
												{#each availableTiles as targetTileId}
													{@const targetSession = getTileSession(targetTileId)}
													<button
														class="dropdown-item block w-full p-2 bg-transparent border-0 radius text-primary font-mono text-sm text-left cursor-pointer transition-all hover:surface-hover {targetSession
															? 'will-swap'
															: ''}"
														onclick={() => handleMoveToTile(session.id, targetTileId)}
														title={targetSession
															? `Swap with ${targetSession.name || 'Session'}`
															: 'Move to empty tile'}
													>
														<div class="flex flex-between">
															<span class="font-medium flex-1">
																{targetTileId === 'root'
																	? 'Root Tile'
																	: `Tile ${targetTileId.slice(0, 6)}`}
															</span>
															{#if targetSession}
																<span
																	class="text-xs opacity-70 ml-2 flex items-center gap-1 text-warning"
																>
																	<svg
																		class="swap-icon inline-block align-middle"
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
																<span
																	class="text-xs opacity-70 ml-2 flex items-center gap-1 text-success"
																	>• Empty</span
																>
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
					<div
						class="empty-tile-content w-full h-full flex flex-col items-center justify-center surface radius p-4"
					>
						<EmptySessionPane onCreateSession={handleCreateSessionInTile}></EmptySessionPane>
					</div>
				{/if}
			</div>
		{/snippet}
	</WindowManager>
</div>

<style>
	/* Component-specific positioning and animations only */
	.tile-controls {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		z-index: 10;
		backdrop-filter: blur(4px);
	}

	.control-btn {
		width: 32px;
		height: 32px;
	}

	.control-btn:hover {
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

	.move-dropdown {
		position: absolute;
		top: calc(100% + var(--space-1));
		right: 0;
		min-width: 220px;
		max-width: 300px;
		z-index: 100;
		animation: slideDown 0.2s ease;
	}

	.dropdown-item + .dropdown-item {
		margin-top: 2px;
	}

	.dropdown-item.will-swap:hover {
		background: var(--warning-alpha, rgba(245, 158, 11, 0.1));
		border-left: 2px solid var(--warning, #f59e0b);
		padding-left: calc(var(--space-2) - 2px);
	}

	.swap-icon {
		animation: pulse 1s ease-in-out infinite;
	}

	.empty-tile-content {
		border: 2px dashed var(--surface-border);
	}

	.empty-tile-content p {
		margin: 0;
		opacity: 0.75;
	}

	/* Component-specific animation */
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
</style>
