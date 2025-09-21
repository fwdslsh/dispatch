<!--
	ClaudeHeader.svelte

	Custom header component for Claude sessions
	Adds Claude-specific controls and status indicators
-->
<script>
	import IconButton from '../IconButton.svelte';
	import IconX from '../Icons/IconX.svelte';
	import IconInfoCircle from '../Icons/IconInfoCircle.svelte';

	// Props
	let { session, onClose = () => {}, index = 0, claudeSessionId = null } = $props();

	// Session display info
	const sessionId = $derived(session.id?.slice(0, 6) || 'unknown');
	const statusDotClass = $derived(`status-dot ${session.type || session.sessionType}`);

	function handleClose(e) {
		e.stopPropagation?.();
		onClose(session.id);
	}

	function handleClaudeInfo() {
		// Example custom action for Claude sessions
		console.log('Claude session info:', { sessionId: session.id, claudeSessionId });
	}
</script>

<div class="claude-header">
	<div class="session-status">
		<span class={statusDotClass}></span>
		<span class="claude-badge">Claude</span>
	</div>

	<div class="session-info">
		<span class="session-id">#{sessionId}</span>
		{#if claudeSessionId}
			<span class="claude-session-id" title="Claude Session ID">
				Claude: {claudeSessionId.slice(0, 8)}...
			</span>
		{/if}
		{#if session.projectName}
			<span class="project-name">{session.projectName}</span>
		{/if}
	</div>

	<div class="claude-actions">
		<IconButton
			onclick={handleClaudeInfo}
			title="Claude session info"
			aria-label="Claude session info"
			variant="neutral"
			size="small"
		>
			<IconInfoCircle size={12} />
		</IconButton>
		
		<IconButton
			onclick={handleClose}
			title="Close session"
			aria-label="Close session"
			variant="danger"
			size="small"
		>
			<IconX size={12} />
		</IconButton>
	</div>
</div>

<style>
	.claude-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-inline: var(--space-3);
		background: var(--bg-panel);
		border-bottom: 1px solid var(--primary-dim);
		min-height: 44px;
		flex-shrink: 0;
		gap: var(--space-3);
	}

	.session-status {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--primary);
		box-shadow: 0 0 8px var(--primary-glow);
	}

	.claude-badge {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--primary);
		background: color-mix(in oklab, var(--primary) 15%, transparent);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid var(--primary-dim);
		font-weight: 500;
	}

	.session-info {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1;
		min-width: 0;
	}

	.session-id {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--text-muted);
		background: var(--surface-hover);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid var(--surface-border);
	}

	.claude-session-id {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--primary);
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid var(--primary-dim);
	}

	.project-name {
		font-family: var(--font-sans);
		font-size: var(--font-size-1);
		color: var(--text);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 120px;
	}

	.claude-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.claude-header {
			padding: var(--space-2) var(--space-3);
			min-height: 40px;
		}

		.project-name {
			max-width: 100px;
			font-size: var(--font-size-0);
		}

		.claude-session-id {
			display: none; /* Hide on mobile for space */
		}
	}
</style>