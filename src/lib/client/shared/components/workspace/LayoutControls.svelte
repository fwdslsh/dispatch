<!--
	LayoutControls.svelte

	Layout control buttons for switching between different workspace layouts
	Integrates with LayoutViewModel for state management
-->
<script>
	import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
	import { setLayoutPreset, uiState } from '$lib/client/shared/state/ui-state.svelte.js';
	import IconButton from '../IconButton.svelte';
	import { IconAppWindow, IconBorderVertical, IconBorderHorizontal } from '@tabler/icons-svelte';

	// Get current layout from UI state
	const currentLayout = $derived(uiState.layout.preset);

	// Layout control handlers
	function setLayout(preset) {
		setLayoutPreset(preset);
	}
</script>

<div class="layout-controls">
	<IconButton
		onclick={() => setLayout('1up')}
		text="1up"
		variant={currentLayout === '1up' ? 'primary' : 'ghost'}
		class={currentLayout === '1up' ? 'active' : ''}
		size="small"
	>
		<IconAppWindow size={18} />
	</IconButton>

	<IconButton
		onclick={() => setLayout('2up')}
		text="2up"
		variant={currentLayout === '2up' ? 'primary' : 'ghost'}
		class={currentLayout === '2up' ? 'active' : ''}
		size="small"
	>
		<IconBorderVertical size={18} />
	</IconButton>

	<IconButton
		onclick={() => setLayout('4up')}
		text="4up"
		variant={currentLayout === '4up' ? 'primary' : 'ghost'}
		class={currentLayout === '4up' ? 'active' : ''}
		size="small"
	>
		<IconBorderHorizontal size={18} />
	</IconButton>
</div>

<style>
	.layout-controls {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	/* Hide on mobile and tablet where layout switching isn't relevant */
	@media (max-width: 1024px) {
		.layout-controls {
			display: none;
		}
	}
</style>
