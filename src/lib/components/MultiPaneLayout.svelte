<script>
	import Terminal from './Terminal.svelte';
	import ResizeHandle from './ResizeHandle.svelte';
	import { TERMINAL_CONFIG } from '../config/constants.js';

	let {
		socket = null,
		sessionId = null,
		linkDetector = null,
		terminalOptions = {},
		onInputEvent = () => {},
		onOutputEvent = () => {}
	} = $props();

	let containerElement = $state();
	let panesWrapper = $state();
	let isResizing = $state(false);
	let resizeStartRatio = $state(50);
	let minPaneSize = $state(TERMINAL_CONFIG.MIN_PANE_SIZE);

	// Simplified state - just track terminal instances
	let terminals = $state([{ id: 'terminal-1', focused: true }]); // Start with one terminal
	let layoutType = $state('single');
	let splitRatio = $state(50); // For 2-pane splits

	$effect(() => {
		console.debug(`MultiPaneLayout mount - desktop mode for session: ${sessionId}`);
		const cleanupKeyboard = setupKeyboardShortcuts();
		const cleanupResize = setupResizeObserver();

		// Cleanup function
		return () => {
			console.debug(`MultiPaneLayout destroy for session: ${sessionId}`);
			cleanupKeyboard();
			cleanupResize();
			// Cleanup handled by individual Terminal components
		};
	});

	function recalculateDimensions() {
		// Let Terminal components handle their own sizing
	}

	function setupKeyboardShortcuts() {
		const handleKeydown = (e) => {
			// Ctrl + Shift + D for vertical split
			if (e.ctrlKey && e.shiftKey && e.key === 'D') {
				e.preventDefault();
				splitVertical();
			}

			// Ctrl + Shift + E for horizontal split
			if (e.ctrlKey && e.shiftKey && e.key === 'E') {
				e.preventDefault();
				splitHorizontal();
			}

			// Ctrl + Shift + W to close current pane
			if (e.ctrlKey && e.shiftKey && e.key === 'W') {
				e.preventDefault();
				closeTerminal();
			}
		};

		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	}

	function setupResizeObserver() {
		// ResizeObserver no longer needed - terminals handle their own resize
		return () => {};
	}

	function splitVertical() {
		if (terminals.length >= TERMINAL_CONFIG.MAX_TERMINALS) return;

		const newTerminal = {
			id: `terminal-${Date.now()}`,
			focused: false
		};

		terminals = [...terminals, newTerminal];
		layoutType = terminals.length === 2 ? 'split' : 'grid';

		console.log('Split vertical - now have', terminals.length, 'terminals');
	}

	function splitHorizontal() {
		if (terminals.length >= TERMINAL_CONFIG.MAX_TERMINALS) return;

		const newTerminal = {
			id: `terminal-${Date.now()}`,
			focused: false
		};

		terminals = [...terminals, newTerminal];
		layoutType = terminals.length === 2 ? 'split' : 'grid';

		console.log('Split horizontal - now have', terminals.length, 'terminals');
	}

	function closeTerminal() {
		if (terminals.length <= 1) return; // Keep at least one terminal

		// Remove the last terminal
		terminals = terminals.slice(0, -1);

		// Update layout type
		if (terminals.length === 1) {
			layoutType = 'single';
		} else if (terminals.length === 2) {
			layoutType = 'split';
		} else {
			layoutType = 'grid';
		}

		console.log('Closed terminal - now have', terminals.length, 'terminals');
	}

	function handleTerminalFocus(terminalId) {
		// Update focus state
		terminals = terminals.map((t) => ({
			...t,
			focused: t.id === terminalId
		}));

		console.log('Focused terminal:', terminalId);
	}

	// No complex terminal initialization needed - Terminal.svelte handles everything

	// No complex session management needed - Terminal.svelte handles its own sessions

	// Simplified resize handling
	function handleResizeStart() {
		if (layoutType !== 'split') return;
		isResizing = true;
		resizeStartRatio = splitRatio;
	}

	function handleResize(event) {
		if (!isResizing) return;
		const { delta } = event.detail;
		const rect = panesWrapper?.getBoundingClientRect();
		if (!rect) return;

		const percentChange = (delta / rect.width) * 100;
		splitRatio = Math.max(20, Math.min(80, resizeStartRatio + percentChange));
	}

	function handleResizeEnd() {
		isResizing = false;
	}

	// Apply simple layout presets
	function applyPreset(presetName) {
		switch (presetName) {
			case 'single':
				terminals = [{ id: 'terminal-1', focused: true }];
				layoutType = 'single';
				break;
			case 'vertical':
				terminals = [
					{ id: 'terminal-1', focused: true },
					{ id: 'terminal-2', focused: false }
				];
				layoutType = 'split';
				break;
			case 'horizontal':
				terminals = [
					{ id: 'terminal-1', focused: true },
					{ id: 'terminal-2', focused: false }
				];
				layoutType = 'split';
				break;
			case 'quad':
				terminals = [
					{ id: 'terminal-1', focused: true },
					{ id: 'terminal-2', focused: false },
					{ id: 'terminal-3', focused: false },
					{ id: 'terminal-4', focused: false }
				];
				layoutType = 'grid';
				break;
		}

		console.log('Applied preset:', presetName, '- now have', terminals.length, 'terminals');
	}
</script>

<!-- Simplified multi-pane layout with independent terminals -->
<div class="multi-pane-container" bind:this={containerElement}>
	<!-- Layout controls -->
	<div class="pane-controls">
		<button onclick={() => applyPreset('single')} title="Single pane">
			<svg width="16" height="16" viewBox="0 0 16 16">
				<rect x="1" y="1" width="14" height="14" stroke="currentColor" fill="none" />
			</svg>
		</button>
		<button onclick={() => applyPreset('vertical')} title="Split vertical">
			<svg width="16" height="16" viewBox="0 0 16 16">
				<rect x="1" y="1" width="6" height="14" stroke="currentColor" fill="none" />
				<rect x="9" y="1" width="6" height="14" stroke="currentColor" fill="none" />
			</svg>
		</button>
		<button onclick={() => applyPreset('horizontal')} title="Split horizontal">
			<svg width="16" height="16" viewBox="0 0 16 16">
				<rect x="1" y="1" width="14" height="6" stroke="currentColor" fill="none" />
				<rect x="1" y="9" width="14" height="6" stroke="currentColor" fill="none" />
			</svg>
		</button>
		<button onclick={() => applyPreset('quad')} title="Quad grid">
			<svg width="16" height="16" viewBox="0 0 16 16">
				<rect x="1" y="1" width="6" height="6" stroke="currentColor" fill="none" />
				<rect x="9" y="1" width="6" height="6" stroke="currentColor" fill="none" />
				<rect x="1" y="9" width="6" height="6" stroke="currentColor" fill="none" />
				<rect x="9" y="9" width="6" height="6" stroke="currentColor" fill="none" />
			</svg>
		</button>

		<span class="separator">|</span>

		<button onclick={splitVertical} title="Split vertical (Ctrl+Shift+D)"> Split V </button>
		<button onclick={splitHorizontal} title="Split horizontal (Ctrl+Shift+E)"> Split H </button>
		<button onclick={closeTerminal} title="Close pane (Ctrl+Shift+W)"> Close </button>
	</div>

	<!-- Terminals container -->
	<div
		class="terminals-wrapper"
		class:layout-single={layoutType === 'single'}
		class:layout-split={layoutType === 'split'}
		class:layout-grid={layoutType === 'grid'}
		bind:this={panesWrapper}
	>
		{#each terminals as terminal (terminal.id)}
			<div
				class="terminal-pane"
				class:focused={terminal.focused}
				onclick={() => handleTerminalFocus(terminal.id)}
			>
				<div class="pane-header">
					<span class="pane-title">Terminal {terminals.indexOf(terminal) + 1}</span>
					{#if terminal.focused}
						<span class="focus-indicator">●</span>
					{/if}
				</div>

				<div class="pane-terminal">
					<!-- Each Terminal is completely independent -->
					<Terminal
						{socket}
						{sessionId}
						{terminalOptions}
						onInputEvent={(data) => onInputEvent(data)}
						onOutputEvent={(data) => onOutputEvent(data)}
					/>
				</div>
			</div>
		{/each}

		<!-- Simple resize handle for 2-pane splits -->
		{#if layoutType === 'split' && terminals.length === 2}
			<div class="resize-handle" style="left: {splitRatio}%"></div>
		{/if}
	</div>
</div>

<style>
	.multi-pane-container {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: var(--bg-darker, #0a0a0a);
	}

	.pane-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		background: var(--bg-dark, #1a1a1a);
		border-bottom: 1px solid var(--border, #333);
	}

	.pane-controls button {
		padding: 4px 8px;
		background: var(--surface, #2a2a2a);
		border: 1px solid var(--border, #333);
		color: var(--text-secondary, #ccc);
		cursor: pointer;
		border-radius: 4px;
		font-size: 12px;
		transition: all 0.2s;
	}

	.pane-controls button:hover {
		background: var(--primary-muted, #00ff8850);
		border-color: var(--primary, #00ff88);
		color: var(--primary, #00ff88);
	}

	.pane-controls svg {
		display: block;
	}

	.separator {
		color: var(--border, #333);
		margin: 0 4px;
	}

	.terminals-wrapper {
		flex: 1;
		display: flex;
		gap: 2px;
		padding: 2px;
		overflow: hidden;
	}

	/* Layout modes */
	.layout-single {
		flex-direction: column;
	}

	.layout-split {
		flex-direction: row;
	}

	.layout-grid {
		flex-wrap: wrap;
	}

	.layout-grid .terminal-pane {
		flex: 1 1 48%;
	}

	.terminal-pane {
		flex: 1;
		border: 1px solid var(--border, #333);
		background: var(--bg-darker, #0a0a0a);
		display: flex;
		flex-direction: column;
		transition: border-color 0.2s;
		min-width: 200px;
		min-height: 200px;
	}

	.terminal-pane.focused {
		border-color: var(--primary, #00ff88);
		z-index: 10;
	}

	.pane-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 8px;
		background: var(--surface, #1a1a1a);
		border-bottom: 1px solid var(--border, #333);
		font-size: 12px;
		color: var(--text-secondary, #ccc);
		flex-shrink: 0;
	}

	.pane-title {
		font-family: var(--font-mono, monospace);
	}

	.focus-indicator {
		color: var(--primary, #00ff88);
		font-size: 10px;
	}

	.pane-terminal {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	/* Simple resize handle */
	.resize-handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: var(--border, #333);
		cursor: col-resize;
		z-index: 20;
	}

	.resize-handle:hover {
		background: var(--primary, #00ff88);
	}

	/* Terminal component takes full space */
	.pane-terminal :global(.terminal-container) {
		height: 100%;
	}
</style>
