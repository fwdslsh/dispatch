<script>
	/**
	 * CommandPalette Component
	 *
	 * Power-user command palette with fuzzy search and keyboard navigation.
	 * Triggered by Cmd/Ctrl+K for quick access to all app features.
	 *
	 * @file src/lib/client/shared/components/CommandPalette.svelte
	 */
	import { goto } from '$app/navigation';
	import IconSearch from './Icons/IconSearch.svelte';
	import IconTerminal from './Icons/IconTerminal.svelte';
	import IconRobot from './Icons/IconRobot.svelte';
	import IconSettings from './Icons/IconSettings.svelte';
	import IconFolder from './Icons/IconFolder.svelte';
	import IconPlus from './Icons/IconPlus.svelte';
	import IconHistory from './Icons/IconHistory.svelte';
	import IconLogout from './Icons/IconLogout.svelte';

	let {
		/** @type {boolean} */
		open = $bindable(false),
		/** @type {() => void} */
		onCreateTerminal = () => {},
		/** @type {() => void} */
		onCreateAI = () => {},
		/** @type {() => void} */
		onLogout = () => {}
	} = $props();

	// Search state
	let searchQuery = $state('');
	let selectedIndex = $state(0);
	let inputRef = $state(null);

	// Command definitions
	const commands = [
		{
			id: 'new-terminal',
			label: 'New Terminal Tab',
			description: 'Create a new terminal tab',
			icon: IconTerminal,
			shortcut: '⌘T',
			category: 'Tabs',
			action: () => {
				onCreateTerminal();
				close();
			}
		},
		{
			id: 'new-ai',
			label: 'New AI Tab',
			description: 'Start a new AI agent tab',
			icon: IconRobot,
			shortcut: '⌘I',
			category: 'Tabs',
			action: () => {
				onCreateAI();
				close();
			}
		},
		{
			id: 'workspace',
			label: 'Go to Project',
			description: 'Open the main project',
			icon: IconFolder,
			shortcut: '⌘1',
			category: 'Navigation',
			action: () => {
				goto('/workspace');
				close();
			}
		},
		{
			id: 'cron',
			label: 'Go to Tasks',
			description: 'Manage scheduled tasks',
			icon: IconHistory,
			shortcut: '⌘2',
			category: 'Navigation',
			action: () => {
				goto('/cron');
				close();
			}
		},
		{
			id: 'settings',
			label: 'Open Settings',
			description: 'Configure application settings',
			icon: IconSettings,
			shortcut: '⌘,',
			category: 'Navigation',
			action: () => {
				goto('/settings');
				close();
			}
		},
		{
			id: 'logout',
			label: 'Logout',
			description: 'Sign out of your account',
			icon: IconLogout,
			category: 'Account',
			action: () => {
				onLogout();
				close();
			}
		}
	];

	// Fuzzy search filter
	const filteredCommands = $derived.by(() => {
		if (!searchQuery.trim()) return commands;

		const query = searchQuery.toLowerCase();
		return commands
			.filter(
				(cmd) =>
					cmd.label.toLowerCase().includes(query) ||
					cmd.description.toLowerCase().includes(query) ||
					cmd.category.toLowerCase().includes(query)
			)
			.sort((a, b) => {
				// Prioritize exact label matches
				const aLabelMatch = a.label.toLowerCase().startsWith(query);
				const bLabelMatch = b.label.toLowerCase().startsWith(query);
				if (aLabelMatch && !bLabelMatch) return -1;
				if (!aLabelMatch && bLabelMatch) return 1;
				return 0;
			});
	});

	// Group commands by category
	const groupedCommands = $derived.by(() => {
		const groups = {};
		for (const cmd of filteredCommands) {
			if (!groups[cmd.category]) {
				groups[cmd.category] = [];
			}
			groups[cmd.category].push(cmd);
		}
		return groups;
	});

	// Reset selection when query changes
	$effect(() => {
		if (searchQuery !== undefined) {
			selectedIndex = 0;
		}
	});

	// Focus input when opened
	$effect(() => {
		if (open && inputRef) {
			requestAnimationFrame(() => inputRef.focus());
		}
	});

	// Global keyboard shortcut to open
	if (typeof window !== 'undefined') {
		$effect(() => {
			function handleGlobalKeydown(e) {
				// Cmd/Ctrl + K to open
				if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
					e.preventDefault();
					open = !open;
				}

				// Escape to close
				if (e.key === 'Escape' && open) {
					e.preventDefault();
					close();
				}
			}

			window.addEventListener('keydown', handleGlobalKeydown);
			return () => window.removeEventListener('keydown', handleGlobalKeydown);
		});
	}

	function close() {
		open = false;
		searchQuery = '';
		selectedIndex = 0;
	}

	function handleKeydown(e) {
		const total = filteredCommands.length;

		switch (e.key) {
			case 'ArrowDown':
				e.preventDefault();
				selectedIndex = (selectedIndex + 1) % total;
				break;
			case 'ArrowUp':
				e.preventDefault();
				selectedIndex = (selectedIndex - 1 + total) % total;
				break;
			case 'Enter':
				e.preventDefault();
				if (filteredCommands[selectedIndex]) {
					filteredCommands[selectedIndex].action();
				}
				break;
			case 'Escape':
				e.preventDefault();
				close();
				break;
		}
	}

	function handleBackdropClick(e) {
		if (e.target === e.currentTarget) {
			close();
		}
	}

	function executeCommand(cmd) {
		cmd.action();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="palette-backdrop" onclick={handleBackdropClick} onkeydown={handleKeydown}>
		<div class="palette-container" role="dialog" aria-label="Command palette">
			<!-- Search input -->
			<div class="palette-header">
				<IconSearch size={18} />
				<input
					bind:this={inputRef}
					bind:value={searchQuery}
					type="text"
					class="palette-input"
					placeholder="Search commands..."
					autocomplete="off"
					autocorrect="off"
					autocapitalize="off"
					spellcheck="false"
				/>
				<kbd class="palette-shortcut">ESC</kbd>
			</div>

			<!-- Command list -->
			<div class="palette-list custom-scrollbar">
				{#if filteredCommands.length === 0}
					<div class="palette-empty">
						<p>No commands found for "{searchQuery}"</p>
					</div>
				{:else}
					{#each Object.entries(groupedCommands) as [category, cmds], groupIndex}
						<div class="palette-group">
							<div class="palette-group-label">{category}</div>
							{#each cmds as cmd, cmdIndex}
								{@const flatIndex =
									Object.values(groupedCommands)
										.slice(0, groupIndex)
										.reduce((sum, g) => sum + g.length, 0) + cmdIndex}
								{@const IconComponent = cmd.icon}
								<button
									class="palette-item"
									class:selected={selectedIndex === flatIndex}
									onclick={() => executeCommand(cmd)}
									onmouseenter={() => (selectedIndex = flatIndex)}
								>
									<span class="item-icon">
										<IconComponent size={16} />
									</span>
									<span class="item-content">
										<span class="item-label">{cmd.label}</span>
										<span class="item-description">{cmd.description}</span>
									</span>
									{#if cmd.shortcut}
										<kbd class="item-shortcut">{cmd.shortcut}</kbd>
									{/if}
								</button>
							{/each}
						</div>
					{/each}
				{/if}
			</div>

			<!-- Footer hint -->
			<div class="palette-footer">
				<span><kbd>↑↓</kbd> Navigate</span>
				<span><kbd>↵</kbd> Select</span>
				<span><kbd>ESC</kbd> Close</span>
			</div>
		</div>
	</div>
{/if}

<style>
	.palette-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: flex-start;
		justify-content: center;
		padding-top: 15vh;
		z-index: 1000;
		animation: fade-in 0.15s ease-out;
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.palette-container {
		width: 100%;
		max-width: 560px;
		margin: 0 var(--space-4);
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius);
		box-shadow:
			0 24px 48px rgba(0, 0, 0, 0.4),
			0 0 0 1px var(--primary-glow-10);
		overflow: hidden;
		animation: slide-down 0.2s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes slide-down {
		from {
			opacity: 0;
			transform: translateY(-20px) scale(0.98);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.palette-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-bottom: 1px solid var(--surface-border);
		color: var(--text-muted);
	}

	.palette-input {
		flex: 1;
		background: transparent;
		border: none;
		color: var(--text);
		font-size: var(--font-size-3);
		font-family: var(--font-mono);
		outline: none;
	}

	.palette-input::placeholder {
		color: var(--text-muted);
	}

	.palette-list {
		max-height: 400px;
		overflow-y: auto;
		padding: var(--space-2);
	}

	.palette-empty {
		padding: var(--space-6) var(--space-4);
		text-align: center;
		color: var(--text-muted);
	}

	.palette-group {
		margin-bottom: var(--space-2);
	}

	.palette-group-label {
		padding: var(--space-2) var(--space-3);
		font-size: var(--font-size-1);
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.palette-item {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		width: 100%;
		padding: var(--space-3);
		background: transparent;
		border: none;
		border-radius: var(--radius);
		color: var(--text);
		text-align: left;
		cursor: pointer;
		transition: background 0.1s ease;
	}

	.palette-item:hover,
	.palette-item.selected {
		background: var(--surface-hover);
	}

	.palette-item.selected {
		background: color-mix(in oklab, var(--primary) 15%, transparent);
	}

	.item-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		background: var(--bg);
		border-radius: var(--radius);
		color: var(--primary);
		flex-shrink: 0;
	}

	.palette-item.selected .item-icon {
		background: var(--primary);
		color: var(--bg);
	}

	.item-content {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.item-label {
		font-weight: 500;
		font-size: var(--font-size-2);
	}

	.item-description {
		font-size: var(--font-size-1);
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.palette-shortcut,
	.item-shortcut {
		padding: var(--space-1) var(--space-2);
		background: var(--bg);
		border: 1px solid var(--surface-border);
		border-radius: var(--radius-sm);
		font-size: 11px;
		font-family: var(--font-mono);
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.palette-footer {
		display: flex;
		gap: var(--space-4);
		padding: var(--space-2) var(--space-4);
		border-top: 1px solid var(--surface-border);
		font-size: var(--font-size-1);
		color: var(--text-muted);
	}

	.palette-footer kbd {
		padding: 2px 6px;
		background: var(--bg);
		border: 1px solid var(--surface-border);
		border-radius: 3px;
		font-size: 10px;
		margin-right: 4px;
	}

	/* Mobile adjustments */
	@media (max-width: 640px) {
		.palette-backdrop {
			padding-top: var(--space-4);
			align-items: flex-start;
		}

		.palette-container {
			margin: 0 var(--space-2);
			max-height: calc(100vh - var(--space-8));
		}

		.palette-footer {
			display: none;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.palette-backdrop,
		.palette-container {
			animation: none;
		}
	}
</style>
