<script>
	import Button from '../Button.svelte';
	import { TAB_TYPE } from '$lib/shared/tab-types.js';

	let { onCreateTab = () => {} } = $props();

	function create(type) {
		onCreateTab?.(type);
	}
</script>

<div class="empty-state">
	<h2>Choose a tab type to start</h2>
	<p>Select the type of tab you want to create.</p>
	<div class="empty-actions">
		<Button onclick={() => create(TAB_TYPE.TERMINAL)}>+ Terminal</Button>
		<Button onclick={() => create(TAB_TYPE.AI)}>+ AI Agent</Button>
		<Button onclick={() => create(TAB_TYPE.FILE_EDITOR)}>+ File Editor</Button>
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
