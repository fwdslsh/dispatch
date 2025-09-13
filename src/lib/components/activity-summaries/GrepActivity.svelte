<script>
	import './shared-styles.css';

	let { event } = $props();

	const searchInfo = $derived(parseGrepEvent(event));

	function parseGrepEvent(e) {
		if (!e) return null;

		try {
			const input = e.input || e;
			return {
				pattern: input.pattern || '',
				path: input.path || '.',
				glob: input.glob || null,
				type: input.type || null,
				outputMode: input.output_mode || input.outputMode || 'files_with_matches',
				caseInsensitive: input['-i'] || false,
				contextLines: {
					before: input['-B'] || 0,
					after: input['-A'] || 0,
					both: input['-C'] || 0
				},
				results: extractResults(e.result),
				success: e.result !== undefined || e.success !== false,
				error: e.error || null
			};
		} catch (err) {
			return {
				pattern: 'Parse error',
				error: err.message,
				success: false
			};
		}
	}

	function extractResults(result) {
		if (!result) return null;

		if (typeof result === 'string') {
			// Parse string results into lines
			const lines = result.split('\n').filter((l) => l.trim());
			return {
				type: 'text',
				count: lines.length,
				preview: lines.slice(0, 10),
				truncated: lines.length > 10
			};
		}

		if (Array.isArray(result)) {
			return {
				type: 'files',
				count: result.length,
				preview: result.slice(0, 10),
				truncated: result.length > 10
			};
		}

		if (result.matches) {
			return {
				type: 'matches',
				count: result.matches,
				files: result.files || []
			};
		}

		return null;
	}

	function formatPath(path) {
		if (!path) return 'Current directory';
		if (path === '.') return 'Current directory';
		const parts = path.split('/');
		if (parts.length > 3) {
			return '.../' + parts.slice(-3).join('/');
		}
		return path;
	}

	function formatPattern(pattern) {
		if (!pattern) return '';
		if (pattern.length > 100) {
			return pattern.substring(0, 100) + '...';
		}
		return pattern;
	}
</script>

<div class="activity-detail grep-activity">
	{#if searchInfo}
		<div class="activity-row">
			<span class="activity-label">Pattern</span>
			<span class="activity-value">
				<code class="search-pattern">{formatPattern(searchInfo.pattern)}</code>
			</span>
		</div>

		<div class="activity-row">
			<span class="activity-label">Location</span>
			<span class="activity-value">
				<span class="activity-path" title={searchInfo.path}>
					{formatPath(searchInfo.path)}
				</span>
			</span>
		</div>

		{#if searchInfo.glob || searchInfo.type}
			<div class="activity-row">
				<span class="activity-label">Filter</span>
				<span class="activity-value">
					{#if searchInfo.glob}
						<span class="filter-badge">glob: {searchInfo.glob}</span>
					{/if}
					{#if searchInfo.type}
						<span class="filter-badge">type: {searchInfo.type}</span>
					{/if}
				</span>
			</div>
		{/if}

		{#if searchInfo.caseInsensitive || searchInfo.contextLines.both > 0 || searchInfo.contextLines.before > 0 || searchInfo.contextLines.after > 0}
			<div class="activity-row">
				<span class="activity-label">Options</span>
				<span class="activity-value">
					{#if searchInfo.caseInsensitive}
						<span class="option-badge">Case insensitive</span>
					{/if}
					{#if searchInfo.contextLines.both > 0}
						<span class="option-badge">Context: ±{searchInfo.contextLines.both}</span>
					{:else}
						{#if searchInfo.contextLines.before > 0}
							<span class="option-badge">Before: {searchInfo.contextLines.before}</span>
						{/if}
						{#if searchInfo.contextLines.after > 0}
							<span class="option-badge">After: {searchInfo.contextLines.after}</span>
						{/if}
					{/if}
				</span>
			</div>
		{/if}

		{#if searchInfo.results}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Results</span>
					<span class="activity-value">
						{searchInfo.results.count}
						{searchInfo.results.type === 'files' ? 'files' : 'matches'} found
					</span>
				</div>

				{#if searchInfo.results.preview && searchInfo.results.preview.length > 0}
					<ul class="activity-list">
						{#each searchInfo.results.preview as item}
							<li>{typeof item === 'string' ? item : JSON.stringify(item)}</li>
						{/each}
					</ul>
					{#if searchInfo.results.truncated}
						<div class="activity-truncated">
							Showing first 10 of {searchInfo.results.count} results
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		{#if searchInfo.error}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-error">
					Error: {searchInfo.error}
				</span>
			</div>
		{:else if searchInfo.success}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-success"> Search completed </span>
			</div>
		{/if}
	{:else}
		<div class="activity-error">Unable to parse grep event</div>
	{/if}
</div>

<style>
	.search-pattern {
		background: color-mix(in oklab, var(--accent-magenta) 15%, transparent);
		border: 1px solid color-mix(in oklab, var(--accent-magenta) 25%, transparent);
		padding: var(--space-1) var(--space-2);
		border-radius: 4px;
		color: var(--accent-magenta);
		font-family: var(--font-mono);
		font-size: 0.9em;
	}

	.filter-badge,
	.option-badge {
		display: inline-block;
		padding: 2px 6px;
		border-radius: 4px;
		font-size: 0.8em;
		font-weight: 500;
		margin-right: var(--space-2);
		background: color-mix(in oklab, var(--primary) 10%, transparent);
		color: var(--primary);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
	}
</style>
