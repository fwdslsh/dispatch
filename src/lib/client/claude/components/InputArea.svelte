<script>
	import Button from '$lib/client/shared/components/Button.svelte';

	/**
	 * InputArea Component
	 *
	 * Auto-resizing textarea with submit/cancel buttons for Claude Code input.
	 * Handles keyboard shortcuts and mobile-friendly input.
	 *
	 * @prop {Object} viewModel - ClaudePaneViewModel instance
	 */
	let { viewModel } = $props();

	// Handle Enter key for sending
	function handleKeyDown(e) {
		// On desktop: Enter sends, Shift+Enter adds newline
		// On mobile: Enter always adds newline (send via button)
		if (e.key === 'Enter' && !e.shiftKey && !viewModel.isMobile) {
			e.preventDefault();
			viewModel.submitInput(e);
		}
	}
</script>

<form onsubmit={(e) => viewModel.submitInput(e)} class="input-form">
	<div class="input-container">
		<div class="message-input-wrapper" data-augmented-ui="tl-clip br-clip both">
			<textarea
				bind:value={viewModel.input}
				placeholder={viewModel.isMobile
					? 'Tap Send button to send'
					: 'Press Enter to send, Shift+Enter for new line'}
				class="message-input"
				disabled={viewModel.loading}
				aria-label="Type your message"
				autocomplete="off"
				onkeydown={handleKeyDown}
				rows="2"
			></textarea>
		</div>
		<div class="input-actions">
			<Button
				type="submit"
				text={viewModel.isWaitingForReply ? 'Send' : viewModel.loading ? 'Sending...' : 'Send'}
				variant="primary"
				augmented="tr-clip bl-clip both"
				disabled={!viewModel.canSubmit || viewModel.loading}
				ariaLabel="Send message"
			/>
		</div>
	</div>
</form>

<style>
	.input-form {
		padding: var(--space-4);
		border-top: 1px solid color-mix(in oklab, var(--primary) 10%, transparent);
		background: color-mix(in oklab, var(--surface) 50%, var(--bg));
		backdrop-filter: blur(12px);
	}

	.input-container {
		display: flex;
		gap: var(--space-3);
		align-items: flex-end;
	}

	.message-input-wrapper {
		flex: 1;
		position: relative;
		--aug-tl: var(--font-size-0);
		--aug-br: var(--font-size-0);
	}

	.message-input {
		width: 100%;
		min-height: 60px;
		max-height: 200px;
		padding: var(--space-3);
		padding-right: var(--space-7);
		background: color-mix(in oklab, var(--surface) 85%, var(--bg));
		border: 2px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: var(--radius-lg);
		font-family: var(--font-mono);
		font-size: 0.95rem;
		line-height: 1.4;
		color: var(--text);
		resize: none;
		transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
		backdrop-filter: blur(8px);
		box-shadow:
			0 4px 16px -8px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 5%, transparent);
	}

	.message-input:focus {
		outline: none;
		border-color: var(--primary);
		background: color-mix(in oklab, var(--surface) 90%, var(--bg));
		box-shadow:
			0 8px 32px -12px var(--primary-glow),
			inset 0 2px 4px color-mix(in oklab, var(--primary) 10%, transparent),
			0 0 0 4px var(--primary-glow-20);
		text-shadow: 0 0 2px var(--primary-glow-10);
		transform: translateY(-1px);
	}

	.message-input::placeholder {
		color: var(--muted);
		opacity: 0.8;
	}

	.message-input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.input-actions {
		display: flex;
		gap: var(--space-2);
		flex-shrink: 0;
	}

	/* Mobile Optimizations */
	@media (max-width: 768px) {
		.input-form {
			padding: var(--space-4);
		}

		.input-container {
			gap: var(--space-4);
		}

		.message-input-wrapper {
			--aug-tl: var(--space-2);
			--aug-br: var(--space-2);
		}

		.message-input {
			min-height: 80px;
			padding: var(--space-4) var(--space-4);
			font-size: var(--font-size-1);
		}

		.input-actions :global(.button) {
			min-width: 80px;
			font-size: var(--font-size-1);
		}
	}

	/* Touch Optimizations */
	@media (hover: none) and (pointer: coarse) {
		.message-input {
			font-size: var(--font-size-2); /* Prevents iOS zoom on focus */
		}
	}

	/* Accessibility */
	@media (prefers-reduced-motion: reduce) {
		.message-input {
			transition: none;
		}

		.message-input:focus {
			transform: none;
		}
	}

	/* High Contrast Mode */
	@media (prefers-contrast: high) {
		.message-input {
			border-width: 3px;
		}
	}
</style>
