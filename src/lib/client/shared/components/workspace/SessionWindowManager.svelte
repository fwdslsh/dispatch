<!--
	SessionWindowManager.svelte

	Integration component that combines WindowManager with session management.
	Provides the tile-based layout for desktop sessions using MVVM architecture.
	Uses TileAssignmentService for clean reactive session-to-tile assignment.
-->
<script>
	import WindowManager from '../window-manager/WindowManager.svelte';
	import SessionContainer from './SessionContainer.svelte';
	import SessionHeader from './SessionHeader.svelte';
	import SessionViewport from './SessionViewport.svelte';
	import EmptyWorkspace from './EmptyWorkspace.svelte';

	// Props
	let {
		windowViewModel,
		tileAssignmentService,
		sessions = [],
		onSessionFocus = () => {},
		onSessionClose = () => {},
		onSessionUnpin = () => {},
		onCreateSession = () => {},
		onCreateSessionDirect = null
	} = $props();

	// Window manager configuration from ViewModel with safe defaults
	const windowConfig = $derived({
		gap: windowViewModel?.windowGap || 6,
		minSize: windowViewModel?.minTileSize || 200,
		keymap: windowViewModel?.keymap || {
			addRight: 'Control+Enter',
			addDown: 'Control+Shift+Enter',
			close: 'Control+Shift+x',
			focusNext: 'Alt+ArrowRight',
			focusPrev: 'Alt+ArrowLeft',
			growHeight: 'Control+ArrowUp',
			shrinkHeight: 'Control+ArrowDown'
		}
	});

	// Create a mapping between WindowManager's real tile IDs and sessions
	let tileToSessionMap = $state(new Map());
	let sessionToTileMap = $state(new Map());

	// Auto-assign sessions to tiles when sessions change
	$effect(() => {
		if (sessions.length > 0) {
			// Get available tile IDs from WindowManager by checking the DOM
			const tileElements = document.querySelectorAll('[data-tile-id]');
			const availableTileIds = Array.from(tileElements).map(el => el.getAttribute('data-tile-id')).filter(Boolean);

			// Only update if we actually have tiles and sessions aren't already mapped correctly
			if (availableTileIds.length > 0) {
				const needsUpdate = sessions.some(session => !sessionToTileMap.has(session.id));

				if (needsUpdate) {
					console.log('[SessionWindowManager] Auto-assigning sessions to tiles:', sessions.length, 'sessions');
					console.log(`[SessionWindowManager] Found ${availableTileIds.length} available tiles:`, availableTileIds);

					// Build new mappings without modifying state until the end
					const newTileToSessionMap = new Map();
					const newSessionToTileMap = new Map();

					// First, preserve existing valid mappings
					for (const [tileId, session] of tileToSessionMap) {
						if (sessions.find(s => s.id === session.id) && availableTileIds.includes(tileId)) {
							newTileToSessionMap.set(tileId, session);
							newSessionToTileMap.set(session.id, tileId);
						}
					}

					// Then assign new sessions to available tiles
					for (const session of sessions) {
						if (!newSessionToTileMap.has(session.id)) {
							const unmappedTileId = availableTileIds.find(tileId => !newTileToSessionMap.has(tileId));
							if (unmappedTileId) {
								newTileToSessionMap.set(unmappedTileId, session);
								newSessionToTileMap.set(session.id, unmappedTileId);
								console.log(`[SessionWindowManager] Mapped session ${session.id} to tile ${unmappedTileId}`);
							}
						}
					}

					// Update maps only once at the end
					tileToSessionMap = newTileToSessionMap;
					sessionToTileMap = newSessionToTileMap;
				}
			}
		}
	});

	// Helper to get session assigned to a tile using our mapping
	function getSessionForTile(tileId) {
		const session = tileToSessionMap.get(tileId);
		if (session) {
			const index = sessions.findIndex(s => s.id === session.id);
			return { session, index: index >= 0 ? index : 0 };
		}
		return null;
	}

	// Handle tile focus from WindowManager
	function handleTileFocus(tileId) {
		// Sync focus to WindowViewModel
		if (windowViewModel) {
			windowViewModel.syncFocusFromWindowManager(tileId);
		}

		// If tile has a session, also focus it
		const sessionData = getSessionForTile(tileId);
		if (sessionData) {
			onSessionFocus(sessionData.session);
		}
	}

	// Handle session actions
	function handleSessionClose(sessionId) {
		onSessionClose(sessionId);
	}

	function handleSessionUnpin(sessionId) {
		onSessionUnpin(sessionId);
	}

	// Handle creating a session in a specific tile
	async function handleCreateSessionInTile(type, tileId) {
		// Optionally tell the assignment service this tile should get the next session of this type
		try {
			if (tileAssignmentService && tileAssignmentService.setTargetTileForType) {
				tileAssignmentService.setTargetTileForType(tileId, type);
			}
		} catch (error) {
			console.warn('[SessionWindowManager] Failed to set target tile for type:', error);
		}

		// Use direct creation if available (bypasses modal), otherwise use normal flow
		if (onCreateSessionDirect) {
			await onCreateSessionDirect(type);
		} else {
			onCreateSession(type);
		}
	}

	// Handle general session creation (from modal/menu) - use focused tile if available
	function handleCreateSession(type) {
		// Optionally tell the assignment service to use the focused tile for the next session
		try {
			if (tileAssignmentService && tileAssignmentService.setFocusedTileAsTarget) {
				tileAssignmentService.setFocusedTileAsTarget(type);
			}
		} catch (error) {
			console.warn('[SessionWindowManager] Failed to set focused tile as target:', error);
		}

		// Always proceed with normal session creation
		onCreateSession(type);
	}

	// Expose function for parent component
	export { handleCreateSession };
</script>

<!-- Window manager with session tiles - always show WindowManager, even with no sessions -->
<WindowManager
	direction="row"
	gap={windowConfig.gap}
	minSize={windowConfig.minSize}
	keymap={windowConfig.keymap}
>
		{#snippet tile({ focused, tileId })}
			{@const sessionData = getSessionForTile(tileId)}
			{@const isFocused = focused === tileId}

			{#if sessionData}
				<div class="session-tile" class:focused={isFocused} onclick={() => handleTileFocus(tileId)}>
					<SessionContainer
						session={sessionData.session}
						index={sessionData.index}
						onClose={handleSessionClose}
						onUnpin={handleSessionUnpin}
					>
						{#snippet header({ session, onClose, onUnpin, index })}
							<SessionHeader {session} {onClose} {onUnpin} {index} />
						{/snippet}

						{#snippet content({ session, isLoading, index })}
							<SessionViewport {session} {isLoading} {index} />
						{/snippet}
					</SessionContainer>
				</div>
			{:else}
				<!-- Empty tile - allow creating new sessions -->
				<div class="empty-tile" class:focused={isFocused} onclick={() => handleTileFocus(tileId)}>
					<div class="empty-tile-content">
						<p>Empty Tile</p>
						<p class="help-text">Click to focus, then use Ctrl+Enter to split</p>
						<div class="empty-actions">
							<button
								class="create-session-btn"
								onclick={(e) => {
									e.stopPropagation();
									handleCreateSessionInTile('terminal', tileId);
								}}
							>
								+ Terminal
							</button>
							<button
								class="create-session-btn"
								onclick={(e) => {
									e.stopPropagation();
									handleCreateSessionInTile('claude', tileId);
								}}
							>
								+ Claude
							</button>
						</div>
					</div>
				</div>
			{/if}
		{/snippet}
	</WindowManager>

<style>
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
		background: #555;
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

	.session-tile {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border-radius: 4px;
		border: 1px solid var(--surface-border);
		background: var(--bg);
		transition: border-color 0.2s ease;
		pointer-events: auto;
	}

	.session-tile.focused {
		border-color: var(--primary);
		box-shadow: 0 0 0 1px var(--primary-alpha);
	}

	.empty-tile {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px dashed var(--surface-border);
		border-radius: 4px;
		background: var(--surface-hover);
		transition: border-color 0.2s ease;
		pointer-events: auto;
	}

	.empty-tile.focused {
		border-color: var(--primary);
		background: var(--primary-alpha);
	}

	.empty-tile-content {
		text-align: center;
		color: var(--text-muted);
	}

	.empty-tile-content p {
		margin: 0 0 1rem 0;
		font-size: 0.9rem;
		opacity: 0.7;
	}

	.help-text {
		font-size: 0.75rem !important;
		opacity: 0.5 !important;
		margin: 0 0 1.5rem 0 !important;
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
		pointer-events: auto;
	}

	.create-session-btn:hover {
		background: var(--primary-hover);
	}

	.create-session-btn:active {
		background: var(--primary-active);
	}

	.empty-tile.error {
		background: var(--error-bg, #3a1515);
		border-color: var(--error-border, #aa4444);
	}

	.empty-tile.error .empty-tile-content {
		color: var(--error-text, #ff8888);
	}

	.error-tile {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 2px dashed var(--error-border, #aa4444);
		border-radius: 4px;
		background: var(--error-bg, #3a1515);
		color: var(--error-text, #ff8888);
		pointer-events: auto;
	}

	.error-content {
		text-align: center;
		font-size: 0.9rem;
		opacity: 0.8;
	}
</style>
