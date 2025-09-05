<script>
	import { LoadingSpinner, ErrorDisplay } from '$lib/shared/components/Button.svelte';
	import CommandItem from './CommandItem.svelte';

	// Props
	let {
		commands = [],
		selectedIndex = 0,
		loading = false,
		error = null,
		onCommandSelect = () => {},
		onCommandExecute = () => {}
	} = $props();

	// Derived state
	let hasCommands = $derived(Array.isArray(commands) && commands.length > 0);
	let commandCount = $derived(commands?.length || 0);
</script>

<div class="command-list" role="listbox">
	{#if loading}
		<div class="command-list-state">
			<LoadingSpinner size="small" />
			<span class="state-text">Loading commands...</span>
		</div>
	{:else if error}
		<div class="command-list-state">
			<ErrorDisplay 
				message={error} 
				variant="compact"
				showRetry={false}
			/>
		</div>
	{:else if !hasCommands}
		<div class="no-results">
			<div class="no-results-icon">🔍</div>
			<div class="no-results-text">No commands found</div>
			<div class="no-results-hint">Try a different search term</div>
		</div>
	{:else}
		{#each commands as command, index (command.name || index)}
			<CommandItem
				{command}
				selected={index === selectedIndex}
				onSelect={() => onCommandSelect(index)}
				onExecute={() => onCommandExecute(command)}
			/>
		{/each}
	{/if}
</div>

<style>
	.command-list {
		max-height: 400px;
		overflow-y: auto;
		background: var(--bg-dark);
	}

	.command-list::-webkit-scrollbar {
		width: 6px;
	}

	.command-list::-webkit-scrollbar-track {
		background: var(--bg-darker);
	}

	.command-list::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 3px;
	}

	.command-list::-webkit-scrollbar-thumb:hover {
		background: var(--border-light);
	}

	.command-list-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-xl);
		gap: var(--space-md);
		min-height: 120px;
	}

	.state-text {
		color: var(--text-secondary);
		font-size: 0.9rem;
	}

	.no-results {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--space-3xl) var(--space-xl);
		text-align: center;
		min-height: 200px;
	}

	.no-results-icon {
		font-size: 2rem;
		margin-bottom: var(--space-sm);
		opacity: 0.5;
	}

	.no-results-text {
		color: var(--text-secondary);
		font-size: 1.1rem;
		margin-bottom: var(--space-xs);
		font-weight: 500;
	}

	.no-results-hint {
		color: var(--text-muted);
		font-size: 0.9rem;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.command-list {
			max-height: 300px;
		}

		.no-results {
			padding: var(--space-xl) var(--space-md);
			min-height: 160px;
		}

		.no-results-icon {
			font-size: 1.5rem;
		}

		.no-results-text {
			font-size: 1rem;
		}

		.no-results-hint {
			font-size: 0.8rem;
		}
	}

	/* Focus and keyboard navigation styles */
	@media (prefers-reduced-motion: no-preference) {
		.command-list {
			scroll-behavior: smooth;
		}
	}
</style>