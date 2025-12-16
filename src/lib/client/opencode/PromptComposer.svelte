<script>
	import { onMount, onDestroy } from 'svelte';
	import EventViewer from './EventViewer.svelte';

	/**
	 * @typedef {Object} OpenCodeSession
	 * @property {string} id - Session ID
	 * @property {string} [name] - Session name
	 */

	/**
	 * @type {{
	 *   session: OpenCodeSession,
	 *   onSendPrompt: (sessionId: string, prompt: string) => Promise<any>
	 * }}
	 */
	let { session, onSendPrompt } = $props();

	let promptText = $state('');
	let sending = $state(false);
	let messages = $state([]);
	let events = $state([]);
	let showAutocomplete = $state(false);
	let autocompleteOptions = $state([]);
	let autocompletePosition = $state(0);
	let textareaEl = $state(null);
	let eventSource = $state(null);

	// File autocomplete
	let currentDirectory = $state(null);
	let files = $state([]);

	async function loadFiles(directory = '.') {
		try {
			const response = await fetch(`/api/browse?path=${encodeURIComponent(directory)}`);
			if (!response.ok) return;
			const data = await response.json();
			files = data.entries || [];
			currentDirectory = directory;
		} catch (err) {
			console.error('Failed to load files:', err);
		}
	}

	function handleKeydown(e) {
		// Check for @ symbol to trigger autocomplete
		if (e.key === '@') {
			const cursorPos = e.target.selectionStart;
			const textBeforeCursor = promptText.substring(0, cursorPos);
			const lastWord = textBeforeCursor.split(/\s/).pop();

			if (lastWord === '') {
				// Just typed @, show file autocomplete
				loadFiles();
				showAutocomplete = true;
				autocompletePosition = 0;
			}
		}

		// Handle autocomplete navigation
		if (showAutocomplete) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				autocompletePosition = Math.min(autocompletePosition + 1, autocompleteOptions.length - 1);
			} else if (e.key === 'ArrowUp') {
				e.preventDefault();
				autocompletePosition = Math.max(autocompletePosition - 1, 0);
			} else if (e.key === 'Enter' && autocompleteOptions.length > 0) {
				e.preventDefault();
				selectAutocomplete(autocompleteOptions[autocompletePosition]);
			} else if (e.key === 'Escape') {
				showAutocomplete = false;
			}
		}
	}

	function handleInput(e) {
		const value = e.target.value;
		promptText = value;

		// Update autocomplete based on current input
		const cursorPos = e.target.selectionStart;
		const textBeforeCursor = value.substring(0, cursorPos);
		const match = textBeforeCursor.match(/@([^\s]*)$/);

		if (match) {
			const searchTerm = match[1].toLowerCase();
			autocompleteOptions = files
				.filter((f) => f.name.toLowerCase().includes(searchTerm))
				.slice(0, 10);
			showAutocomplete = autocompleteOptions.length > 0;
		} else {
			showAutocomplete = false;
		}
	}

	function selectAutocomplete(file) {
		const cursorPos = textareaEl.selectionStart;
		const textBeforeCursor = promptText.substring(0, cursorPos);
		const textAfterCursor = promptText.substring(cursorPos);
		const match = textBeforeCursor.match(/@([^\s]*)$/);

		if (match) {
			const beforeMatch = textBeforeCursor.substring(0, match.index);
			promptText = beforeMatch + '@' + file.name + ' ' + textAfterCursor;
		}

		showAutocomplete = false;
		textareaEl.focus();
	}

	async function handleSend() {
		if (!promptText.trim() || sending) return;

		sending = true;
		const prompt = promptText.trim();
		promptText = '';

		try {
			messages = [...messages, { role: 'user', content: prompt, timestamp: Date.now() }];
			const result = await onSendPrompt(session.id, prompt);
			messages = [...messages, { role: 'assistant', content: result.content || 'Sent', timestamp: Date.now() }];
		} catch (err) {
			console.error('Failed to send prompt:', err);
			messages = [...messages, { role: 'error', content: err.message, timestamp: Date.now() }];
		} finally {
			sending = false;
		}
	}

	function connectEventSource() {
		if (eventSource) {
			eventSource.close();
		}

		// Connect to SSE endpoint for real-time events
		const url = `/api/opencode/events?sessionId=${session.id}`;
		eventSource = new EventSource(url);

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				events = [...events, { ...data, timestamp: Date.now() }];
			} catch (err) {
				console.error('Failed to parse SSE event:', err);
			}
		};

		eventSource.onerror = (err) => {
			console.error('SSE connection error:', err);
			eventSource.close();
		};
	}

	onMount(() => {
		loadFiles();
		connectEventSource();
	});

	onDestroy(() => {
		if (eventSource) {
			eventSource.close();
		}
	});
</script>

<div class="prompt-composer">
	<div class="composer-main">
		<div class="textarea-wrapper">
			<textarea
				bind:this={textareaEl}
				bind:value={promptText}
				oninput={handleInput}
				onkeydown={handleKeydown}
				placeholder="Type your prompt here... Use @ to mention files"
				rows="4"
				disabled={sending}
			></textarea>

			{#if showAutocomplete && autocompleteOptions.length > 0}
				<div class="autocomplete-menu">
					{#each autocompleteOptions as option, i}
						<div
							class="autocomplete-item"
							class:selected={i === autocompletePosition}
							onclick={() => selectAutocomplete(option)}
							role="button"
							tabindex="-1"
						>
							<span class="file-icon">{option.type === 'directory' ? '📁' : '📄'}</span>
							<span class="file-name">{option.name}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="composer-actions">
			<button class="send-btn" onclick={handleSend} disabled={!promptText.trim() || sending}>
				{sending ? 'Sending...' : 'Send Prompt'}
			</button>
			<span class="hint">Tip: Use @filename to reference files in your workspace</span>
		</div>
	</div>

	<div class="composer-output">
		<div class="messages-section">
			<h3>Messages</h3>
			{#if messages.length === 0}
				<p class="empty">No messages yet</p>
			{:else}
				<div class="messages-list">
					{#each messages as message}
						<div class="message" class:user={message.role === 'user'} class:assistant={message.role === 'assistant'} class:error={message.role === 'error'}>
							<div class="message-role">{message.role}</div>
							<div class="message-content">{message.content}</div>
							<div class="message-timestamp">{new Date(message.timestamp).toLocaleTimeString()}</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="events-section">
			<h3>Real-time Events</h3>
			<EventViewer {events} />
		</div>
	</div>
</div>

<style>
	.prompt-composer {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		height: 100%;
	}

	.composer-main {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.textarea-wrapper {
		position: relative;
	}

	textarea {
		width: 100%;
		padding: 0.75rem;
		background: var(--color-background);
		color: var(--color-text);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		font-family: var(--font-mono, monospace);
		font-size: 0.875rem;
		resize: vertical;
		min-height: 100px;
	}

	textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.autocomplete-menu {
		position: absolute;
		bottom: 100%;
		left: 0;
		right: 0;
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		max-height: 200px;
		overflow-y: auto;
		box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
		z-index: 10;
	}

	.autocomplete-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.75rem;
		cursor: pointer;
		transition: background 0.1s;
	}

	.autocomplete-item:hover,
	.autocomplete-item.selected {
		background: var(--color-primary-bg, rgba(59, 130, 246, 0.1));
	}

	.file-icon {
		font-size: 1rem;
	}

	.file-name {
		font-family: var(--font-mono, monospace);
		font-size: 0.875rem;
	}

	.composer-actions {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.send-btn {
		padding: 0.5rem 1.5rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
		transition: opacity 0.2s;
	}

	.send-btn:hover:not(:disabled) {
		opacity: 0.9;
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.hint {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-style: italic;
	}

	.composer-output {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		flex: 1;
		min-height: 300px;
	}

	.messages-section,
	.events-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1rem;
		background: var(--color-background);
		border: 1px solid var(--color-border);
		border-radius: 4px;
		overflow: hidden;
	}

	.messages-section h3,
	.events-section h3 {
		margin: 0;
		font-size: 1rem;
		color: var(--color-text);
	}

	.empty {
		color: var(--color-text-muted);
		font-style: italic;
		text-align: center;
		padding: 2rem;
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		overflow-y: auto;
	}

	.message {
		padding: 0.75rem;
		background: var(--color-surface);
		border-left: 3px solid var(--color-border);
		border-radius: 4px;
	}

	.message.user {
		border-left-color: var(--color-primary);
	}

	.message.assistant {
		border-left-color: var(--color-success, #0a0);
	}

	.message.error {
		border-left-color: var(--color-error, #c33);
		background: var(--color-error-bg, #fee);
	}

	.message-role {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: var(--color-text-muted);
		margin-bottom: 0.25rem;
	}

	.message-content {
		color: var(--color-text);
		white-space: pre-wrap;
		word-wrap: break-word;
	}

	.message-timestamp {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		margin-top: 0.25rem;
	}

	@media (max-width: 768px) {
		.composer-output {
			grid-template-columns: 1fr;
		}
	}
</style>
