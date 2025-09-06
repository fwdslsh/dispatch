<script>
	import { onMount } from 'svelte';
	import { getSessionType } from '$lib/session-types/client.js';
	import Terminal from '$lib/session-types/shell/components/Terminal.svelte';
	import ChatInterface from '$lib/session-types/claude/components/ChatInterface.svelte';

	// Fallback imports for session type views
	import ShellSessionView from '$lib/session-types/shell/ShellSessionView.svelte';
	import ClaudeSessionView from '$lib/session-types/claude/ClaudeSessionView.svelte';

	let {
		session = null,
		socket = null,
		projectId = null,
		showChat = false,
		onChatToggle = () => {}
	} = $props();

	// Dynamic session view state
	let sessionViewComponent = $state(null);
	let useLegacyView = $state(false);
	let isLoading = $state(false);
	let error = $state(null);

	// Session type derived from session data
	const sessionType = $derived(session?.type || session?.mode || 'shell');

	/**
	 * Load session type view component dynamically
	 * Falls back to legacy Terminal/Chat view if session type not found
	 */
	async function loadSessionView() {
		if (!session) {
			sessionViewComponent = null;
			useLegacyView = false;
			return;
		}

		isLoading = true;
		error = null;

		try {
			// Get session type from registry
			const sessionTypeDefinition = getSessionType(sessionType);

			if (!sessionTypeDefinition) {
				console.warn(`Session type '${sessionType}' not found in registry, using legacy view`);
				useLegacyView = true;
				sessionViewComponent = null;
				return;
			}

			// Use static imports for known session types for better performance
			switch (sessionType) {
				case 'shell':
					sessionViewComponent = ShellSessionView;
					useLegacyView = false;
					break;
				case 'claude':
					sessionViewComponent = ClaudeSessionView;
					useLegacyView = false;
					break;
				default:
					// Try dynamic import for unknown session types
					try {
						const module = await import(
							`$lib/session-types/${sessionType}/${sessionType.charAt(0).toUpperCase() + sessionType.slice(1)}SessionView.svelte`
						);
						sessionViewComponent = module.default;
						useLegacyView = false;
					} catch (importError) {
						console.warn(`Failed to load session view for '${sessionType}':`, importError);
						useLegacyView = true;
						sessionViewComponent = null;
					}
					break;
			}
		} catch (err) {
			console.error('Error loading session view:', err);
			error = err.message;
			useLegacyView = true;
			sessionViewComponent = null;
		} finally {
			isLoading = false;
		}
	}

	// Load session view when session changes
	$effect(() => {
		loadSessionView();
	});
</script>

<div class="session-content">
	{#if session}
		{#if isLoading}
			<!-- Loading session view -->
			<div class="session-loading">
				<div class="loading-content">
					<div class="loading-spinner"></div>
					<p>Loading session view...</p>
				</div>
			</div>
		{:else if error}
			<!-- Error loading session view -->
			<div class="session-error">
				<div class="error-content">
					<div class="error-icon">⚠️</div>
					<h3>Error Loading Session View</h3>
					<p>{error}</p>
					<button onclick={loadSessionView} class="retry-button"> Retry </button>
				</div>
			</div>
		{:else if !useLegacyView && sessionViewComponent}
			<!-- Dynamic session type view -->
			<div class="dynamic-session-view">
				<svelte:component
					this={sessionViewComponent}
					{session}
					{socket}
					{projectId}
					readonly={false}
					on:sessionAction
					on:error
					on:viewChanged
				/>
			</div>
		{:else}
			<!-- Legacy view for backward compatibility -->
			<div class="legacy-session-view">
				<div class="content-header">
					<div class="session-title">
						<h3>{session.name || session.id}</h3>
						<span class="session-mode">{sessionType}</span>
						{#if !sessionViewComponent}
							<span
								class="legacy-indicator"
								title="Using legacy view - session type view not available"
							>
								(Legacy)
							</span>
						{/if}
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
			</div>
		{/if}
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

	/* Dynamic session view styles */
	.dynamic-session-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	/* Legacy view styles */
	.legacy-session-view {
		flex: 1;
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.legacy-indicator {
		padding: 0.125rem 0.375rem;
		background: var(--warning-color, #f59e0b);
		color: white;
		border-radius: 3px;
		font-size: 0.7rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.025em;
	}

	/* Loading state styles */
	.session-loading {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.loading-content {
		text-align: center;
		color: var(--text-muted);
	}

	.loading-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top: 3px solid var(--accent);
		border-radius: 50%;
		margin: 0 auto 1rem;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	/* Error state styles */
	.session-error {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.error-content {
		text-align: center;
		color: var(--text-muted);
		max-width: 400px;
		padding: 2rem;
	}

	.error-icon {
		font-size: 2rem;
		margin-bottom: 1rem;
	}

	.error-content h3 {
		margin: 0 0 0.5rem 0;
		color: var(--error-color, #ef4444);
	}

	.error-content p {
		margin: 0 0 1rem 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.retry-button {
		padding: 0.5rem 1rem;
		background: var(--accent);
		color: var(--bg);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.9rem;
		transition: opacity 0.2s;
	}

	.retry-button:hover {
		opacity: 0.9;
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
