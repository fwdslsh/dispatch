<script>
	let { event } = $props();

	const globInfo = $derived(parseGlobEvent(event));

	function parseGlobEvent(e) {
		if (!e) return null;

		try {
			const input = e.input || e;
			return {
				pattern: input.pattern || '',
				path: input.path || '.',
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

		if (Array.isArray(result)) {
			return {
				count: result.length,
				files: result.slice(0, 15),
				truncated: result.length > 15
			};
		}

		if (typeof result === 'string') {
			const files = result.split('\n').filter((f) => f.trim());
			return {
				count: files.length,
				files: files.slice(0, 15),
				truncated: files.length > 15
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

	function formatFile(file) {
		const parts = file.split('/');
		if (parts.length > 3) {
			return '.../' + parts.slice(-3).join('/');
		}
		return file;
	}
</script>

<div class="activity-detail glob-activity">
	{#if globInfo}
		<div class="activity-row">
			<span class="activity-label">Pattern</span>
			<span class="activity-value">
				<code class="glob-pattern">{globInfo.pattern}</code>
			</span>
		</div>

		<div class="activity-row">
			<span class="activity-label">Location</span>
			<span class="activity-value">
				<span class="activity-path" title={globInfo.path}>
					{formatPath(globInfo.path)}
				</span>
			</span>
		</div>

		{#if globInfo.results}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Matches</span>
					<span class="activity-value">
						{globInfo.results.count}
						{globInfo.results.count === 1 ? 'file' : 'files'} found
					</span>
				</div>

				{#if globInfo.results.files && globInfo.results.files.length > 0}
					<ul class="activity-list file-list">
						{#each globInfo.results.files as file (file)}
							<li title={file}>{formatFile(file)}</li>
						{/each}
					</ul>
					{#if globInfo.results.truncated}
						<div class="activity-truncated">
							Showing first 15 of {globInfo.results.count} files
						</div>
					{/if}
				{/if}
			</div>
		{/if}

		{#if globInfo.error}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-error">
					Error: {globInfo.error}
				</span>
			</div>
		{:else if globInfo.success}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-success"> Pattern matched successfully </span>
			</div>
		{/if}
	{:else}
		<div class="activity-error">Unable to parse glob event</div>
	{/if}
</div>

<style>
	.glob-pattern {
		background: color-mix(in oklab, var(--accent-amber) 15%, transparent);
		border: 1px solid color-mix(in oklab, var(--accent-amber) 25%, transparent);
		padding: var(--space-1) var(--space-2);
		border-radius: var(--radius-xs);
		color: var(--accent-amber);
		font-family: var(--font-mono);
		font-size: 0.9em;
	}

	.file-list {
		max-height: 200px;
		overflow-y: auto;
		font-size: 0.9em;
	}
</style>
