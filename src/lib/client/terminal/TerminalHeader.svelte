<!--
	TerminalHeader.svelte

	Custom header component for Terminal sessions
	Adds terminal-specific controls and status indicators
-->
<script>
	import IconButton from '../shared/components/IconButton.svelte';
	import IconX from '../shared/components/Icons/IconX.svelte';
	import IconTerminal from '../shared/components/Icons/IconTerminal.svelte';

	// Props
	let { session, onClose = () => {}, index = 0, shell = 'bash' } = $props();

	// Session display info
	const sessionId = $derived(session.id?.slice(0, 6) || 'unknown');
	const statusDotClass = $derived(`status-dot ${session.type || session.sessionType}`);

	function handleClose(e) {
		e.stopPropagation?.();
		onClose(session.id);
	}

	function handleTerminalAction() {
		// Example custom action for Terminal sessions
		console.log('Terminal action:', { sessionId: session.id, shell });
	}
</script>

<div class="terminal-header">
	<div class="session-status">
		<span class={statusDotClass}></span>
		<span class="terminal-badge">
			<IconTerminal size={10} />
			Terminal
		</span>
	</div>

	<div class="session-info">
		<span class="session-id">#{sessionId}</span>
		{#if shell}
			<span class="shell-info" title="Shell: {shell}">
				{shell}
			</span>
		{/if}
		{#if session.projectName}
			<span class="project-name">{session.projectName}</span>
		{/if}
	</div>

	<div class="terminal-actions">
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
	.terminal-header {
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
		background: var(--accent-amber);
		box-shadow: 0 0 8px color-mix(in oklab, var(--accent-amber) 60%, transparent);
	}

	.terminal-badge {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--accent-amber);
		background: color-mix(in oklab, var(--accent-amber) 15%, transparent);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid color-mix(in oklab, var(--accent-amber) 30%, transparent);
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

	.shell-info {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--accent-amber);
		background: color-mix(in oklab, var(--accent-amber) 10%, transparent);
		padding: 2px 6px;
		border-radius: 4px;
		border: 1px solid color-mix(in oklab, var(--accent-amber) 30%, transparent);
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

	.terminal-actions {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.terminal-header {
			padding: var(--space-2) var(--space-3);
			min-height: 40px;
		}

		.project-name {
			max-width: 100px;
			font-size: var(--font-size-0);
		}

		.shell-info {
			display: none; /* Hide on mobile for space */
		}
	}
</style>
