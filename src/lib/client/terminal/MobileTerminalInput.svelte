<!--
	MobileTerminalInput.svelte

	Mobile terminal input area that matches Claude pane design with integrated toolbar.
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
	let inputElement = $state(null);
	let showToolbar = $state(false);
	let expandedToolbar = $state(false);
	let commandHistory = $state([]);
	let historyIndex = $state(-1);

	// Handle form submission
	function handleSubmit(e) {
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
		<div class="mobile-keyboard-toolbar">
			<!-- Essential keys row -->
			<div class="toolbar-row primary">
				<!-- Wrap mode toggle -->
				<div class="wrap-toggle-wrapper">
					<Button
						variant={wrapMode === 'wrap' ? 'primary' : 'ghost'}
						size="small"
						text={wrapMode === 'wrap' ? 'Wrap' : 'Scroll'}
						onclick={toggleWrapMode}
						{disabled}
						ariaLabel="Toggle text wrap mode"
						title={wrapMode === 'wrap' ? 'Switch to horizontal scroll' : 'Switch to text wrap'}
					/>
				</div>

				<!-- Arrow keys group -->
				<div class="key-group">
					<Button variant="ghost" size="small" text="↑" onclick={() => sendSpecialKey('\x1B[A')} {disabled} ariaLabel="Up arrow" />
					<Button variant="ghost" size="small" text="↓" onclick={() => sendSpecialKey('\x1B[B')} {disabled} ariaLabel="Down arrow" />
					<Button variant="ghost" size="small" text="←" onclick={() => sendSpecialKey('\x1B[D')} {disabled} ariaLabel="Left arrow" />
					<Button variant="ghost" size="small" text="→" onclick={() => sendSpecialKey('\x1B[C')} {disabled} ariaLabel="Right arrow" />
				</div>

				<!-- Essential keys -->
				<Button variant="ghost" size="small" text="TAB" onclick={() => sendSpecialKey('\t')} {disabled} ariaLabel="Tab key" />
				<Button variant="ghost" size="small" text="ESC" onclick={() => sendSpecialKey('\x1b')} {disabled} ariaLabel="Escape key" />
				<Button variant="ghost" size="small" text="⏎" onclick={() => sendSpecialKey('\r')} {disabled} ariaLabel="Enter key" />
				<Button variant="ghost" size="small" text="⌫" onclick={() => sendSpecialKey('\x7f')} {disabled} ariaLabel="Backspace key" />
				<Button variant="ghost" size="small" text="⎵" onclick={() => sendSpecialKey(' ')} {disabled} ariaLabel="Space key" />
				<Button variant="ghost" size="small" text="^C" onclick={() => sendSpecialKey('\x03')} {disabled} ariaLabel="Control-C" />
				<Button variant="ghost" size="small" text="^D" onclick={() => sendSpecialKey('\x04')} {disabled} ariaLabel="Control-D" />

				<!-- Expand button -->
				<Button
					variant="ghost"
					size="small"
					text={expandedToolbar ? '×' : '⋯'}
					onclick={() => expandedToolbar = !expandedToolbar}
					{disabled}
					ariaLabel={expandedToolbar ? 'Hide more keys' : 'Show more keys'}
				/>
			</div>

			{#if expandedToolbar}
				<!-- Control keys row -->
				<div class="toolbar-row secondary">
					<span class="row-label">Control:</span>
					<Button variant="ghost" size="small" text="^Z" onclick={() => sendSpecialKey('\x1a')} {disabled} ariaLabel="Control-Z" />
					<Button variant="ghost" size="small" text="^L" onclick={() => sendSpecialKey('\x0c')} {disabled} ariaLabel="Control-L (Clear)" />
					<Button variant="ghost" size="small" text="^A" onclick={() => sendSpecialKey('\x01')} {disabled} ariaLabel="Control-A" />
					<Button variant="ghost" size="small" text="^E" onclick={() => sendSpecialKey('\x05')} {disabled} ariaLabel="Control-E" />
					<Button variant="ghost" size="small" text="^K" onclick={() => sendSpecialKey('\x0b')} {disabled} ariaLabel="Control-K" />
					<Button variant="ghost" size="small" text="^U" onclick={() => sendSpecialKey('\x15')} {disabled} ariaLabel="Control-U" />
					<Button variant="ghost" size="small" text="^W" onclick={() => sendSpecialKey('\x17')} {disabled} ariaLabel="Control-W" />
					<Button variant="ghost" size="small" text="^R" onclick={() => sendSpecialKey('\x12')} {disabled} ariaLabel="Control-R" />
				</div>

				<!-- Navigation keys row -->
				<div class="toolbar-row tertiary">
					<span class="row-label">Nav:</span>
					<Button variant="ghost" size="small" text="HOME" onclick={() => sendSpecialKey('\x1B[H')} {disabled} ariaLabel="Home key" />
					<Button variant="ghost" size="small" text="END" onclick={() => sendSpecialKey('\x1B[F')} {disabled} ariaLabel="End key" />
					<Button variant="ghost" size="small" text="PgUp" onclick={() => sendSpecialKey('\x1B[5~')} {disabled} ariaLabel="Page Up" />
					<Button variant="ghost" size="small" text="PgDn" onclick={() => sendSpecialKey('\x1B[6~')} {disabled} ariaLabel="Page Down" />
					<Button variant="ghost" size="small" text="DEL" onclick={() => sendSpecialKey('\x1B[3~')} {disabled} ariaLabel="Delete key" />
					<Button variant="ghost" size="small" text="INS" onclick={() => sendSpecialKey('\x1B[2~')} {disabled} ariaLabel="Insert key" />
				</div>

				<!-- Symbols row -->
				<div class="toolbar-row quaternary">
					<span class="row-label">Symbols:</span>
					<Button variant="ghost" size="small" text="|" onclick={() => sendSpecialKey('|')} {disabled} ariaLabel="Pipe character" />
					<Button variant="ghost" size="small" text="~" onclick={() => sendSpecialKey('~')} {disabled} ariaLabel="Tilde character" />
					<Button variant="ghost" size="small" text="`" onclick={() => sendSpecialKey('`')} {disabled} ariaLabel="Backtick character" />
					<Button variant="ghost" size="small" text="$" onclick={() => sendSpecialKey('$')} {disabled} ariaLabel="Dollar sign" />
					<Button variant="ghost" size="small" text="&" onclick={() => sendSpecialKey('&')} {disabled} ariaLabel="Ampersand" />
					<Button variant="ghost" size="small" text=">" onclick={() => sendSpecialKey('>')} {disabled} ariaLabel="Greater than" />
					<Button variant="ghost" size="small" text="<" onclick={() => sendSpecialKey('<')} {disabled} ariaLabel="Less than" />
					<Button variant="ghost" size="small" text=";" onclick={() => sendSpecialKey(';')} {disabled} ariaLabel="Semicolon" />
				</div>
			{/if}
		</div>
	{/if}

	<form onsubmit={handleSubmit} class="input-form">
		<div class="input-container">
			<div class="message-input-wrapper" data-augmented-ui="tl-clip br-clip both">
				<textarea
					bind:this={inputElement}
					bind:value={currentInput}
					{placeholder}
					{disabled}
					class="message-input"
					onkeydown={handleKeyDown}
					aria-label="Terminal command input"
					autocomplete="off"
					autocorrect="off"
					autocapitalize="off"
					spellcheck="false"
					rows="2"
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

	/* Mobile keyboard toolbar - ENHANCED ANIMATION */
	.mobile-keyboard-toolbar {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%),
			color-mix(in oklab, var(--surface) 98%, var(--primary) 2%)
		);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		overflow: hidden;
		animation: slideDown 0.4s cubic-bezier(0.23, 1, 0.32, 1);
		backdrop-filter: blur(8px) saturate(110%);
		box-shadow:
			0 2px 16px -8px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 8%, transparent);
	}

	@keyframes slideDown {
		from {
			max-height: 0;
			opacity: 0;
			transform: translateY(-8px);
		}
		to {
			max-height: 300px;
			opacity: 1;
			transform: translateY(0);
		}
	}

	.toolbar-row {
		display: flex;
		gap: var(--space-3);
		align-items: center;
		justify-content: flex-start;
		flex-wrap: wrap;
		padding: var(--space-4) var(--space-4);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 10%, transparent);
		min-height: 60px;
	}

	.toolbar-row.primary {
		background: color-mix(in oklab, var(--surface) 98%, var(--primary) 2%);
	}

	.toolbar-row.secondary,
	.toolbar-row.tertiary,
	.toolbar-row.quaternary {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 92%, var(--primary) 8%),
			color-mix(in oklab, var(--surface) 96%, var(--primary) 4%)
		);
		animation: expandRow 0.35s cubic-bezier(0.23, 1, 0.32, 1);
		backdrop-filter: blur(6px);
		box-shadow: inset 0 1px 2px color-mix(in oklab, var(--primary) 6%, transparent);
	}

	@keyframes expandRow {
		from {
			max-height: 0;
			opacity: 0;
			padding-top: 0;
			padding-bottom: 0;
			transform: translateY(-4px);
		}
		to {
			max-height: 80px;
			opacity: 1;
			padding-top: var(--space-2);
			padding-bottom: var(--space-2);
			transform: translateY(0);
		}
	}

	.key-group {
		display: flex;
		gap: var(--space-2);
		margin-right: var(--space-4);
		padding: var(--space-3);
		background: color-mix(in oklab, var(--primary) 8%, transparent);
		border-radius: var(--radius-sm);
		border: 1px solid color-mix(in oklab, var(--primary) 15%, transparent);
	}

	.wrap-toggle-wrapper {
		margin-right: var(--space-4);
		padding-right: var(--space-3);
		border-right: 2px solid color-mix(in oklab, var(--primary) 20%, transparent);
	}

	.row-label {
		font-family: var(--font-mono);
		font-size: 0.7rem;
		color: var(--muted);
		font-weight: 600;
		margin-right: var(--space-2);
		opacity: 0.8;
	}

	/* Toolbar buttons - using global Button component */
	.toolbar-row :global(.button) {
		min-width: 3rem;
		min-height: 2.5rem;
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.875rem;
		padding: var(--space-2) var(--space-3);
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	/* Arrow buttons need special sizing */
	.key-group :global(.button) {
		min-width: 2.5rem;
		min-height: 2.5rem;
		padding: var(--space-2);
		font-size: 1.1rem;
	}

	/* Wrap toggle button styling */
	.wrap-toggle-wrapper :global(.button) {
		min-width: 4rem;
		font-weight: 700;
	}

	/* REVOLUTIONARY INPUT INTERFACE - EXACT MATCH TO CLAUDE PANE */
	.input-form {
		padding: var(--space-3);
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
		flex-shrink: 0;
		margin-top: auto;
	}

	.input-container {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		position: relative;
	}

	.input-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	/* Message input wrapper with augmented-ui styling - EXACT CLAUDE MATCH */
	.message-input-wrapper {
		width: 100%;
		position: relative;
		--aug-border: 2px;
		--aug-border-bg: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		--aug-border-fallback-color: var(--primary);
		--aug-tl: 12px;
		--aug-br: 12px;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 93%, var(--primary) 7%),
			color-mix(in oklab, var(--surface) 96%, var(--primary) 4%)
		);
		backdrop-filter: blur(12px) saturate(120%);
		box-shadow:
			inset 0 2px 12px rgba(0, 0, 0, 0.08),
			0 4px 32px -8px rgba(0, 0, 0, 0.15),
			0 0 0 1px color-mix(in oklab, var(--primary) 15%, transparent);
		transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
	}

	.message-input-wrapper:focus-within {
		--aug-border: 3px;
		--aug-border-bg: linear-gradient(135deg, var(--accent-cyan), var(--primary));
		background: radial-gradient(
			ellipse at center,
			color-mix(in oklab, var(--surface) 88%, var(--primary) 12%),
			color-mix(in oklab, var(--surface) 94%, var(--primary) 6%)
		);
		box-shadow:
			inset 0 2px 16px rgba(0, 0, 0, 0.05),
			0 0 0 4px color-mix(in oklab, var(--primary) 25%, transparent),
			0 0 60px var(--primary-glow),
			0 20px 80px -20px var(--primary-glow);
	}

	.message-input {
		width: 100%;
		height: 100%;
		padding: var(--space-5) var(--space-5);
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		font-weight: 500;
		background: transparent;
		border: none;
		color: var(--text);
		position: relative;
		overflow: hidden;
		min-height: 100px;
		max-height: 200px;
		resize: vertical;
		line-height: 1.6;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklab, var(--primary) 30%, transparent) transparent;
		outline: none;
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

	/* Toolbar toggle button - ENHANCED DESIGN */
	.toolbar-toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-2);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 12%, var(--surface)),
			color-mix(in oklab, var(--primary) 6%, var(--surface))
		);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: var(--radius-sm);
		color: var(--primary);
		cursor: pointer;
		transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
		backdrop-filter: blur(4px);
		box-shadow:
			0 2px 8px -4px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 8%, transparent);
	}

	.toolbar-toggle-btn:hover {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 20%, var(--surface)),
			color-mix(in oklab, var(--primary) 12%, var(--surface))
		);
		border-color: color-mix(in oklab, var(--primary) 40%, transparent);
		transform: translateY(-1px);
		box-shadow:
			0 4px 16px -8px rgba(0, 0, 0, 0.15),
			0 0 0 1px color-mix(in oklab, var(--primary) 15%, transparent),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 12%, transparent);
	}

	.toolbar-toggle-btn:active {
		transform: translateY(0);
		box-shadow:
			0 2px 8px -4px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 8%, transparent);
	}

	/* Buttons in the actions area - EXACT CLAUDE MATCH */
	.input-actions :global(.button) {
		min-width: 120px;
		justify-content: center;
		font-weight: 600;
		letter-spacing: 0.05em;
	}

	/* Toolbar toggle button - compact size */
	.input-actions :global(button:first-child) {
		min-width: unset;
		flex-shrink: 0;
	}

	/* Send button - take up remaining space */
	.input-actions :global(.button[type='submit']) {
		flex: 1;
		min-width: 120px;
	}

	.input-hint {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--muted);
		opacity: 0.7;
		text-align: center;
		margin-top: var(--space-1);
	}

	/* RESPONSIVE DESIGN - EXACT CLAUDE MATCH */
	@media (max-width: 768px) {
		.input-form {
			padding: var(--space-4);
		}

		.input-container {
			gap: var(--space-4);
		}

		.message-input-wrapper {
			--aug-tl: 8px;
			--aug-br: 8px;
		}

		.message-input {
			min-height: 80px;
			padding: var(--space-4) var(--space-4);
			font-size: var(--font-size-1);
		}

		.input-actions :global(.button) {
			min-width: 80px;
			font-size: var(--font-size-1);
		}
	}

	@media (max-width: 480px) {
		.toolbar-row {
			gap: var(--space-2);
			padding: var(--space-3) var(--space-3);
			min-height: 55px;
		}

		.toolbar-row :global(.button) {
			min-width: 2.8rem;
			min-height: 2.3rem;
			font-size: 0.8rem;
			padding: var(--space-2);
		}

		.key-group {
			gap: var(--space-1);
			padding: var(--space-2);
			margin-right: var(--space-3);
		}

		.key-group :global(.button) {
			min-width: 2.2rem;
			min-height: 2.2rem;
			padding: var(--space-1);
			font-size: 1rem;
		}

		.wrap-toggle-wrapper {
			margin-right: var(--space-3);
			padding-right: var(--space-2);
		}

		.wrap-toggle-wrapper :global(.button) {
			min-width: 3.5rem;
			font-size: 0.75rem;
		}

		.row-label {
			font-size: 0.65rem;
			margin-right: var(--space-1);
		}
	}

	/* Hide on desktop */
	@media (min-width: 769px) {
		.mobile-input-wrapper {
			display: none;
		}
	}
</style>