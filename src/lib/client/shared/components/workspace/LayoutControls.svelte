<!--
	Layout control buttons for switching between different workspace layouts
-->
<script>
	import IconButton from '../IconButton.svelte';
	import IconLayoutGrid from '../Icons/IconLayoutGrid.svelte';
	import IconDeviceDesktop from '../Icons/IconDeviceDesktop.svelte';

	let { viewMode = 'window-manager', onSelectView = () => {} } = $props();

	function handleSelect(mode) {
		console.log('[LayoutControls] handleSelect called:', { mode, currentViewMode: viewMode, willCall: viewMode !== mode });
		if (viewMode === mode) {
			console.log('[LayoutControls] Early return - already in this mode');
			return;
		}
		console.log('[LayoutControls] Calling onSelectView with mode:', mode);
		onSelectView?.(mode);
	}
</script>

<div class="layout-controls">
	<IconButton
		onclick={() => handleSelect('window-manager')}
		text="Window Manager"
		variant={viewMode === 'window-manager' ? 'primary' : 'ghost'}
		class={viewMode === 'window-manager' ? 'active' : ''}
		size="small"
	>
		<IconLayoutGrid size={18} />
	</IconButton>

	<IconButton
		onclick={() => handleSelect('single-session')}
		text="Single Session"
		variant={viewMode === 'single-session' ? 'primary' : 'ghost'}
		class={viewMode === 'single-session' ? 'active' : ''}
		size="small"
	>
		<IconDeviceDesktop size={18} />
	</IconButton>
</div>

<style>
	.layout-controls {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.layout-controls :global(.btn-icon-active) {
		font-weight: 600;
	}

	.layout-controls :global(.btn-icon-active svg) {
		color: var(--text-primary);
	}

	@media (max-width: 500px) {
		.layout-controls {
			display: none;
		}
	}
</style>
