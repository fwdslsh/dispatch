<!--
	KeyboardShortcutsOverlay.svelte

	Comprehensive keyboard shortcuts overlay for WindowManager
	Based on frontend design expert recommendations
-->
<script>
	import { createEventDispatcher } from 'svelte';
	import {
		IconX,
		IconKeyboard,
		IconTerminal,
		IconPlus,
		IconMinus,
		IconArrowLeft,
		IconArrowRight,
		IconArrowUp,
		IconArrowDown
	} from '@tabler/icons-svelte';
	import IconClaude from '../Icons/IconClaude.svelte';
	import Button from '../Button.svelte';

	// Props
	let { open = false } = $props();

	// Events
	const dispatch = createEventDispatcher();

	// Shortcut categories
	const shortcuts = [
		{
			category: 'Window Management',
			icon: IconPlus,
			shortcuts: [
				{
					keys: ['Ctrl', 'Enter'],
					description: 'Split current tile right',
					example: 'Creates a new tile to the right of the current one'
				},
				{
					keys: ['Ctrl', 'Shift', 'Enter'],
					description: 'Split current tile down',
					example: 'Creates a new tile below the current one'
				},
				{
					keys: ['Ctrl', 'Shift', 'X'],
					description: 'Close current tile',
					example: 'Removes the focused tile and its content'
				}
			]
		},
		{
			category: 'Navigation',
			icon: IconArrowRight,
			shortcuts: [
				{
					keys: ['Alt', '→'],
					description: 'Focus next tile',
					example: 'Move focus to the tile on the right'
				},
				{
					keys: ['Alt', '←'],
					description: 'Focus previous tile',
					example: 'Move focus to the tile on the left'
				},
				{
					keys: ['Tab'],
					description: 'Cycle through tiles',
					example: 'Navigate between all available tiles'
				}
			]
		},
		{
			category: 'Resizing',
			icon: IconArrowUp,
			shortcuts: [
				{
					keys: ['Ctrl', '↑'],
					description: 'Grow tile height',
					example: 'Increase the height of the current tile'
				},
				{
					keys: ['Ctrl', '↓'],
					description: 'Shrink tile height',
					example: 'Decrease the height of the current tile'
				},
				{
					keys: ['Drag'],
					description: 'Resize dividers',
					example: 'Click and drag the dividers between tiles'
				}
			]
		},
		{
			category: 'Session Creation',
			icon: IconTerminal,
			shortcuts: [
				{
					keys: ['T'],
					description: 'Create terminal session',
					example: 'When focused on empty tile'
				},
				{
					keys: ['C'],
					description: 'Create Claude session',
					example: 'When focused on empty tile'
				}
			]
		},
		{
			category: 'Help & Shortcuts',
			icon: IconKeyboard,
			shortcuts: [
				{
					keys: ['?'],
					description: 'Show this help dialog',
					example: 'Toggle keyboard shortcuts reference'
				},
				{
					keys: ['Esc'],
					description: 'Close dialogs',
					example: 'Close modals and return to workspace'
				}
			]
		}
	];

	// Handle escape key
	function handleKeydown(event) {
		if (event.key === 'Escape') {
			dispatch('close');
		}
	}

	// Handle backdrop click
	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			dispatch('close');
		}
	}

	// Handle backdrop keyboard events
	function handleBackdropKeydown(event) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			dispatch('close');
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- Backdrop -->
	<div
		class="shortcuts-backdrop"
		onclick={handleBackdropClick}
		onkeydown={handleBackdropKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="shortcuts-title"
		tabindex="0"
	>
		<!-- Modal -->
		<div class="shortcuts-modal">
			<!-- Header -->
			<div class="modal-header">
				<div class="header-content">
					<IconKeyboard size={24} />
					<h2 id="shortcuts-title">Keyboard Shortcuts</h2>
				</div>
				<Button variant="ghost" onclick={() => dispatch('close')} aria-label="Close shortcuts">
					<IconX size={20} />
				</Button>
			</div>

			<!-- Content -->
			<div class="modal-content">
				<div class="shortcuts-grid">
					{#each shortcuts as category}
						{@const IconComponent = category.icon}
						<div class="shortcut-category">
							<div class="category-header">
								<IconComponent size={18} />
								<h3>{category.category}</h3>
							</div>
							<div class="category-shortcuts">
								{#each category.shortcuts as shortcut}
									<div class="shortcut-item">
										<div class="shortcut-keys">
											{#each shortcut.keys as key, index}
												<kbd class="key">{key}</kbd>
												{#if index < shortcut.keys.length - 1}
													<span class="key-separator">+</span>
												{/if}
											{/each}
										</div>
										<div class="shortcut-info">
											<div class="shortcut-description">
												{shortcut.description}
											</div>
											<div class="shortcut-example">
												{shortcut.example}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>

				<!-- Pro tips -->
				<div class="pro-tips">
					<h3>💡 Pro Tips</h3>
					<ul>
						<li>
							<strong>Drag to resize:</strong> Click and drag the gray dividers between tiles to adjust
							their size
						</li>
						<li>
							<strong>Focus management:</strong> The focused tile has a blue border and receives keyboard
							input
						</li>
						<li>
							<strong>Empty tiles:</strong> Use empty tiles to quickly create new sessions with T (Terminal)
							or C (Claude)
						</li>
						<li>
							<strong>Layout persistence:</strong> Your tile layout is automatically saved and restored
						</li>
					</ul>
				</div>
			</div>

			<!-- Footer -->
			<div class="modal-footer">
				<div class="footer-note">
					<span>Press <kbd class="key small">Esc</kbd> to close this dialog</span>
				</div>
				<Button onclick={() => dispatch('close')}>Got it!</Button>
			</div>
		</div>
	</div>
{/if}

<style>
	.shortcuts-backdrop {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 2rem;
		animation: fadeIn 0.2s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.shortcuts-modal {
		background: var(--bg, #1a1a1a);
		border: 1px solid var(--surface-border, #333);
		border-radius: 12px;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
		width: 100%;
		max-width: 900px;
		max-height: 90vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		animation: slideUp 0.3s cubic-bezier(0.23, 1, 0.32, 1);
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(20px) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		border-bottom: 1px solid var(--surface-border, #333);
		background: var(--surface-elevated, #222);
	}

	.header-content {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.header-content h2 {
		margin: 0;
		color: var(--text-primary, #fff);
		font-size: 1.25rem;
		font-weight: 600;
	}

	.modal-content {
		flex: 1;
		overflow-y: auto;
		padding: 2rem;
	}

	.shortcuts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: 2rem;
		margin-bottom: 2rem;
	}

	.shortcut-category {
		background: var(--surface-hover, #2a2a2a);
		border: 1px solid var(--surface-border, #333);
		border-radius: 8px;
		padding: 1.5rem;
	}

	.category-header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		color: var(--primary, #0066cc);
	}

	.category-header h3 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.category-shortcuts {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.shortcut-item {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.shortcut-keys {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		flex-shrink: 0;
		min-width: 120px;
	}

	.key {
		background: var(--surface-active, #333);
		border: 1px solid var(--surface-border, #444);
		border-radius: 4px;
		padding: 0.25rem 0.5rem;
		font-family: var(--font-mono, monospace);
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--text-primary, #fff);
		min-width: 24px;
		text-align: center;
		box-shadow: 0 2px 0 var(--surface-border, #444);
	}

	.key.small {
		padding: 0.125rem 0.375rem;
		font-size: 0.7rem;
		min-width: 20px;
	}

	.key-separator {
		color: var(--text-muted, #888);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.shortcut-info {
		flex: 1;
		min-width: 0;
	}

	.shortcut-description {
		color: var(--text-primary, #fff);
		font-weight: 500;
		margin-bottom: 0.25rem;
	}

	.shortcut-example {
		color: var(--text-muted, #888);
		font-size: 0.85rem;
		line-height: 1.4;
	}

	.pro-tips {
		background: var(--surface-elevated, #222);
		border: 1px solid var(--primary-muted, #0066cc40);
		border-radius: 8px;
		padding: 1.5rem;
		margin-top: 1rem;
	}

	.pro-tips h3 {
		margin: 0 0 1rem 0;
		color: var(--primary, #0066cc);
		font-size: 1rem;
		font-weight: 600;
	}

	.pro-tips ul {
		margin: 0;
		padding-left: 1rem;
		color: var(--text-muted, #888);
		line-height: 1.6;
	}

	.pro-tips li {
		margin-bottom: 0.5rem;
	}

	.pro-tips strong {
		color: var(--text-primary, #fff);
	}

	.modal-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem 2rem;
		border-top: 1px solid var(--surface-border, #333);
		background: var(--surface-elevated, #222);
	}

	.footer-note {
		color: var(--text-muted, #888);
		font-size: 0.85rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.shortcuts-backdrop {
			padding: 1rem;
		}

		.shortcuts-grid {
			grid-template-columns: 1fr;
			gap: 1.5rem;
		}

		.modal-header,
		.modal-content,
		.modal-footer {
			padding: 1rem 1.5rem;
		}

		.shortcut-item {
			flex-direction: column;
			gap: 0.5rem;
		}

		.shortcut-keys {
			min-width: auto;
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.shortcuts-backdrop,
		.shortcuts-modal {
			animation: none;
		}
	}
</style>
