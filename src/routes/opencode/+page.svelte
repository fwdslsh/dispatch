<script>
	import { onMount } from 'svelte';
	import ServerStatus from '$lib/client/opencode/ServerStatus.svelte';
	import SessionManager from '$lib/client/opencode/SessionManager.svelte';
	import PromptComposer from '$lib/client/opencode/PromptComposer.svelte';

	let serverStatus = $state(null);
	let sessions = $state([]);
	let selectedSession = $state(null);
	let loading = $state(true);
	let error = $state(null);

	async function loadServerStatus() {
		try {
			const response = await fetch('/api/opencode');
			if (!response.ok) throw new Error(`Failed to load server status: ${response.statusText}`);
			serverStatus = await response.json();
		} catch (err) {
			error = err.message;
			console.error('Failed to load OpenCode server status:', err);
		}
	}

	async function loadSessions() {
		try {
			const response = await fetch('/api/opencode/sessions');
			if (!response.ok) throw new Error(`Failed to load sessions: ${response.statusText}`);
			const data = await response.json();
			sessions = data.sessions || [];
		} catch (err) {
			error = err.message;
			console.error('Failed to load OpenCode sessions:', err);
		} finally {
			loading = false;
		}
	}

	async function createSession(provider, model) {
		try {
			const response = await fetch('/api/opencode/sessions', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ provider, model })
			});
			if (!response.ok) throw new Error(`Failed to create session: ${response.statusText}`);
			const newSession = await response.json();
			sessions = [...sessions, newSession];
			selectedSession = newSession;
		} catch (err) {
			error = err.message;
			console.error('Failed to create session:', err);
		}
	}

	async function deleteSession(sessionId) {
		try {
			const response = await fetch(`/api/opencode/sessions/${sessionId}`, {
				method: 'DELETE'
			});
			if (!response.ok) throw new Error(`Failed to delete session: ${response.statusText}`);
			sessions = sessions.filter((s) => s.id !== sessionId);
			if (selectedSession?.id === sessionId) {
				selectedSession = null;
			}
		} catch (err) {
			error = err.message;
			console.error('Failed to delete session:', err);
		}
	}

	async function sendPrompt(sessionId, prompt) {
		try {
			const response = await fetch(`/api/opencode/sessions/${sessionId}/prompt`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ prompt })
			});
			if (!response.ok) throw new Error(`Failed to send prompt: ${response.statusText}`);
			return await response.json();
		} catch (err) {
			error = err.message;
			console.error('Failed to send prompt:', err);
			throw err;
		}
	}

	onMount(async () => {
		await Promise.all([loadServerStatus(), loadSessions()]);
	});
</script>

<div class="opencode-portal">
	<header class="portal-header">
		<h1>OpenCode Portal</h1>
		<p class="subtitle">AI-powered development sessions via OpenCode</p>
	</header>

	{#if error}
		<div class="error-banner">
			<strong>Error:</strong>
			{error}
		</div>
	{/if}

	<div class="portal-grid">
		<!-- Server Status Section -->
		<section class="status-section">
			<h2>Server Status</h2>
			{#if serverStatus}
				<ServerStatus status={serverStatus} onRefresh={loadServerStatus} />
			{:else}
				<p class="loading">Loading server status...</p>
			{/if}
		</section>

		<!-- Session Management Section -->
		<section class="sessions-section">
			<h2>Sessions</h2>
			{#if loading}
				<p class="loading">Loading sessions...</p>
			{:else}
				<SessionManager
					{sessions}
					{selectedSession}
					onSelect={(session) => (selectedSession = session)}
					onCreate={createSession}
					onDelete={deleteSession}
				/>
			{/if}
		</section>

		<!-- Prompt Composer Section -->
		{#if selectedSession}
			<section class="composer-section">
				<h2>Prompt Composer - {selectedSession.name || selectedSession.id}</h2>
				<PromptComposer session={selectedSession} onSendPrompt={sendPrompt} />
			</section>
		{:else}
			<section class="composer-section empty">
				<p class="placeholder">Select a session or create a new one to start prompting</p>
			</section>
		{/if}
	</div>
</div>

<style>
	.opencode-portal {
		padding: 2rem;
		max-width: 1400px;
		margin: 0 auto;
		min-height: 100vh;
		background: var(--color-background);
		color: var(--color-text);
	}

	.portal-header {
		margin-bottom: 2rem;
		border-bottom: 2px solid var(--color-border);
		padding-bottom: 1rem;
	}

	.portal-header h1 {
		margin: 0;
		font-size: 2rem;
		color: var(--color-primary);
	}

	.subtitle {
		margin: 0.5rem 0 0;
		color: var(--color-text-muted);
	}

	.error-banner {
		background: var(--color-error-bg, #fee);
		border: 1px solid var(--color-error, #c33);
		color: var(--color-error, #c33);
		padding: 1rem;
		border-radius: 4px;
		margin-bottom: 1rem;
	}

	.portal-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		grid-template-areas:
			'status sessions'
			'composer composer';
	}

	.status-section {
		grid-area: status;
	}

	.sessions-section {
		grid-area: sessions;
	}

	.composer-section {
		grid-area: composer;
		min-height: 400px;
	}

	.composer-section.empty {
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--color-surface);
		border: 2px dashed var(--color-border);
		border-radius: 8px;
	}

	section {
		background: var(--color-surface);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.5rem;
	}

	section h2 {
		margin: 0 0 1rem 0;
		font-size: 1.25rem;
		color: var(--color-text);
	}

	.loading,
	.placeholder {
		color: var(--color-text-muted);
		font-style: italic;
		text-align: center;
		padding: 2rem;
	}

	@media (max-width: 900px) {
		.portal-grid {
			grid-template-columns: 1fr;
			grid-template-areas:
				'status'
				'sessions'
				'composer';
		}
	}
</style>
