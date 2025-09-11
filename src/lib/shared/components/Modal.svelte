<script>
	import { onDestroy } from "svelte";

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
		augmented = 'tl-clip tr-clip bl-clip br-clip both',

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
	const modalId = `modal-${Math.random()}`;
	const titleId = title ? `${modalId}-title` : undefined;
	const contentId = `${modalId}-content`;

	// Responsive state
	let isMobile = $state(false);

	// Check if mobile on mount and resize
	function updateMobileState() {
		isMobile = window.innerWidth <= 768;
	}

	// Compute modal classes - use global card/panel styles
	const modalClasses = $derived.by(() => {
		const classes = ['card', 'modal', `modal--${size}`];
		// Only apply augmented-ui on desktop to prevent clipping on mobile
		if (augmented && augmented !== 'none' && !isMobile) classes.push('aug');
		if (customClass) classes.push(...customClass.split(' '));
		return classes.join(' ');
	});

	// Compute augmented attribute - disable on mobile
	const augmentedAttr = $derived(isMobile ? 'none' : augmented);

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
			
			// Initialize mobile state
			updateMobileState();
			window.addEventListener('resize', updateMobileState);
		} else {
			// Restore body scroll
			document.body.style.overflow = '';
			window.removeEventListener('resize', updateMobileState);
		}

	});
	onDestroy(() => {
		// Ensure body scroll is restored
		document.body.style.overflow = '';
		window.removeEventListener('resize', updateMobileState);
	});
</script>

<div
	class="modal-backdrop"
	class:open
	role="dialog"
	aria-modal="true"
	aria-label={ariaLabel || title}
	aria-labelledby={titleId}
	aria-describedby={ariaDescribedBy || contentId}
	onclick={handleBackdropClick}
	onkeydown={handleKeydown}
	tabindex="-1"
	style={restProps.style}
>
	<div
		id={modalId}
		class="{modalClasses}"
		class:open
		data-augmented-ui={augmentedAttr}
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

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1000;
		background: 
			radial-gradient(ellipse at center, rgba(46, 230, 107, 0.05) 0%, transparent 70%),
			color-mix(in oklab, black 70%, transparent);
		backdrop-filter: blur(0px);
		display: none;
		align-items: center;
		justify-content: center;
		padding: var(--space-4);
		outline: none;
		
		/* Modern CSS dialog-style animations */
		opacity: 0;
		transition: 
			display 0.3s allow-discrete,
			overlay 0.3s allow-discrete,
			opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1),
			backdrop-filter 0.3s cubic-bezier(0.23, 1, 0.32, 1);
		
		/* Terminal grid overlay */
		background-image: 
			radial-gradient(circle at 25% 25%, var(--scan-line) 1px, transparent 1px),
			radial-gradient(circle at 75% 75%, var(--scan-line) 1px, transparent 1px);
		background-size: 50px 50px, 30px 30px;
	}
	
	.modal-backdrop.open {
		display: flex;
		opacity: 1;
		backdrop-filter: blur(12px);
		
		@starting-style {
			opacity: 0;
			backdrop-filter: blur(0px);
		}
	}

	.modal {
		max-height: var(--modal-max-height, 90vh);
		min-height: var(--modal-min-height, 200px);
		max-width: var(--modal-max-width, 90vw);
		min-width: var(--modal-min-width, 300px);
		display: flex;
		flex-direction: column;
		outline: none;
		position: relative;
		overflow: hidden;
		
		/* Enhanced terminal modal styling */
		background: var(--bg-panel);
		border: 2px solid var(--primary-dim);
		border-radius: 0;
		
		/* Terminal lighting effects */
		box-shadow: none;
		
		/* Modern CSS modal animations */
		opacity: 0;
		transform: perspective(1000px) translate3d(0, -20px, -30px) scale(0.95);
		transition: 
			opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1),
			transform 0.3s cubic-bezier(0.23, 1, 0.32, 1);
	}
	
	.modal.open {
		opacity: 1;
		transform: perspective(1000px) translate3d(0, 0, 0) scale(1);
		box-shadow:
			var(--glow-primary),
			inset 0 0 60px rgba(46, 230, 107, 0.03),
			inset 0 0 20px rgba(0, 0, 0, 0.8),
			0 15px 50px rgba(0, 0, 0, 0.7);
		
		@starting-style {
			opacity: 0;
			transform: perspective(1000px) translate3d(0, -20px, -30px) scale(0.95);
		}
	}

	/* Sizes */
	.modal--small {
		width: 400px;
		min-height: 200px;
	}

	.modal--medium {
		width: 600px;
		min-height: 400px;
		max-height: 80vh;
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

	/* Enhanced terminal header */
	.modal__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4) var(--space-5);
		flex-shrink: 0;
		background: linear-gradient(135deg, var(--bg-dark), var(--bg-panel));
		border-bottom: 2px solid var(--primary-dim);
		position: relative;
	}

	/* Terminal title bar effect */
	.modal__header::before {
		content: '';
		position: absolute;
		top: 0;
		left: 2px;
		right: 2px;
		height: 2px;
		background: linear-gradient(90deg, 
			transparent, 
			var(--primary), 
			var(--accent-amber), 
			var(--primary), 
			transparent
		);
		animation: terminalScan 2s linear infinite;
		overflow: hidden;
	}

	.modal__title {
		font-size: 1.2rem;
		font-weight: 700;
		font-family: var(--font-mono);
		color: var(--primary);
		margin: 0;
		line-height: 1.2;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		text-shadow: 0 0 8px var(--primary-glow);
	}

	/* Terminal prompt prefix for title */
	.modal__title::before {
		content: '> ';
		color: var(--accent-amber);
		margin-right: 0.5rem;
	}

	.modal__close {
		background: transparent;
		border: 1px solid var(--primary-dim);
		color: var(--text-muted);
		cursor: pointer;
		padding: var(--space-2);
		transition: all 0.3s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 2rem;
		height: 2rem;
	}

	.modal__close:hover {
		color: var(--primary);
		border-color: var(--primary);
		background: rgba(46, 230, 107, 0.1);
		box-shadow: 0 0 10px var(--primary-glow);
		text-shadow: 0 0 5px var(--primary-glow);
	}

	@keyframes terminalScan {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}

	/* Enhanced terminal content */
	.modal__content {
		flex: 1;
		overflow: auto;
		padding: 0;
		background: var(--bg);
		color: var(--text-primary);
		font-family: var(--font-sans);
		position: relative;
		min-height: 0;
		max-height: calc(80vh - 120px);
	}

	/* Subtle scan lines in content area */
	.modal__content::before {
		content: '';
		position: absolute;
		inset: 0;
		background: repeating-linear-gradient(
			0deg,
			transparent 0px,
			transparent 2px,
			var(--scan-line) 3px,
			transparent 4px
		);
		pointer-events: none;
		opacity: 0.3;
	}

	/* Enhanced terminal footer */
	.modal__footer {
		padding: var(--space-4) var(--space-5);
		border-top: 2px solid var(--primary-dim);
		background: linear-gradient(135deg, var(--bg-dark), var(--bg-panel));
		flex-shrink: 0;
		display: flex;
		gap: var(--space-3);
		justify-content: flex-end;
		align-items: center;
		position: relative;
	}

	/* Terminal footer accent line */
	.modal__footer::before {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 2px;
		background: linear-gradient(90deg, 
			transparent, 
			var(--primary), 
			transparent
		);
	}

	/* Modern CSS animations replace old keyframes */

	/* Responsive */
	@media (max-width: 768px) {
		.modal-backdrop {
			padding: var(--space-2);
			align-items: flex-start;
			padding-top: var(--space-6);
		}

		.modal {
			/* Disable augmented-ui on mobile to prevent clipping */
			border-radius: 8px !important;
			max-width: 100%;
			width: 100%;
			margin: 0;
			/* Simplify mobile styling */
			border: 1px solid var(--primary-dim);
			box-shadow: 
				0 4px 20px rgba(0, 0, 0, 0.5),
				0 0 20px rgba(46, 230, 107, 0.1);
		}

		/* Remove augmented-ui completely on mobile */
		.modal[data-augmented-ui] {
			border-radius: 8px !important;
		}

		.modal--small,
		.modal--medium,
		.modal--large {
			width: 100%;
			max-width: 100%;
			min-height: auto;
		}

		.modal--fullscreen {
			width: 100vw;
			height: 100vh;
			max-width: 100vw;
			max-height: 100vh;
			border-radius: 0 !important;
		}

		.modal__header,
		.modal__content,
		.modal__footer {
			padding-left: var(--space-4);
			padding-right: var(--space-4);
		}

		.modal__content {
			padding-top: var(--space-4);
			padding-bottom: var(--space-4);
		}

		.modal__footer {
			flex-direction: column;
			align-items: stretch;
			gap: var(--space-2);
		}

		/* Mobile-specific title styling */
		.modal__title {
			font-size: 1rem;
			letter-spacing: 0.05em;
		}

		/* Simplify mobile close button */
		.modal__close {
			width: 1.75rem;
			height: 1.75rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.modal-backdrop,
		.modal {
			animation: none;
		}
		
		.modal__header::before {
			animation: none;
		}
		
		.modal__content::before {
			display: none;
		}
	}

	.modal:focus {
		outline: none;
	}
</style>
