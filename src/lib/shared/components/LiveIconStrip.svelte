<script>
	import ActivitySummary from '$lib/components/activity-summaries/ActivitySummary.svelte';
	import { IconCircle } from '@tabler/icons-svelte';
	let { icons = [], title = 'Agent activity', staticMode = false } = $props();
	let selected = $state(null);

	function toggle(icon) {
		selected = selected?.id === icon.id ? null : icon;
	}
</script>

{#if icons && icons.length > 0}
	<div class="live-event-icons {staticMode ? 'static' : ''}" aria-label={title}>
		{#each icons as ev, index (ev.id)}
			<button
				type="button"
				class="event-icon {selected?.id === ev.id ? 'selected' : ''}"
				title={ev.label}
				style="animation-delay: {index * 0.05}s"
				onclick={() => toggle(ev)}
				aria-label={`${ev.label} - Click for details`}
			>
				{#if ev.Icon}
					<svelte:component this={ev.Icon} size={16} stroke={2} />
				{:else}
					<!-- Fallback icon if Icon is missing -->
					<IconCircle size={16} stroke={2} />
				{/if}
			</button>
		{/each}
	</div>
{/if}

{#if selected}
	<div class="event-summary">
		<div class="event-summary-header">
			<span class="event-summary-icon">
				{#if selected.Icon}
					<svelte:component this={selected.Icon} size={18} stroke={2} />
				{/if}
			</span>
			<span class="event-summary-label">{selected.label}</span>
			<span class="event-summary-time">
				{(selected.timestamp || new Date()).toLocaleTimeString('en-US', {
					hour: '2-digit',
					minute: '2-digit',
					second: '2-digit'
				})}
			</span>
		</div>
		<div class="event-summary-content">
			<ActivitySummary icon={selected} />
		</div>
	</div>
{/if}

<style>
	.live-event-icons {
		margin-top: var(--space-3);
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-3);
		/* border-radius: 12px; */
		box-shadow:
			inset 0 1px 2px rgba(255, 255, 255, 0.05),
			0 4px 16px -10px var(--primary-glow);
		font-size: 1rem;
		min-height: 40px;
		max-width: 100%;
		overflow: visible;
		transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
	}

	/* Static variant: no background or shadow */
	.live-event-icons.static {
		box-shadow: none;
		background: transparent;
		padding: var(--space-2) 0;
	}

	/* Ensure Tabler icons inherit color properly */
	.event-icon :global(svg) {
		color: currentColor;
		stroke: currentColor;
		fill: none;
	}

	.event-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		padding: 0;
		border-radius: 50%;
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 92%, var(--primary) 8%),
			color-mix(in oklab, var(--surface) 96%, var(--primary) 4%)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		box-shadow:
			0 2px 8px -4px var(--primary-glow),
			inset 0 1px 2px rgba(255, 255, 255, 0.05);
		cursor: pointer;
		font-size: 1.1rem;
		transition: all 0.2s cubic-bezier(0.23, 1, 0.32, 1);
		opacity: 0;
		transform: translateX(-20px);
		animation: slideInFromLeft 0.4s cubic-bezier(0.23, 1, 0.32, 1) forwards;
		font-family: inherit;
		color: var(--muted);
		line-height: 1;
		appearance: none;
		/* Remove mobile tap highlight */
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
	}

	.event-icon:hover {
		transform: translateY(-2px) scale(1.1);
		border-color: color-mix(in oklab, var(--primary) 40%, transparent);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 15%, var(--surface)),
			color-mix(in oklab, var(--primary) 8%, var(--surface))
		);
		box-shadow:
			0 4px 12px -4px var(--primary-glow),
			0 0 20px -8px var(--primary-glow),
			inset 0 1px 4px rgba(255, 255, 255, 0.1);
		color: var(--text);
	}

	.event-icon.selected {
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--primary) 25%, var(--surface)),
			color-mix(in oklab, var(--primary) 15%, var(--surface))
		);
		color: var(--primary);
		border-color: color-mix(in oklab, var(--primary) 50%, transparent);
		box-shadow:
			0 0 0 2px color-mix(in oklab, var(--primary) 20%, transparent),
			0 4px 16px -6px var(--primary-glow),
			inset 0 2px 4px rgba(255, 255, 255, 0.1);
		transform: translateY(-2px) scale(1.1);
	}

	@keyframes slideInFromLeft {
		from {
			opacity: 0;
			transform: translateX(-20px) scale(0.8);
		}
		to {
			opacity: 1;
			transform: translateX(0) scale(1);
		}
	}

	.event-summary {
		margin-top: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: linear-gradient(
			135deg,
			color-mix(in oklab, var(--surface) 95%, var(--primary) 5%),
			color-mix(in oklab, var(--surface) 98%, var(--primary) 2%)
		);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 12px;
		box-shadow:
			inset 0 1px 3px rgba(0, 0, 0, 0.05),
			0 4px 12px -6px rgba(0, 0, 0, 0.1);
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		overflow: hidden;
	}
	.event-summary-header {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-2);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 15%, transparent);
	}
	.event-summary-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: var(--primary);
	}
	.event-summary-label {
		flex: 1;
		font-weight: 600;
		color: var(--primary);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		font-size: var(--font-size-0);
	}
	.event-summary-time {
		font-size: var(--font-size-0);
		color: var(--muted);
		opacity: 0.7;
	}
	.event-summary-content {
		color: var(--text);
		line-height: 1.5;
		word-break: break-word;
		opacity: 0.9;
	}
	.event-summary-content :global(strong) {
		color: var(--primary);
		font-weight: 600;
	}
	.event-summary-content :global(.event-role) {
		color: var(--accent-cyan);
		font-weight: 500;
		font-size: 0.9em;
		padding: 2px 6px;
		background: color-mix(in oklab, var(--accent-cyan) 15%, transparent);
		border-radius: 4px;
		border: 1px solid color-mix(in oklab, var(--accent-cyan) 25%, transparent);
	}
	.event-summary-content :global(.event-id) {
		color: var(--muted);
		font-family: var(--font-mono);
		font-size: 0.85em;
		padding: 2px 4px;
		background: color-mix(in oklab, var(--muted) 10%, transparent);
		border-radius: 3px;
		border: 1px solid color-mix(in oklab, var(--muted) 20%, transparent);
	}
	.event-summary-content :global(.event-preview) {
		color: var(--text-secondary);
		font-style: italic;
		font-size: 0.9em;
		line-height: 1.4;
		display: block;
		margin-top: var(--space-1);
		padding: var(--space-2);
		background: color-mix(in oklab, var(--bg) 50%, transparent);
		border-radius: 6px;
		border-left: 3px solid color-mix(in oklab, var(--primary) 30%, transparent);
		overflow-wrap: break-word;
	}

	@media (max-width: 640px) {
		.live-event-icons {
			padding: var(--space-2);
			gap: var(--space-1);
		}
		.event-icon {
			width: 28px;
			height: 28px;
			font-size: 0.95rem;
		}
		.event-icon :global(svg) {
			width: 14px;
			height: 14px;
		}
		.event-summary {
			padding: var(--space-2) var(--space-3);
			font-size: var(--font-size-0);
		}
	}
</style>
