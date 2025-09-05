<!--
DirectoryBrowser.svelte - Directory listing and navigation component
Displays directories with navigation and selection options
~85 lines - handles empty states, loading, and error display
-->
<script>
	import { Button, ErrorDisplay } from '$lib/shared/components/Button.svelte';

	let {
		directories = [],
		error = null,
		loading = false,
		onNavigate = () => {},
		onSelect = () => {},
		onRetry = () => {}
	} = $props();

	// Handle directory navigation
	const handleNavigateToDirectory = (dirName) => {
		onNavigate(dirName);
	};

	// Handle directory selection
	const handleSelectDirectory = (dirName) => {
		onSelect({ detail: { path: dirName } });
	};

	// Handle keyboard navigation within directory list
	const handleDirectoryKeydown = (event, dirName, action) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			if (action === 'navigate') {
				handleNavigateToDirectory(dirName);
			} else if (action === 'select') {
				handleSelectDirectory(dirName);
			}
		}
	};
</script>

<div class="directory-browser">
	{#if error}
		<ErrorDisplay 
			{error}
			onRetry={onRetry}
			class="browser-error"
		/>
	{:else if directories.length === 0}
		<div class="empty-state">
			<div class="empty-icon">📁</div>
			<div class="empty-message">No subdirectories found</div>
		</div>
	{:else}
		<div class="directories-list">
			{#each directories as dir}
				<div class="directory-item">
					<button
						class="directory-name"
						onclick={() => handleNavigateToDirectory(dir.name)}
						onkeydown={(e) => handleDirectoryKeydown(e, dir.name, 'navigate')}
						title="Navigate into {dir.name}"
						tabindex="0"
					>
						📁 {dir.name}
						{#if dir.size}
							<span class="directory-size">({dir.size} items)</span>
						{/if}
					</button>
					
					<Button
						variant="outline"
						size="small"
						onclick={() => handleSelectDirectory(dir.name)}
						onkeydown={(e) => handleDirectoryKeydown(e, dir.name, 'select')}
						title="Select {dir.name}"
						class="select-dir-btn"
					>
						Select
					</Button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.directory-browser {
		padding: var(--space-xs);
	}

	:global(.browser-error) {
		margin: var(--space-sm);
	}

	.empty-state {
		padding: var(--space-lg);
		text-align: center;
		color: var(--text-muted);
	}

	.empty-icon {
		font-size: 2rem;
		margin-bottom: var(--space-sm);
		opacity: 0.5;
	}

	.empty-message {
		font-size: 0.9rem;
	}

	.directories-list {
		display: flex;
		flex-direction: column;
		gap: var(--space-xs);
	}

	.directory-item {
		display: flex;
		align-items: center;
		gap: var(--space-sm);
		padding: var(--space-xs);
		border-radius: 4px;
		transition: background-color 0.2s ease;
	}

	.directory-item:hover {
		background: rgba(0, 255, 136, 0.05);
	}

	.directory-name {
		flex: 1;
		text-align: left;
		background: none;
		border: none;
		color: var(--text-primary);
		cursor: pointer;
		padding: var(--space-xs);
		border-radius: 3px;
		transition: background-color 0.2s ease;
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: var(--space-xs);
	}

	.directory-name:hover {
		background: rgba(0, 255, 136, 0.1);
	}

	.directory-name:focus {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	.directory-size {
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-left: auto;
	}

	:global(.select-dir-btn) {
		font-size: 0.8rem !important;
		white-space: nowrap !important;
	}

	/* Mobile responsiveness */
	@media (max-width: 768px) {
		.directory-item {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-xs);
		}

		.directory-name {
			text-align: center;
			justify-content: center;
		}

		:global(.select-dir-btn) {
			align-self: stretch !important;
		}
	}
</style>