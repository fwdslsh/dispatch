<script>
	import { onMount, onDestroy } from 'svelte';
	import PromptComposer from './PromptComposer.svelte';

	/**
	 * @type {{
	 *   sessionId: string,
	 *   opencodeSessionId?: string,
	 *   workspacePath?: string,
	 *   provider?: string,
	 *   model?: string
	 * }}
	 */
	let { sessionId, opencodeSessionId, workspacePath, provider, model } = $props();

	let session = $state(null);
	let loading = $state(true);
	let error = $state(null);

	async function loadSession() {
		try {
			loading = true;
			error = null;

			// Session is already created by workspace
			// Just use the provided IDs and metadata
			const id = opencodeSessionId || sessionId;
			if (!id) {
				throw new Error('No session ID provided');
			}

			session = {
				id,
				opencodeSessionId: id,
				workspacePath: workspacePath || '/workspace',
				provider: provider || 'anthropic',
				model: model || 'claude-sonnet-4'
			};
		} catch (err) {
			error = err.message;
			console.error('Failed to load OpenCode session:', err);
		} finally {
			loading = false;
		}
	}

	async function sendPrompt(sid, prompt) {
		// Note: OpenCode sessions use the AI adapter which handles prompts
		// For now, just return a mock response
		// TODO: Implement actual prompt sending via Socket.IO or API
		try {
			return {
				content: 'OpenCode session received prompt. Socket.IO integration coming soon.',
				timestamp: Date.now()
			};
		} catch (err) {
			console.error('Failed to send prompt:', err);
			throw err;
		}
	}

	onMount(() => {
		loadSession();
	});

	onDestroy(() => {
		// Cleanup if needed
	});
</script>

<div class="opencode-pane">
	{#if loading}
		<div class="loading-state">
			<div class="spinner"></div>
			<p>Loading OpenCode session...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<h3>Failed to Load Session</h3>
			<p class="error-message">{error}</p>
			<button class="retry-btn" onclick={loadSession}>Retry</button>
		</div>
	{:else if session}
		<PromptComposer {session} onSendPrompt={sendPrompt} />
	{:else}
		<div class="empty-state">
			<p>No session available</p>
		</div>
	{/if}
</div>

<style>
	.opencode-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		background: var(--color-background);
		color: var(--color-text);
		overflow: hidden;
	}

	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 2rem;
		text-align: center;
	}

	.spinner {
		width: 40px;
		height: 40px;
		border: 4px solid var(--color-border);
		border-top-color: var(--color-primary);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 1rem;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.loading-state p,
	.empty-state p {
		color: var(--color-text-muted);
		margin: 0;
	}

	.error-state h3 {
		color: var(--color-error, #c33);
		margin: 0 0 0.5rem 0;
	}

	.error-message {
		color: var(--color-text);
		margin: 0 0 1rem 0;
		padding: 1rem;
		background: var(--color-error-bg, #fee);
		border: 1px solid var(--color-error, #c33);
		border-radius: 4px;
		max-width: 400px;
	}

	.retry-btn {
		padding: 0.5rem 1.5rem;
		background: var(--color-primary);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	.retry-btn:hover {
		opacity: 0.9;
	}
</style>
