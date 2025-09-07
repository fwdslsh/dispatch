<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Container from '$lib/shared/components/Container.svelte';
	import HeaderToolbar from '$lib/shared/components/HeaderToolbar.svelte';
	import BackIcon from '$lib/shared/components/Icons/BackIcon.svelte';
	import SessionTypeSelector from '$lib/sessions/components/SessionTypeSelector.svelte';
	import SessionList from '$lib/sessions/components/SessionList.svelte';
	import { SessionsViewModel } from '$lib/sessions/components/SessionsViewModel.svelte.js';

	let {data} = $props();
	const projectId = $derived(page.params.id);
	let sessionType = $state('shell');
	let hasActiveSession = $state(false);

	const sessionsVM = new SessionsViewModel();
	
	// Filter sessions for current project
	const projectSessions = $derived(() => {
		const filtered = sessionsVM.sessions.filter(session => session.projectId === projectId);
		console.log(`[PROJECT-PAGE] All sessions: ${sessionsVM.sessions.length}, Project sessions for ${projectId}: ${filtered.length}`);
		console.log('[PROJECT-PAGE] First few sessions:', sessionsVM.sessions.slice(0, 3));
		console.log('[PROJECT-PAGE] Filtered project sessions:', filtered.slice(0, 3));
		return filtered;
	});
	const project = $derived(data?.project || data?.projects?.find(p => p.id === projectId) || { name: 'Unknown Project' });
	// Load sessions once on mount
	onMount(() => {
		console.log(`[PROJECT-PAGE] Loading sessions for project: ${projectId}`);
		sessionsVM.loadSessions();
	});

	function handleBack() {
		goto('/projects');
	}

	function handleSessionCreated(event) {
		console.log('Session created:', event);
		hasActiveSession = true;
	}

	function handleSessionEnded(event) {
		console.log('Session ended:', event);
		hasActiveSession = false;
	}

	function startShellSession() {
		sessionType = 'shell';
		hasActiveSession = true;
	}

	function startClaudeSession() {
		sessionType = 'claude';
		hasActiveSession = true;
	}

	function endSession() {
		hasActiveSession = false;
	}
</script>

<Container>
	{#snippet header()}
		<HeaderToolbar>
			{#snippet left()}
				<button
					class="btn-icon-only"
					onclick={handleBack}
					title="Back to Projects"
					aria-label="Back to Projects"
				>
					<BackIcon />
					Back to Projects
				</button>
			{/snippet}
			{#snippet right()}
				<h2>Project {project.name}</h2>
			{/snippet}
		</HeaderToolbar>
	{/snippet}

	{#snippet children()}
		<!-- Existing Sessions -->
		<div class="sessions-section">
			<SessionList 
				sessions={project.sessions} 
				onAttach={(sessionId) => sessionsVM.attachToSession(sessionId)} 
				onEnd={(sessionId) => sessionsVM.endSession(sessionId)} 
			/>
		</div>

		<!-- Session Management -->
		{#if !hasActiveSession}
			<div class="session-selection">
				<h2>Choose Session Type</h2>
				<div class="session-buttons">
					<button onclick={startShellSession} class="session-btn shell">
						<div class="session-icon">🖥️</div>
						<h3>Shell Terminal</h3>
						<p>Interactive command line interface</p>
					</button>

					<button onclick={startClaudeSession} class="session-btn claude">
						<div class="session-icon">🤖</div>
						<h3>Claude AI</h3>
						<p>AI-powered coding assistant</p>
					</button>
				</div>
			</div>
		{:else}
			<!-- Active Session -->
			<div class="session-container">
				<div class="session-header">
					<h3>
						{sessionType === 'shell' ? '🖥️ Shell Terminal' : '🤖 Claude AI'}
					</h3>
					<button onclick={endSession} class="end-session-btn"> End Session </button>
				</div>

				<div class="session-content">
					<SessionTypeSelector
						{sessionType}
						{projectId}
						onSessionCreated={handleSessionCreated}
						onSessionEnded={handleSessionEnded}
					/>
				</div>
			</div>
		{/if}
	{/snippet}
</Container>

<style>
	.session-selection {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
	}

	.session-selection h2 {
		margin: 0 0 2rem 0;
		font-size: 1.75rem;
		color: var(--text-primary, #ffffff);
	}

	.session-buttons {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 1.5rem;
		max-width: 800px;
		width: 100%;
	}

	.session-btn {
		padding: 2rem;
		background: var(--surface, #1a1a1a);
		border: 2px solid var(--border, #333);
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.3s;
		text-align: center;
		color: var(--text-primary, #ffffff);
	}

	.session-btn:hover {
		border-color: var(--primary, #00d4ff);
		background: var(--surface-hover, #252525);
		transform: translateY(-2px);
	}

	.session-btn.shell:hover {
		border-color: var(--success, #00ff88);
		box-shadow: 0 4px 20px rgba(0, 255, 136, 0.2);
	}

	.session-btn.claude:hover {
		border-color: var(--primary, #00d4ff);
		box-shadow: 0 4px 20px rgba(0, 212, 255, 0.2);
	}

	.session-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.session-btn h3 {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
	}

	.session-btn p {
		margin: 0;
		color: var(--text-secondary, #aaa);
		font-size: 0.875rem;
	}

	.session-container {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 120px);
	}

	.session-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 2rem;
		background: var(--surface, #1a1a1a);
		border-bottom: 1px solid var(--border, #333);
	}

	.session-header h3 {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text-primary, #ffffff);
	}

	.end-session-btn {
		padding: 0.5rem 1rem;
		background: var(--error, #ff4444);
		border: none;
		color: white;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.875rem;
		transition: background 0.2s;
	}

	.end-session-btn:hover {
		background: var(--error-hover, #ff6666);
	}

	.session-content {
		flex: 1;
		display: flex;
		flex-direction: column;
	}

	/* Mobile responsive */
	.sessions-section {
		padding: 1rem 2rem;
		border-bottom: 1px solid var(--border, #333);
	}

	@media (max-width: 768px) {
		.session-buttons {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.session-btn {
			padding: 1.5rem;
		}

		.session-header {
			padding: 0.75rem 1rem;
			flex-direction: column;
			gap: 0.75rem;
			align-items: stretch;
		}

		.session-selection {
			padding: 1rem;
		}

		.sessions-section {
			padding: 1rem;
		}
	}
</style>