<script>
	/**
	 * ActivityStrip Component
	 *
	 * Horizontal strip showing currently running AI tool activities as icons.
	 * Provides at-a-glance view of what the AI is currently doing.
	 *
	 * @file src/lib/client/ai/components/ActivityStrip.svelte
	 */
	import IconTerminal from '../../shared/components/Icons/IconTerminal.svelte';
	import IconFileText from '../../shared/components/Icons/IconFileText.svelte';
	import IconEdit from '../../shared/components/Icons/IconEdit.svelte';
	import IconSearch from '../../shared/components/Icons/IconSearch.svelte';
	import IconFolder from '../../shared/components/Icons/IconFolder.svelte';
	import IconWorld from '../../shared/components/Icons/IconWorld.svelte';
	import IconTool from '../../shared/components/Icons/IconTool.svelte';
	import IconBrain from '../../shared/components/Icons/IconBrain.svelte';

	/**
	 * @typedef {Object} Activity
	 * @property {string} id - Unique activity ID
	 * @property {string} tool - Tool type name
	 * @property {string} status - Activity status (running, completed, error)
	 * @property {string} [summary] - Brief description
	 */

	let {
		/** @type {Activity[]} */
		activities = [],
		/** @type {boolean} */
		isThinking = false
	} = $props();

	// Tool icon mapping
	const toolIcons = {
		bash: IconTerminal,
		Bash: IconTerminal,
		read: IconFileText,
		Read: IconFileText,
		write: IconFileText,
		Write: IconFileText,
		edit: IconEdit,
		Edit: IconEdit,
		glob: IconFolder,
		Glob: IconFolder,
		grep: IconSearch,
		Grep: IconSearch,
		web_fetch: IconWorld,
		WebFetch: IconWorld,
		web_search: IconSearch,
		WebSearch: IconSearch,
		task: IconTool,
		Task: IconTool,
		TodoWrite: IconTool,
		unknown: IconTool
	};

	// Tool colors
	const toolColors = {
		bash: 'var(--accent-green, #22c55e)',
		Bash: 'var(--accent-green, #22c55e)',
		read: 'var(--accent-blue, #3b82f6)',
		Read: 'var(--accent-blue, #3b82f6)',
		write: 'var(--accent-purple, #a855f7)',
		Write: 'var(--accent-purple, #a855f7)',
		edit: 'var(--accent-yellow, #eab308)',
		Edit: 'var(--accent-yellow, #eab308)',
		glob: 'var(--accent-cyan, #06b6d4)',
		Glob: 'var(--accent-cyan, #06b6d4)',
		grep: 'var(--accent-orange, #f97316)',
		Grep: 'var(--accent-orange, #f97316)',
		web_fetch: 'var(--accent-pink, #ec4899)',
		WebFetch: 'var(--accent-pink, #ec4899)',
		web_search: 'var(--accent-pink, #ec4899)',
		WebSearch: 'var(--accent-pink, #ec4899)',
		task: 'var(--primary)',
		Task: 'var(--primary)',
		TodoWrite: 'var(--primary)',
		unknown: 'var(--text-muted)'
	};

	// Get running activities
	const runningActivities = $derived(activities.filter((a) => a.status === 'running'));

	// Check if anything is active
	const hasActivity = $derived(runningActivities.length > 0 || isThinking);

	function getIcon(tool) {
		return toolIcons[tool] || IconTool;
	}

	function getColor(tool) {
		return toolColors[tool] || 'var(--text-muted)';
	}
</script>

{#if hasActivity}
	<div class="activity-strip">
		{#if isThinking && runningActivities.length === 0}
			<div class="activity-item thinking" title="Thinking...">
				<IconBrain size={16} />
			</div>
		{/if}

		{#each runningActivities as activity (activity.id)}
			{@const IconComponent = getIcon(activity.tool)}
			<div
				class="activity-item"
				title={activity.summary || activity.tool}
				style="--tool-color: {getColor(activity.tool)}"
			>
				<IconComponent size={16} />
			</div>
		{/each}

		<span class="activity-label">
			{#if runningActivities.length > 0}
				{runningActivities.length === 1
					? runningActivities[0].tool
					: `${runningActivities.length} tools`}
			{:else}
				Thinking...
			{/if}
		</span>
	</div>
{/if}

<style>
	.activity-strip {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		background: color-mix(in oklab, var(--primary) 10%, var(--surface));
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 20%, var(--surface-border));
		animation: slideIn 0.2s ease-out;
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-100%);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.activity-item {
		width: 28px;
		height: 28px;
		border-radius: var(--radius);
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg);
		color: var(--tool-color, var(--primary));
		border: 1px solid color-mix(in oklab, var(--tool-color, var(--primary)) 30%, transparent);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.activity-item.thinking {
		color: var(--primary);
		--tool-color: var(--primary);
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.7;
			transform: scale(0.95);
		}
	}

	.activity-label {
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
		color: var(--primary);
		text-transform: capitalize;
	}

	/* Mobile */
	@media (max-width: 768px) {
		.activity-strip {
			padding: var(--space-2);
		}

		.activity-item {
			width: 32px;
			height: 32px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.activity-strip {
			animation: none;
		}

		.activity-item {
			animation: none;
		}
	}
</style>
