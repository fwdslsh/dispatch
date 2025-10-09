<script>
	import { onMount, onDestroy } from 'svelte';
	import { ClaudePaneViewModel } from './viewmodels/ClaudePaneViewModel.svelte.js';
	import MessageList from './components/MessageList.svelte';
	import InputArea from './components/InputArea.svelte';
	import IconMessage from '../shared/components/Icons/IconMessage.svelte';
	import IconLoader from '../shared/components/Icons/IconLoader.svelte';
	import IconSparkles from '../shared/components/Icons/IconSparkles.svelte';
	import IconProgressDown from '../shared/components/Icons/IconProgressDown.svelte';
	import IconClaude from '../shared/components/Icons/IconClaude.svelte';
	import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';
	import './claude.css';

	/**
	 * ClaudePane Component
	 *
	 * Main orchestrator for Claude Code sessions using MVVM pattern.
	 * Delegates business logic to ClaudePaneViewModel and renders subcomponents.
	 */

	// Props
	let { sessionId, claudeSessionId = null, shouldResume = false, sessionClient = null } = $props();

	// Create ViewModel instance with dependency injection
	// sessionClient can be injected for testing, defaults to singleton runSessionClient
	const viewModel = new ClaudePaneViewModel({
		sessionId,
		claudeSessionId,
		shouldResume,
		sessionClient
	});

	// Debug logging
	$effect(() => {
		console.log('[ClaudePane] Props received:', {
			sessionId,
			claudeSessionId,
			shouldResume
		});
	});

	// Update ViewModel props when they change
	$effect(() => {
		viewModel.sessionId = sessionId;
		viewModel.claudeSessionId = claudeSessionId;
		viewModel.shouldResume = shouldResume;
	});

	// Load previous messages function
	async function loadPreviousMessages() {
		const sessionIdToLoad = viewModel.claudeSessionId || sessionId;
		if (!sessionIdToLoad) return;

		console.log('[ClaudePane] Loading previous messages for session:', sessionIdToLoad);
		viewModel.loading = true;

		try {
			// Load Claude session history from API
			const response = await fetch(
				`/api/claude/session/${encodeURIComponent(sessionIdToLoad)}?full=1`
			);

			if (response.ok) {
				const data = await response.json();
				console.log('[ClaudePane] Session history loaded:', {
					sessionId: sessionIdToLoad,
					project: data.project,
					entryCount: (data.entries || []).length
				});

				// Convert entries to message format
				const events = (data.entries || []).map((entry, index) => ({
					type: 'claude:message',
					payload: entry,
					timestamp: entry.timestamp || Date.now() + index,
					seq: index
				}));

				if (events.length > 0) {
					await viewModel.loadPreviousMessages(events);
				}
			}
		} catch (error) {
			console.error('[ClaudePane] Failed to load previous messages:', error);
		} finally {
			viewModel.loading = false;
		}
	}

	// Mobile detection with resize handling
	function checkMobile() {
		return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;
	}
	function handleResize() {
		viewModel.setMobile(checkMobile());
	}

	// Mount lifecycle with comprehensive error boundary
	onMount(async () => {
		console.log('[ClaudePane] Mounting with:', { sessionId, claudeSessionId, shouldResume });

		try {
			// Socket.IO authenticates via session cookie in handshake (no explicit auth needed)

			// Attach to the run session and get backlog
			console.log('[ClaudePane] Attaching to run session:', sessionId);
			viewModel.isCatchingUp = shouldResume;

			const result = await runSessionClient.attachToRunSession(
				sessionId,
				(event) => viewModel.handleRunEvent(event),
				0
			);

			viewModel.attach();
			console.log('[ClaudePane] Attached to run session:', result);

			// Clear catching up state after a delay if no messages arrived
			if (shouldResume) {
				setTimeout(() => {
					if (viewModel.isCatchingUp) {
						viewModel.isCatchingUp = false;
						viewModel.isWaitingForReply = false;
						console.log('[ClaudePane] Timeout reached, clearing catching up state');
					}
				}, 2000);
			}

			if (typeof window !== 'undefined') {
				viewModel.setMobile(checkMobile());
				window.addEventListener('resize', handleResize);
			}

			// Load previous messages if this is a resumed session
			if (claudeSessionId || shouldResume) {
				await loadPreviousMessages();
			}
		} catch (error) {
			// Comprehensive error boundary - handle all mount failures gracefully
			console.error('[ClaudePane] Mount error:', error);
			viewModel.setConnectionError(`Failed to initialize: ${error.message || 'Unknown error'}`);
			viewModel.isCatchingUp = false;
			viewModel.loading = false;
			viewModel.isWaitingForReply = false;
		}
	});

	// Cleanup on destroy
	onDestroy(() => {
		// Detach from run session
		if (viewModel.isAttached && sessionId) {
			try {
				runSessionClient.detachFromRunSession(sessionId);
				console.log('[ClaudePane] Detached from run session:', sessionId);
			} catch (error) {
				console.error('[ClaudePane] Failed to detach from run session:', error);
			}
		}
		window.removeEventListener('resize', handleResize);
	});
</script>

<div class="claude-pane">
	<!-- Chat Header with AI Status -->
	<div class="chat-header">
		<div
			class="ai-status {viewModel.status}"
			title={viewModel.isWaitingForReply
				? 'thinking...'
				: viewModel.loading
					? 'loading...'
					: 'idle'}
		>
			<div class="ai-avatar">
				{#if viewModel.isCatchingUp}
					<IconLoader size={16} class="ai-icon spinning" />
					<span class="catching-up">Reconnecting to active session...</span>
				{:else if viewModel.loading}
					<IconProgressDown size={16} class="ai-icon" />
				{:else if viewModel.isWaitingForReply}
					<IconSparkles size={16} class="ai-icon glowing" />
				{:else}
					<IconClaude size={16} />
				{/if}
			</div>
			<div class="ai-info">
				<div class="ai-name">Claude</div>
			</div>
		</div>
		<div class="chat-stats">
			<div class="stat-item">
				<span class="stat-icon"><IconMessage size={16} /></span>
				<span class="stat-value">{viewModel.messages.length}</span>
			</div>
		</div>
	</div>

	<!-- Messages List Component -->
	<MessageList {viewModel} />

	<!-- Input Area Component -->
	<InputArea {viewModel} />
</div>

<style>
	.claude-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		position: relative;
		background: linear-gradient(
			180deg,
			color-mix(in oklab, var(--bg) 95%, var(--surface)),
			color-mix(in oklab, var(--bg) 98%, var(--surface))
		);
		overflow: visible;
	}

	/* Chat Header */
	.chat-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-4);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 10%, transparent);
		background: linear-gradient(
			180deg,
			color-mix(in oklab, var(--surface) 60%, var(--bg)),
			color-mix(in oklab, var(--surface) 40%, var(--bg))
		);
		backdrop-filter: blur(12px);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.ai-status {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.ai-avatar {
		width: var(--space-7);
		height: var(--space-7);
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 25%, transparent),
			color-mix(in oklab, var(--primary) 15%, transparent)
		);
		border: 3px solid color-mix(in oklab, var(--primary) 40%, transparent);
		box-shadow: 0 8px 24px -8px var(--primary-glow);
		position: relative;
		overflow: hidden;
		transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
	}

	.ai-status.thinking .ai-avatar {
		animation: avatarPulse 2s ease-in-out infinite;
	}

	:global(.ai-icon.spinning) {
		animation: spin 1.5s linear infinite;
	}

	:global(.ai-icon.glowing) {
		animation: glowIcon 2s ease-in-out infinite;
	}

	@keyframes glowIcon {
		0%,
		100% {
			opacity: 1;
			filter: drop-shadow(0 0 4px var(--primary));
		}
		50% {
			opacity: 0.7;
			filter: drop-shadow(0 0 8px var(--primary));
		}
	}

	.catching-up {
		font-size: var(--font-size-1);
		color: var(--muted);
		animation: loadingPulse 1.5s ease-in-out infinite;
	}

	.ai-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}

	.ai-name {
		font-weight: 600;
		font-size: var(--font-size-2);
		color: var(--text);
	}

	.chat-stats {
		display: flex;
		gap: var(--space-4);
		align-items: center;
	}

	.stat-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		border-radius: var(--radius-md);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
	}

	.stat-icon {
		display: flex;
		color: var(--primary);
	}

	.stat-value {
		font-weight: 600;
		font-size: var(--font-size-1);
		color: var(--text);
		min-width: 20px;
		text-align: right;
	}

	/* Mobile Optimizations */
	@media (max-width: 768px) {
		.claude-pane {
			height: 100%;
			min-height: 0;
		}

		.chat-header {
			padding: var(--space-3) var(--space-4);
		}

		.ai-avatar {
			width: 40px;
			height: 40px;
		}
	}

	/* Accessibility */
	@media (prefers-reduced-motion: reduce) {
		.ai-avatar,
		.catching-up,
		:global(.ai-icon.spinning),
		:global(.ai-icon.glowing) {
			animation: none !important;
		}
	}

	/* High Contrast Mode */
	@media (prefers-contrast: high) {
		.ai-avatar {
			border-width: 3px;
		}

		.stat-item {
			border-width: var(--space-0);
		}
	}
</style>
