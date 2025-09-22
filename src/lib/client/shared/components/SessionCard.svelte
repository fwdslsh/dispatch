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
	class="card-base card-session interactive {isActive ? 'is-active' : 'is-inactive'} {selectedSession === session.id ? 'is-selected' : ''}"
	onclick={handleSelect}
	role="button"
	tabindex="0"
	onkeydown={handleKeydown}
>
	<div class="header-layout">
		<div class="icon-container">
			{#if session.type === 'claude'}
				<IconClaude size={16} />
			{:else}
				<IconTerminal size={16} />
			{/if}
		</div>
		<div class="info-section">
			<div class="title-text">{session.title} ({sessionId})</div>
			<div class="meta-text">
				<span class="workspace-path" title={session.workspacePath}>
					{session.workspacePath}
				</span>
				<span class="date-text">{formatDate(session.lastActivity)}</span>
			</div>
		</div>
		<Button variant="ghost" augmented="none" onclick={handleAction} class="action-button">
			{actionLabel}
		</Button>
	</div>
</div>

<style>
	/* Component-specific overrides only */
	.action-button {
		margin-left: auto;
		flex-shrink: 0;
	}
	
	.icon-container {
		color: var(--primary);
	}
	
	.meta-text {
		flex-direction: column;
		gap: var(--space-1);
		font-size: 0.8rem;
		min-height: 2.5rem;
	}
	
	.workspace-path {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		word-break: break-all;
		line-height: 1.3;
		max-width: 100%;
		display: block;
		color: var(--text-muted);
	}
	
	.date-text {
		color: var(--text-dim);
		font-size: 0.7rem;
	}
	
	.title-text {
		font-size: 1rem;
		min-height: 1.5rem;
		line-height: 1.5;
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
</style>
