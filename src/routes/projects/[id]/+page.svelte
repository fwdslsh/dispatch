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
		<div class="page-header">
			<div class="page-header__title">
				<button
					class="btn-icon-only"
					onclick={handleBack}
					title="Back to Projects"
					aria-label="Back to Projects"
				>
					<BackIcon />
					Back to Projects
				</button>
			</div>
			<div class="page-header__title">
				<h2>Project {project.name}</h2>
			</div>
		</div>
	{/snippet}

	{#snippet children()}
		<!-- Existing Sessions -->
		<div class="content-section">
			<SessionList 
				sessions={project.sessions} 
				onAttach={(sessionId) => sessionsVM.attachToSession(sessionId)} 
				onEnd={(sessionId) => sessionsVM.endSession(sessionId)} 
			/>
		</div>

		<!-- Session Management -->
		{#if !hasActiveSession}
			<div class="content-section">
				<div class="content-section__header">
					<h2>Choose Session Type</h2>
				</div>
				<div class="session-type-grid">
					<div class="session-type-card session-type-card--shell" onclick={startShellSession} role="button" tabindex="0">
						<div class="session-type-card__icon">🖥️</div>
						<h3 class="session-type-card__title">Shell Terminal</h3>
						<p class="session-type-card__description">Interactive command line interface</p>
					</div>

					<div class="session-type-card session-type-card--claude" onclick={startClaudeSession} role="button" tabindex="0">
						<div class="session-type-card__icon">🤖</div>
						<h3 class="session-type-card__title">Claude AI</h3>
						<p class="session-type-card__description">AI-powered coding assistant</p>
					</div>
				</div>
			</div>
		{:else}
			<!-- Active Session -->
			<div class="session-container">
				<div class="page-header">
					<div class="page-header__title">
						<h3>
							{sessionType === 'shell' ? '🖥️ Shell Terminal' : '🤖 Claude AI'}
						</h3>
					</div>
					<div class="page-header__actions">
						<button onclick={endSession} class="btn-danger btn-sm">End Session</button>
					</div>
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
	.session-container {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 120px);
		container-type: inline-size;
	}

	.session-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Mobile responsive adjustments */
	@container (max-width: 768px) {
		.session-container {
			height: calc(100vh - 80px);
		}
	}
</style>