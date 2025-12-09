<!--
	SessionHeader.svelte

	Session header component with status, info, and controls
	Displays session type, ID, project name, and close button
-->
<script>
	import IconButton from '../IconButton.svelte';
	import IconX from '../Icons/IconX.svelte';

	// Props
	let { session, onClose = () => {}, index: _index = 0 } = $props();

	// Session display info
	const sessionId = $derived(session.id?.slice(0, 6) || 'unknown');
	const _sessionType = $derived(
		(session.type || session.sessionType) === 'claude' ? 'Claude' : 'Terminal'
	);
	const statusDotClass = $derived(`status-dot ${session.type || session.sessionType}`);

	function handleClose(e) {
		e.stopPropagation?.();
		onClose(session.id);
	}
</script>

<div class="session-header">
	<div class="session-status">
		<span class={statusDotClass}></span>
	</div>

	<div class="session-info">
		<span class="session-id">#{sessionId}</span>
		{#if session.projectName}
			<span class="project-name" title={session.projectName}>
				{session.projectName}
			</span>
		{/if}
	</div>

	<IconButton
		onclick={handleClose}
		title="Close tab"
		aria-label="Close tab"
		variant="danger"
		size="small"
	>
		<IconX size={12} />
	</IconButton>
</div>

<style>
	.session-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-2) var(--space-3);
		background: var(--bg-panel);
		border-bottom: 1px solid var(--primary-dim);
		min-height: 48px;
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
		border-radius: var(--radius-full);
		background: var(--accent-green);
		box-shadow: 0 0 8px color-mix(in oklab, var(--accent-green) 60%, transparent);
		animation: statusPulse 2s ease-in-out infinite;
	}

	.status-dot.claude {
		background: var(--primary);
		box-shadow: 0 0 8px var(--primary-glow);
	}

	.status-dot.pty {
		background: var(--accent-amber);
		box-shadow: 0 0 8px color-mix(in oklab, var(--accent-amber) 60%, transparent);
	}

	.session-info {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.session-id {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--text-muted);
		background: var(--surface-hover);
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		border: 1px solid var(--surface-border);
	}

	.project-name {
		font-family: var(--font-sans);
		font-size: var(--font-size-1);
		color: var(--text);
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
		min-width: 80px;
		max-width: 100%;
	}

	/* Mobile adjustments */
	@media (max-width: 800px) {
		.session-header {
			min-height: 44px;
			gap: var(--space-2);
		}

		.project-name {
			font-size: var(--font-size-1);
			min-width: 60px;
		}
	}

	/* Animation for status dot */
	@keyframes statusPulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.6;
		}
	}
</style>
