<script>
	/**
	 * ToolActivityCard Component
	 *
	 * Displays AI tool usage with appropriate icon, status, and details.
	 * Touch-friendly design for mobile interfaces.
	 *
	 * @file src/lib/client/ai/components/ToolActivityCard.svelte
	 */
	import IconTerminal from '../../shared/components/Icons/IconTerminal.svelte';
	import IconFileText from '../../shared/components/Icons/IconFileText.svelte';
	import IconEdit from '../../shared/components/Icons/IconEdit.svelte';
	import IconSearch from '../../shared/components/Icons/IconSearch.svelte';
	import IconFolder from '../../shared/components/Icons/IconFolder.svelte';
	import IconWorld from '../../shared/components/Icons/IconWorld.svelte';
	import IconTool from '../../shared/components/Icons/IconTool.svelte';
	import IconLoader from '../../shared/components/Icons/IconLoader.svelte';
	import IconCheck from '../../shared/components/Icons/IconCheck.svelte';
	import IconX from '../../shared/components/Icons/IconX.svelte';
	import IconChevronDown from '../../shared/components/Icons/IconChevronDown.svelte';

	/**
	 * @typedef {'bash'|'read'|'write'|'edit'|'glob'|'grep'|'web_fetch'|'web_search'|'task'|'unknown'} ToolType
	 * @typedef {'running'|'completed'|'error'} ToolStatus
	 */

	let {
		/** @type {ToolType} */
		tool = 'unknown',
		/** @type {ToolStatus} */
		status = 'completed',
		/** @type {string} */
		title = '',
		/** @type {string} */
		summary = '',
		/** @type {string|null} */
		filePath = null,
		/** @type {string|null} */
		command = null,
		/** @type {boolean} */
		expanded = $bindable(false),
		/** @type {import('svelte').Snippet|null} */
		details = null
	} = $props();

	// Tool icon mapping
	const toolIcons = {
		bash: IconTerminal,
		read: IconFileText,
		write: IconFileText,
		edit: IconEdit,
		glob: IconFolder,
		grep: IconSearch,
		web_fetch: IconWorld,
		web_search: IconSearch,
		task: IconTool,
		unknown: IconTool
	};

	// Tool display names
	const toolNames = {
		bash: 'Shell Command',
		read: 'Read File',
		write: 'Write File',
		edit: 'Edit File',
		glob: 'Find Files',
		grep: 'Search Content',
		web_fetch: 'Fetch URL',
		web_search: 'Web Search',
		task: 'Sub-Task',
		unknown: 'Tool'
	};

	// Get the appropriate icon component
	const IconComponent = $derived(toolIcons[tool] || IconTool);
	const displayName = $derived(toolNames[tool] || 'Tool');

	function toggle() {
		if (details) {
			expanded = !expanded;
		}
	}

	function handleKeydown(e) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle();
		}
	}
</script>

<div
	class="tool-card {status}"
	class:expandable={!!details}
	class:expanded
	role={details ? 'button' : undefined}
	tabindex={details ? 0 : undefined}
	onclick={toggle}
	onkeydown={handleKeydown}
>
	<div class="tool-header">
		<div class="tool-icon {tool}">
			{#if status === 'running'}
				<IconLoader size={16} />
			{:else}
				<IconComponent size={16} />
			{/if}
		</div>

		<div class="tool-info">
			<div class="tool-name">{title || displayName}</div>
			{#if filePath}
				<div class="tool-path" title={filePath}>
					{filePath.split('/').slice(-2).join('/')}
				</div>
			{:else if command}
				<div class="tool-command" title={command}>
					{command.length > 50 ? command.slice(0, 50) + '...' : command}
				</div>
			{:else if summary}
				<div class="tool-summary">{summary}</div>
			{/if}
		</div>

		<div class="tool-status">
			{#if status === 'running'}
				<span class="status-badge running">Running</span>
			{:else if status === 'completed'}
				<IconCheck size={14} />
			{:else if status === 'error'}
				<IconX size={14} />
			{/if}
		</div>

		{#if details}
			<div class="expand-icon" class:rotated={expanded}>
				<IconChevronDown size={16} />
			</div>
		{/if}
	</div>

	{#if expanded && details}
		<div class="tool-details">
			{@render details()}
		</div>
	{/if}
</div>

<style>
	.tool-card {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		overflow: hidden;
		transition: all 0.2s ease;
	}

	.tool-card.expandable {
		cursor: pointer;
	}

	.tool-card.expandable:hover {
		border-color: var(--primary-dim, var(--primary));
		background: var(--surface-hover);
	}

	.tool-card.expandable:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 0 2px var(--primary-glow-15);
	}

	.tool-card.running {
		border-color: var(--primary);
		background: color-mix(in oklab, var(--primary) 5%, var(--surface));
	}

	.tool-card.error {
		border-color: var(--error);
		background: color-mix(in oklab, var(--error) 5%, var(--surface));
	}

	.tool-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3);
		min-height: 48px; /* Touch-friendly */
	}

	.tool-icon {
		width: 32px;
		height: 32px;
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		background: var(--bg);
		color: var(--text-muted);
	}

	.tool-icon.bash {
		color: var(--accent-green, #22c55e);
	}
	.tool-icon.read {
		color: var(--accent-blue, #3b82f6);
	}
	.tool-icon.write {
		color: var(--accent-purple, #a855f7);
	}
	.tool-icon.edit {
		color: var(--accent-yellow, #eab308);
	}
	.tool-icon.glob {
		color: var(--accent-cyan, #06b6d4);
	}
	.tool-icon.grep {
		color: var(--accent-orange, #f97316);
	}
	.tool-icon.web_fetch {
		color: var(--accent-pink, #ec4899);
	}
	.tool-icon.web_search {
		color: var(--accent-pink, #ec4899);
	}
	.tool-icon.task {
		color: var(--primary);
	}

	.tool-info {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tool-name {
		font-weight: 600;
		font-size: var(--font-size-2);
		color: var(--text);
		font-family: var(--font-mono);
	}

	.tool-path,
	.tool-command,
	.tool-summary {
		font-size: var(--font-size-1);
		color: var(--text-muted);
		font-family: var(--font-mono);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tool-status {
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}

	.tool-card.completed .tool-status {
		color: var(--success);
	}

	.tool-card.error .tool-status {
		color: var(--error);
	}

	.status-badge {
		font-size: var(--font-size-1);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-full);
		font-weight: 500;
	}

	.status-badge.running {
		background: var(--primary);
		color: var(--bg);
		animation: pulse 2s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.7;
		}
	}

	.expand-icon {
		color: var(--text-muted);
		transition: transform 0.2s ease;
	}

	.expand-icon.rotated {
		transform: rotate(180deg);
	}

	.tool-details {
		padding: var(--space-3);
		padding-top: 0;
		border-top: 1px solid var(--surface-border);
		margin-top: var(--space-2);
	}

	/* Mobile optimizations */
	@media (max-width: 768px) {
		.tool-header {
			min-height: 56px; /* Larger touch target */
		}

		.tool-icon {
			width: 36px;
			height: 36px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.status-badge.running {
			animation: none;
		}

		.tool-card,
		.expand-icon {
			transition: none;
		}
	}
</style>
