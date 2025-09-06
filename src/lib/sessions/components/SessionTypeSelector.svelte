<!-- 
  SessionTypeSelector - Simple component that selects which session type to render
  
  Much simpler than complex registration systems - just renders the appropriate component.
-->
<script>
	import ShellSession from '../../session-types/shell/components/ShellSession.svelte';
	import ClaudeSession from '../../session-types/claude/components/ClaudeSession.svelte';

	let {
		sessionType = 'shell',
		projectId,
		sessionOptions = {},
		onSessionCreated,
		onSessionEnded
	} = $props();
</script>

{#if sessionType === 'shell'}
	<ShellSession {projectId} {sessionOptions} {onSessionCreated} {onSessionEnded} />
{:else if sessionType === 'claude'}
	<ClaudeSession {projectId} {sessionOptions} {onSessionCreated} {onSessionEnded} />
{:else}
	<div class="error">
		Unknown session type: {sessionType}
	</div>
{/if}

<style>
	.error {
		padding: 1rem;
		background: var(--error-bg, #fee);
		color: var(--error-text, #c00);
		border: 1px solid var(--error-border, #fcc);
		border-radius: 4px;
	}
</style>
