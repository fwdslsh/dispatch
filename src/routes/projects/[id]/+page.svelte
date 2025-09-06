<!-- 
  Project Page - Simplified Session Interface
  
  Uses the new SessionTypeSelector for clean session type selection.
  Much simpler than the previous complex ViewModel approach.
-->

<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';

	// Simplified session selector
	import SessionTypeSelector from '$lib/sessions/components/SessionTypeSelector.svelte';
	import BackIcon from '$lib/shared/components/Icons/BackIcon.svelte';

	const projectId = $derived(page.params.id);

	// Simple state
	let sessionType = $state('shell'); // 'shell' or 'claude'
	let currentProject = $state(null);
	let hasActiveSession = $state(false);

	onMount(async () => {
		// Load project info (simplified)
		try {
			// This would typically fetch from an API or local storage
			currentProject = {
				id: projectId,
				name: `Project ${projectId}`,
				description: 'Development project'
			};
		} catch (error) {
			console.error('Error loading project:', error);
		}
	});

	function handleSessionCreated(event) {
		console.log('Session created:', event);
		hasActiveSession = true;
	}

	function handleSessionEnded(event) {
		console.log('Session ended:', event);
		hasActiveSession = false;
	}

	function handleBack() {
		goto('/projects');
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

<div class="project-page">
	<!-- Header -->
	<header class="project-header">
		<button onclick={handleBack} class="back-button">
			<BackIcon />
			Back to Projects
		</button>

		{#if currentProject}
			<div class="project-info">
				<h1>{currentProject.name}</h1>
				<p>{currentProject.description}</p>
			</div>
		{/if}
	</header>

	<!-- Session Selection or Active Session -->
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
</div>

<style>
	.project-page {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: var(--bg-dark, #0a0a0a);
		color: var(--text-primary, #ffffff);
	}

	.project-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 2rem;
		background: var(--surface, #1a1a1a);
		border-bottom: 1px solid var(--border, #333);
	}

	.back-button {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--surface-variant, #2a2a2a);
		border: 1px solid var(--border, #333);
		color: var(--text-primary, #ffffff);
		border-radius: 6px;
		cursor: pointer;
		transition: background 0.2s;
	}

	.back-button:hover {
		background: var(--surface-hover, #3a3a3a);
	}

	.project-info h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.5rem;
		color: var(--primary, #00d4ff);
	}

	.project-info p {
		margin: 0;
		color: var(--text-secondary, #aaa);
		font-size: 0.875rem;
	}

	.session-selection {
		flex: 1;
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
		flex: 1;
		display: flex;
		flex-direction: column;
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
	@media (max-width: 768px) {
		.project-header {
			padding: 0.75rem 1rem;
			flex-direction: column;
			align-items: flex-start;
			gap: 0.75rem;
		}

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
	}
</style>
