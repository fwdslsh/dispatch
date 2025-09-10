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
					preview: extractPreview(e.result || e.content)
				};
			}
			
			// Check for input object with file_path
			if (e.input && typeof e.input === 'object') {
				return {
					path: e.input.file_path || e.input.path || 'Unknown file',
					lines: e.input.limit || null,
					offset: e.input.offset || null,
					success: e.result !== undefined || e.content !== undefined || e.success !== false,
					error: e.error || null,
					preview: extractPreview(e.result || e.content)
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
		
		// Direct string content
		if (typeof result === 'string') {
			// Take first 500 chars as preview for better context
			const preview = result.substring(0, 500);
			return {
				text: preview + (result.length > 500 ? '...' : ''),
				totalLength: result.length,
				lines: result.split('\n').length
			};
		}
		
		// Check for nested content property (JSONL structure)
		if (result.content) {
			const content = typeof result.content === 'string' 
				? result.content 
				: (result.content.text || JSON.stringify(result.content, null, 2));
			const preview = content.substring(0, 500);
			return {
				text: preview + (content.length > 500 ? '...' : ''),
				totalLength: content.length,
				lines: content.split('\n').length
			};
		}
		
		// Check for text property
		if (result.text) {
			const content = result.text;
			const preview = content.substring(0, 500);
			return {
				text: preview + (content.length > 500 ? '...' : ''),
				totalLength: content.length,
				lines: content.split('\n').length
			};
		}
		
		// Check for error in result
		if (result.error) {
			return {
				error: result.error
			};
		}
		
		// For objects, try to extract meaningful data
		if (typeof result === 'object' && result !== null) {
			const text = JSON.stringify(result, null, 2);
			const preview = text.substring(0, 500);
			return {
				text: preview + (text.length > 500 ? '...' : ''),
				totalLength: text.length,
				lines: text.split('\n').length
			};
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
					<span class="activity-label">Content Preview</span>
					{#if fileInfo.preview.lines}
						<span class="activity-value">
							{fileInfo.preview.lines} lines, {fileInfo.preview.totalLength} characters
						</span>
					{/if}
				</div>
				{#if fileInfo.preview.error}
					<div class="activity-error">{fileInfo.preview.error}</div>
				{:else if fileInfo.preview.text}
					<pre class="activity-code">{fileInfo.preview.text}</pre>
					{#if fileInfo.preview.text.endsWith('...')}
						<div class="activity-truncated">
							Showing first 500 characters of {fileInfo.preview.totalLength} total
						</div>
					{/if}
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