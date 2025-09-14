<script>
	let {
		show = $bindable(false),
		title = 'Confirm Action',
		message = 'Are you sure you want to proceed?',
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		dangerous = false,
		onconfirm = () => {},
		oncancel = () => {}
	} = $props();

	function handleConfirm() {
		onconfirm();
		show = false;
	}

	function handleCancel() {
		oncancel();
		show = false;
	}

	function handleKeydown(event) {
		if (event.key === 'Escape') {
			handleCancel();
		} else if (event.key === 'Enter' && event.target.tagName !== 'BUTTON') {
			handleConfirm();
		}
	}

	function handleBackdropClick(event) {
		if (event.target === event.currentTarget) {
			handleCancel();
		}
	}
</script>

{#if show}
	<div
		class="dialog-backdrop"
		onclick={handleBackdropClick}
		onkeydown={handleKeydown}
		role="dialog"
		aria-modal="true"
		aria-labelledby="dialog-title"
		aria-describedby="dialog-message"
		tabindex="-1"
	>
		<div class="dialog-container" data-augmented-ui="tl-clip tr-clip br-clip bl-clip border">
			<div class="dialog-content">
				<h3 id="dialog-title" class="dialog-title">{title}</h3>
				<p id="dialog-message" class="dialog-message">{message}</p>
			</div>

			<div class="dialog-actions">
				<button
					type="button"
					class="button-secondary text-button"
					onclick={handleCancel}
					aria-label="Cancel"
				>
					{cancelText}
				</button>
				<button
					type="button"
					class="button-confirm text-button"
					class:button-danger={dangerous}
					onclick={handleConfirm}
					aria-label="Confirm action"
                   
				>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.dialog-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		animation: fadeIn 0.2s ease-out;
	}

	.dialog-container {
		max-width: 400px;
		width: 90%;
		background: rgba(26, 26, 26, 0.9);
		border-radius: 12px;
		backdrop-filter: blur(20px);
		border: 1px solid rgba(0, 255, 136, 0.3);
		box-shadow:
			0 10px 40px rgba(0, 0, 0, 0.5),
			0 0 30px rgba(0, 255, 136, 0.1),
			inset 0 1px 0 rgba(255, 255, 255, 0.1);
		animation: slideIn 0.3s ease-out;

		--aug-border-all: 1px;
		--aug-border-bg: rgba(0, 255, 136, 0.4);
		--aug-inlay-all: 4px;
		--aug-inlay-bg: rgba(26, 26, 26, 0.8);
	}

	.dialog-content {
		padding: var(--space-xl) var(--space-lg) var(--space-lg);
	}

	.dialog-title {
		color: var(--text-primary);
		font-size: 1.2rem;
		font-weight: bold;
		margin-bottom: var(--space-md);
		text-transform: none;
	}

	.dialog-message {
		color: var(--text-secondary);
		margin-bottom: 0;
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--space-md);
		padding: 0 var(--space-lg) var(--space-lg);
	}

	.dialog-actions button {
		min-width: 80px;
		font-size: 0.9rem;
		padding: var(--space-sm) var(--space-md);
		border-radius: 6px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;
		border: none;
		background: none;
		font-family: var(--font-accent);
		&:hover {
			transition: all 0.4s ease;
		}
	}

	.button-secondary {
		/* background: rgba(128, 128, 128, 0.1); */
		color: var(--text-secondary);
		/* border: 1px solid rgba(128, 128, 128, 0.3) !important; */
	}

	.button-secondary:hover {
		/* background: rgba(128, 128, 128, 0.2);
    border-color: rgba(128, 128, 128, 0.5) !important; */

		color: rgba(0, 255, 136, 0.8);
		background: none;
	}

	.button-confirm {
		color: var(--bg);
	}

	.button-confirm:hover {
		background: rgba(0, 255, 136, 0.8);
	}

	.button-danger {
		background: none;
		color: var(--secondary-muted);
	}

	.button-danger:hover {
		color: var(--secondary);
		background: none;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			transform: scale(0.9) translateY(-20px);
			opacity: 0;
		}
		to {
			transform: scale(1) translateY(0);
			opacity: 1;
		}
	}

	@media (max-width: 768px) {
		.dialog-container {
			max-width: 320px;
			margin: var(--space-lg);
		}

		.dialog-content {
			padding: var(--space-lg) var(--space-md) var(--space-md);
		}

		.dialog-title {
			font-size: 1.1rem;
		}

		.dialog-actions {
			padding: 0 var(--space-md) var(--space-md);
			gap: var(--space-sm);
		}

		.dialog-actions button {
			min-width: 70px;
			font-size: 0.85rem;
		}
	}
</style>
