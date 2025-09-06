<script>
	import { onMount, onDestroy } from 'svelte';
	import { CommandMenuViewModel } from '../CommandMenuViewModel.svelte.js';
	import { CommandService } from './CommandService.js';
	import CommandSearchInput from './CommandSearchInput.svelte';
	import CommandList from './CommandList.svelte';

	// Props with defaults
	let {
		visible = false,
		commands = [],
		sessionId = 'default',
		onExecuteCommand = () => {},
		onClose = () => {}
	} = $props();

	// Create service and ViewModel instances
	const commandService = new CommandService({
		onExecute: onExecuteCommand,
		cacheEnabled: true
	});

	const model = {
		state: {
			visible,
			searchQuery: '',
			selectedIndex: 0,
			filteredCommands: commands,
			commands: commands,
			sessionId,
			cacheEnabled: true
		},
		onChange: null,
		dispose: () => {}
	};

	const viewModel = new CommandMenuViewModel(model, { commandService });

	// Component state
	let searchInputRef;
	let dialogRef;
	
	// Reactive updates from props
	$effect(() => {
		if (viewModel && !viewModel.isDisposed) {
			viewModel.updateField('visible', visible);
		}
	});

	$effect(() => {
		if (viewModel && !viewModel.isDisposed && Array.isArray(commands)) {
			viewModel.setCommands(commands);
		}
	});

	// Expose public methods
	export function show() {
		viewModel.show();
		// Focus search input after DOM update
		setTimeout(() => {
			if (searchInputRef?.focus) {
				searchInputRef.focus();
			}
		}, 0);
	}

	export function hide() {
		viewModel.hide();
		onClose();
	}

	export function toggle() {
		if (viewModel.isVisible) {
			hide();
		} else {
			show();
		}
	}

	export function setCommands(newCommands) {
		viewModel.setCommands(newCommands);
	}

	export function clearCache() {
		viewModel.clearCache();
	}

	export function saveCommandCache() {
		viewModel.saveToCache();
	}

	// Keyboard event handling
	let keydownHandler;

	onMount(() => {
		setupKeyboardListeners();
	});

	onDestroy(() => {
		if (keydownHandler) {
			document.removeEventListener('keydown', keydownHandler);
		}
		if (viewModel && !viewModel.isDisposed) {
			viewModel.dispose();
		}
		commandService.dispose();
	});

	function setupKeyboardListeners() {
		keydownHandler = (event) => {
			// Handle global shortcut (Ctrl+K or Cmd+K)
			if (viewModel.handleGlobalShortcut(event)) {
				visible = viewModel.isVisible;
				return;
			}

			// Handle menu navigation when visible
			if (viewModel.handleKeyboardEvent(event)) {
				// Update visible state if changed
				visible = viewModel.isVisible;
			}
		};

		document.addEventListener('keydown', keydownHandler);
	}

	function handleOverlayClick(event) {
		if (event.target === event.currentTarget) {
			hide();
		}
	}

	function handleSearchChange(query) {
		viewModel.updateSearchQuery(query);
	}

	function handleCommandSelect(index) {
		viewModel.selectCommand(index);
	}

	function handleCommandExecute(command) {
		viewModel.executeCommand(command);
		visible = viewModel.isVisible;
	}

	// Update visible state when ViewModel state changes
	$effect(() => {
		visible = viewModel.isVisible;
	});
</script>

{#if viewModel.isVisible}
	<div class="command-menu" role="dialog" aria-modal="true" aria-label="Command Menu">
		<div class="command-menu-overlay" on:click={handleOverlayClick}>
			<div 
				bind:this={dialogRef}
				class="command-menu-dialog" 
				data-augmented-ui="tl-clip tr-clip border"
			>
				<CommandSearchInput
					bind:this={searchInputRef}
					query={viewModel.searchQuery}
					placeholder="Search commands... (↑↓ to navigate, ⏎ to select)"
					shortcut="Ctrl+K"
					onInput={handleSearchChange}
				/>

				<CommandList
					commands={viewModel.state.filteredCommands}
					selectedIndex={viewModel.state.selectedIndex}
					loading={viewModel.loading}
					error={viewModel.error}
					onCommandSelect={handleCommandSelect}
					onCommandExecute={handleCommandExecute}
				/>

				<!-- Footer -->
				<div class="command-footer">
					<div class="command-help">
						<span class="help-item">
							<span class="key">⏎</span> Execute
						</span>
						<span class="help-item">
							<span class="key">↑↓</span> Navigate
						</span>
						<span class="help-item">
							<span class="key">Esc</span> Close
						</span>
					</div>
					<div class="command-count">
						{viewModel.commandCount} command{viewModel.commandCount !== 1 ? 's' : ''}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.command-menu {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1000;
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 10vh;
		font-family: var(--font-sans);
	}

	.command-menu-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
	}

	.command-menu-dialog {
		position: relative;
		width: 90%;
		max-width: 600px;
		background: var(--bg-darker);
		border: 1px solid var(--border-light);
		border-radius: 12px;
		box-shadow:
			0 20px 60px rgba(0, 0, 0, 0.6),
			0 0 0 1px var(--primary-muted);
		overflow: hidden;
	}

	.command-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-sm) var(--space-md);
		background: var(--surface);
		border-top: 1px solid var(--border);
	}

	.command-help {
		display: flex;
		align-items: center;
		gap: var(--space-md);
	}

	.help-item {
		display: flex;
		align-items: center;
		gap: var(--space-xs);
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.key {
		background: var(--bg-darker);
		color: var(--text-secondary);
		padding: 2px 4px;
		border-radius: 3px;
		font-family: var(--font-mono);
		font-size: 0.75rem;
		border: 1px solid var(--border);
		min-width: 20px;
		text-align: center;
	}

	.command-count {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.command-menu {
			padding-top: 5vh;
		}

		.command-menu-dialog {
			width: 95%;
			margin: 0 var(--space-sm);
		}

		.command-help {
			gap: var(--space-sm);
		}

		.help-item {
			font-size: 0.7rem;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.command-menu-dialog {
			border-width: 2px;
		}
	}
</style>