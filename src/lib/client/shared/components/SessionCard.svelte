<script>
	import Button from './Button.svelte';
	import IconClaude from './Icons/IconClaude.svelte';
	import IconTerminal from './Icons/IconTerminal.svelte';

	// Props
	let {
		session,
		selectedSession = null,
		onSelect,
		onAction,
		actionLabel = 'Connect',
		formatDate,
		isActive = false
	} = $props();

	// Handle session selection
	function handleSelect() {
		onSelect?.(session);
	}

	// Handle action button click
	function handleAction(e) {
		e.stopPropagation();
		onAction?.(session);
	}

	// Handle keyboard navigation
	function handleKeydown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleSelect();
		}
	}

	const sessionId = $derived(`#${session.id?.slice(0, 6) || 'unknown'}`);
</script>

<div
	class="session-card {isActive ? 'active-session' : 'inactive-session'} {selectedSession ===
	session.id
		? 'selected'
		: ''}"
	onclick={handleSelect}
	role="button"
	tabindex="0"
	onkeydown={handleKeydown}
>
	<div class="session-header">
		<div class="session-type-icon">
			{#if session.type === 'claude'}
				<IconClaude size={16} />
			{:else}
				<IconTerminal size={16} />
			{/if}
		</div>
		<div class="session-info">
			<div class="session-title">{session.title} ({sessionId})</div>
			<div class="session-meta">
				<span class="session-workspace" title={session.workspacePath}>
					{session.workspacePath}
				</span>
				<span class="session-date">{formatDate(session.lastActivity)}</span>
			</div>
		</div>
		<Button variant="ghost" augmented="none" onclick={handleAction} class="action-button">
			{actionLabel}
		</Button>
	</div>
</div>

<style>
	/* Unified Session Cards */
	.session-card {
		background: var(--bg);
		min-height: 100px;
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		padding: var(--space-4);
		transition: all 0.2s ease;
		cursor: pointer;
		margin-bottom: var(--space-2);
		outline: none;
		width: 100%;
		position: relative;
		overflow: hidden;
	}

	.session-card:hover {
		border-color: var(--primary-dim);
		background: var(--bg-light);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px color-mix(in oklab, var(--bg) 90%, black 10%);
	}

	.session-card:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-glow-20);
	}

	.session-card.selected {
		border-color: var(--primary);
		background: color-mix(in oklab, var(--primary) 5%, transparent);
		box-shadow: 0 0 0 1px var(--primary-glow-20);
	}

	.session-card.active-session {
		border-color: var(--success);
		background: color-mix(in oklab, var(--success) 5%, transparent);
		box-shadow: 0 0 0 1px color-mix(in oklab, var(--success) 10%, transparent);
	}

	.session-card.active-session:hover {
		background: color-mix(in oklab, var(--success) 10%, transparent);
		box-shadow: 0 2px 12px color-mix(in oklab, var(--success) 20%, transparent);
	}

	.session-card.active-session.selected {
		border-color: var(--success);
		background: color-mix(in oklab, var(--success) 15%, transparent);
		box-shadow: 0 0 0 2px color-mix(in oklab, var(--success) 30%, transparent);
	}

	.session-card.inactive-session {
		border-color: var(--surface-border);
		opacity: 0.9;
	}

	.session-card.inactive-session:hover {
		opacity: 1;
	}

	.session-card.inactive-session.selected {
		border-color: var(--primary);
		background: color-mix(in oklab, var(--primary) 5%, transparent);
		opacity: 1;
	}

	.session-header {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}

	.session-type-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		color: var(--primary);
		flex-shrink: 0;
	}

	.session-info {
		flex: 1;
		min-width: 0;
		overflow: hidden;
	}

	.session-title {
		font-weight: 600;
		color: var(--text);
		font-size: 1rem;
		margin-bottom: var(--space-1);
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 1.5rem;
		line-height: 1.5;
	}

	.session-meta {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: 0.8rem;
		min-height: 2.5rem;
	}

	.session-workspace {
		color: var(--text-muted);
		font-family: var(--font-mono);
		font-size: 0.75rem;
		word-break: break-all;
		line-height: 1.3;
		max-width: 100%;
		display: block;
	}

	.session-date {
		color: var(--text-dim);
		font-size: 0.7rem;
		flex-shrink: 0;
	}
</style>
