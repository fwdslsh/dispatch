<svelte:options runes={true} />

<script>
	import WindowManager from '$lib/client/shared/components/window-manager/WindowManager.svelte';
	import SessionContainer from '$lib/client/shared/components/workspace/SessionContainer.svelte';
	import TerminalPane from '$lib/client/terminal/TerminalPane.svelte';
	import ClaudePane from '$lib/client/claude/ClaudePane.svelte';
	import Button from '$lib/client/shared/components/Button.svelte';
	import { IconTerminal, IconX, IconPin, IconPinnedOff } from '@tabler/icons-svelte';
	import IconClaude from '$lib/client/shared/components/Icons/IconClaude.svelte';

	// Session management state
	/** @type {Map<string, any>} */
	let sessions = $state(new Map());

	/** @type {Map<string, string>} Tile ID to Session ID mapping */
	let tileSessionMap = $state(new Map());


	/** @type {boolean} */
	let showInstructions = $state(true);

	/** @type {number} */
	let sessionCounter = $state(0);

	// Socket connections are managed by individual session panes

	/**
	 * Create a new session and assign it to a tile
	 * @param {'terminal' | 'claude'} type - UI type, converted internally to 'pty' | 'claude'
	 * @param {string} tileId - Optional tile ID to assign to
	 */
	async function createSession(type, tileId = null) {
		const sessionId = `${type}-${Date.now()}-${++sessionCounter}`;

		const newSession = {
			id: sessionId,
			type: type === 'terminal' ? 'pty' : 'claude',
			isActive: false,
			name: `${type === 'terminal' ? 'Terminal' : 'Claude'} ${sessionCounter}`,
			isPinned: true
		};

		sessions.set(sessionId, newSession);
		sessions = new Map(sessions); // Trigger reactivity

		// If a specific tile ID is provided, assign this session to it
		if (tileId) {
			tileSessionMap.set(tileId, sessionId);
			tileSessionMap = new Map(tileSessionMap);
		}

		// Simulate session becoming active after a brief delay
		setTimeout(() => {
			const session = sessions.get(sessionId);
			if (session) {
				session.isActive = true;
				sessions.set(sessionId, session);
				sessions = new Map(sessions);
			}
		}, 500);

		return sessionId;
	}

	/**
	 * Create a session for a specific tile
	 * @param {'terminal' | 'claude'} type - UI type, converted internally to 'pty' | 'claude'
	 * @param {string} tileId
	 */
	function createSessionForTile(type, tileId) {
		return createSession(type, tileId);
	}

	/**
	 * Close a session
	 * @param {string} sessionId
	 */
	function closeSession(sessionId) {
		sessions.delete(sessionId);
		sessions = new Map(sessions);

		// Remove from tile mapping
		for (const [tileId, mappedSessionId] of tileSessionMap.entries()) {
			if (mappedSessionId === sessionId) {
				tileSessionMap.delete(tileId);
				break;
			}
		}
		tileSessionMap = new Map(tileSessionMap);
	}

	/**
	 * Toggle session pin status
	 * @param {string} sessionId
	 */
	function togglePin(sessionId) {
		const session = sessions.get(sessionId);
		if (session) {
			session.isPinned = !session.isPinned;
			sessions.set(sessionId, session);
			sessions = new Map(sessions);
		}
	}

	// No initial sessions - each tile starts empty and can create its own session

	// Reactive tile count that updates when DOM changes
	let tileCount = $state(1);

	// Update tile count when DOM changes
	$effect(() => {
		// Use a mutation observer to watch for changes in the window manager
		const updateTileCount = () => {
			const tiles = document.querySelectorAll('.wm-tile');
			const newCount = tiles.length;
			if (newCount !== tileCount) {
				console.log(`[TILES] Tile count updated: ${tileCount} → ${newCount}`);
				tileCount = newCount;
			}
		};

		// Initial count with a small delay to ensure DOM is ready
		setTimeout(updateTileCount, 100);

		// Watch for DOM changes
		const observer = new MutationObserver((mutations) => {
			// Only update if we see actual structural changes
			let hasStructuralChange = false;
			mutations.forEach((mutation) => {
				if (
					mutation.type === 'childList' &&
					(mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)
				) {
					hasStructuralChange = true;
				}
			});

			if (hasStructuralChange) {
				// Small delay to let DOM settle
				setTimeout(updateTileCount, 10);
			}
		});

		const container = document.querySelector('.wm-root');
		if (container) {
			observer.observe(container, {
				childList: true,
				subtree: true,
				attributes: false
			});
		}

		// Cleanup
		return () => {
			observer.disconnect();
		};
	});

	/**
	 * Close an empty tile by focusing it and using the window manager's close functionality
	 * @param {string} tileId
	 */
	function closeEmptyTile(tileId) {
		console.log(`[TILES] Close empty tile requested: ${tileId}, current count: ${tileCount}`);

		// Only allow closing if there are multiple tiles
		if (tileCount <= 1) {
			console.log(`[TILES] Cannot close tile - only ${tileCount} tile(s) remaining`);
			return;
		}

		// Find the target tile and focus it
		const tiles = document.querySelectorAll('.wm-tile');
		console.log(`[TILES] Found ${tiles.length} tiles in DOM`);

		for (const tile of tiles) {
			if (
				tile instanceof HTMLElement &&
				(tile.getAttribute('data-tile-id') === tileId || tile.textContent?.includes('No Session'))
			) {
				console.log(`[TILES] Found target tile, focusing and closing...`);

				// Focus the tile by clicking it
				tile.click();

				// Use a shorter delay and more reliable event dispatch
				setTimeout(() => {
					// Double-check tile count before closing
					if (tileCount > 1) {
						const container = document.querySelector('.wm-root');
						if (container instanceof HTMLElement) {
							// Ensure the container is focused for keyboard events
							container.focus();

							// Dispatch the close event
							const event = new KeyboardEvent('keydown', {
								key: 'x',
								code: 'KeyX',
								ctrlKey: true,
								shiftKey: true,
								bubbles: true,
								cancelable: true
							});
							container.dispatchEvent(event);
							console.log(`[TILES] Close event dispatched`);
						}
					} else {
						console.log(`[TILES] Tile count changed to ${tileCount}, skipping close`);
					}
				}, 50);
				break;
			}
		}
	}
</script>

<svelte:head>
	<title>Session Tiles Demo - Window Manager</title>
	<style>
		body {
			margin: 0;
			font-family:
				system-ui,
				-apple-system,
				sans-serif;
			background: #1a1a1a;
			color: #fff;
		}
	</style>
</svelte:head>

<div class="demo-host">
	<div class="demo-header">
		<div class="header-content">
			<h1>🖥️ Session Tiles Demo</h1>
			<p>Interactive terminal and Claude sessions in tiling window manager</p>
		</div>
		<div class="header-controls">
			<Button variant="secondary" onclick={() => createSession('terminal')}>
				<IconTerminal size={16} />
				Add Terminal
			</Button>
			<Button variant="secondary" onclick={() => createSession('claude')}>
				<IconClaude size={16} />
				Add Claude
			</Button>
			<Button variant="ghost" onclick={() => (showInstructions = !showInstructions)}>
				{showInstructions ? 'Hide' : 'Show'} Instructions
			</Button>
		</div>
	</div>

	{#if showInstructions}
		<div class="instructions-panel">
			<div class="instructions-grid">
				<div class="instruction-group">
					<h3>🖥️ Session Management</h3>
					<div class="shortcuts">
						<span><strong>Add Terminal:</strong> Creates new terminal session</span>
						<span><strong>Add Claude:</strong> Creates new Claude AI session</span>
						<span><strong>Pin/Unpin:</strong> Toggle session visibility</span>
						<span><strong>Close:</strong> Remove session from layout</span>
						<span><strong>Close Empty:</strong> Remove empty tiles (X button appears)</span>
					</div>
				</div>
				<div class="instruction-group">
					<h3>🪟 Window Management</h3>
					<div class="shortcuts">
						<kbd>Ctrl+Enter</kbd> Split right
						<kbd>Ctrl+Shift+Enter</kbd> Split down
						<kbd>Ctrl+Shift+X</kbd> Close current tile
						<kbd>Alt+→/←</kbd> Navigate tiles
						<kbd>Ctrl+↑/↓</kbd> Resize focused pane
					</div>
				</div>
				<div class="instruction-group">
					<h3>🎯 Features</h3>
					<div class="shortcuts">
						<span><strong>Real Sessions:</strong> Actual terminal and Claude instances</span>
						<span><strong>Drag Resize:</strong> Drag dividers to adjust width/height</span>
						<span><strong>Focus Management:</strong> Visual focus indicators</span>
						<span><strong>Session Persistence:</strong> Pin important sessions</span>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div class="window-container">
		<WindowManager
			gap={4}
			minSize={300}
			keymap={{
				addRight: 'Control+Enter',
				addDown: 'Control+Shift+Enter',
				close: 'Control+Shift+x',
				focusNext: 'Alt+ArrowRight',
				focusPrev: 'Alt+ArrowLeft',
				growHeight: 'Control+ArrowUp',
				shrinkHeight: 'Control+ArrowDown'
			}}
		>
			{#snippet tile({ focused, tileId })}
				{@const sessionId = tileId ? tileSessionMap.get(tileId) : null}
				{@const session = sessionId ? sessions.get(sessionId) : null}

				{#if session}
					<SessionContainer
						{session}
						isFocused={focused === tileId}
						onClose={() => closeSession(sessionId)}
						onUnpin={() => togglePin(sessionId)}
					>
						{#snippet header({ session, onClose, onUnpin })}
							<div class="session-header">
								<div class="session-title">
									{#if session.type === 'pty'}
										<IconTerminal size={16} />
									{:else}
										<IconClaude size={16} />
									{/if}
									<span>{session.name}</span>
									{#if !session.isActive}
										<span class="loading-indicator">Connecting...</span>
									{/if}
								</div>
								<div class="session-controls">
									<button
										class="control-btn"
										onclick={onUnpin}
										title={session.isPinned ? 'Unpin session' : 'Pin session'}
									>
										{#if session.isPinned}
											<IconPin size={14} />
										{:else}
											<IconPinnedOff size={14} />
										{/if}
									</button>
									<button class="control-btn close-btn" onclick={onClose} title="Close session">
										<IconX size={14} />
									</button>
								</div>
							</div>
						{/snippet}

						{#snippet content({ session, isLoading })}
							<div class="session-content">
								{#if isLoading}
									<div class="loading-state">
										<div class="loading-spinner"></div>
										<p>Initializing {session.type === 'pty' ? 'terminal' : 'Claude'} session...</p>
									</div>
								{:else if session.type === 'pty'}
									<TerminalPane sessionId={session.id} />
								{:else if session.type === 'claude'}
									<ClaudePane sessionId={session.id} />
								{/if}
							</div>
						{/snippet}
					</SessionContainer>
				{:else}
					<div class="empty-tile">
						{#if tileCount > 1}
							<button
								class="close-empty-tile"
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									closeEmptyTile(tileId);
								}}
								title="Close empty tile"
							>
								<IconX size={14} />
							</button>
						{/if}
						<div class="empty-content">
							<h3>No Session</h3>
							<p>Create a new terminal or Claude session to get started.</p>
							<div class="empty-actions">
								<Button onclick={() => createSessionForTile('terminal', tileId)}>
									<IconTerminal size={16} />
									Terminal
								</Button>
								<Button onclick={() => createSessionForTile('claude', tileId)}>
									<IconClaude size={16} />
									Claude
								</Button>
							</div>
						</div>
					</div>
				{/if}
			{/snippet}
		</WindowManager>
	</div>
</div>

<style>
	.demo-host {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #1a1a1a;
		color: #fff;
	}

	.demo-header {
		padding: 1rem;
		border-bottom: 1px solid #333;
		background: linear-gradient(135deg, #111 0%, #1a1a1a 100%);
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.header-content h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.5rem;
		background: linear-gradient(45deg, #0066cc, #00ccff);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	.header-content p {
		margin: 0;
		color: #aaa;
		font-size: 0.9rem;
	}

	.header-controls {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.instructions-panel {
		background: #1a1a1a;
		border-bottom: 1px solid #333;
		padding: 1rem;
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from {
			opacity: 0;
			transform: translateY(-10px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.instructions-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
		max-width: 1200px;
		margin: 0 auto;
	}

	.instruction-group h3 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		color: #0066cc;
	}

	.shortcuts {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.shortcuts kbd {
		background: #333;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-family: 'JetBrains Mono', monospace;
		font-size: 0.8rem;
		border: 1px solid #555;
		display: inline-block;
		min-width: 60px;
		text-align: center;
		margin-right: 0.5rem;
	}

	.shortcuts span {
		font-size: 0.9rem;
		color: #ccc;
	}

	.window-container {
		flex: 1;
		min-height: 0;
	}

	/* Window Manager Styles */
	:global(.wm-root) {
		width: 100%;
		height: 100%;
		background: #222;
	}

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

	:global(.wm-pane) {
		display: flex;
		min-width: 0;
		min-height: 0;
	}

	:global(.wm-divider) {
		background: #555;
		position: relative;
		transition: background-color 0.2s;
	}

	:global(.wm-divider:hover) {
		background: #777;
	}

	:global(.wm-split[data-dir='row'] .wm-divider) {
		width: 4px;
		height: 100%;
		cursor: col-resize;
	}

	:global(.wm-split[data-dir='column'] .wm-divider) {
		width: 100%;
		height: 4px;
		cursor: row-resize;
	}

	:global(.wm-tile) {
		width: 100%;
		height: 100%;
		border: none;
		background: #2a2a2a;
		color: inherit;
		padding: 0;
		margin: 0;
		display: flex;
		cursor: pointer;
		transition: all 0.2s;
	}

	:global(.wm-tile[data-focused='true']) {
		background: #333;
		box-shadow: inset 0 0 0 2px #0066cc;
	}

	/* Session Styles */
	.session-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem;
		background: #333;
		border-bottom: 1px solid #444;
	}

	.session-title {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.loading-indicator {
		font-size: 0.8rem;
		color: #888;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	.session-controls {
		display: flex;
		gap: 0.25rem;
	}

	.control-btn {
		background: transparent;
		border: 1px solid #555;
		color: #ccc;
		padding: 0.25rem;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.control-btn:hover {
		background: #444;
		border-color: #666;
	}

	.control-btn.close-btn:hover {
		background: #cc4444;
		border-color: #cc4444;
		color: white;
	}

	.session-content {
		flex: 1;
		min-height: 0;
		background: #2a2a2a;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 2rem;
		text-align: center;
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid #333;
		border-top: 3px solid #0066cc;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.empty-tile {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #2a2a2a;
		border: 2px dashed #444;
		position: relative;
	}

	.close-empty-tile {
		position: absolute;
		top: 8px;
		right: 8px;
		background: transparent;
		border: 1px solid #555;
		color: #ccc;
		padding: 4px;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10;
	}

	.close-empty-tile:hover {
		background: #cc4444;
		border-color: #cc4444;
		color: white;
	}

	.empty-content {
		text-align: center;
		padding: 2rem;
	}

	.empty-content h3 {
		margin: 0 0 0.5rem 0;
		color: #666;
	}

	.empty-content p {
		margin: 0 0 1rem 0;
		color: #888;
		font-size: 0.9rem;
	}

	.empty-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
	}
</style>
