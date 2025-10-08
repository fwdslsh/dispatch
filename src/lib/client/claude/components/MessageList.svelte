<script>
	import Markdown from '$lib/client/shared/components/Markdown.svelte';
	import LiveIconStrip from '$lib/client/shared/components/LiveIconStrip.svelte';
	import IconClaude from '$lib/client/shared/components/Icons/IconClaude.svelte';
	import IconUserCode from '$lib/client/shared/components/Icons/IconUserCode.svelte';
	import Logo from '$lib/client/shared/components/Logo.svelte';

	/**
	 * MessageList Component
	 *
	 * Displays a scrollable list of messages in a Claude Code conversation.
	 * Handles message rendering, typing indicators, and live event feedback.
	 *
	 * @prop {Object} viewModel - ClaudePaneViewModel instance
	 */
	let { viewModel } = $props();

	// Bind messages container for scrolling
	let messagesContainer = $state();

	$effect(() => {
		console.log('[MessageList] Messages changed:', viewModel.messages.length, viewModel.messages);
	});

	$effect(() => {
		if (messagesContainer) {
			viewModel.setMessagesContainer(messagesContainer);
		}
	});
</script>

<div
	class="messages"
	role="log"
	aria-live="polite"
	aria-label="Chat messages"
	bind:this={messagesContainer}
>

	{#if viewModel.loading && viewModel.messages.length === 0}
		<div class="loading-message">
			<div class="loading-indicator">
				<div class="pulse-ring"></div>
				<div class="pulse-ring"></div>
				<div class="pulse-ring"></div>
			</div>
			<div class="loading-text">Loading previous conversation...</div>
		</div>
	{/if}

	{#each viewModel.messages as m, index (m.id || `msg-${index}`)}
		<!-- DEBUG: Rendering message {index} -->
		<div
			class="message message--{m.role} {m.isError ? 'message--error' : ''}"
			role="article"
			aria-label="{m.role} message"
		>
			<div class="message-wrapper">
				<div class="message-avatar">
					{#if m.role === 'user'}
						<div class="user-avatar">
							<IconUserCode size={16} />
						</div>
					{:else}
						<div class="ai-avatar-small">
							<IconClaude size={16} />
						</div>
					{/if}
				</div>
				<div class="message-content">
					<div class="message-header">
						<span class="message-role">{m.role === 'user' ? 'You' : 'Claude'}</span>
						<span class="message-time">
							{m.timestamp
								? new Date(m.timestamp).toLocaleTimeString('en-US', {
										hour: '2-digit',
										minute: '2-digit'
									})
								: '--:--'}
						</span>
					</div>
					<div class="message-text">
						{#if m.isError && m.errorIcon}
							{@const ErrorIcon = m.errorIcon}
							<div class="error-icon-wrapper">
								<ErrorIcon size={20} />
							</div>
						{/if}
						<Markdown content={m.text} />
					</div>
					{#if m.activityIcons && m.activityIcons.length > 0}
						<div class="activity-icons-container">
							<LiveIconStrip icons={m.activityIcons} title="Agent activity" staticMode={true} />
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/each}

	{#if viewModel.isWaitingForReply}
		<div
			class="message message--assistant typing-indicator"
		>
			<div class="message-wrapper">
				<div class="message-avatar">
					<div class="ai-avatar-small">
						<IconClaude size={16} />
					</div>
				</div>
				<div class="message-content">
					<div class="message-header">
						<span class="message-role">Claude</span>
						<span class="typing-status">Thinking...</span>
					</div>
					<div class="typing-animation">
						<div class="typing-dot"></div>
						<div class="typing-dot"></div>
						<div class="typing-dot"></div>
					</div>
					{#if viewModel.liveEventIcons.length > 0}
						<div class="activity-icons-container">
							<LiveIconStrip
								icons={viewModel.liveEventIcons}
								title="Live activity"
								staticMode={false}
							/>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if viewModel.messages.length === 0 && !viewModel.loading && !viewModel.isCatchingUp}
		<div class="welcome-message">
			<div class="welcome-icon">
				<Logo height={48} width={48} />
			</div>
			<h3>Welcome to Claude</h3>
			<p>
				Start a conversation with your AI assistant. Ask questions, get help with coding, or discuss
				ideas!
			</p>
		</div>
	{/if}
</div>

<style>
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-4);
		gap: var(--space-4);
		display: flex;
		flex-direction: column;
		contain: layout style;
		scroll-behavior: smooth;
		background: linear-gradient(
			180deg,
			color-mix(in oklab, var(--bg) 95%, var(--surface)),
			color-mix(in oklab, var(--bg) 98%, var(--surface))
		);
	}

	/* Loading Message */
	.loading-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-4);
		padding: var(--space-8);
		color: var(--muted);
	}

	.loading-indicator {
		display: flex;
		gap: var(--space-2);
		position: relative;
	}

	.pulse-ring {
		width: var(--font-size-0);
		height: var(--font-size-0);
		border-radius: var(--radius-full);
		background: var(--primary);
		animation: pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
	}

	.pulse-ring:nth-child(2) {
		animation-delay: 0.2s;
	}

	.pulse-ring:nth-child(3) {
		animation-delay: 0.4s;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.5;
			transform: scale(0.8);
		}
	}

	/* Message Styles */
	.message {
		display: flex;
		width: 100%;
		animation: messageSlideIn 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards;
	}

	.message-wrapper {
		display: flex;
		gap: var(--space-3);
		max-width: 85%;
		width: 100%;
	}

	.message--user .message-wrapper {
		margin-left: auto;
		flex-direction: row-reverse;
	}

	.message-avatar {
		flex-shrink: 0;
		margin-top: var(--space-2);
	}

	.user-avatar,
	.ai-avatar-small {
		width: 36px;
		height: 36px;
		border-radius: var(--radius-full);
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 20%, transparent),
			color-mix(in oklab, var(--primary) 10%, transparent)
		);
		border: 2px solid color-mix(in oklab, var(--primary) 30%, transparent);
		box-shadow: 0 4px 12px -4px var(--primary-glow);
	}

	.message-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.message-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: 0 var(--space-2);
	}

	.message-role {
		font-weight: 600;
		font-size: var(--font-size-1);
		color: var(--primary);
		text-transform: capitalize;
	}

	.message-time {
		font-size: var(--font-size-0);
		color: var(--muted);
		opacity: 0.7;
	}

	.message-text {
		padding: var(--space-4);
		font-size: var(--font-size-1);
		border-radius: var(--radius-xl);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 8%, var(--surface)),
			color-mix(in oklab, var(--primary) 4%, var(--surface))
		);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		box-shadow:
			0 var(--space-2) var(--space-6) -12px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px rgba(255, 255, 255, 0.05);
	}

	.message--user .message-text {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 15%, var(--surface)),
			color-mix(in oklab, var(--primary) 10%, var(--surface))
		);
		border-radius: var(--radius-xl);
		border-top-right-radius: var(--radius-sm);
	}

	.message--assistant .message-text {
		border-radius: var(--radius-xl);
		border-bottom-left-radius: var(--radius-sm);
	}

	/* Typing Indicator */
	.typing-indicator {
		opacity: 1;
		animation: none;
	}

	.typing-status {
		color: var(--muted);
		font-weight: 600;
		animation: typingPulse 1.5s ease-in-out infinite;
	}

	.typing-animation {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-5);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 12%, var(--surface)),
			color-mix(in oklab, var(--primary) 6%, var(--surface))
		);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: var(--radius-xl);
		border-bottom-left-radius: var(--radius-sm);
		min-height: var(--space-7);
		box-shadow:
			0 var(--space-2) var(--space-6) -12px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px rgba(255, 255, 255, 0.05);
	}

	.typing-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: var(--radius-full);
		background: var(--primary);
		opacity: 0.4;
		animation: typingBounceSubtle 1.4s ease-in-out infinite;
		box-shadow: 0 2px 8px -2px var(--primary-glow);
	}

	.typing-dot:nth-child(1) {
		animation-delay: 0s;
	}

	.typing-dot:nth-child(2) {
		animation-delay: 0.2s;
	}

	.typing-dot:nth-child(3) {
		animation-delay: 0.4s;
	}

	/* Welcome Message */
	.welcome-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-8);
		gap: var(--space-4);
		color: var(--muted);
		animation: fadeIn 0.6s ease-out;
	}

	.welcome-icon {
		width: 80px;
		height: 80px;
		border-radius: var(--radius-full);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 20%, transparent),
			color-mix(in oklab, var(--primary) 10%, transparent)
		);
		border: 3px solid color-mix(in oklab, var(--primary) 30%, transparent);
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 8px 24px -8px var(--primary-glow);
		animation: avatarPulse 3s ease-in-out infinite;
	}

	

	.welcome-message h3 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text);
		margin: 0;
	}

	.welcome-message p {
		font-size: 1rem;
		color: var(--muted);
		max-width: 400px;
		margin: 0;
	}

	/* Activity Icons */
	.activity-icons-container {
		margin-top: var(--space-2);
		padding: 0 var(--space-2);
	}

	/* Error Message Styling */
	.message--error .message-text {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--error, #ff6b6b) 15%, var(--surface)),
			color-mix(in oklab, var(--error, #ff6b6b) 8%, var(--surface))
		);
		border-color: color-mix(in oklab, var(--error, #ff6b6b) 35%, transparent);
		color: var(--error, #ff6b6b);
	}

	.error-icon-wrapper {
		display: inline-flex;
		align-items: center;
		margin-right: var(--space-2);
		color: var(--error, #ff6b6b);
		vertical-align: middle;
	}

	/* Mobile Optimizations */
	@media (max-width: 768px) {
		.messages {
			-webkit-overflow-scrolling: touch;
			overscroll-behavior-y: contain;
			position: relative;
			touch-action: pan-y;
		}

		.message-wrapper {
			max-width: 95%;
		}
	}

	/* Accessibility */
	@media (prefers-reduced-motion: reduce) {
		.message,
		.pulse-ring,
		.welcome-icon {
			animation: none;
		}

		.typing-dot {
			animation: none;
			opacity: 1;
		}
	}
</style>
