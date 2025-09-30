<script>
	import Button from './Button.svelte';

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
				<Button
					type="button"
					variant="ghost"
					augmented="none"
					onclick={handleCancel}
					ariaLabel="Cancel"
					text={cancelText}
					class="button-secondary"
				/>
				<Button
					type="button"
					variant={dangerous ? 'danger' : 'primary'}
					augmented="none"
					onclick={handleConfirm}
					ariaLabel="Confirm action"
					text={confirmText}
					class="button-confirm"
				/>
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
		background: color-mix(in oklab, var(--bg) 70%, black 30%);
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
		background: color-mix(in oklab, var(--surface) 90%, black 10%);
		border-radius: 12px;
		backdrop-filter: blur(20px);
		border: 1px solid color-mix(in oklab, var(--primary) 30%, transparent);
		box-shadow:
			0 10px 40px color-mix(in oklab, var(--bg) 50%, black 50%),
			0 0 30px color-mix(in oklab, var(--primary) 10%, transparent),
			inset 0 1px 0 color-mix(in oklab, var(--text) 10%, transparent);
		animation: slideIn 0.3s ease-out;

		--aug-border-all: 1px;
		--aug-border-bg: color-mix(in oklab, var(--primary) 40%, transparent);
		--aug-inlay-all: 4px;
		--aug-inlay-bg: color-mix(in oklab, var(--surface) 80%, black 20%);
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

		color: color-mix(in oklab, var(--primary) 80%, white 20%);
		background: none;
	}

	.button-confirm {
		color: var(--bg);
	}

	.button-confirm:hover {
		background: color-mix(in oklab, var(--primary) 80%, white 20%);
	}

	.button-danger {
		background: none;
		color: var(--secondary-muted);
	}

	.button-danger:hover {
		color: var(--secondary);
		background: none;
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
