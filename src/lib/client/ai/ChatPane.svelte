<script>
	import { onMount, onDestroy } from 'svelte';
	import { AIPaneViewModel } from './viewmodels/AIPaneViewModel.svelte.js';
	import IconMessage from '../shared/components/Icons/IconMessage.svelte';
	import IconLoader from '../shared/components/Icons/IconLoader.svelte';
	import IconSparkles from '../shared/components/Icons/IconSparkles.svelte';
	import IconRobot from '../shared/components/Icons/IconRobot.svelte';
	import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';

	/**
	 * ChatPane Component - Unified AI Chat Interface
	 *
	 * v2.0 Hard Fork: OpenCode-first architecture
	 * Single chat interface for all AI sessions powered by OpenCode.
	 *
	 * @file src/lib/client/ai/ChatPane.svelte
	 */

	// Props
	let {
		sessionId,
		aiSessionId = null,
		shouldResume = false,
		sessionClient = null
	} = $props();

	// Create ViewModel with dependency injection
	const viewModel = new AIPaneViewModel({
		sessionId,
		aiSessionId,
		shouldResume,
		sessionClient
	});

	// Refs
	let messagesContainer = $state(null);

	// Auto-scroll when shouldScrollToBottom changes
	$effect(() => {
		if (viewModel.shouldScrollToBottom && messagesContainer) {
			requestAnimationFrame(() => {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
				viewModel.shouldScrollToBottom = false;
			});
		}
	});

	// Update ViewModel props when they change
	$effect(() => {
		viewModel.sessionId = sessionId;
		viewModel.aiSessionId = aiSessionId;
		viewModel.shouldResume = shouldResume;
	});

	// Handle keyboard shortcuts
	function handleKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			viewModel.submitInput();
		}
	}

	// Mobile detection
	function checkMobile() {
		return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;
	}

	function handleResize() {
		viewModel.setMobile(checkMobile());
	}

	// Mount lifecycle
	onMount(async () => {
		console.log('[ChatPane] Mounting:', { sessionId, aiSessionId, shouldResume });

		try {
			// Ensure socket is authenticated
			if (!runSessionClient.getStatus().authenticated) {
				try {
					await runSessionClient.authenticate();
				} catch (e) {
					console.warn('[ChatPane] Auth warning:', e?.message);
				}
			}

			// Attach to run session
			viewModel.isCatchingUp = shouldResume;

			const result = await runSessionClient.attachToRunSession(
				sessionId,
				(event) => viewModel.handleRunEvent(event),
				0
			);

			viewModel.attach();
			console.log('[ChatPane] Attached to session:', result);

			// Clear catching up state after timeout
			if (shouldResume) {
				setTimeout(() => {
					if (viewModel.isCatchingUp) {
						viewModel.isCatchingUp = false;
						viewModel.isWaitingForReply = false;
					}
				}, 2000);
			}

			// Mobile handling
			if (typeof window !== 'undefined') {
				viewModel.setMobile(checkMobile());
				window.addEventListener('resize', handleResize);
			}
		} catch (error) {
			console.error('[ChatPane] Mount error:', error);
			viewModel.setConnectionError(`Failed to initialize: ${error.message}`);
			viewModel.isCatchingUp = false;
			viewModel.loading = false;
		}
	});

	// Cleanup
	onDestroy(() => {
		if (viewModel.isAttached && sessionId) {
			try {
				runSessionClient.detachFromRunSession(sessionId);
			} catch (error) {
				console.error('[ChatPane] Detach error:', error);
			}
		}
		if (typeof window !== 'undefined') {
			window.removeEventListener('resize', handleResize);
		}
	});
</script>

<div class="chat-pane">
	<!-- Header -->
	<header class="chat-header">
		<div class="ai-status {viewModel.status}">
			<div class="ai-avatar">
				{#if viewModel.isCatchingUp}
					<IconLoader size={18} />
				{:else if viewModel.isWaitingForReply}
					<IconSparkles size={18} />
				{:else}
					<IconRobot size={18} />
				{/if}
			</div>
			<div class="ai-info">
				<span class="ai-name">AI Assistant</span>
				{#if viewModel.isCatchingUp}
					<span class="ai-status-text">Reconnecting...</span>
				{:else if viewModel.isWaitingForReply}
					<span class="ai-status-text">Thinking...</span>
				{/if}
			</div>
		</div>
		<div class="chat-stats">
			<div class="stat-item">
				<IconMessage size={14} />
				<span>{viewModel.messages.length}</span>
			</div>
		</div>
	</header>

	<!-- Messages -->
	<div class="messages-area" bind:this={messagesContainer}>
		{#if viewModel.messages.length === 0 && !viewModel.loading}
			<div class="empty-state">
				<IconSparkles size={48} />
				<h3>AI Coding Assistant</h3>
				<p>Powered by OpenCode. Start a conversation to get AI-powered help.</p>
			</div>
		{:else}
			<div class="messages-list">
				{#each viewModel.messages as message (message.id)}
					<div class="message {message.role}">
						<div class="message-avatar">
							{#if message.role === 'user'}
								<span class="avatar-user">You</span>
							{:else if message.role === 'error'}
								<span class="avatar-error">!</span>
							{:else}
								<IconRobot size={16} />
							{/if}
						</div>
						<div class="message-content">
							{#if message.role === 'error'}
								<p class="error-text">{message.text}</p>
								{#if message.text.includes('Cannot connect')}
									<p class="error-hint">
										Tip: Go to Settings → OpenCode to start the managed server.
									</p>
								{/if}
							{:else}
								<p>{message.text}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		{#if viewModel.isWaitingForReply}
			<div class="thinking-indicator">
				<IconLoader size={16} />
				<span>AI is thinking...</span>
			</div>
		{/if}
	</div>

	<!-- Input -->
	<div class="input-area">
		<form class="input-form" onsubmit={(e) => viewModel.submitInput(e)}>
			<textarea
				bind:value={viewModel.input}
				onkeydown={handleKeydown}
				placeholder="Ask the AI to help with your code..."
				disabled={viewModel.loading || !viewModel.isAttached}
				rows="2"
			></textarea>
			<button
				type="submit"
				disabled={!viewModel.canSubmit || viewModel.isWaitingForReply}
			>
				<IconMessage size={18} />
				<span>Send</span>
			</button>
		</form>
	</div>
</div>

<style>
	.chat-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-panel, var(--bg));
		overflow: hidden;
	}

	/* Header */
	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--surface-border);
		background: var(--surface);
		flex-shrink: 0;
	}

	.ai-status {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.ai-avatar {
		width: 32px;
		height: 32px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg,
			color-mix(in oklab, var(--primary) 20%, transparent),
			color-mix(in oklab, var(--primary) 10%, transparent)
		);
		border: 2px solid color-mix(in oklab, var(--primary) 30%, transparent);
		color: var(--primary);
	}

	.ai-status.thinking .ai-avatar {
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.7; transform: scale(1.05); }
	}

	.ai-info {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.ai-name {
		font-weight: 600;
		font-size: var(--font-size-2);
		color: var(--text);
	}

	.ai-status-text {
		font-size: var(--font-size-1);
		color: var(--primary);
	}

	.chat-stats {
		display: flex;
		gap: var(--space-2);
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-2);
		background: var(--bg);
		border-radius: var(--radius);
		font-size: var(--font-size-1);
		color: var(--text-muted);
	}

	/* Messages Area */
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
		height: 100%;
		gap: var(--space-3);
		color: var(--text-muted);
		text-align: center;
		padding: var(--space-8);
	}

	.empty-state h3 {
		margin: 0;
		font-family: var(--font-mono);
		color: var(--text);
	}

	.empty-state p {
		margin: 0;
		max-width: 300px;
	}

	.messages-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.message {
		display: flex;
		gap: var(--space-3);
		align-items: flex-start;
	}

	.message.user {
		flex-direction: row-reverse;
	}

	.message-avatar {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: 10px;
		font-weight: 600;
	}

	.message.user .message-avatar {
		background: var(--primary);
		color: var(--bg);
	}

	.message.assistant .message-avatar,
	.message.system .message-avatar {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		color: var(--primary);
	}

	.message.error .message-avatar {
		background: var(--error);
		color: white;
	}

	.avatar-user,
	.avatar-error {
		font-size: 10px;
	}

	.message-content {
		flex: 1;
		min-width: 0;
		padding: var(--space-3);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--surface-border);
	}

	.message.user .message-content {
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		border-color: color-mix(in oklab, var(--primary) 20%, transparent);
	}

	.message.error .message-content {
		background: color-mix(in oklab, var(--error) 10%, transparent);
		border-color: var(--error);
	}

	.message-content p {
		margin: 0;
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		line-height: 1.6;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.error-text {
		color: var(--error);
	}

	.error-hint {
		margin-top: var(--space-2) !important;
		font-size: var(--font-size-1);
		color: var(--text-muted);
	}

	.thinking-indicator {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3);
		color: var(--primary);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
	}

	/* Input Area */
	.input-area {
		flex-shrink: 0;
		padding: var(--space-4);
		border-top: 1px solid var(--surface-border);
		background: var(--surface);
	}

	.input-form {
		display: flex;
		gap: var(--space-2);
		align-items: flex-end;
	}

	.input-form textarea {
		flex: 1;
		padding: var(--space-3);
		background: var(--bg);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		resize: none;
		min-height: 44px;
		max-height: 120px;
	}

	.input-form textarea:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-glow-15, color-mix(in oklab, var(--primary) 15%, transparent));
	}

	.input-form textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.input-form button {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: var(--primary);
		color: var(--bg);
		border: none;
		border-radius: var(--radius);
		font-family: var(--font-mono);
		font-size: var(--font-size-2);
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		min-height: 44px;
	}

	.input-form button:hover:not(:disabled) {
		background: var(--primary-bright, var(--primary));
		transform: translateY(-1px);
	}

	.input-form button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		transform: none;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.chat-header {
			padding: var(--space-2) var(--space-3);
		}

		.messages-area {
			padding: var(--space-3);
		}

		.input-area {
			padding: var(--space-3);
		}

		.input-form button span {
			display: none;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.ai-status.thinking .ai-avatar {
			animation: none;
		}
	}
</style>
