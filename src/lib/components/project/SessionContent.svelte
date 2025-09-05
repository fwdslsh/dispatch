<script>
	import Terminal from '$lib/components/Terminal.svelte';
	import ChatInterface from '$lib/components/ChatInterface.svelte';

	let {
		session = null,
		socket = null,
		projectId = null,
		showChat = false,
		onChatToggle = () => {}
	} = $props();
</script>

<div class="session-content">
	{#if session}
		<div class="content-header">
			<div class="session-title">
				<h3>{session.name || session.id}</h3>
				<span class="session-mode">{session.mode}</span>
			</div>
			<button class="btn-chat" class:active={showChat} onclick={onChatToggle}> Chat </button>
		</div>

		<div class="content-body">
			{#if showChat}
				<div class="split-view">
					<div class="terminal-section">
						<Terminal {socket} sessionId={session.id} {projectId} />
					</div>
					<div class="chat-section">
						<ChatInterface {socket} sessionId={session.id} />
					</div>
				</div>
			{:else}
				<div class="terminal-only">
					<Terminal {socket} sessionId={session.id} {projectId} />
				</div>
			{/if}
		</div>
	{:else}
		<div class="no-session">
			<h3>No session selected</h3>
			<p>Select a session from the panel or create a new one</p>
		</div>
	{/if}
</div>

<style>
	.session-content {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background: var(--bg);
	}

	.content-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--space-md);
		border-bottom: 1px solid var(--border);
	}

	.session-title {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.session-title h3 {
		margin: 0;
		color: var(--text);
		font-size: 1.1rem;
	}

	.session-mode {
		padding: 0.25rem 0.5rem;
		background: var(--bg-darker);
		color: var(--text-muted);
		border-radius: 4px;
		font-size: 0.8rem;
		text-transform: capitalize;
	}

	.btn-chat {
		padding: 0.5rem 1rem;
		background: transparent;
		color: var(--text-muted);
		border: 1px solid var(--border);
		border-radius: 4px;
		cursor: pointer;
	}

	.btn-chat.active,
	.btn-chat:hover {
		background: var(--accent);
		color: var(--bg);
		border-color: var(--accent);
	}

	.content-body {
		flex: 1;
		min-height: 0;
	}

	.terminal-only {
		height: 100%;
	}

	.split-view {
		display: flex;
		height: 100%;
	}

	.terminal-section {
		flex: 1;
		min-width: 0;
	}

	.chat-section {
		width: 400px;
		border-left: 1px solid var(--border);
		background: var(--bg-darker);
	}

	.no-session {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		height: 100%;
		text-align: center;
		color: var(--text-muted);
	}

	.no-session h3 {
		margin-bottom: 0.5rem;
	}

	@media (max-width: 768px) {
		.split-view {
			flex-direction: column;
		}

		.chat-section {
			width: auto;
			height: 300px;
			border-left: none;
			border-top: 1px solid var(--border);
		}
	}
</style>
