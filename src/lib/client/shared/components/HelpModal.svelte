<script>
	import Modal from './Modal.svelte';

	// Props
	let { open = $bindable(false) } = $props();

	// Window manager shortcuts
	const shortcuts = [
		{
			category: 'Pane Management',
			items: [
				{ keys: 'Ctrl + Enter', description: 'Add pane to the right' },
				{ keys: 'Ctrl + Shift + Enter', description: 'Add pane below' },
				{ keys: 'Ctrl + Shift + X', description: 'Close current pane' }
			]
		},
		{
			category: 'Navigation',
			items: [
				{ keys: 'Alt + →', description: 'Focus next pane' },
				{ keys: 'Alt + ←', description: 'Focus previous pane' }
			]
		},
		{
			category: 'Resizing',
			items: [
				{ keys: 'Ctrl + ↑', description: 'Grow pane height' },
				{ keys: 'Ctrl + ↓', description: 'Shrink pane height' }
			]
		}
	];
</script>

<Modal bind:open title="Keyboard Shortcuts" size="medium">
	{#snippet children()}
		<div class="help-content p-5" style="max-height: 70vh; overflow-y: auto; line-height: 1.6;">
			<p class="help-intro">Use these keyboard shortcuts to efficiently manage your workspace:</p>

			{#each shortcuts as category}
				<div class="shortcut-category">
					<h3 class="category-title">{category.category}</h3>
					<div class="flex-col gap-3">
						{#each category.items as shortcut}
							<div class="shortcut-item interactive flex gap-4 p-3">
								<div class="shortcut-keys">
									{shortcut.keys}
								</div>
								<div class="flex-1">
									{shortcut.description}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/each}

			<div class="help-footer">
				<p class="help-note">
					💡 <strong>Tip:</strong> These shortcuts work when the window manager has focus. Click on the
					workspace area to ensure shortcuts are active.
				</p>
			</div>
		</div>
	{/snippet}
	{#snippet footer()}
		<!-- Empty footer snippet to satisfy Modal component requirements -->
	{/snippet}
</Modal>

<style>
	.help-content {
		color: var(--text);
		font-family: var(--font-sans);
	}

	.help-intro {
		margin: 0 0 var(--space-5) 0;
		color: var(--text-secondary);
		font-size: 0.95rem;
	}

	.shortcut-category {
		margin-bottom: var(--space-5);
	}

	.shortcut-category:last-child {
		margin-bottom: 0;
	}

	.category-title {
		margin: 0 0 var(--space-3) 0;
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--accent);
		font-family: var(--font-mono);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid var(--primary-dim);
		padding-bottom: var(--space-2);
	}

	.shortcut-item {
		background: var(--surface);
		border: 1px solid var(--primary-dim);
		border-radius: var(--radius-sm);
		align-items: center;
	}

	.shortcut-item:hover {
		background: var(--surface-elevated);
		border-color: var(--primary);
		box-shadow: 0 0 10px var(--primary-glow-20);
	}

	.shortcut-keys {
		font-family: var(--font-mono);
		font-weight: 600;
		font-size: 0.9rem;
		color: var(--accent);
		background: var(--bg);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--primary-dim);
		border-radius: var(--radius-xs);
		min-width: 140px;
		text-align: center;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.2),
			inset 0 1px 2px rgba(46, 230, 107, 0.1);
	}

	.help-footer {
		margin-top: var(--space-5);
		padding-top: var(--space-4);
		border-top: 1px solid var(--primary-dim);
	}

	.help-note {
		margin: 0;
		font-size: 0.9rem;
		color: var(--text-secondary);
		background: var(--surface);
		padding: var(--space-3);
		border-radius: var(--radius-sm);
		border-left: 3px solid var(--accent-amber);
	}

	.help-note strong {
		color: var(--accent-amber);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.help-content {
			padding: var(--space-4) !important;
		}

		.shortcut-item {
			flex-direction: column !important;
			align-items: flex-start !important;
			gap: var(--space-2) !important;
		}

		.shortcut-keys {
			min-width: auto;
			width: 100%;
		}

		.category-title {
			font-size: 1rem;
		}
	}

	/* Scrollbar styling */
	.help-content::-webkit-scrollbar {
		width: 8px;
	}

	.help-content::-webkit-scrollbar-track {
		background: var(--bg);
		border-radius: var(--radius-xs);
	}

	.help-content::-webkit-scrollbar-thumb {
		background: var(--primary-dim);
		border-radius: var(--radius-xs);
		border: 1px solid var(--bg);
	}

	.help-content::-webkit-scrollbar-thumb:hover {
		background: var(--primary);
	}
</style>
