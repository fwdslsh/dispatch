<script>
	import { onMount, onDestroy } from 'svelte';
	import IconMessage from '../shared/components/Icons/IconMessage.svelte';
	import IconLoader from '../shared/components/Icons/IconLoader.svelte';
	import IconSparkles from '../shared/components/Icons/IconSparkles.svelte';
	import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';
	import './opencode.css';

	/**
	 * OpenCodePane Component
	 *
	 * Main component for OpenCode sessions.
	 * Displays messages and handles user input for AI-powered coding.
	 */

	// Props
	let {
		sessionId,
		opencodeSessionId = null,
		shouldResume = false,
		sessionClient = null
	} = $props();

	// Use provided sessionClient or default to singleton
	const client = sessionClient || runSessionClient;

	// Component state
	let messages = $state([]);
	let input = $state('');
	let loading = $state(false);
	let error = $state(null);
	let attached = $state(false);

	// Event handler for session events
	function handleEvent(event) {
		console.log('[OpenCodePane] Received event:', event);

		if (event.channel === 'opencode:message') {
			// Extract events array from payload
			const opencodeEvents = event.payload?.events || [];

			// Process each OpenCode event
			opencodeEvents.forEach((ocEvent) => {

				// Add event to messages based on type
				if (ocEvent.type && ocEvent.data) {
					messages = [
						...messages,
						{
							type: 'assistant',
							text: JSON.stringify(ocEvent.data, null, 2),
							eventType: ocEvent.type,
							timestamp: Date.now()
						}
					];
				} else {
					// Fallback: display entire event
					messages = [...messages, { type: 'system', ...ocEvent, timestamp: Date.now() }];
				}
			});
		} else if (event.channel === 'opencode:error') {
			error = event.payload.error || 'Unknown error occurred';
		}
	}

	// Send message to OpenCode
	async function sendMessage() {
		if (!input.trim() || loading) return;

		const message = input.trim();
		input = '';
		loading = true;
		error = null;

		try {
			// Add user message to display
			messages = [...messages, { type: 'user', text: message, timestamp: Date.now() }];

			// Send to session using the correct RunSessionClient method
			client.sendInput(sessionId, message);

			console.log('[OpenCodePane] Sent message:', message);
		} catch (err) {
			console.error('[OpenCodePane] Failed to send message:', err);
			error = err.message || 'Failed to send message';
		} finally {
			loading = false;
		}
	}

	// Handle Enter key
	function handleKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	// Mount lifecycle
	onMount(async () => {

		try {
			// Attach to the run session using the correct method
			const result = await client.attachToRunSession(
				sessionId,
				handleEvent,
				0 // Start from sequence 0
			);
			attached = true;
			console.log('[OpenCodePane] Attached to session:', sessionId, result);
		} catch (err) {
			console.error('[OpenCodePane] Failed to attach:', err);
			error = 'Failed to connect to session';
		}
	});

	// Cleanup on unmount
	onDestroy(() => {
		console.log('[OpenCodePane] Unmounting, detaching from session:', sessionId);
		if (attached) {
			client.detachFromRunSession(sessionId);
		}
	});
</script>

<div class="opencode-pane">
	<!-- Message Area -->
	<div class="messages-area">
		{#if messages.length === 0 && !loading}
			<div class="empty-state">
				<IconSparkles size={48} />
				<h3>OpenCode AI Coding Assistant</h3>
				<p>Start a conversation to get AI-powered coding help.</p>
			</div>
		{:else}
			<div class="messages-list">
				{#each messages as message, i (i)}
					<div class="message {message.type || 'system'}">
						<div class="message-content">
							{#if typeof message === 'string'}
								<p>{message}</p>
							{:else if message.text}
								<p>{message.text}</p>
							{:else}
								<pre>{JSON.stringify(message, null, 2)}</pre>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if loading}
			<div class="loading-indicator">
				<IconLoader size={24} />
				<span>OpenCode is thinking...</span>
			</div>
		{/if}

		{#if error}
			<div class="error-message">
				<p>{error}</p>
				{#if error.includes('Cannot connect to OpenCode server')}
					<p class="error-hint">
						💡 Tip: Go to Settings → OpenCode to start the managed OpenCode server.
					</p>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Input Area -->
	<div class="input-area">
		<div class="input-wrapper">
			<textarea
				bind:value={input}
				onkeydown={handleKeydown}
				placeholder="Ask OpenCode to help with your code..."
				disabled={loading || !attached}
				rows="3"
			></textarea>
			<button onclick={sendMessage} disabled={!input.trim() || loading || !attached}>
				<IconMessage size={20} />
				Send
			</button>
		</div>
	</div>
</div>

<style>
	.opencode-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-panel);
	}

	.messages-area {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-4);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		height: 100%;
		color: var(--text-muted);
		text-align: center;
		padding: var(--space-8);
	}

	.empty-state h3 {
		margin: 0;
		font-family: var(--font-mono);
		color: var(--text);
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.message {
		padding: var(--space-3);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--surface-border);
	}

	.message.user {
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		border-color: var(--primary-dim);
		margin-left: var(--space-8);
	}

	.message-content {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.message-content p {
		margin: 0;
		white-space: pre-wrap;
	}

	.message-content pre {
		margin: 0;
		overflow-x: auto;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3);
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	.error-message {
		padding: var(--space-3);
		background: color-mix(in oklab, var(--error) 10%, transparent);
		border: 1px solid var(--error);
		border-radius: var(--radius);
		color: var(--error);
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	.error-message p {
		margin: 0 0 var(--space-2) 0;
	}

	.error-message p:last-child {
		margin-bottom: 0;
	}

	.error-hint {
		color: var(--text);
		font-size: 0.8rem;
		opacity: 0.8;
	}

	.input-area {
		flex-shrink: 0;
		padding: var(--space-4);
		border-top: 1px solid var(--surface-border);
		background: var(--bg-panel);
	}

	.input-wrapper {
		display: flex;
		gap: var(--space-2);
		align-items: flex-end;
	}

	.input-wrapper textarea {
		flex: 1;
		padding: var(--space-3);
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		resize: none;
	}

	.input-wrapper textarea:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-glow-15);
	}

	.input-wrapper textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.input-wrapper button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: var(--primary);
		color: var(--bg);
		border: none;
		border-radius: var(--radius);
		font-family: var(--font-mono);
		font-size: 0.875rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.input-wrapper button:hover:not(:disabled) {
		background: var(--primary-bright);
	}

	.input-wrapper button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
