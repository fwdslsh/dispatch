<script>
	/**
	 * @typedef {Object} OpenCodeEvent
	 * @property {string} type - Event type
	 * @property {any} data - Event data
	 * @property {number} timestamp - Event timestamp
	 */

	/**
	 * @type {{
	 *   events: OpenCodeEvent[]
	 * }}
	 */
	let { events } = $props();

	let autoScroll = $state(true);
	let eventsContainer = $state(null);

	$effect(() => {
		// Auto-scroll to bottom when new events arrive
		if (autoScroll && eventsContainer && events.length > 0) {
			eventsContainer.scrollTop = eventsContainer.scrollHeight;
		}
	});

	function formatTimestamp(ts) {
		const date = new Date(ts);
		return date.toLocaleTimeString('en-US', { hour12: false });
	}

	function formatEventData(data) {
		if (typeof data === 'string') return data;
		if (typeof data === 'object') {
			return JSON.stringify(data, null, 2);
		}
		return String(data);
	}

	function getEventColor(type) {
		const colors = {
			error: 'var(--color-error, #c33)',
			warning: 'var(--color-warning, #f90)',
			success: 'var(--color-success, #0a0)',
			info: 'var(--color-info, #39f)',
			default: 'var(--color-text-muted)'
		};
		return colors[type] || colors.default;
	}
</script>

<div class="event-viewer">
	<div class="viewer-header">
		<label class="auto-scroll-toggle">
			<input type="checkbox" bind:checked={autoScroll} />
			<span>Auto-scroll</span>
		</label>
		<span class="event-count">{events.length} events</span>
	</div>

	{#if events.length === 0}
		<div class="empty-state">
			<p>No events yet. Events will appear here as they arrive.</p>
		</div>
	{:else}
		<div class="events-container" bind:this={eventsContainer}>
			{#each events as event, i (i)}
				<div class="event-item" style="--event-color: {getEventColor(event.type)}">
					<div class="event-header">
						<span class="event-type">{event.type}</span>
						<span class="event-time">{formatTimestamp(event.timestamp)}</span>
					</div>
					{#if event.data}
						<div class="event-data">{formatEventData(event.data)}</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.event-viewer {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	.viewer-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding-bottom: 0.5rem;
		border-bottom: 1px solid var(--color-border);
	}

	.auto-scroll-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: var(--color-text);
		cursor: pointer;
		user-select: none;
	}

	.auto-scroll-toggle input[type='checkbox'] {
		cursor: pointer;
	}

	.event-count {
		font-size: 0.75rem;
		color: var(--color-text-muted);
		font-weight: 500;
	}

	.empty-state {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		color: var(--color-text-muted);
		font-style: italic;
		text-align: center;
		padding: 2rem;
	}

	.empty-state p {
		margin: 0;
	}

	.events-container {
		flex: 1;
		overflow-y: auto;
		padding: 0.5rem 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.event-item {
		padding: 0.5rem;
		background: var(--color-surface);
		border-left: 3px solid var(--event-color);
		border-radius: 3px;
		font-size: 0.875rem;
	}

	.event-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.event-type {
		font-weight: 600;
		color: var(--event-color);
		text-transform: uppercase;
		font-size: 0.75rem;
	}

	.event-time {
		font-size: 0.7rem;
		color: var(--color-text-muted);
		font-family: var(--font-mono, monospace);
	}

	.event-data {
		color: var(--color-text);
		white-space: pre-wrap;
		font-family: var(--font-mono, monospace);
		font-size: 0.8rem;
		word-wrap: break-word;
		background: var(--color-background);
		padding: 0.5rem;
		border-radius: 3px;
		margin-top: 0.25rem;
	}

	/* Scrollbar styling */
	.events-container::-webkit-scrollbar {
		width: 8px;
	}

	.events-container::-webkit-scrollbar-track {
		background: var(--color-background);
	}

	.events-container::-webkit-scrollbar-thumb {
		background: var(--color-border);
		border-radius: 4px;
	}

	.events-container::-webkit-scrollbar-thumb:hover {
		background: var(--color-text-muted);
	}
</style>
