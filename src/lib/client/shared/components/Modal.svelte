<script>
	import { onDestroy } from 'svelte';
	import IconButton from './IconButton.svelte';
	import IconX from './Icons/IconX.svelte';

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

	// Check if mobile on mount and resize
	function updateMobileState() {
		// Mobile state check (currently unused but available for future use)
		return window.innerWidth <= 768;
	}

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
	class="modal-backdrop {open ? 'modal-backdrop--open' : ''}"
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
		class="modal-container modal-container--{size} {open
			? 'modal-container--open'
			: ''} {customClass}"
		data-augmented-ui={augmented}
		tabindex="-1"
		{...restProps}
	>
		{#if title || showCloseButton}
			<header class="modal-header">
				{#if title}
					<h2 class="modal-title" id={titleId}>
						{title}
					</h2>
				{/if}

				{#if showCloseButton}
					<IconButton variant="danger" onclick={close} aria-label="Close modal">
						<IconX size={18} />
					</IconButton>
				{/if}
			</header>
		{/if}

		<div class="modal-content" id={contentId}>
			{@render children()}
		</div>

		{#if footer}
			<footer class="modal-footer">
				{@render footer()}
			</footer>
		{/if}
	</div>
</div>

<style>
	/* Component-specific overrides only */
	.modal-backdrop {
		/* Terminal grid overlay */
		background-image:
			radial-gradient(circle at 25% 25%, var(--scan-line) 1px, transparent 1px),
			radial-gradient(circle at 75% 75%, var(--scan-line) 1px, transparent 1px);
		background-size:
			50px 50px,
			30px 30px;
		background-color: color-mix(in oklab, var(--bg) 70%, transparent);
	}

	.modal-container {
		/* Terminal lighting effects */
		border: 2px solid var(--primary-dim);
		border-radius: 0;
		box-shadow:
			0 0 40px var(--primary-glow),
			0 0 100px color-mix(in oklab, var(--primary) 30%, transparent),
			inset 0 0 50px color-mix(in oklab, var(--bg) 90%, transparent);
	}
</style>
