<script>
	import './shared-styles.css';
	
	let { event } = $props();
	
	// Parse the event to extract file read information
	let fileInfo = $derived(parseReadEvent(event));
	
	function parseReadEvent(e) {
		if (!e) return null;
		
		try {
			// Check for direct file path in event
			if (e.file_path || e.path) {
				return {
					path: e.file_path || e.path,
					lines: e.limit || null,
					offset: e.offset || null,
					success: e.result !== undefined || e.success !== false,
					error: e.error || null,
					preview: extractPreview(e.result)
				};
			}
			
			// Check for input object with file_path
			if (e.input && typeof e.input === 'object') {
				return {
					path: e.input.file_path || e.input.path || 'Unknown file',
					lines: e.input.limit || null,
					offset: e.input.offset || null,
					success: e.result !== undefined || e.success !== false,
					error: e.error || null,
					preview: extractPreview(e.result)
				};
			}
			
			// Fallback parsing
			return {
				path: 'Unknown file',
				lines: null,
				offset: null,
				success: false,
				error: 'Could not parse event',
				preview: null
			};
		} catch (err) {
			return {
				path: 'Parse error',
				error: err.message,
				success: false
			};
		}
	}
	
	function extractPreview(result) {
		if (!result) return null;
		
		if (typeof result === 'string') {
			// Take first 200 chars as preview
			const preview = result.substring(0, 200);
			return preview + (result.length > 200 ? '...' : '');
		}
		
		if (result.content) {
			const content = result.content;
			const preview = content.substring(0, 200);
			return preview + (content.length > 200 ? '...' : '');
		}
		
		return null;
	}
	
	function formatPath(path) {
		if (!path) return 'Unknown';
		// Show just the last 2-3 parts of the path for readability
		const parts = path.split('/');
		if (parts.length > 3) {
			return '.../' + parts.slice(-3).join('/');
		}
		return path;
	}
</script>

<div class="activity-detail read-activity">
	{#if fileInfo}
		<div class="activity-row">
			<span class="activity-label">File</span>
			<span class="activity-value">
				<span class="activity-path" title={fileInfo.path}>
					{formatPath(fileInfo.path)}
				</span>
			</span>
		</div>
		
		{#if fileInfo.offset || fileInfo.lines}
			<div class="activity-row">
				<span class="activity-label">Range</span>
				<span class="activity-value">
					{#if fileInfo.offset}
						Starting at line {fileInfo.offset}
					{/if}
					{#if fileInfo.lines}
						{fileInfo.offset ? ', ' : ''}
						{fileInfo.lines} lines
					{/if}
				</span>
			</div>
		{/if}
		
		{#if fileInfo.success && fileInfo.preview}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Preview</span>
				</div>
				<pre class="activity-code">{fileInfo.preview}</pre>
				{#if fileInfo.preview.endsWith('...')}
					<div class="activity-truncated">Content truncated for display</div>
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
				<span class="activity-value activity-success">
					File read successfully
				</span>
			</div>
		{/if}
	{:else}
		<div class="activity-error">Unable to parse read event</div>
	{/if}
</div>

<style>
	.read-activity {
		/* Component specific styles if needed */
	}
</style>