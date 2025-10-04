<!--
	SessionHeader.svelte

	Session header component with status, info, and controls
	Displays session type, ID, project name, and close button
-->
<script>
	import IconButton from '../IconButton.svelte';
	import IconX from '../Icons/IconX.svelte';

	// Props
	let { session, onClose = () => {}, index = 0 } = $props();

	// Session display info
	const sessionId = $derived(session.id?.slice(0, 6) || 'unknown');
	const sessionType = $derived(
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
			<span class="project-name">{session.projectName}</span>
		{/if}
	</div>

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

<style>
	.session-header {
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
		max-width: 120px;
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.session-header {
			padding: var(--space-2) var(--space-3);
			min-height: 40px;
		}

		.project-name {
			max-width: 100px;
			font-size: var(--font-size-0);
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
