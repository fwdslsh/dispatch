<script>
	/**
	 * SessionCard Component
	 * Card for displaying session information with status
	 */
	import { IconRobot, IconTerminal2, IconFolder } from '@tabler/icons-svelte';

	// Props
	let {
		session = {},
		selected = false,
		augmented = 'tl-clip br-clip both',
		onclick = undefined,
		class: customClass = '',
		...restProps
	} = $props();

	// Get workspace display name
	function getWorkspaceName(path) {
		if (!path) return 'root';
		return path.split('/').pop() || 'root';
	}
</script>

<button
	type="button"
	class="session-card {customClass}"
	class:selected
	data-augmented-ui={augmented}
	{onclick}
	{...restProps}
>
	<div class="session-header">
		<div class="session-type-badge">
			<span class="type-icon">
				{#if session.type === 'claude'}
					<IconRobot size={16} />
				{:else}
					<IconTerminal2 size={16} />
				{/if}
			</span>
			<span class="type-text">{session.type?.toUpperCase() || 'SESSION'}</span>
		</div>
		<div class="session-status">
			<span class="status-dot"></span>
			<span class="status-text">ACTIVE</span>
		</div>
	</div>
	<div class="session-content">
		<div class="session-title">{session.title || `${session.type} Session`}</div>
		<div class="session-workspace">
			<span class="workspace-icon-small"><IconFolder size={14} /></span>
			<span>{getWorkspaceName(session.workspacePath)}</span>
		</div>
	</div>
</button>

<style>
	/* Use CSS utility classes from retro.css */
	.session-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.75rem;
		position: relative;
		z-index: 1;
	}

	.session-type-badge {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		color: var(--bg);
		padding: 0.4rem 0.75rem;
		border: 1px solid var(--primary);
		border-radius: 0;
		box-shadow:
			0 0 10px rgba(46, 230, 107, 0.3),
			inset 0 1px 0 rgba(255, 255, 255, 0.2);
	}

	.session-type-badge .type-icon {
		font-size: 0.9em;
		filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.3));
	}

	.session-type-badge .type-text {
		font-size: 0.7rem;
		font-weight: 700;
		font-family: var(--font-mono);
		letter-spacing: 0.05em;
		text-shadow: 0 0 4px rgba(0, 0, 0, 0.3);
	}

	.session-status {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.7rem;
		font-weight: 700;
		font-family: var(--font-mono);
		color: var(--primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.status-dot {
		width: 6px;
		height: 6px;
		background: var(--primary);
		border-radius: 50%;
		box-shadow: 0 0 8px rgba(46, 230, 107, 0.6);
		animation: pulse-dot 2s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%,
		100% {
			box-shadow: 0 0 8px rgba(46, 230, 107, 0.6);
		}
		50% {
			box-shadow: 0 0 15px rgba(46, 230, 107, 0.9);
		}
	}

	.session-content {
		position: relative;
		z-index: 1;
	}

	.session-title {
		font-weight: 700;
		color: var(--text);
		margin-bottom: 0.5rem;
		font-family: var(--font-mono);
		font-size: 1rem;
		text-shadow: 0 0 6px rgba(46, 230, 107, 0.2);
	}

	.session-workspace {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-family: var(--font-mono);
		font-size: 0.8rem;
		color: var(--text-muted);
		opacity: 0.9;
		font-weight: 600;
	}

	.workspace-icon-small {
		font-size: 0.9em;
		color: var(--primary);
		filter: drop-shadow(0 0 4px rgba(46, 230, 107, 0.3));
	}
</style>
