<!--
	LayoutControls.svelte

	Layout control buttons for switching between different workspace layouts
	Integrates with LayoutViewModel for state management
-->
<script>
	import IconButton from '../IconButton.svelte';
	import { IconLayoutGrid, IconDeviceDesktop } from '@tabler/icons-svelte';

	let {
		viewMode = 'window-manager',
		onSelectView = () => {}
	} = $props();

	function handleSelect(mode) {
		if (viewMode === mode) return;
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

	.layout-controls :global(.btn-icon-only.active) {
		font-weight: 600;
	}

	.layout-controls :global(.btn-icon-only.active svg) {
		color: var(--text-primary);
	}
</style>
