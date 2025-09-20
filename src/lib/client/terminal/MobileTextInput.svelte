<!--
	MobileTextInput.svelte

	Mobile-friendly text input area for terminal sessions.
	Provides easier typing on mobile devices with autocomplete and suggestions.
-->
<script>
	// Props with callbacks using runes mode
	let {
		placeholder = 'Type commands here...',
		disabled = false,
		visible = true,
		autoFocus = false,
		multiline = false,
		onSubmit = () => {}  // Callback function for submit events
	} = $props();

	let inputValue = $state('');
	let inputElement = $state();
	let textareaElement = $state();
	
	// Command history
	let commandHistory = $state([]);
	let historyIndex = $state(-1);

	// Common terminal commands for suggestions
	const commonCommands = [
		'ls', 'cd', 'pwd', 'mkdir', 'rmdir', 'rm', 'cp', 'mv',
		'cat', 'less', 'more', 'head', 'tail', 'grep', 'find',
		'ps', 'top', 'kill', 'killall', 'jobs', 'bg', 'fg',
		'chmod', 'chown', 'which', 'whereis', 'history', 'clear',
		'exit', 'logout', 'sudo', 'su', 'man', 'help',
		'git status', 'git add', 'git commit', 'git push', 'git pull',
		'npm install', 'npm start', 'npm run', 'npm test',
		'python', 'node', 'java', 'gcc', 'make'
	];

	let suggestionsSuppressed = $state(false);
	let selectedSuggestionIndex = $state(-1);

	// Derive suggestions from input value - this prevents reactive loops
	const suggestions = $derived.by(() => {
		const trimmedInput = inputValue.trim();
		if (trimmedInput.length > 0) {
			return commonCommands.filter(cmd =>
				cmd.toLowerCase().startsWith(trimmedInput.toLowerCase())
			).slice(0, 5); // Limit to 5 suggestions
		}
		return [];
	});

	const showSuggestions = $derived(suggestions.length > 0 && !suggestionsSuppressed);

	// Reset selected index when suggestions change
	$effect(() => {
		selectedSuggestionIndex = -1;
	});

	// Clear suppression when user types (input value changes)
	$effect(() => {
		if (inputValue.trim().length > 0 && suggestionsSuppressed) {
			suggestionsSuppressed = false;
		}
	});

	function handleSubmit() {
		if (disabled) return;

		const command = inputValue.trim();
		if (command) {
			// Add to history
			if (commandHistory[commandHistory.length - 1] !== command) {
				commandHistory = [...commandHistory, command];
				// Keep only last 50 commands
				if (commandHistory.length > 50) {
					commandHistory = commandHistory.slice(-50);
				}
			}

			// Call the submit callback
			onSubmit({
				command: command + '\r',  // Add carriage return for terminal
				text: command
			});

			// Clear input and reset history navigation
			inputValue = '';
			historyIndex = -1;
			suggestionsSuppressed = false;
		}
	}

	function handleKeyDown(event) {
		if (disabled) return;

		switch (event.key) {
			case 'Enter':
				if (!event.shiftKey || !multiline) {
					event.preventDefault();
					if (showSuggestions && selectedSuggestionIndex >= 0) {
						applySuggestion(suggestions[selectedSuggestionIndex]);
					} else {
						handleSubmit();
					}
				}
				break;

			case 'ArrowUp':
				event.preventDefault();
				if (showSuggestions) {
					selectedSuggestionIndex = Math.max(0, selectedSuggestionIndex - 1);
				} else {
					navigateHistory(-1);
				}
				break;

			case 'ArrowDown':
				event.preventDefault();
				if (showSuggestions) {
					selectedSuggestionIndex = Math.min(suggestions.length - 1, selectedSuggestionIndex + 1);
				} else {
					navigateHistory(1);
				}
				break;

			case 'Tab':
				event.preventDefault();
				if (showSuggestions && suggestions.length > 0) {
					applySuggestion(suggestions[selectedSuggestionIndex >= 0 ? selectedSuggestionIndex : 0]);
				}
				break;

			case 'Escape':
				event.preventDefault();
				suggestionsSuppressed = true;
				selectedSuggestionIndex = -1;
				break;
		}
	}

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
				inputValue = '';
				return;
			}
		}

		if (historyIndex >= 0 && historyIndex < commandHistory.length) {
			inputValue = commandHistory[historyIndex];
		}
	}

	function applySuggestion(suggestion) {
		inputValue = suggestion;
		suggestionsSuppressed = true;
		selectedSuggestionIndex = -1;
		
		// Focus back to input
		const element = multiline ? textareaElement : inputElement;
		if (element) {
			element.focus();
			// Move cursor to end
			element.setSelectionRange(inputValue.length, inputValue.length);
		}
	}

	function handleSuggestionClick(suggestion) {
		applySuggestion(suggestion);
	}

	// Auto-focus on mount if requested
	$effect(() => {
		if (autoFocus && visible) {
			const element = multiline ? textareaElement : inputElement;
			if (element) {
				setTimeout(() => element.focus(), 100);
			}
		}
	});
</script>

{#if visible}
	<div class="mobile-text-input" class:disabled>
		{#if showSuggestions}
			<div class="suggestions">
				{#each suggestions as suggestion, index}
					<button 
						class="suggestion-item"
						class:selected={index === selectedSuggestionIndex}
						onclick={() => handleSuggestionClick(suggestion)}
					>
						{suggestion}
					</button>
				{/each}
			</div>
		{/if}

		<div class="input-container">
			{#if multiline}
				<textarea
					bind:this={textareaElement}
					bind:value={inputValue}
					{placeholder}
					{disabled}
					rows="3"
					onkeydown={handleKeyDown}
					class="text-input multiline"
					autocomplete="off"
					spellcheck="false"
				></textarea>
			{:else}
				<input
					bind:this={inputElement}
					bind:value={inputValue}
					type="text"
					{placeholder}
					{disabled}
					onkeydown={handleKeyDown}
					class="text-input"
					autocomplete="off"
					spellcheck="false"
				/>
			{/if}

			<button 
				class="send-button"
				onclick={handleSubmit}
				{disabled}
				aria-label="Send command"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M22 2L11 13"></path>
					<path d="M22 2L15 22L11 13L2 9L22 2Z"></path>
				</svg>
			</button>
		</div>

		{#if commandHistory.length > 0}
			<div class="input-hint">
				<span>↑↓ for history • Tab for autocomplete • Enter to send</span>
			</div>
		{:else}
			<div class="input-hint">
				<span>Enter to send • Tab for autocomplete</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.mobile-text-input {
		display: flex;
		flex-direction: column;
		background: var(--bg, #0a0a0a);
		border-top: 1px solid var(--border, #333);
		padding: var(--space-3);
		gap: var(--space-2);
	}

	.mobile-text-input.disabled {
		opacity: 0.6;
		pointer-events: none;
	}

	.suggestions {
		display: flex;
		flex-direction: column;
		background: color-mix(in oklab, var(--bg) 90%, var(--accent) 10%);
		border: 1px solid var(--accent-alpha);
		border-radius: var(--radius-2);
		max-height: 150px;
		overflow-y: auto;
		margin-bottom: var(--space-2);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.suggestion-item {
		background: transparent;
		border: none;
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		padding: var(--space-2) var(--space-3);
		text-align: left;
		cursor: pointer;
		transition: background 0.15s ease;
		border-bottom: 1px solid var(--border);
	}

	.suggestion-item:last-child {
		border-bottom: none;
	}

	.suggestion-item:hover,
	.suggestion-item.selected {
		background: color-mix(in oklab, var(--bg) 80%, var(--accent) 20%);
		color: var(--text);
	}

	.suggestion-item.selected {
		background: var(--accent-alpha);
		color: var(--accent);
	}

	.input-container {
		display: flex;
		gap: var(--space-2);
		align-items: flex-end;
	}

	.text-input {
		flex: 1;
		background: color-mix(in oklab, var(--bg) 95%, var(--accent) 5%);
		border: 1px solid var(--border);
		border-radius: var(--radius-2);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.9rem;
		padding: var(--space-3);
		outline: none;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		resize: none;
	}

	.text-input:focus {
		border-color: var(--accent);
		box-shadow: 0 0 0 2px var(--accent-alpha);
	}

	.text-input::placeholder {
		color: var(--text-muted);
	}

	.text-input.multiline {
		min-height: 4rem;
		line-height: 1.4;
	}

	.send-button {
		background: var(--accent);
		border: 1px solid var(--accent);
		border-radius: var(--radius-2);
		color: var(--bg);
		padding: var(--space-3);
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
	}

	.send-button:hover:not(:disabled) {
		background: color-mix(in oklab, var(--accent) 90%, #fff 10%);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px var(--accent-alpha);
	}

	.send-button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 1px 4px var(--accent-alpha);
	}

	.send-button:disabled {
		background: var(--border);
		border-color: var(--border);
		color: var(--text-muted);
		cursor: not-allowed;
		transform: none;
	}

	.input-hint {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-muted);
		text-align: center;
		margin-top: var(--space-1);
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.mobile-text-input {
			padding: var(--space-2);
		}

		.text-input {
			font-size: 0.875rem;
			padding: var(--space-2);
		}

		.send-button {
			padding: var(--space-2);
			min-width: 2.5rem;
			min-height: 2.5rem;
		}

		.input-hint {
			font-size: 0.7rem;
		}
	}

	/* Hide on desktop */
	@media (min-width: 769px) {
		.mobile-text-input {
			display: none;
		}
	}
</style>