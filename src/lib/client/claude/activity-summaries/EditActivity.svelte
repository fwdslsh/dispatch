<script>
	let { event } = $props();

	let editInfo = $derived(parseEditEvent(event));

	function parseEditEvent(e) {
		if (!e) return null;

		try {
			const input = e.input || e;
			return {
				path: input.file_path || input.path || 'Unknown file',
				oldString: input.old_string || input.oldString || '',
				newString: input.new_string || input.newString || '',
				replaceAll: input.replace_all || input.replaceAll || false,
				success: e.result !== undefined || e.success !== false,
				error: e.error || null,
				editsCount: extractEditsCount(input)
			};
		} catch (err) {
			return {
				path: 'Parse error',
				error: err.message,
				success: false
			};
		}
	}

	function extractEditsCount(input) {
		// Check if this is a MultiEdit with multiple edits
		if (input.edits && Array.isArray(input.edits)) {
			return input.edits.length;
		}
		return 1;
	}

	function formatPath(path) {
		if (!path) return 'Unknown';
		const parts = path.split('/');
		if (parts.length > 3) {
			return '.../' + parts.slice(-3).join('/');
		}
		return path;
	}

	function truncateString(str, maxLength = 100) {
		if (!str) return '';
		if (str.length <= maxLength) return str;
		return str.substring(0, maxLength) + '...';
	}

	function getDiffPreview(oldStr, newStr) {
		// Simple diff visualization
		const oldLines = (oldStr || '').split('\n');
		const newLines = (newStr || '').split('\n');

		return {
			oldPreview: oldLines.slice(0, 3).join('\n'),
			newPreview: newLines.slice(0, 3).join('\n'),
			oldTruncated: oldLines.length > 3,
			newTruncated: newLines.length > 3
		};
	}
</script>

<div class="activity-detail edit-activity">
	{#if editInfo}
		<div class="activity-row">
			<span class="activity-label">File</span>
			<span class="activity-value">
				<span class="activity-path" title={editInfo.path}>
					{formatPath(editInfo.path)}
				</span>
				{#if editInfo.editsCount > 1}
					<span class="activity-badge multi">{editInfo.editsCount} edits</span>
				{/if}
			</span>
		</div>

		{#if editInfo.replaceAll}
			<div class="activity-row">
				<span class="activity-label">Mode</span>
				<span class="activity-value"> Replace all occurrences </span>
			</div>
		{/if}

		{@const diff = getDiffPreview(editInfo.oldString, editInfo.newString)}

		{#if editInfo.oldString}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label diff-label removed">- Old</span>
				</div>
				<pre class="activity-code diff-old">{diff.oldPreview}</pre>
				{#if diff.oldTruncated}
					<div class="activity-truncated">Content truncated</div>
				{/if}
			</div>
		{/if}

		{#if editInfo.newString}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label diff-label added">+ New</span>
				</div>
				<pre class="activity-code diff-new">{diff.newPreview}</pre>
				{#if diff.newTruncated}
					<div class="activity-truncated">Content truncated</div>
				{/if}
			</div>
		{/if}

		{#if editInfo.error}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-error">
					Error: {editInfo.error}
				</span>
			</div>
		{:else if editInfo.success}
			<div class="activity-row">
				<span class="activity-label">Status</span>
				<span class="activity-value activity-success"> Edit applied successfully </span>
			</div>
		{/if}
	{:else}
		<div class="activity-error">Unable to parse edit event</div>
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

	.activity-badge.multi {
		background: color-mix(in oklab, var(--accent-amber) 20%, transparent);
		color: var(--accent-amber);
		border: 1px solid color-mix(in oklab, var(--accent-amber) 30%, transparent);
	}

	.diff-label.removed {
		color: var(--err);
	}

	.diff-label.added {
		color: var(--ok);
	}

	.diff-old {
		background: color-mix(in oklab, var(--err) 5%, var(--bg) 95%);
		border-color: color-mix(in oklab, var(--err) 15%, transparent);
	}

	.diff-new {
		background: color-mix(in oklab, var(--ok) 5%, var(--bg) 95%);
		border-color: color-mix(in oklab, var(--ok) 15%, transparent);
	}
</style>
