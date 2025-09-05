<!--
DirectoryPickerDropdown.svelte - Dropdown container with header and content
Contains breadcrumbs navigation, actions, and directory browser
~80 lines - manages dropdown layout and navigation controls
-->
<script>
	import { Button, Card } from '../foundation/index.js';
	import DirectoryBrowser from './DirectoryBrowser.svelte';

	let {
		viewModel,
		onSelect = () => {},
		onNavigate = () => {},
		onGoBack = () => {},
		onSelectCurrent = () => {}
	} = $props();

	// Handle breadcrumb navigation
	const handleBreadcrumbClick = async (index) => {
		await viewModel.navigateToBreadcrumb(index);
	};

	// Handle escape key to close dropdown
	const handleKeydown = (event) => {
		if (event.key === 'Escape') {
			viewModel.closePicker();
		}
	};

	// Add global event listener for escape
	$effect(() => {
		if (viewModel.state.isOpen) {
			document.addEventListener('keydown', handleKeydown);
			return () => document.removeEventListener('keydown', handleKeydown);
		}
	});
</script>

<Card class="picker-dropdown" elevation={2}>
	<div class="picker-header">
		<div class="breadcrumbs">
			{#each viewModel.state.breadcrumbs as crumb, index}
				<Button
					variant="ghost"
					size="small"
					class="breadcrumb {index === viewModel.state.breadcrumbs.length - 1 ? 'active' : ''}"
					onclick={() => handleBreadcrumbClick(index)}
				>
					{crumb === '/' ? '🏠' : crumb}
				</Button>
				{#if index < viewModel.state.breadcrumbs.length - 1}
					<span class="breadcrumb-separator">/</span>
				{/if}
			{/each}
		</div>
		
		<div class="picker-actions">
			{#if viewModel.canGoBack}
				<Button
					variant="outline"
					size="small"
					onclick={onGoBack}
					title="Go back"
				>
					←
				</Button>
			{/if}
			
			<Button
				variant="primary"
				size="small"
				onclick={onSelectCurrent}
				title="Select current directory"
			>
				Select "{viewModel.currentDirectory}"
			</Button>
		</div>
	</div>

	<div class="picker-content">
		<DirectoryBrowser
			directories={viewModel.state.directories}
			error={viewModel.state.error}
			loading={viewModel.loading}
			onNavigate={onNavigate}
			onSelect={onSelect}
			onRetry={() => viewModel.reloadCurrentDirectory()}
		/>
	</div>
</Card>

<style>
	:global(.picker-dropdown) {
		position: absolute !important;
		top: 100% !important;
		left: 0 !important;
		right: 0 !important;
		z-index: 1000 !important;
		max-height: 300px !important;
		overflow: hidden !important;
		display: flex !important;
		flex-direction: column !important;
	}

	.picker-header {
		padding: var(--space-sm);
		border-bottom: 1px solid rgba(0, 255, 136, 0.2);
		background: rgba(26, 26, 26, 0.8);
	}

	.breadcrumbs {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		margin-bottom: var(--space-xs);
		flex-wrap: wrap;
	}

	:global(.breadcrumb) {
		font-size: 0.8rem !important;
		padding: var(--space-xs) !important;
	}

	:global(.breadcrumb.active) {
		background: var(--accent) !important;
		color: var(--bg) !important;
	}

	.breadcrumb-separator {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.picker-actions {
		display: flex;
		gap: var(--space-xs);
		align-items: center;
	}

	.picker-content {
		flex: 1;
		overflow-y: auto;
		max-height: 200px;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		:global(.picker-dropdown) {
			max-height: 250px !important;
		}

		.breadcrumbs {
			font-size: 0.75rem;
		}

		.picker-actions {
			flex-direction: column;
			gap: var(--space-xs);
			align-items: stretch;
		}
	}
</style>