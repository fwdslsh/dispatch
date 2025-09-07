<script>
	import { onMount, onDestroy } from 'svelte';
	import VirtualList from 'svelte-virtual-list';
	import { ChatInterfaceViewModel } from './ChatInterfaceViewModel.svelte.js';

	// Props
	let { sessionId = 'default', onSendMessage = () => {}, claudeClient = null } = $props();

	// Create ViewModel once with initial props - no reactive updates to avoid infinite loops
	let viewModel = new ChatInterfaceViewModel(sessionId, onSendMessage, claudeClient);
	let messageContainer;
	let virtualList;

	// Reactive state from ViewModel - access properties directly
	let messages = $derived(viewModel.messages);
	let typing = $derived(viewModel.typing);
	let messageInput = $derived(viewModel.messageInput);
	let isAuthenticated = $derived(viewModel.isAuthenticated);
	let isLoginCommand = $derived(
		viewModel.messageInput.trim() === '/login' ||
			viewModel.messageInput.trim().startsWith('claude setup-token')
	);
	let virtualItems = $derived([
		...viewModel.messages.map((msg) => ({ type: 'message', data: msg })),
		...(viewModel.typing ? [{ type: 'typing', data: {} }] : [])
	]);

	// Actions from ViewModel - access directly without $derived
	let { sendMessage, handleKeyDown, formatMessageContent, formatTimestamp, updateMessageInput } =
		viewModel.actions;

	// Auto-scroll to bottom after updates
	$effect(() => {
		if (virtualList && virtualItems.length > 0) {
			scrollToBottom();
		}
	});

	// Expose methods for external access
	export function addMessage(message) {
		viewModel.addMessage(message);
	}

	export function setTyping(isTyping) {
		viewModel.setTyping(isTyping);
	}

	export function clearHistory() {
		viewModel.clearHistory();
	}

	/**
	 * Scroll to bottom of message list
	 */
	function scrollToBottom() {
		if (virtualItems.length > 0) {
			// Use requestAnimationFrame to ensure DOM is updated
			requestAnimationFrame(() => {
				try {
					// First try using the VirtualList API if available
					if (virtualList && typeof virtualList.scrollToIndex === 'function') {
						virtualList.scrollToIndex(virtualItems.length - 1);
						return;
					}

					// Fallback: Find and scroll the virtual list viewport
					if (messageContainer) {
						const viewport = messageContainer.querySelector('.svelte-virtual-list-viewport');
						if (viewport) {
							viewport.scrollTop = viewport.scrollHeight;
						}
					}
				} catch (error) {
					console.warn('Could not scroll to bottom:', error);
				}
			});
		}
	}
</script>

<div class="chat-interface">
	<!-- Debug info -->
	{#if virtualItems.length === 0}
		<div class="debug-info">
			No messages yet. Items: {virtualItems.length}, Messages: {messages.length}
		</div>
	{/if}

	<!-- Messages container with virtual scrolling -->
	<div class="messages-container" bind:this={messageContainer}>
		<VirtualList bind:this={virtualList} items={virtualItems} let:item itemHeight={120}>
			{#if item.type === 'message'}
				<div class="message-wrapper">
					<div class="message {item.data.sender}">
						<div class="message-content">
							{@html formatMessageContent(item.data.content)}
						</div>
						<div class="message-timestamp">
							{formatTimestamp(item.data.timestamp)}
						</div>
					</div>
				</div>
			{:else if item.type === 'typing'}
				<div class="message-wrapper">
					<div class="message assistant">
						<div class="typing-indicator">
							<div class="typing-dot"></div>
							<div class="typing-dot"></div>
							<div class="typing-dot"></div>
						</div>
					</div>
				</div>
			{/if}
		</VirtualList>
	</div>

	<!-- Input area -->
	<div class="input-area" data-augmented-ui="tl-clip br-clip border">
		<textarea
			value={messageInput}
			oninput={(e) => updateMessageInput(e.currentTarget.value)}
			onkeydown={handleKeyDown}
			placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
			class="message-input"
			rows="1"
		></textarea>
		<button
			onclick={sendMessage}
			disabled={!messageInput?.trim() || (!isAuthenticated && !isLoginCommand)}
			class="send-button"
			data-augmented-ui="tl-clip br-clip border"
		>
			Send
		</button>
	</div>

	<!-- Authentication status -->
	{#if !isAuthenticated}
		<div class="auth-warning" data-augmented-ui="border">
			<span>⚠️ Not authenticated with Claude CLI</span>
			<small
				>Type <code>/login</code> for instructions or run <code>claude setup-token</code> in terminal</small
			>
		</div>
	{/if}
</div>

<style>
	.chat-interface {
		display: flex;
		flex-direction: column;
		background-color: transparent;
		overflow: hidden;
		font-family: var(--font-sans);
		height: 100%;
		:global(p) {
			color: unset;
		}
	}

	.messages-container {
		flex: 1;
		overflow: hidden;
	}

	:global(.chat-interface .svelte-virtual-list-viewport) {
		height: 100% !important;
	}

	:global(.chat-interface .svelte-virtual-list-contents) {
		padding: var(--space-sm);
	}

	.message-wrapper {
		margin-bottom: var(--space-sm);
		min-height: 120px;
		display: flex;
		align-items: flex-start;
		box-sizing: border-box;
		padding: var(--space-xs) 0;
	}

	.message {
		max-width: 80%;
		padding: var(--space-sm) var(--space-md);
		border-radius: 12px;
		position: relative;
		word-wrap: break-word;
		hyphens: auto;
	}

	.message.user {
		background: var(--primary);
		color: var(--bg-dark);
		margin-left: auto;
		text-align: right;
	}

	.message.assistant {
		background: var(--surface);
		color: var(--text-primary);
		margin-right: auto;
	}

	.message-content :global(p) {
		margin: 0;
		line-height: 1.4;
	}

	.message-content :global(pre) {
		margin: var(--space-xs) 0;
		padding: var(--space-sm);
		background: var(--bg-darker);
		border-radius: 6px;
		overflow-x: auto;
		border: 1px solid var(--border);
	}

	.message-content :global(code) {
		font-family: var(--font-mono);
		font-size: 0.9em;
	}

	.message-content :global(p code) {
		background: var(--bg-darker);
		padding: 2px 4px;
		border-radius: 3px;
		border: 1px solid var(--border);
	}

	.message-timestamp {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: var(--space-xs);
	}

	.message.user .message-timestamp {
		text-align: right;
	}

	.typing-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		padding: var(--space-sm);
	}

	.typing-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--primary);
		animation: typing-pulse 2.5s infinite ease-in-out;
	}

	.typing-dot:nth-child(1) {
		animation-delay: -0.6s;
	}
	.typing-dot:nth-child(2) {
		animation-delay: -0.3s;
	}

	@keyframes typing-pulse {
		0%,
		80%,
		100% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.input-area {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-md);
		background: var(--surface);
		align-items: flex-end;
	}

	.message-input {
		flex: 1;
		background: var(--bg-dark);
		border: 1px solid var(--border);
		border-radius: 6px;
		padding: var(--space-sm) var(--space-md);
		color: var(--text-primary);
		font-family: var(--font-sans);
		font-size: 0.9rem;
		line-height: 1.4;
		resize: vertical;
		min-height: 38px;
		max-height: 120px;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-muted);
	}

	.message-input::placeholder {
		color: var(--text-muted);
	}

	.send-button {
		background: var(--primary-gradient);
		color: var(--bg-dark);
		border: none;
		padding: var(--space-sm) var(--space-lg);
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		font-family: var(--font-sans);
	}

	.send-button:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 4px 12px var(--primary-muted);
	}

	.send-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.send-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.auth-warning {
		background: var(--secondary-muted);
		color: var(--text-primary);
		padding: var(--space-sm) var(--space-md);
		border-top: 1px solid var(--border);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-sm);
	}

	.auth-warning code {
		background: var(--bg-darker);
		padding: 2px 4px;
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 0.8rem;
	}

	.auth-warning small {
		color: var(--text-secondary);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.message {
			max-width: 90%;
		}

		.input-area {
			padding: var(--space-sm);
		}

		.send-button {
			padding: var(--space-sm);
		}
	}

	.debug-info {
		padding: var(--space-sm);
		color: var(--text-muted);
		font-size: 0.8rem;
		text-align: center;
		border-bottom: 1px solid var(--border);
	}
</style>
