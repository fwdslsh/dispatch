<!--
	EmptyWorkspace.svelte

	Empty state component shown when no sessions are active
	Provides guidance and action buttons for creating sessions
-->
<script>
	// Props
	let {
		onCreateSession = () => {}
	} = $props();

	function handleCreateClaude() {
		onCreateSession('claude');
	}

	function handleCreateTerminal() {
		onCreateSession('terminal');
	}
</script>

<div class="empty-workspace">
	<div class="empty-content">
		<div class="empty-icon">
			<img src="/favicon.png" alt="Dispatch" height="64" />
		</div>
		<h1>Dispatch</h1>
		<p>Create a terminal or Claude Code session to get started</p>

		<div class="empty-actions">
			<button class="create-btn claude" onclick={handleCreateClaude}>
				<span class="btn-icon">🤖</span>
				<span class="btn-text">Create Claude Session</span>
			</button>
			<button class="create-btn terminal" onclick={handleCreateTerminal}>
				<span class="btn-icon">💻</span>
				<span class="btn-text">Create Terminal Session</span>
			</button>
		</div>
	</div>
</div>

<style>
	.empty-workspace {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--space-6);
	}

	.empty-content {
		text-align: center;
		color: var(--text-muted);
		max-width: 400px;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: var(--space-4);
		opacity: 0.8;
	}

	.empty-icon img {
		width: 64px;
		height: 64px;
		filter: drop-shadow(0 0 10px var(--primary-glow));
	}

	.empty-content h1 {
		font-size: 5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		opacity: 0.75;
		text-shadow: 0 0 10px var(--glow);
		margin: 0 0 var(--space-3) 0;
		font-family: var(--font-accent);
		color: var(--primary);
	}

	.empty-content p {
		margin: 0 0 var(--space-6) 0;
		font-size: var(--font-size-2);
		line-height: 1.5;
	}

	.empty-actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		align-items: center;
	}

	.create-btn {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		background: var(--surface-hover);
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		color: var(--text);
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 200px;
		text-align: left;
	}

	.create-btn:hover {
		background: var(--surface-active);
		border-color: var(--primary-dim);
		transform: translateY(-1px);
	}

	.create-btn.claude:hover {
		border-color: var(--primary);
		box-shadow: 0 4px 12px rgba(46, 230, 107, 0.2);
	}

	.create-btn.terminal:hover {
		border-color: var(--accent-amber);
		box-shadow: 0 4px 12px rgba(255, 159, 28, 0.2);
	}

	.btn-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.btn-text {
		font-weight: 500;
	}

	/* Mobile adjustments */
	@media (max-width: 768px) {
		.empty-content h1 {
			font-size: 3rem;
		}

		.empty-actions {
			width: 100%;
		}

		.create-btn {
			width: 100%;
			justify-content: center;
		}
	}

	/* Very small screens */
	@media (max-width: 480px) {
		.empty-workspace {
			padding: var(--space-4);
		}

		.empty-content h1 {
			font-size: 2.5rem;
		}

		.create-btn {
			min-width: unset;
			padding: var(--space-2) var(--space-3);
		}
	}
</style>