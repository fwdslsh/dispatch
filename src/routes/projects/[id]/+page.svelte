<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Container from '$lib/shared/components/Container.svelte';
	import HeaderToolbar from '$lib/shared/components/HeaderToolbar.svelte';
	import BackIcon from '$lib/shared/components/Icons/BackIcon.svelte';
	import SessionTypeSelector from '$lib/sessions/components/SessionTypeSelector.svelte';
	import CollapsibleSessionSidebar from '$lib/sessions/components/CollapsibleSessionSidebar.svelte';
	import { SessionsViewModel } from '$lib/sessions/components/SessionsViewModel.svelte.js';
	import { ClaudeSessionViewModel } from '$lib/session-types/claude/components/ClaudeSessionViewModel.svelte.js';
	
	let { data } = $props();
	const projectId = $derived(page.params.id);
	let sessionType = $state('shell');
	let hasActiveSession = $state(false);
	let sidebarCollapsed = $state(false);

	const project = $derived(
		data?.project || data?.projects?.find((p) => p.id === projectId) || { name: 'Unknown Project' }
	);

	// Initialize ViewModels for proper MVVM architecture
	let sessionsViewModel = $state(null);
	let claudeSessionViewModel = $state(null);

	onMount(() => {
		// Initialize ViewModels - they handle all socket/client logic internally
		sessionsViewModel = new SessionsViewModel();
		claudeSessionViewModel = new ClaudeSessionViewModel(projectId);
		
		// Load sessions from the project data instead of making redundant server calls
		// The ViewModels will handle server communication when needed
		if (project.sessions) {
			sessionsViewModel.sessions = project.sessions;
			sessionsViewModel.activeSessions = project.sessions.filter(s => s.status === 'active');
		}
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

	async function handleAttachToSession(sessionId) {
		if (!sessionsViewModel) return;
		
		const session = project.sessions?.find(s => s.id === sessionId);
		if (!session) {
			console.error('Session not found:', sessionId);
			return;
		}

		try {
			const sessionMode = session.type || session.mode || 'shell';
			if (sessionMode === 'claude') {
				// For Claude sessions, use the ClaudeSessionViewModel
				sessionType = 'claude';
				hasActiveSession = true;
				// The ViewModel will handle the actual session connection
			} else {
				// For shell sessions, use the SessionsViewModel
				await sessionsViewModel.attachToSession(sessionId, { cols: 80, rows: 24 });
				sessionType = 'shell';
				hasActiveSession = true;
			}
		} catch (error) {
			console.error('Failed to attach to session:', error);
		}
	}

	async function handleEndSession(sessionId) {
		if (!sessionsViewModel) return;

		const session = project.sessions?.find(s => s.id === sessionId);
		if (!session) {
			console.error('Session not found:', sessionId);
			return;
		}

		try {
			const sessionMode = session.type || session.mode || 'shell';
			if (sessionMode === 'claude') {
				// For Claude sessions, use the ClaudeSessionViewModel
				if (claudeSessionViewModel) {
					await claudeSessionViewModel.endSession();
				}
			} else {
				// For shell sessions, use the SessionsViewModel
				await sessionsViewModel.endSession(sessionId);
			}
		} catch (error) {
			console.error('Failed to end session:', error);
			// Even if ending fails, we should remove the session from the UI if it doesn't exist on server
			if (error.message.includes('not found')) {
				// Remove the session from local state since it doesn't exist on server
				sessionsViewModel.sessions = sessionsViewModel.sessions.filter(s => s.id !== sessionId);
				sessionsViewModel.activeSessions = sessionsViewModel.activeSessions.filter(s => s.id !== sessionId);
			}
		}
		
		// Always refresh the sessions list to sync with server state
		try {
			await sessionsViewModel.refreshSessions();
		} catch (refreshError) {
			console.error('Failed to refresh sessions:', refreshError);
		}
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
		<div class="project-layout">
			<!-- Sidebar -->
			<CollapsibleSessionSidebar
				sessions={sessionsViewModel?.sessions || project.sessions || []}
				activeSessionId={sessionsViewModel?.currentSession?.id || null}
				onAttach={handleAttachToSession}
				onEnd={handleEndSession}
				bind:isCollapsed={sidebarCollapsed}
			/>

			<!-- Main Content -->
			<main class="main-content">
				<!-- Session Management -->
				{#if !hasActiveSession}
					<div class="content-section">
						<div class="content-section__header">
							<h2>Choose Session Type</h2>
						</div>
						<div class="session-type-grid">
							<div
								class="session-type-card session-type-card--shell"
								onclick={startShellSession}
								role="button"
								tabindex="0"
							>
								<div class="session-type-card__icon">🖥️</div>
								<h3 class="session-type-card__title">Shell Terminal</h3>
								<p class="session-type-card__description">Interactive command line interface</p>
							</div>

							<div
								class="session-type-card session-type-card--claude"
								onclick={startClaudeSession}
								role="button"
								tabindex="0"
							>
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
			</main>
		</div>
	{/snippet}
</Container>

<style>
	.project-layout {
		display: flex;
		height: calc(100vh - 120px);
		min-height: 0;
	}

	.main-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		overflow: hidden;
	}

	.session-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		container-type: inline-size;
	}

	.session-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	/* Mobile responsive adjustments */
	@media (max-width: 768px) {
		.project-layout {
			height: calc(100vh - 80px);
		}
	}
</style>
