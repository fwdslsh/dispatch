<!--
	MobileTerminalInput.svelte

	Simple, fast mobile terminal interface optimized for touch devices.
	Large buttons, minimal animations, maximum performance.
-->
<script>
	import Button from '$lib/client/shared/components/Button.svelte';

	// Props
	let {
		visible = true,
		disabled = false,
		placeholder = 'Type commands here...',
		onSubmit = () => {},
		onTab = () => {},
		onSpecialKey = () => {},
		toggleWrapMode = () => {},
		wrapMode = 'wrap'
	} = $props();

	// State
	let currentInput = $state('');
	let showToolbar = $state(false);
	let commandHistory = $state([]);
	let historyIndex = $state(-1);
	let expandedSection = $state(null);

	// Handle form submission
	function handleSubmit(e = null) {
		if (e) e.preventDefault();
		if (disabled || !currentInput.trim()) return;

		const command = currentInput.trim();

		// Add to history
		if (commandHistory[commandHistory.length - 1] !== command) {
			commandHistory = [...commandHistory, command].slice(-50);
		}

		// Submit command
		onSubmit({ command: command + '\r' });

		// Clear input and reset history
		currentInput = '';
		historyIndex = -1;
	}

	// Handle special keys in textarea
	function handleKeyDown(e) {
		switch(e.key) {
			case 'Enter':
				if (!e.shiftKey) {
					e.preventDefault();
					handleSubmit();
				}
				break;

			case 'Tab':
				e.preventDefault();
				onTab({ currentInput, tabKey: '\t' });
				break;

			case 'ArrowUp':
				if (e.ctrlKey || e.metaKey) {
					e.preventDefault();
					navigateHistory(-1);
				}
				break;

			case 'ArrowDown':
				if (e.ctrlKey || e.metaKey) {
					e.preventDefault();
					navigateHistory(1);
				}
				break;
		}
	}

	// Navigate command history
	function navigateHistory(direction) {
		if (commandHistory.length === 0) return;

		if (direction < 0) {
			// Go back in history
			if (historyIndex === -1) {
				historyIndex = commandHistory.length - 1;
			} else if (historyIndex > 0) {
				historyIndex--;
			}
		} else {
			// Go forward in history
			if (historyIndex < commandHistory.length - 1) {
				historyIndex++;
			} else {
				historyIndex = -1;
				currentInput = '';
				return;
			}
		}

		if (historyIndex >= 0 && historyIndex < commandHistory.length) {
			currentInput = commandHistory[historyIndex];
		}
	}

	// Send special key to terminal
	function sendSpecialKey(key) {
		if (disabled) return;
		onSpecialKey({ key });
	}
</script>

<div class="mobile-input-wrapper {visible ? 'visible' : 'hidden'}">
	{#if showToolbar}
		<div class="simple-keyboard">
			<!-- Row 1: Arrow Keys in compact 2x2 grid -->
			<div class="keyboard-row arrows">
				<button class="key-btn arrow" onclick={() => sendSpecialKey('\x1B[A')} {disabled} title="Up">↑</button>
				<button class="key-btn arrow" onclick={() => sendSpecialKey('\x1B[B')} {disabled} title="Down">↓</button>
				<button class="key-btn arrow" onclick={() => sendSpecialKey('\x1B[D')} {disabled} title="Left">←</button>
				<button class="key-btn arrow" onclick={() => sendSpecialKey('\x1B[C')} {disabled} title="Right">→</button>
			</div>

			<!-- Row 2: Essential Controls -->
			<div class="keyboard-row controls">
				<button class="key-btn action primary" onclick={() => sendSpecialKey('\t')} {disabled}>TAB</button>
				<button class="key-btn action" onclick={() => sendSpecialKey(' ')} {disabled}>SPACE</button>
				<button class="key-btn danger" onclick={() => sendSpecialKey('\x03')} {disabled}>^C</button>
				<button class="key-btn action" onclick={() => sendSpecialKey('\x1b')} {disabled}>ESC</button>
			</div>

			<!-- Row 3: Terminal Symbols (not available on mobile keyboards) -->
			<div class="keyboard-row symbols">
				<button class="key-btn symbol" onclick={() => sendSpecialKey('|')} {disabled}>|</button>
				<button class="key-btn symbol" onclick={() => sendSpecialKey('&')} {disabled}>&</button>
				<button class="key-btn symbol" onclick={() => sendSpecialKey('>')} {disabled}>&gt;</button>
				<button class="key-btn symbol" onclick={() => sendSpecialKey('<')} {disabled}>&lt;</button>
				<button class="key-btn symbol" onclick={() => sendSpecialKey('$')} {disabled}>$</button>
				<button class="key-btn symbol" onclick={() => sendSpecialKey('~')} {disabled}>~</button>
			</div>

			<!-- Expandable Terminal Controls -->
			{#if expandedSection}
				<div class="more-keys">
					<button class="key-btn" onclick={() => sendSpecialKey('\x04')} {disabled} title="EOF">^D</button>
					<button class="key-btn" onclick={() => sendSpecialKey('\x1a')} {disabled} title="Suspend">^Z</button>
					<button class="key-btn" onclick={() => sendSpecialKey('\x0c')} {disabled} title="Clear Screen">^L</button>
					<button class="key-btn" onclick={() => sendSpecialKey('\x1B[H')} {disabled}>HOME</button>
					<button class="key-btn" onclick={() => sendSpecialKey('\x1B[F')} {disabled}>END</button>
					<button class="key-btn" onclick={() => sendSpecialKey('\x1B[5~')} {disabled}>PAGE↑</button>
				</div>
			{/if}

			<!-- Footer -->
			<div class="keyboard-footer">
				<Button
					variant="secondary"
					text={wrapMode === 'wrap' ? 'No Wrap' : 'Wrap'}
					onclick={() => toggleWrapMode()}
					{disabled}
					ariaLabel="Toggle text wrap mode"
				/>
				<Button
					variant="outline"
					text={expandedSection ? 'Less Keys' : 'More Keys'}
					onclick={() => expandedSection = expandedSection ? null : 'more'}
					{disabled}
					ariaLabel={expandedSection ? 'Hide additional keys' : 'Show additional keys'}
				/>
			</div>
		</div>
	{/if}

	<form onsubmit={handleSubmit} class="input-form">
		<div class="input-container">
			<div class="message-input-wrapper" data-augmented-ui="tl-clip br-clip both">
				<textarea
					bind:value={currentInput}
					{placeholder}
					{disabled}
					class="message-input"
					onkeydown={handleKeyDown}
					aria-label="Terminal command input"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					rows={showToolbar ? 1 : 2}
				></textarea>
			</div>
			<div class="input-actions">
				<button
					type="button"
					class="toolbar-toggle-btn"
					onclick={() => showToolbar = !showToolbar}
					title={showToolbar ? 'Hide toolbar' : 'Show toolbar'}
					aria-label={showToolbar ? 'Hide toolbar' : 'Show toolbar'}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						{#if showToolbar}
							<path d="M6 15l6-6 6 6"/>
						{:else}
							<rect x="3" y="3" width="18" height="18" rx="2"/>
							<path d="M7 8h10M7 12h10M7 16h10"/>
						{/if}
					</svg>
				</button>
				<Button
					type="submit"
					text="Send"
					variant="primary"
					{disabled}
					ariaLabel="Send command"
					augmented="tr-clip bl-clip both"
				/>
			</div>
		</div>
		{#if commandHistory.length > 0}
			<div class="input-hint">
				Ctrl+↑↓ for history • Tab for completion • Enter to send
			</div>
		{/if}
	</form>
</div>

<style>
	.mobile-input-wrapper {
		display: flex;
		flex-direction: column;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 88%, var(--primary) 12%),
			color-mix(in oklab, var(--surface) 92%, var(--primary) 8%)
		);
		border-top: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		backdrop-filter: blur(16px) saturate(120%);
		position: relative;
		z-index: 10;
		box-shadow:
			0 -8px 32px -16px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
	}

	.mobile-input-wrapper.hidden {
		display: none;
	}

	/* SIMPLE MOBILE KEYBOARD */
	.simple-keyboard {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%),
			color-mix(in oklab, var(--surface) 98%, var(--primary) 2%)
		);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		padding: var(--space-3);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		backdrop-filter: blur(8px) saturate(110%);
	}

	.keyboard-row {
		display: flex;
		gap: var(--space-2);
		align-items: stretch;
	}

	/* Arrow key group - compact 2x2 grid */
	.keyboard-row.arrows {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: repeat(2, 1fr);
		max-width: 200px;
		margin: 0 auto;
	}

	.keyboard-row.arrows .key-btn:nth-child(1) { grid-column: 2; grid-row: 1; } /* Up */
	.keyboard-row.arrows .key-btn:nth-child(2) { grid-column: 2; grid-row: 2; } /* Down */
	.keyboard-row.arrows .key-btn:nth-child(3) { grid-column: 1; grid-row: 2; } /* Left */
	.keyboard-row.arrows .key-btn:nth-child(4) { grid-column: 3; grid-row: 2; } /* Right */

	/* Essential controls row */
	.keyboard-row.controls {
		display: flex;
		gap: var(--space-2);
	}

	.keyboard-row.controls .key-btn {
		flex: 1;
	}

	/* Symbols row - grid layout */
	.keyboard-row.symbols {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--space-2);
	}

	.key-btn {
		min-height: 44px;
		min-width: 44px;
		padding: var(--space-2) var(--space-3);
		background: color-mix(in oklab, var(--surface) 85%, var(--primary) 15%);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 8px;
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.06s ease;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow:
			0 2px 4px -1px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 5%, transparent);
		position: relative;
		overflow: hidden;
	}

	.key-btn:hover:not(:disabled) {
		background: color-mix(in oklab, var(--surface) 75%, var(--primary) 25%);
		border-color: color-mix(in oklab, var(--primary) 40%, transparent);
		transform: translateY(-1px);
		box-shadow:
			0 4px 8px -2px rgba(0, 0, 0, 0.15),
			0 0 20px var(--primary-glow);
	}

	.key-btn:active:not(:disabled) {
		transform: translateY(0) scale(0.98);
		box-shadow:
			0 1px 2px -1px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 8%, transparent);
	}

	/* Arrow keys - primary style */
	.key-btn.arrow {
		background: linear-gradient(135deg, var(--primary), var(--primary-bright));
		color: var(--bg);
		border-color: var(--primary);
		font-size: var(--font-size-3);
		min-height: 48px;
		min-width: 56px;
	}

	.key-btn.arrow:hover:not(:disabled) {
		background: linear-gradient(135deg, var(--primary-bright), var(--accent-cyan));
		border-color: var(--primary-bright);
	}

	/* Action keys - secondary style */
	.key-btn.action {
		background: color-mix(in oklab, var(--surface) 70%, var(--accent-cyan) 30%);
		border-color: color-mix(in oklab, var(--accent-cyan) 40%, transparent);
		color: var(--text);
	}

	.key-btn.action.primary {
		background: linear-gradient(135deg, var(--accent-cyan), var(--primary));
		color: var(--bg);
		border-color: var(--accent-cyan);
	}

	/* Danger key - Ctrl+C */
	.key-btn.danger {
		background: color-mix(in oklab, var(--surface) 80%, var(--err) 20%);
		color: var(--err);
		border-color: color-mix(in oklab, var(--err) 30%, transparent);
	}

	.key-btn.danger:hover:not(:disabled) {
		background: color-mix(in oklab, var(--surface) 70%, var(--err) 30%);
		border-color: color-mix(in oklab, var(--err) 50%, transparent);
		color: color-mix(in oklab, var(--err) 90%, white 10%);
	}

	/* Symbol keys - compact */
	.key-btn.symbol {
		background: color-mix(in oklab, var(--surface) 90%, var(--accent-magenta) 10%);
		border-color: color-mix(in oklab, var(--accent-magenta) 20%, transparent);
		color: var(--text);
		font-size: var(--font-size-2);
		min-width: 48px;
		flex-shrink: 0;
	}

	/* More keys section */
	.more-keys {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--space-2);
		padding: var(--space-2);
		background: color-mix(in oklab, var(--surface) 95%, transparent);
		border-radius: 8px;
		border: 1px solid color-mix(in oklab, var(--primary) 15%, transparent);
		margin-top: var(--space-1);
	}

	.more-keys .key-btn {
		min-width: 0;
	}

	/* Keyboard footer */
	.keyboard-footer {
		display: flex;
		gap: var(--space-2);
		justify-content: space-between;
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid color-mix(in oklab, var(--primary) 10%, transparent);
	}

	.keyboard-footer :global(.button) {
		flex: 1;
		min-width: 0;
		height: 40px;
		font-size: var(--font-size-0);
		padding: var(--space-2) var(--space-3);
	}

	.key-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
		transform: none !important;
		box-shadow: none !important;
	}

	/* MOBILE OPTIMIZATION */
	@media (max-width: 480px) {
		.simple-keyboard {
			padding: var(--space-2);
		}

		.key-btn {
			min-height: 48px;
			font-size: var(--font-size-1);
			padding: var(--space-2);
		}

		.key-btn.arrow {
			min-height: 52px;
			min-width: 60px;
			font-size: var(--font-size-3);
		}

		.keyboard-row.arrows {
			max-width: 180px;
		}

		.more-keys {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	/* INPUT INTERFACE */
	.input-form {
		padding: var(--space-3);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 88%, var(--primary) 12%),
			color-mix(in oklab, var(--surface) 92%, var(--primary) 8%)
		);
		border-top: 1px solid color-mix(in oklab, var(--primary) 15%, transparent);
		backdrop-filter: blur(16px) saturate(120%);
		position: relative;
		z-index: 10;
		box-shadow:
			0 -8px 32px -16px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
		flex-shrink: 0;
		margin-top: auto;
		transition: padding 0.15s ease;
	}

	/* Compact form when toolbar is open */
	.simple-keyboard ~ .input-form {
		padding: var(--space-2) var(--space-3);
	}

	.input-container {
		display: flex;
		gap: var(--space-2);
		align-items: stretch;
		position: relative;
	}

	.input-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	.message-input-wrapper {
		flex: 1;
		position: relative;
		--aug-border: 1px;
		--aug-border-bg: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		--aug-border-fallback-color: var(--primary);
		--aug-tl: 8px;
		--aug-br: 8px;
		background: color-mix(in oklab, var(--surface) 94%, var(--primary) 6%);
		backdrop-filter: blur(8px) saturate(110%);
		box-shadow:
			inset 0 1px 4px rgba(0, 0, 0, 0.05),
			0 2px 8px -4px rgba(0, 0, 0, 0.1),
			0 0 0 1px color-mix(in oklab, var(--primary) 10%, transparent);
		transition: all 0.15s ease;
	}

	.message-input-wrapper:focus-within {
		--aug-border: 2px;
		--aug-border-bg: linear-gradient(135deg, var(--accent-cyan), var(--primary));
		background: color-mix(in oklab, var(--surface) 90%, var(--primary) 10%);
		box-shadow:
			inset 0 1px 4px rgba(0, 0, 0, 0.03),
			0 0 0 2px color-mix(in oklab, var(--primary) 20%, transparent),
			0 0 20px var(--primary-glow);
	}

	.message-input {
		width: 100%;
		height: 100%;
		padding: var(--space-3) var(--space-4);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		font-weight: 500;
		background: transparent;
		border: none;
		color: var(--text);
		position: relative;
		overflow: hidden;
		min-height: 44px;
		max-height: 120px;
		resize: none;
		line-height: 1.4;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklab, var(--primary) 30%, transparent) transparent;
		outline: none;
		transition: min-height 0.15s ease, padding 0.15s ease;
	}

	/* Compact when toolbar is open */
	.simple-keyboard ~ .input-form .message-input {
		min-height: 36px;
		padding: var(--space-2) var(--space-3);
		line-height: 1.2;
	}

	.message-input::-webkit-scrollbar {
		width: 6px;
	}

	.message-input::-webkit-scrollbar-thumb {
		background: color-mix(in oklab, var(--primary) 40%, transparent);
		border-radius: 3px;
	}

	.message-input:focus {
		outline: none !important;
		border: none !important;
		box-shadow: none !important;
	}

	.message-input::placeholder {
		color: color-mix(in oklab, var(--muted) 80%, var(--primary) 20%);
		font-style: italic;
		opacity: 0.7;
	}

	.message-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.toolbar-toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		padding: 0;
		background: color-mix(in oklab, var(--surface) 85%, var(--primary) 15%);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 8px;
		color: var(--primary);
		cursor: pointer;
		transition: all 0.06s ease;
		backdrop-filter: blur(4px);
		box-shadow:
			0 2px 4px -1px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 5%, transparent);
		flex-shrink: 0;
	}

	.toolbar-toggle-btn:hover {
		background: color-mix(in oklab, var(--surface) 75%, var(--primary) 25%);
		border-color: color-mix(in oklab, var(--primary) 40%, transparent);
		transform: translateY(-1px);
		box-shadow:
			0 4px 8px -2px rgba(0, 0, 0, 0.15),
			0 0 20px var(--primary-glow);
	}

	.toolbar-toggle-btn:active {
		transform: translateY(0) scale(0.98);
		box-shadow:
			0 1px 2px -1px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 8%, transparent);
	}

	.input-actions :global(.button) {
		min-width: 80px;
		height: 44px;
		justify-content: center;
		font-weight: 600;
		font-size: var(--font-size-1);
		padding: var(--space-2) var(--space-3);
	}

	.input-actions :global(.button[type='submit']) {
		min-width: 80px;
	}

	.input-hint {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--muted);
		opacity: 0.7;
		text-align: center;
		margin-top: var(--space-1);
	}

	/* Hide on desktop */
	@media (min-width: 769px) {
		.mobile-input-wrapper {
			display: none;
		}
	}
</style>