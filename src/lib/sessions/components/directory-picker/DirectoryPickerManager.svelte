<!--
DirectoryPickerManager.svelte - Smart container component for directory picker
Integrates DirectoryPickerViewModel with UI components and manages all state
~95 lines - maintains MVVM patterns with foundation components
-->
<script>
	import { DirectoryPickerViewModel } from '../../viewmodels/directory-picker/DirectoryPickerViewModel.svelte.js';
	imp../../../services/DirectoryService.js../services/DirectoryService.js';
	import { ErrorDisplay, LoadingSpinner } from '$lib/shared/components/Button.svelte';
	import DirectoryPickerInput from './DirectoryPickerInput.svelte';
	import DirectoryPickerDropdown from './DirectoryPickerDropdown.svelte';

	let {
		socket = null,
		projectId = null,
		selectedPath = $bindable(''),
		disabled = false,
		onselect = () => {}
	} = $props();

	// Create model and services
	const model = {
		state: {
			isOpen: false,
			currentPath: '',
			selectedPath: selectedPath || '',
			directories: [],
			loading: false,
			error: null,
			pathHistory: [],
			breadcrumbs: ['/'],
			disabled: disabled,
			projectId: projectId,
			socketId: socket?.id || null
		},
		onChange: null,
		dispose: () => {}
	};

	// Initialize services
	const directoryService = new DirectoryService();
	if (socket) directoryService.setSocket(socket);

	const services = {
		directoryService,
		validationService: { validate: () => ({ isValid: true, errors: [] }) }
	};

	// Create ViewModel
	const viewModel = new DirectoryPickerViewModel(model, services);

	// Reactive updates for props
	$effect(() => {
		viewModel.setSelectedPath(selectedPath);
	});

	$effect(() => {
		viewModel.setDisabled(disabled);
	});

	$effect(() => {
		if (projectId !== viewModel.state.projectId) {
			viewModel.setProjectContext(projectId, socket?.id);
		}
	});

	// Handle selection events
	const handleSelect = (event) => {
		selectedPath = event.detail.path;
		onselect(event);
	};

	// Cleanup on unmount
	$effect.pre(() => {
		return () => {
			viewModel.dispose();
			directoryService.dispose();
		};
	});

	// Export for testing
	export { viewModel };
</script>

<div class="directory-picker-manager">
	{#if viewModel.error}
		<ErrorDisplay message={viewModel.error} onDismiss={() => viewModel.clearError()} />
	{/if}

	<DirectoryPickerInput
		selectedPath={viewModel.state.selectedPath}
		disabled={viewModel.state.disabled || !socket || !projectId}
		loading={viewModel.loading}
		onToggle={() => viewModel.togglePicker()}
		onClear={() => viewModel.clearSelection(handleSelect)}
	/>

	{#if viewModel.state.isOpen}
		{#if viewModel.loading}
			<div class="dropdown-loading">
				<LoadingSpinner size="small" />
				<span>Loading directories...</span>
			</div>
		{:else}
			<DirectoryPickerDropdown
				{viewModel}
				onSelect={handleSelect}
				onNavigate={(path) => viewModel.loadDirectories(path)}
				onGoBack={() => viewModel.goBack()}
				onSelectCurrent={() => viewModel.selectCurrentDirectory(handleSelect)}
			/>
		{/if}
	{/if}
</div>

<style>
	.directory-picker-manager {
		position: relative;
		margin-bottom: var(--space-sm);
	}

	.dropdown-loading {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 1000;
		background: rgba(26, 26, 26, 0.95);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 6px;
		backdrop-filter: blur(10px);
		padding: var(--space-md);
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		color: var(--text-muted);
		font-size: 0.9rem;
	}
</style>
