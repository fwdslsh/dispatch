<svelte:options runes={true} />

<script>
	import WindowManager from '$lib/client/shared/components/window-manager/WindowManager.svelte';

	/** @type {Record<string, string>} */
	let titles = $state({});

	/** @type {Record<string, string>} */
	let content = $state({});

	/** @type {boolean} */
	let showInstructions = $state(true);

	/**
	 * @param {string} id
	 * @param {string} value
	 */
	function setTitle(id, value) {
		titles[id] = value;
	}

	/**
	 * @param {string} id
	 * @param {string} value
	 */
	function setContent(id, value) {
		content[id] = value;
	}

	// Sample content for different tiles
	const sampleContent = {
		welcome: `🚀 Welcome to the Tiling Window Manager!

This is a fully functional tiling window manager built with Svelte 5 and modern runes.

✨ Features:
• Dynamic layout management
• Keyboard-driven navigation
• Mouse drag resizing
• Flexible configuration
• Full TypeScript support
• Comprehensive test suite

Try creating splits and see how the layout adapts!`,

		javascript: `// Sample JavaScript code
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// Generate first 10 numbers
const numbers = Array.from({length: 10}, (_, i) => fibonacci(i));
console.log('Fibonacci:', numbers);

// Modern async/await example
async function fetchData(url) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}`,

		svelte: ``,

		notes: `📝 My Notes

TODO:
• Test window manager features
• Try different layouts
• Experiment with resizing
• Check keyboard shortcuts

Ideas:
• Could be used for code editor layouts
• Great for documentation browsing
• Perfect for terminal multiplexing
• Useful for dashboard views

The drag-to-resize feature works really well!
`
	};

	// Initialize some default content with variety
	$effect(() => {
		if (Object.keys(content).length === 0) {
			content['root'] = sampleContent.welcome;
		}
	});

	// Add some variety when new tiles are created
	let tileCounter = 0;
	function getNextSampleContent() {
		const samples = Object.values(sampleContent);
		tileCounter = (tileCounter + 1) % samples.length;
		return samples[tileCounter];
	}
</script>

<svelte:head>
	<title>Window Manager Demo</title>
	<style>
		/* Global styles for the demo */
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

<!-- Demo container -->
<div class="demo-host">
	<div class="demo-header">
		<div class="header-content">
			<h1>🪟 Tiling Window Manager Demo</h1>
			<p>Interactive tiling window manager built with Svelte 5 runes</p>
		</div>
		<div class="header-controls">
			<button class="toggle-btn" onclick={() => (showInstructions = !showInstructions)}>
				{showInstructions ? 'Hide' : 'Show'} Instructions
			</button>
		</div>
	</div>

	{#if showInstructions}
		<div class="instructions-panel">
			<div class="instructions-grid">
				<div class="instruction-group">
					<h3>🔨 Layout Control</h3>
					<div class="shortcuts">
						<kbd>Ctrl+Enter</kbd> Split right
						<kbd>Ctrl+Shift+Enter</kbd> Split down
						<kbd>Ctrl+W</kbd> Close current tile
					</div>
				</div>
				<div class="instruction-group">
					<h3>🧭 Navigation</h3>
					<div class="shortcuts">
						<kbd>Alt+→</kbd> Focus next tile
						<kbd>Alt+←</kbd> Focus previous tile
						<kbd>Click</kbd> Focus tile
					</div>
				</div>
				<div class="instruction-group">
					<h3>📏 Resizing</h3>
					<div class="shortcuts">
						<kbd>Ctrl+↑</kbd> Grow focused tile
						<kbd>Ctrl+↓</kbd> Shrink focused tile
						<kbd>Drag</kbd> Resize dividers
					</div>
				</div>
			</div>
		</div>
	{/if}

	<div class="window-container">
		<WindowManager
			gap={4}
			minSize={200}
			keymap={{
				addRight: 'Control+Enter',
				addDown: 'Control+Shift+Enter',
				close: 'Control+w',
				focusNext: 'Alt+ArrowRight',
				focusPrev: 'Alt+ArrowLeft',
				grow: 'Control+ArrowUp',
				shrink: 'Control+ArrowDown'
			}}
		>
			{#snippet tile({ focused, tileId })}
				<div class="tile-content" class:focused={focused === tileId}>
					<div class="tile-header">
						<input
							class="tile-title"
							aria-label="Tile title"
							value={titles[tileId] ?? ''}
							oninput={(e) => setTitle(tileId, e.currentTarget.value)}
							placeholder={`Tile ${tileId}`}
						/>
						<div class="tile-status">
							{focused === tileId ? '🎯 Focused' : ''}
						</div>
						{#if !content[tileId] && tileId !== 'root'}
							<button class="sample-btn" onclick={() => setContent(tileId, getNextSampleContent())}>
								📄 Add Sample
							</button>
						{/if}
					</div>
					<textarea
						class="tile-textarea"
						value={content[tileId] ?? ''}
						oninput={(e) => setContent(tileId, e.currentTarget.value)}
						placeholder="Type something here..."
					></textarea>
				</div>
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

	.toggle-btn {
		background: #333;
		border: 1px solid #555;
		color: #fff;
		padding: 0.5rem 1rem;
		border-radius: 0.5rem;
		cursor: pointer;
		font-size: 0.9rem;
		transition: all 0.2s;
	}

	.toggle-btn:hover {
		background: #444;
		border-color: #0066cc;
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
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
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
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
		font-size: 0.8rem;
		border: 1px solid #555;
		display: inline-block;
		min-width: 60px;
		text-align: center;
		margin-right: 0.5rem;
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
		cursor: col-resize;
	}

	:global(.wm-split[data-dir='column'] .wm-divider) {
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

	.tile-content {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		background: #2a2a2a;
		border: 1px solid #444;
		transition: all 0.2s;
	}

	.tile-content.focused {
		border-color: #0066cc;
		background: #333;
	}

	.tile-header {
		display: flex;
		align-items: center;
		padding: 0.5rem;
		background: #333;
		border-bottom: 1px solid #444;
		gap: 0.5rem;
	}

	.tile-title {
		flex: 1;
		background: #444;
		border: 1px solid #555;
		color: #fff;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.9rem;
	}

	.tile-title:focus {
		outline: none;
		border-color: #0066cc;
		background: #555;
	}

	.tile-status {
		font-size: 0.8rem;
		color: #0066cc;
		font-weight: 500;
	}

	.sample-btn {
		background: #0066cc;
		border: none;
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.sample-btn:hover {
		background: #0088ff;
		transform: translateY(-1px);
	}

	.tile-textarea {
		flex: 1;
		background: #2a2a2a;
		border: none;
		color: #fff;
		padding: 1rem;
		font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
		font-size: 0.9rem;
		line-height: 1.4;
		resize: none;
		outline: none;
	}

	.tile-textarea::placeholder {
		color: #666;
	}

	.tile-textarea:focus {
		background: #333;
	}
</style>
