<!-- 
  SessionTypeSelector - Simple component that selects which session type to render
  
  Uses dynamic imports to avoid SSR issues with xterm dependencies.
-->
<script>
	import { onMount } from 'svelte';

	let {
		sessionType = 'shell',
		projectId,
		sessionOptions = {},
		onSessionCreated,
		onSessionEnded
	} = $props();

	let ShellSession = $state(null);
	let ClaudeSession = $state(null);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			if (sessionType === 'shell') {
				const module = await import('../../session-types/shell/components/ShellSession.svelte');
				ShellSession = module.default;
			} else if (sessionType === 'claude') {
				const module = await import('../../session-types/claude/components/ClaudeSession.svelte');
				ClaudeSession = module.default;
			}
		} catch (error) {
			console.error('Error loading session component:', error);
		} finally {
			isLoading = false;
		}
	});
</script>

{#if isLoading}
	<div class="loading">
		<p>Loading {sessionType} session...</p>
	</div>
{:else if sessionType === 'shell' && ShellSession}
	<svelte:component
		this={ShellSession}
		{projectId}
		{sessionOptions}
		{onSessionCreated}
		{onSessionEnded}
	/>
{:else if sessionType === 'claude' && ClaudeSession}
	<svelte:component
		this={ClaudeSession}
		{projectId}
		{sessionOptions}
		{onSessionCreated}
		{onSessionEnded}
	/>
{:else}
	<div class="error">
		{#if !ShellSession && !ClaudeSession}
			Failed to load {sessionType} session component
		{:else}
			Unknown session type: {sessionType}
		{/if}
	</div>
{/if}

<style>
	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		text-align: center;
		color: var(--text-primary, #fff);
	}

	.error {
		padding: 1rem;
		background: var(--error-bg, #fee);
		color: var(--error-text, #c00);
		border: 1px solid var(--error-border, #fcc);
		border-radius: 4px;
	}
</style>
