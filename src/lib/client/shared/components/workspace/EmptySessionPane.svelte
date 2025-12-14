<script>
	import Button from '../Button.svelte';

	let { onCreateSession = () => {} } = $props();

	function create(type) {
		onCreateSession?.(type);
	}
</script>

<div class="empty-state">
	<h2>Choose a session type to start</h2>
	<p>Select the type of session you want to create.</p>
	<div class="empty-actions">
		<Button onclick={() => create('pty')}>+ Terminal</Button>
		<Button onclick={() => create('claude')}>+ Claude Code</Button>
		<Button onclick={() => create('file-editor')}>+ File Editor</Button>
	</div>
</div>

<style>
	/* Background image overlay */
	.empty-state::before {
		content: '';
		position: absolute;
		inset: 0;
		opacity: 0.09;
		background-image: url('/fwdslsh-green-bg.png');
		background-repeat: no-repeat;
		background-position: center center;
		background-size: contain;
		pointer-events: none;
		z-index: -1;
	}
	.empty-state {
		gap: var(--space-3);
		place-items: center;
		padding: var(--space-4);
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.empty-state h2 {
		font-size: 1.05rem;
		color: var(--text-primary);
	}

	.empty-actions {
		display: flex;
		gap: var(--space-3);
		flex-wrap: wrap;
		justify-content: center;
	}

	@media (max-width: 768px) {
		.empty-actions {
			width: 100%;
		}
	}
</style>
