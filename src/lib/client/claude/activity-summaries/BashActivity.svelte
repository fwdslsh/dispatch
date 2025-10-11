<script>
	let { event } = $props();

	let commandInfo = $derived(parseBashEvent(event));

	function parseBashEvent(e) {
		if (!e) return null;

		try {
			const input = e.input || e;
			return {
				command: input.command || input.cmd || '',
				description: input.description || '',
				runInBackground: input.run_in_background || input.runInBackground || false,
				timeout: input.timeout || null,
				output: extractOutput(e.result),
				exitCode: extractExitCode(e.result),
				success: e.result !== undefined || e.success !== false,
				error: e.error || null
			};
		} catch (err) {
			return {
				command: 'Parse error',
				error: err.message,
				success: false
			};
		}
	}

	function extractOutput(result) {
		if (!result) return null;
		if (typeof result === 'string') return result;
		if (result.output) return result.output;
		if (result.stdout) return result.stdout;
		return null;
	}

	function extractExitCode(result) {
		if (!result) return null;
		if (result.exitCode !== undefined) return result.exitCode;
		if (result.exit_code !== undefined) return result.exit_code;
		return null;
	}

	function formatCommand(cmd) {
		if (!cmd) return '';
		// Truncate very long commands
		if (cmd.length > 200) {
			return cmd.substring(0, 200) + '...';
		}
		return cmd;
	}

	function formatOutput(output) {
		if (!output) return null;

		// Limit output lines for display
		const lines = output.split('\n');
		if (lines.length > 20) {
			return {
				preview: lines.slice(0, 20).join('\n'),
				truncated: true,
				totalLines: lines.length
			};
		}

		return {
			preview: output,
			truncated: false,
			totalLines: lines.length
		};
	}
</script>

<div class="activity-detail bash-activity">
	{#if commandInfo}
		{#if commandInfo.description}
			<div class="activity-row">
				<span class="activity-label">Action</span>
				<span class="activity-value">
					{commandInfo.description}
				</span>
			</div>
		{/if}

		<div class="activity-row">
			<span class="activity-label">Command</span>
		</div>
		<pre class="activity-code command-display">{formatCommand(commandInfo.command)}</pre>

		{#if commandInfo.runInBackground}
			<div class="activity-row">
				<span class="activity-label">Mode</span>
				<span class="activity-value">
					<span class="activity-badge background">Background</span>
				</span>
			</div>
		{/if}

		{#if commandInfo.timeout}
			<div class="activity-row">
				<span class="activity-label">Timeout</span>
				<span class="activity-value">
					{commandInfo.timeout}ms
				</span>
			</div>
		{/if}

		{#if commandInfo.output}
			{@const outputInfo = formatOutput(commandInfo.output)}
			<div class="activity-result">
				<div class="activity-row">
					<span class="activity-label">Output</span>
					{#if outputInfo.totalLines > 1}
						<span class="activity-value muted">
							{outputInfo.totalLines} lines
						</span>
					{/if}
				</div>
				<pre class="activity-code output-display">{outputInfo.preview}</pre>
				{#if outputInfo.truncated}
					<div class="activity-truncated">
						Showing first 20 lines of {outputInfo.totalLines} total
					</div>
				{/if}
			</div>
		{/if}

		<div class="activity-row">
			<span class="activity-label">Status</span>
			<span class="activity-value">
				{#if commandInfo.error}
					<span class="activity-error">Error: {commandInfo.error}</span>
				{:else if commandInfo.exitCode !== null}
					{#if commandInfo.exitCode === 0}
						<span class="activity-success">Success (exit code: 0)</span>
					{:else}
						<span class="activity-error">Failed (exit code: {commandInfo.exitCode})</span>
					{/if}
				{:else if commandInfo.success}
					<span class="activity-success">Command executed</span>
				{:else}
					<span class="muted">Unknown</span>
				{/if}
			</span>
		</div>
	{:else}
		<div class="activity-error">Unable to parse bash event</div>
	{/if}
</div>

<style>
	.command-display {
		background: color-mix(in oklab, var(--bg) 98%, var(--accent-cyan) 2%);
		border-color: color-mix(in oklab, var(--accent-cyan) 15%, transparent);
		color: var(--text);
	}

	.output-display {
		max-height: 300px;
		overflow-y: auto;
	}

	.activity-badge {
		display: inline-block;
		padding: 2px 6px;
		border-radius: var(--radius-xs);
		font-size: 0.75em;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.activity-badge.background {
		background: color-mix(in oklab, var(--accent-cyan) 20%, transparent);
		color: var(--accent-cyan);
		border: 1px solid color-mix(in oklab, var(--accent-cyan) 30%, transparent);
	}

	.muted {
		opacity: 0.7;
		font-size: 0.9em;
	}
</style>
