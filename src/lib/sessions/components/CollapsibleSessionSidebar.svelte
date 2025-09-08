<script>
	import SessionList from './SessionList.svelte';

	let {
		sessions = [],
		activeSessionId = null,
		onAttach,
		onEnd,
		isCollapsed = $bindable(false)
	} = $props();

	function toggleCollapse() {
		isCollapsed = !isCollapsed;
	}
</script>

<aside
	class="session-sidebar"
	class:collapsed={isCollapsed}
	data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
>
	<div class="sidebar-header" data-augmented-ui="tl-clip-x tr-clip-x border">
		<h3 class="sidebar-title">Sessions</h3>
		<button
			class="collapse-btn"
			onclick={toggleCollapse}
			title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
			data-augmented-ui="tl-clip tr-clip br-clip bl-clip border"
		>
			{isCollapsed ? '▶' : '◀'}
		</button>
	</div>

	<div class="sidebar-content">
		<SessionList {sessions} {activeSessionId} {onAttach} {onEnd} />
	</div>
</aside>

<style>
	.session-sidebar {
		position: relative;
		width: 300px;
		background: var(--bg-darker, #1a1a1a);
		--aug-border-bg: var(--primary, #007acc);
		--aug-border: 2px;
		display: flex;
		flex-direction: column;
		transition: width 0.3s ease;
		overflow: hidden;
		z-index: 1;
	}

	.session-sidebar.collapsed {
		width: 50px;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		min-height: 60px;
		background: var(--surface, #2a2a2a);
		--aug-border-bg: var(--primary, #007acc);
		--aug-border: 1px;
		margin-bottom: 0.5rem;
	}

	.sidebar-title {
		margin: 0;
		font-size: 1.1rem;
		color: var(--text, #fff);
		white-space: nowrap;
		opacity: 1;
		transition: opacity 0.2s ease;
		overflow: hidden;
	}

	.collapsed .sidebar-title {
		opacity: 0;
		pointer-events: none;
		width: 0;
	}

	.collapse-btn {
		background: var(--bg-darker, #1a1a1a);
		border: none;
		color: var(--text-secondary, #999);
		cursor: pointer;
		padding: 0.5rem;
		transition:
			background-color 0.2s ease,
			color 0.2s ease;
		font-size: 1rem;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		--aug-border-bg: var(--border, #333);
		--aug-border: 1px;
	}

	.collapse-btn:hover {
		background: var(--surface, #333);
		color: var(--text, #fff);
		--aug-border-bg: var(--primary, #007acc);
	}

	.sidebar-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		transition: opacity 0.3s ease;
	}

	.collapsed .sidebar-content {
		opacity: 0;
		pointer-events: none;
		padding: 0;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.session-sidebar {
			width: 280px;
		}

		.session-sidebar.collapsed {
			width: 44px;
		}
	}
</style>
