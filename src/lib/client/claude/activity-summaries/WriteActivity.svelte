<script>
	let { event } = $props();

	let fileInfo = $derived(parseWriteEvent(event));

	function parseWriteEvent(e) {
		if (!e) return null;

		try {
			const input = e.input || e;
			return {
				path: input.file_path || input.path || 'Unknown file',
				content: input.content || '',
				success: e.result !== undefined || e.success !== false,
				error: e.error || null,
				isNew: detectIfNewFile(e)
			};
		} catch (err) {
			return {
				path: 'Parse error',
				error: err.message,
				success: false
			};
		}
	}

	function detectIfNewFile(e) {
		// Try to detect if this was creating a new file
		return e.creating || e.isNew || false;
	}

	function formatPath(path) {
		if (!path) return 'Unknown';
		const parts = path.split('/');
		if (parts.length > 3) {
			return '.../' + parts.slice(-3).join('/');
		}
		return path;
	}

	function getContentPreview(content) {
		if (!content) return 'Empty file';
		const lines = content.split('\n');
		const lineCount = lines.length;
		const charCount = content.length;

		// Show first few lines
		const preview = lines.slice(0, 5).join('\n');
		const truncated = lines.length > 5;

		return { preview, lineCount, charCount, truncated };
	}
</script>

<div class="activity-detail write-activity">
	{#if fileInfo}
		<div class="activity-row">
			<span class="activity-label">File</span>
			<span class="activity-value">
				<span class="activity-path" title={fileInfo.path}>
					{formatPath(fileInfo.path)}
				</span>
				{#if fileInfo.isNew}
					<span class="activity-badge new">NEW</span>
				{/if}
			</span>
		</div>

		{@const contentInfo = getContentPreview(fileInfo.content)}
		<div class="activity-row">
			<span class="activity-label">Size</span>
			<span class="activity-value">
				{typeof contentInfo === 'string'
					? contentInfo
					: `${contentInfo.lineCount} lines, ${contentInfo.charCount} characters`}
			</span>
		</div>

		{#if typeof contentInfo === 'object' && contentInfo.preview}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Content</span>
				</div>
				<pre class="activity-code">{contentInfo.preview}</pre>
				{#if contentInfo.truncated}
					<div class="activity-truncated">
						Showing first 5 lines of {contentInfo.lineCount} total
					</div>
				{/if}
			</div>
		{/if}

		{#if fileInfo.error}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-error">
					Error: {fileInfo.error}
				</span>
			</div>
		{:else if fileInfo.success}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-success"> File written successfully </span>
			</div>
		{/if}
	{:else}
		<div class="activity-error">Unable to parse write event</div>
	{/if}
</div>

<style>
	.activity-badge {
		display: inline-block;
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		font-size: 0.75em;
		font-weight: 600;
		margin-left: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.activity-badge.new {
		background: color-mix(in oklab, var(--ok) 20%, transparent);
		color: var(--ok);
		border: 1px solid color-mix(in oklab, var(--ok) 30%, transparent);
	}
</style>
