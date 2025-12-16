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

			// Try to fetch existing session
			if (opencodeSessionId) {
				const response = await fetch(`/api/opencode/sessions/${opencodeSessionId}`);
				if (response.ok) {
					session = await response.json();
					return;
				}
			}

			// If no existing session, create a new one
			const createResponse = await fetch('/api/opencode/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					provider: provider || 'anthropic',
					model: model || 'claude-sonnet-4',
					workspacePath
				})
			});

			if (!createResponse.ok) {
				throw new Error(`Failed to create session: ${createResponse.statusText}`);
			}

			session = await createResponse.json();
		} catch (err) {
			error = err.message;
			console.error('Failed to load/create OpenCode session:', err);
		} finally {
			loading = false;
		}
	}

	async function sendPrompt(sessionId, prompt) {
		try {
			const response = await fetch(`/api/opencode/sessions/${sessionId}/prompt`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt })
			});

			if (!response.ok) {
				throw new Error(`Failed to send prompt: ${response.statusText}`);
			}

			return await response.json();
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
