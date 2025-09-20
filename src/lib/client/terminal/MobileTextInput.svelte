<!--
	MobileTextInput.svelte
	
	Mobile-friendly text input area for terminal sessions.
	Provides easier typing on mobile devices with autocomplete and suggestions.
-->
<script>
	import { createEventDispatcher } from 'svelte';

	// Props
	let { 
		placeholder = 'Type commands here...',
		disabled = false,
		visible = true,
		autoFocus = false,
		multiline = false
	} = $props();

	const dispatch = createEventDispatcher();

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

	let suggestions = $state([]);
	let showSuggestions = $state(false);
	let selectedSuggestionIndex = $state(-1);

	// Update suggestions based on input
	$effect(() => {
		if (inputValue.trim().length > 0) {
			const filtered = commonCommands.filter(cmd => 
				cmd.toLowerCase().startsWith(inputValue.toLowerCase().trim())
			);
			suggestions = filtered.slice(0, 5); // Limit to 5 suggestions
			showSuggestions = suggestions.length > 0;
			selectedSuggestionIndex = -1;
		} else {
			showSuggestions = false;
			suggestions = [];
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
			
			// Dispatch the command
			dispatch('submit', { 
				command: command + '\r',  // Add carriage return for terminal
				text: command
			});

			// Clear input and reset history navigation
			inputValue = '';
			historyIndex = -1;
			showSuggestions = false;
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
				showSuggestions = false;
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
		showSuggestions = false;
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
		background: var(--surface-elevated, #1a1a1a);
		border-top: 1px solid var(--surface-border, #333);
		padding: 0.75rem;
		gap: 0.5rem;
	}

	.mobile-text-input.disabled {
		opacity: 0.6;
		pointer-events: none;
	}

	.suggestions {
		display: flex;
		flex-direction: column;
		background: var(--surface-panel, #222);
		border: 1px solid var(--surface-border, #333);
		border-radius: 6px;
		max-height: 150px;
		overflow-y: auto;
		margin-bottom: 0.5rem;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.suggestion-item {
		background: transparent;
		border: none;
		color: var(--text-muted, #aaa);
		font-family: var(--font-mono, monospace);
		font-size: 0.875rem;
		padding: 0.5rem 0.75rem;
		text-align: left;
		cursor: pointer;
		transition: background 0.15s ease;
		border-bottom: 1px solid var(--surface-border, #333);
	}

	.suggestion-item:last-child {
		border-bottom: none;
	}

	.suggestion-item:hover,
	.suggestion-item.selected {
		background: var(--surface-hover, #2a2a2a);
		color: var(--text-primary, #fff);
	}

	.suggestion-item.selected {
		background: var(--accent-alpha, rgba(14, 165, 233, 0.1));
		color: var(--accent, #0ea5e9);
	}

	.input-container {
		display: flex;
		gap: 0.5rem;
		align-items: flex-end;
	}

	.text-input {
		flex: 1;
		background: var(--surface-panel, #222);
		border: 1px solid var(--surface-border, #333);
		border-radius: 6px;
		color: var(--text-primary, #fff);
		font-family: var(--font-mono, monospace);
		font-size: 0.9rem;
		padding: 0.75rem;
		outline: none;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		resize: none;
	}

	.text-input:focus {
		border-color: var(--accent, #0ea5e9);
		box-shadow: 0 0 0 2px var(--accent-alpha, rgba(14, 165, 233, 0.1));
	}

	.text-input::placeholder {
		color: var(--text-muted, #666);
	}

	.text-input.multiline {
		min-height: 4rem;
		line-height: 1.4;
	}

	.send-button {
		background: var(--accent, #0ea5e9);
		border: 1px solid var(--accent, #0ea5e9);
		border-radius: 6px;
		color: var(--text-on-accent, #fff);
		padding: 0.75rem;
		cursor: pointer;
		transition: all 0.15s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 2.75rem;
		min-height: 2.75rem;
	}

	.send-button:hover:not(:disabled) {
		background: var(--accent-bright, #38bdf8);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px var(--accent-alpha, rgba(14, 165, 233, 0.3));
	}

	.send-button:active:not(:disabled) {
		transform: translateY(0);
		box-shadow: 0 1px 4px var(--accent-alpha, rgba(14, 165, 233, 0.2));
	}

	.send-button:disabled {
		background: var(--surface-muted, #333);
		border-color: var(--surface-border, #444);
		color: var(--text-muted, #666);
		cursor: not-allowed;
		transform: none;
	}

	.input-hint {
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
		color: var(--text-muted, #666);
		text-align: center;
		margin-top: 0.25rem;
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.mobile-text-input {
			padding: 0.625rem;
		}

		.text-input {
			font-size: 0.875rem;
			padding: 0.625rem;
		}

		.send-button {
			padding: 0.625rem;
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