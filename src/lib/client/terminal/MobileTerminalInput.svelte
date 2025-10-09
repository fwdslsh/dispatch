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
		switch (e.key) {
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
		<div class="compact-keyboard">
			<!-- Single row: Essential terminal-only keys -->
			<div class="main-row">
				<!-- Left side: Less common keys -->
				<div class="left-keys">
					<Button
						variant="ghost"
						text="|"
						onclick={() => sendSpecialKey('|')}
						{disabled}
						ariaLabel="Pipe"
					/>
					<Button
						variant="ghost"
						text="$"
						onclick={() => sendSpecialKey('$')}
						{disabled}
						ariaLabel="Dollar"
					/>
					<Button
						variant="ghost"
						text="~"
						onclick={() => sendSpecialKey('~')}
						{disabled}
						ariaLabel="Tilde"
					/>
				</div>

				<!-- Right side: Most common actions for right thumb -->
				<div class="right-keys">
					<Button
						variant="danger"
						text="^C"
						onclick={() => sendSpecialKey('\x03')}
						{disabled}
						ariaLabel="Interrupt (Ctrl+C)"
					/>
					<Button
						variant="outline"
						text="TAB"
						onclick={() => sendSpecialKey('\t')}
						{disabled}
						ariaLabel="Tab completion"
					/>
					<Button
						variant="primary"
						text="ENTER"
						onclick={() => sendSpecialKey('\r')}
						{disabled}
						ariaLabel="Execute command"
					/>
				</div>
			</div>

			<!-- Expandable row for additional keys -->
			{#if expandedSection}
				<div class="expanded-row">
					<!-- Navigation -->
					<Button
						variant="secondary"
						text="↑"
						onclick={() => sendSpecialKey('\x1B[A')}
						{disabled}
						ariaLabel="Up"
					/>
					<Button
						variant="secondary"
						text="↓"
						onclick={() => sendSpecialKey('\x1B[B')}
						{disabled}
						ariaLabel="Down"
					/>
					<Button
						variant="secondary"
						text="←"
						onclick={() => sendSpecialKey('\x1B[D')}
						{disabled}
						ariaLabel="Left"
					/>
					<Button
						variant="secondary"
						text="→"
						onclick={() => sendSpecialKey('\x1B[C')}
						{disabled}
						ariaLabel="Right"
					/>
					<!-- Control Keys -->
					<Button
						variant="ghost"
						text="^Z"
						onclick={() => sendSpecialKey('\x1a')}
						{disabled}
						ariaLabel="Suspend"
					/>
					<Button
						variant="ghost"
						text="^D"
						onclick={() => sendSpecialKey('\x04')}
						{disabled}
						ariaLabel="EOF"
					/>
					<Button
						variant="ghost"
						text="^L"
						onclick={() => sendSpecialKey('\x0c')}
						{disabled}
						ariaLabel="Clear"
					/>
					<Button
						variant="ghost"
						text="ESC"
						onclick={() => sendSpecialKey('\x1b')}
						{disabled}
						ariaLabel="Escape"
					/>
					<!-- Additional Symbols -->
					<Button
						variant="ghost"
						text=">"
						onclick={() => sendSpecialKey('>')}
						{disabled}
						ariaLabel="Redirect"
					/>
					<Button
						variant="ghost"
						text="<"
						onclick={() => sendSpecialKey('<')}
						{disabled}
						ariaLabel="Input"
					/>
					<Button
						variant="ghost"
						text="&"
						onclick={() => sendSpecialKey('&')}
						{disabled}
						ariaLabel="Background"
					/>
					<Button
						variant="ghost"
						text=";"
						onclick={() => sendSpecialKey(';')}
						{disabled}
						ariaLabel="Semicolon"
					/>
				</div>
			{/if}
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
		</div>

		<!-- Bottom actions row -->
		<div class="bottom-actions">
			<Button
				type="submit"
				text="Send"
				variant="primary"
				{disabled}
				ariaLabel="Send command"
				augmented="tr-clip bl-clip both"
			/>
			<Button
				variant="outline"
				text={showToolbar ? 'Hide' : 'Keys'}
				onclick={() => (showToolbar = !showToolbar)}
				{disabled}
				ariaLabel={showToolbar ? 'Hide toolbar' : 'Show toolbar'}
			/>
			{#if showToolbar}
				<Button
					variant="ghost"
					text={expandedSection ? '−' : '+'}
					onclick={() => (expandedSection = expandedSection ? null : 'more')}
					{disabled}
					ariaLabel={expandedSection ? 'Less keys' : 'More keys'}
				/>
			{/if}
		</div>
		{#if commandHistory.length > 0}
			<div class="input-hint">Ctrl+↑↓ for history • Tab for completion • Enter to send</div>
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
			0 calc(-1 * var(--space-2)) var(--space-6) -16px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
	}

	.mobile-input-wrapper.hidden {
		display: none;
	}

	/* COMPACT MOBILE KEYBOARD */
	.compact-keyboard {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%),
			color-mix(in oklab, var(--surface) 98%, var(--primary) 2%)
		);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		padding: var(--space-2);
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		backdrop-filter: blur(8px) saturate(110%);
	}

	/* Compact layout - single main row */
	.main-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-2);
	}

	.left-keys {
		display: flex;
		gap: var(--space-1);
	}

	.right-keys {
		display: flex;
		gap: var(--space-2);
	}

	.expanded-row {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--space-2);
		margin-top: var(--space-2);
		padding-top: var(--space-2);
		border-top: 1px solid color-mix(in oklab, var(--primary) 10%, transparent);
	}

	/* Global button overrides for keyboard */
	.compact-keyboard :global(.button) {
		min-height: 40px;
		font-family: var(--font-mono);
		font-weight: 600;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	.left-keys :global(.button) {
		min-width: 36px;
		padding: var(--space-1) var(--space-2);
	}

	.right-keys :global(.button) {
		min-width: 60px;
	}

	/* Bottom actions row */
	.bottom-actions {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		padding-top: var(--space-2);
	}

	.bottom-actions :global(.button:first-child) {
		flex: 1;
	}

	/* MOBILE OPTIMIZATION */
	@media (max-width: 480px) {
		.compact-keyboard {
			padding: var(--space-2);
		}

		.expanded-row {
			grid-template-columns: repeat(3, 1fr);
		}

		.left-keys {
			gap: var(--space-1);
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
			0 calc(-1 * var(--space-2)) var(--space-6) -16px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
		flex-shrink: 0;
		margin-top: auto;
		transition: padding 0.15s ease;
	}

	/* Compact form when toolbar is open */
	.compact-keyboard ~ .input-form {
		padding: var(--space-2) var(--space-3);
	}

	.input-container {
		position: relative;
		margin-bottom: var(--space-2);
	}

	.message-input-wrapper {
		flex: 1;
		position: relative;
		--aug-border: 1px;
		--aug-border-bg: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		--aug-border-fallback-color: var(--primary);
		--aug-tl: var(--space-2);
		--aug-br: var(--space-2);
		background: color-mix(in oklab, var(--surface) 94%, var(--primary) 6%);
		backdrop-filter: blur(8px) saturate(110%);
		box-shadow:
			inset 0 1px 4px rgba(0, 0, 0, 0.05),
			0 2px var(--space-2) -4px rgba(0, 0, 0, 0.1),
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
		transition:
			min-height 0.15s ease,
			padding 0.15s ease;
	}

	/* Compact when toolbar is open */
	.compact-keyboard ~ .input-form .message-input {
		min-height: 36px;
		padding: var(--space-2) var(--space-3);
		line-height: 1.2;
	}

	.message-input::-webkit-scrollbar {
		width: 6px;
	}

	.message-input::-webkit-scrollbar-thumb {
		background: color-mix(in oklab, var(--primary) 40%, transparent);
		border-radius: var(--radius-xs);
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
