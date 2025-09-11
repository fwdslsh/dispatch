<script>
	import './shared-styles.css';
	import Markdown from '$lib/shared/components/Markdown.svelte';
	
	let { event, type = 'Unknown', tool = '' } = $props();
	
	const eventInfo = $derived(parseGenericEvent(event));
	
	function parseGenericEvent(e) {
		if (!e) return null;
		
		try {
			const info = {
				type: e.type || type,
				tool: e.tool || e.name || tool,
				hasInput: !!e.input,
				hasResult: !!e.result,
				hasMessage: !!e.message,
				success: e.success !== false,
				error: e.error || null,
				properties: []
			};
			
			// Extract interesting properties
			const skipKeys = ['type', 'tool', 'name', 'input', 'result', 'error', 'success', 'message', 'content'];
			
			for (const [key, value] of Object.entries(e)) {
				if (!skipKeys.includes(key) && value !== undefined && value !== null) {
					info.properties.push({ key, value: formatValue(value) });
				}
			}
			
			// Add input summary if present
			if (e.input) {
				info.inputSummary = getObjectSummary(e.input);
			}
			
			// Check for nested content structure (from JSONL)
			if (e.content) {
				// Handle tool_result content structure
				if (typeof e.content === 'string') {
					info.resultMessage = e.content;
				} else if (typeof e.content === 'object') {
					// Extract from nested content
					info.resultSummary = getObjectSummary(e.content);
					if (e.content.message) {
						info.resultMessage = extractMessageContent(e.content.message);
					}
				}
			}
			
			// Add result summary if present (fallback for non-nested structure)
			if (e.result && !info.resultMessage && !info.resultSummary) {
				info.resultSummary = getObjectSummary(e.result);
				// Check if result contains message content
				if (typeof e.result === 'object' && e.result.message) {
					info.resultMessage = extractMessageContent(e.result.message);
				} else if (typeof e.result === 'string') {
					// If result is a string, it might be markdown content
					info.resultMessage = e.result;
				}
			}
			
			// Check for message property at top level
			if (e.message && !info.messageContent) {
				info.messageContent = extractMessageContent(e.message);
			}
			
			return info;
		} catch (err) {
			return {
				type: 'Error',
				error: err.message
			};
		}
	}
	
	function formatValue(value) {
		if (value === null) return 'null';
		if (value === undefined) return 'undefined';
		if (typeof value === 'boolean') return value ? 'true' : 'false';
		if (typeof value === 'number') return value.toString();
		if (typeof value === 'string') {
			if (value.length > 100) {
				return value.substring(0, 100) + '...';
			}
			return value;
		}
		if (Array.isArray(value)) {
			return `Array(${value.length})`;
		}
		if (typeof value === 'object') {
			return `Object(${Object.keys(value).length} keys)`;
		}
		return String(value);
	}
	
	function extractMessageContent(message) {
		if (!message) return null;
		
		// If message is a string, return it
		if (typeof message === 'string') {
			return message;
		}
		
		// If message has content array (Claude API format)
		if (message.content && Array.isArray(message.content)) {
			const textParts = message.content
				.filter(part => part.type === 'text')
				.map(part => part.text);
			if (textParts.length > 0) {
				return textParts.join('\n');
			}
		}
		
		// If message has text property
		if (message.text) {
			return message.text;
		}
		
		// If message has content as string
		if (message.content && typeof message.content === 'string') {
			return message.content;
		}
		
		return null;
	}
	
	function getObjectSummary(obj) {
		if (!obj) return null;
		
		if (typeof obj === 'string') {
			return obj.substring(0, 200) + (obj.length > 200 ? '...' : '');
		}
		
		if (Array.isArray(obj)) {
			return `Array with ${obj.length} items`;
		}
		
		if (typeof obj === 'object') {
			const keys = Object.keys(obj);
			const preview = keys.slice(0, 5).map(k => `${k}: ${formatValue(obj[k])}`);
			return {
				keys: keys.length,
				preview,
				truncated: keys.length > 5
			};
		}
		
		return formatValue(obj);
	}
</script>

<div class="activity-detail generic-activity">
	Basic
	{#if eventInfo}
		<div class="activity-row">
			<span class="activity-label">Type</span>
			<span class="activity-value">
				<span class="type-badge">{eventInfo.type}</span>
				{#if eventInfo.tool}
					<span class="tool-name">{eventInfo.tool}</span>
				{/if}
			</span>
		</div>
		
		{#if eventInfo.properties.length > 0}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Details</span>
				</div>
				<ul class="property-list">
					{#each eventInfo.properties as prop}
						<li>
							<span class="prop-key">{prop.key}:</span>
							<span class="prop-value">{prop.value}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		
		{#if eventInfo.inputSummary}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Input</span>
				</div>
				{#if typeof eventInfo.inputSummary === 'string'}
					<pre class="activity-code">{eventInfo.inputSummary}</pre>
				{:else if eventInfo.inputSummary.preview}
					<ul class="property-list">
						{#each eventInfo.inputSummary.preview as item}
							<li>{item}</li>
						{/each}
					</ul>
					{#if eventInfo.inputSummary.truncated}
						<div class="activity-truncated">
							Showing 5 of {eventInfo.inputSummary.keys} properties
						</div>
					{/if}
				{:else}
					<div class="activity-value">{eventInfo.inputSummary}</div>
				{/if}
			</div>
		{/if}
		
		{#if eventInfo.messageContent}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Message</span>
				</div>
				<div class="activity-message-content">
					<Markdown content={eventInfo.messageContent} />
				</div>
			</div>
		{/if}
		
		{#if eventInfo.resultMessage}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Result Message</span>
				</div>
				<div class="activity-message-content">
					<Markdown content={eventInfo.resultMessage} />
				</div>
			</div>
		{:else if eventInfo.resultSummary}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Result</span>
				</div>
				{#if typeof eventInfo.resultSummary === 'string'}
					<pre class="activity-code">{eventInfo.resultSummary}</pre>
				{:else if eventInfo.resultSummary.preview}
					<ul class="property-list">
						{#each eventInfo.resultSummary.preview as item}
							<li>{item}</li>
						{/each}
					</ul>
					{#if eventInfo.resultSummary.truncated}
						<div class="activity-truncated">
							Showing 5 of {eventInfo.resultSummary.keys} properties
						</div>
					{/if}
				{:else}
					<div class="activity-value">{eventInfo.resultSummary}</div>
				{/if}
			</div>
		{/if}
		
		{#if eventInfo.error}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-error">
					Error: {eventInfo.error}
				</span>
			</div>
		{:else if eventInfo.success}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-success">
					Completed
				</span>
			</div>
		{/if}
	{:else}
		<div class="activity-error">Unable to parse event</div>
	{/if}
</div>

<style>
	.type-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 0.85em;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		background: color-mix(in oklab, var(--primary) 15%, transparent);
		color: var(--primary);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
	}
	
	.tool-name {
		margin-left: var(--space-2);
		font-family: var(--font-mono);
		font-size: 0.9em;
		opacity: 0.8;
	}
	
	.property-list {
		list-style: none;
		padding: 0;
		margin: var(--space-2) 0;
		font-size: 0.9em;
	}
	
	.property-list li {
		padding: var(--space-1) var(--space-2);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 5%, transparent);
	}
	
	.prop-key {
		font-weight: 600;
		color: var(--muted);
		margin-right: var(--space-2);
	}
	
	.prop-value {
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 0.9em;
	}
	
	.activity-message-content {
		padding: var(--space-3);
		background: color-mix(in oklab, var(--bg) 50%, transparent);
		border-radius: 8px;
		border: 1px solid color-mix(in oklab, var(--primary) 10%, transparent);
		margin-top: var(--space-2);
		max-height: 400px;
		overflow-y: auto;
	}
	
	.activity-message-content :global(.markdown-content) {
		font-size: 0.9em;
		line-height: 1.5;
	}
</style>