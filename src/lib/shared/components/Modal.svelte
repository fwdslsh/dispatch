<script>
	/**
	 * Modal Foundation Component
	 * Standardized modal with backdrop, keyboard handling, and accessibility
	 */

	// Props with defaults
	let {
		// Visibility
		open = $bindable(false),

		// Modal configuration
		size = 'medium', // 'small' | 'medium' | 'large' | 'fullscreen'
		closeOnBackdrop = true,
		closeOnEscape = true,
		showCloseButton = true,

		// Content
		title = '',

		// Snippets for content
		children,
		footer,

		// Styling
		augmented = 'tl-clip tr-clip bl-clip br-clip border',

		// Accessibility
		ariaLabel = undefined,
		ariaDescribedBy = undefined,

		// Event handlers
		onclose = undefined,
		onopen = undefined,

		// HTML attributes
		class: customClass = '',
		...restProps
	} = $props();

	// Generate unique IDs
	const modalId = crypto.randomUUID();
	const titleId = title ? `${modalId}-title` : undefined;
	const contentId = `${modalId}-content`;

	// Compute modal classes
	const modalClasses = $derived(() => {
		const classes = ['modal', `modal--${size}`];
		if (customClass) classes.push(...customClass.split(' '));
		return classes.join(' ');
	});

	// Handle backdrop click
	function handleBackdropClick(event) {
		if (event.target === event.currentTarget && closeOnBackdrop) {
			close();
		}
	}

	// Handle escape key
	function handleKeydown(event) {
		if (event.key === 'Escape' && closeOnEscape) {
			close();
		}
	}

	// Close modal
	function close() {
		open = false;
		onclose?.();
	}

	// Open modal
	function handleOpen() {
		onopen?.();
	}

	// Watch for open state changes
	$effect(() => {
		if (open) {
			handleOpen();
			// Prevent body scroll when modal is open
			document.body.style.overflow = 'hidden';
			// Focus trap - focus the modal
			const modalElement = document.getElementById(modalId);
			modalElement?.focus();
		} else {
			// Restore body scroll
			document.body.style.overflow = '';
		}

		// Cleanup on unmount
		return () => {
			document.body.style.overflow = '';
		};
	});
</script>

{#if open}
	<div
		class="modal-backdrop"
		role="dialog"
		aria-modal="true"
		aria-label={ariaLabel || title}
		aria-labelledby={titleId}
		aria-describedby={ariaDescribedBy || contentId}
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		tabindex="-1"
	>
		<div
			id={modalId}
			class={modalClasses}
			data-augmented-ui={augmented}
			tabindex="-1"
			{...restProps}
		>
			{#if title || showCloseButton}
				<header class="modal__header">
					{#if title}
						<h2 class="modal__title" id={titleId}>
							{title}
						</h2>
					{/if}

					{#if showCloseButton}
						<button class="modal__close" onclick={close} aria-label="Close modal" type="button">
							<svg
								width="24"
								height="24"
								viewBox="0 0 24 24"
								fill="none"
								xmlns="http://www.w3.org/2000/svg"
							>
								<path
									d="M18 6L6 18M6 6L18 18"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							</svg>
						</button>
					{/if}
				</header>
			{/if}

			<div class="modal__content" id={contentId}>
				{@render children()}
			</div>

			{#if footer}
				<footer class="modal__footer">
					{@render footer()}
				</footer>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--space-md);
		animation: backdropFadeIn 0.2s ease-out;
		outline: none;
	}

	.modal {
		/* Augmented-UI optimizations */
		--aug-border-opacity: 0.35;
		--aug-border-bg: rgba(0, 255, 136, 0.4);

		/* Modal styling */
		background: var(--bg);
		color: var(--text-primary);
		border: 1px solid var(--border);
		box-shadow:
			0 20px 25px -5px rgba(0, 0, 0, 0.4),
			0 10px 10px -5px rgba(0, 0, 0, 0.2),
			0 0 0 1px rgba(0, 255, 136, 0.1);
		max-height: 90vh;
		max-width: 90vw;
		display: flex;
		flex-direction: column;
		animation: modalSlideIn 0.3s ease-out;
		outline: none;
		position: relative;
	}

	/* Sizes */
	.modal--small {
		width: 400px;
		min-height: 200px;
	}

	.modal--medium {
		width: 600px;
		min-height: 300px;
	}

	.modal--large {
		width: 800px;
		min-height: 400px;
	}

	.modal--fullscreen {
		width: 95vw;
		height: 95vh;
		max-width: none;
		max-height: none;
	}

	/* Header */
	.modal__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-lg) var(--space-lg) 0 var(--space-lg);
		flex-shrink: 0;
	}

	.modal__title {
		font-family: var(--font-sans);
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0;
		line-height: 1.2;
	}

	.modal__close {
		background: none;
		border: none;
		color: var(--text-secondary);
		cursor: pointer;
		padding: var(--space-xs);
		border-radius: 4px;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.modal__close:hover {
		color: var(--text-primary);
		background: var(--surface-hover);
	}

	.modal__close:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	/* Content */
	.modal__content {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-lg);
		scrollbar-width: thin;
		scrollbar-color: var(--border) transparent;
	}

	.modal__content::-webkit-scrollbar {
		width: 6px;
	}

	.modal__content::-webkit-scrollbar-track {
		background: transparent;
	}

	.modal__content::-webkit-scrollbar-thumb {
		background: var(--border);
		border-radius: 3px;
	}

	.modal__content::-webkit-scrollbar-thumb:hover {
		background: var(--border-light);
	}

	/* Footer */
	.modal__footer {
		padding: 0 var(--space-lg) var(--space-lg) var(--space-lg);
		border-top: 1px solid var(--border);
		margin-top: var(--space-md);
		flex-shrink: 0;
		display: flex;
		gap: var(--space-sm);
		justify-content: flex-end;
		align-items: center;
	}

	/* Animations */
	@keyframes backdropFadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes modalSlideIn {
		from {
			opacity: 0;
			transform: translate3d(0, -20px, 0) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translate3d(0, 0, 0) scale(1);
		}
	}

	/* Responsive */
	@media (max-width: 768px) {
		.modal-backdrop {
			padding: var(--space-sm);
		}

		.modal--small,
		.modal--medium,
		.modal--large {
			width: 100%;
			max-width: 100%;
		}

		.modal--fullscreen {
			width: 100vw;
			height: 100vh;
			max-width: 100vw;
			max-height: 100vh;
		}

		.modal__header,
		.modal__content,
		.modal__footer {
			padding-left: var(--space-md);
			padding-right: var(--space-md);
		}

		.modal__content {
			padding-top: var(--space-md);
			padding-bottom: var(--space-md);
		}

		.modal__footer {
			flex-direction: column;
			align-items: stretch;
		}
	}

	/* High contrast mode support */
	@media (prefers-contrast: high) {
		.modal {
			border-width: 2px;
		}

		.modal__close {
			border: 1px solid var(--border);
		}
	}

	/* Reduced motion support */
	@media (prefers-reduced-motion: reduce) {
		.modal-backdrop,
		.modal {
			animation: none;
		}

		.modal__close {
			transition: none;
		}
	}

	/* Focus management */
	.modal:focus {
		outline: none;
	}
</style>
