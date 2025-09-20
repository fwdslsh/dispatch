<!--
	MobileKeyboardToolbar.svelte
	
	Mobile keyboard toolbar for terminal sessions providing common terminal keys
	and key combinations not available on mobile keyboards.
-->
<script>
	import { createEventDispatcher } from 'svelte';
	import IconButton from '$lib/client/shared/components/IconButton.svelte';

	// Props
	let { 
		visible = true,
		disabled = false,
		compact = false 
	} = $props();

	const dispatch = createEventDispatcher();

	// Key mapping for common terminal operations
	const keyActions = {
		// Arrow keys
		ArrowUp: { label: '↑', key: 'ArrowUp' },
		ArrowDown: { label: '↓', key: 'ArrowDown' },
		ArrowLeft: { label: '←', key: 'ArrowLeft' },
		ArrowRight: { label: '→', key: 'ArrowRight' },
		
		// Control combinations
		'Ctrl+C': { label: '^C', key: '\x03' }, // ASCII 3 (ETX)
		'Ctrl+D': { label: '^D', key: '\x04' }, // ASCII 4 (EOT)
		'Ctrl+Z': { label: '^Z', key: '\x1A' }, // ASCII 26 (SUB)
		'Ctrl+L': { label: '^L', key: '\x0C' }, // ASCII 12 (FF) - clear screen
		
		// Special keys
		Escape: { label: 'Esc', key: '\x1B' }, // ASCII 27 (ESC)
		Tab: { label: 'Tab', key: '\t' },
		Home: { label: 'Home', key: '\x01' }, // Ctrl+A
		End: { label: 'End', key: '\x05' }, // Ctrl+E
		
		// Page navigation
		PageUp: { label: 'PgUp', key: '\x1B[5~' },
		PageDown: { label: 'PgDn', key: '\x1B[6~' },
		
		// Additional useful keys
		Backspace: { label: '⌫', key: '\x7F' }, // DEL
		Delete: { label: 'Del', key: '\x1B[3~' },
		Enter: { label: '↵', key: '\r' }
	};

	// Key groups for organized layout
	const keyGroups = {
		arrows: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'],
		control: ['Ctrl+C', 'Ctrl+D', 'Ctrl+Z', 'Ctrl+L'],
		special: ['Escape', 'Tab', 'Home', 'End'],
		nav: ['PageUp', 'PageDown'],
		edit: ['Backspace', 'Delete', 'Enter']
	};

	// Compact layout for smaller screens
	const compactGroups = {
		primary: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Ctrl+C', 'Escape', 'Tab'],
		secondary: ['Ctrl+D', 'Ctrl+Z', 'Home', 'End', 'Enter']
	};

	function sendKey(keyAction) {
		if (disabled) return;
		
		console.log('[MobileKeyboardToolbar] Sending key:', keyAction);
		dispatch('keypress', {
			key: keyAction.key,
			label: keyAction.label,
			originalKey: keyAction
		});
	}

	function handleKeyClick(keyName) {
		const action = keyActions[keyName];
		if (action) {
			sendKey(action);
		}
	}
</script>

{#if visible}
	<div class="mobile-keyboard-toolbar" class:compact class:disabled>
		{#if compact}
			<!-- Compact layout for very small screens -->
			<div class="key-group">
				{#each compactGroups.primary as keyName}
					<button 
						class="key-button"
						onclick={() => handleKeyClick(keyName)}
						{disabled}
						aria-label={keyActions[keyName].label}
					>
						{keyActions[keyName].label}
					</button>
				{/each}
			</div>
			
			<div class="key-group secondary">
				{#each compactGroups.secondary as keyName}
					<button 
						class="key-button small"
						onclick={() => handleKeyClick(keyName)}
						{disabled}
						aria-label={keyActions[keyName].label}
					>
						{keyActions[keyName].label}
					</button>
				{/each}
			</div>
		{:else}
			<!-- Full layout for larger mobile screens -->
			<div class="key-group arrows">
				{#each keyGroups.arrows as keyName}
					<button 
						class="key-button arrow"
						onclick={() => handleKeyClick(keyName)}
						{disabled}
						aria-label={keyActions[keyName].label}
					>
						{keyActions[keyName].label}
					</button>
				{/each}
			</div>

			<div class="key-group control">
				{#each keyGroups.control as keyName}
					<button 
						class="key-button ctrl"
						onclick={() => handleKeyClick(keyName)}
						{disabled}
						aria-label={keyActions[keyName].label}
					>
						{keyActions[keyName].label}
					</button>
				{/each}
			</div>

			<div class="key-group special">
				{#each keyGroups.special as keyName}
					<button 
						class="key-button"
						onclick={() => handleKeyClick(keyName)}
						{disabled}
						aria-label={keyActions[keyName].label}
					>
						{keyActions[keyName].label}
					</button>
				{/each}
			</div>

			<div class="key-group nav">
				{#each keyGroups.nav as keyName}
					<button 
						class="key-button small"
						onclick={() => handleKeyClick(keyName)}
						{disabled}
						aria-label={keyActions[keyName].label}
					>
						{keyActions[keyName].label}
					</button>
				{/each}
			</div>

			<div class="key-group edit">
				{#each keyGroups.edit as keyName}
					<button 
						class="key-button"
						onclick={() => handleKeyClick(keyName)}
						{disabled}
						aria-label={keyActions[keyName].label}
					>
						{keyActions[keyName].label}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.mobile-keyboard-toolbar {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--surface-elevated, #1a1a1a);
		border-top: 1px solid var(--surface-border, #333);
		border-radius: 8px 8px 0 0;
		box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.2);
		max-height: 40vh;
		overflow-y: auto;
		user-select: none;
	}

	.mobile-keyboard-toolbar.compact {
		gap: 0.25rem;
		padding: 0.5rem;
		max-height: 25vh;
	}

	.mobile-keyboard-toolbar.disabled {
		opacity: 0.6;
		pointer-events: none;
	}

	.key-group {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		justify-content: center;
		align-items: center;
	}

	.key-group.arrows {
		justify-content: center;
	}

	.key-group.secondary {
		border-top: 1px solid var(--surface-border, #333);
		padding-top: 0.5rem;
		margin-top: 0.25rem;
	}

	.key-button {
		background: var(--surface-hover, #2a2a2a);
		border: 1px solid var(--surface-border, #444);
		border-radius: 6px;
		color: var(--text-primary, #fff);
		font-family: var(--font-mono, monospace);
		font-size: 0.8rem;
		font-weight: 500;
		padding: 0.5rem 0.75rem;
		min-width: 2.5rem;
		min-height: 2.5rem;
		cursor: pointer;
		transition: all 0.15s ease;
		box-shadow: 
			0 1px 2px rgba(0, 0, 0, 0.2),
			0 2px 0 var(--surface-border, #444);
		position: relative;
		top: 0;
	}

	.key-button:hover:not(:disabled) {
		background: var(--surface-active, #3a3a3a);
		border-color: var(--accent, #0ea5e9);
		box-shadow: 
			0 1px 2px rgba(0, 0, 0, 0.3),
			0 2px 0 var(--accent, #0ea5e9);
	}

	.key-button:active:not(:disabled) {
		top: 1px;
		box-shadow: 
			0 1px 1px rgba(0, 0, 0, 0.2),
			0 1px 0 var(--surface-border, #444);
		background: var(--accent-alpha, rgba(14, 165, 233, 0.1));
	}

	.key-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
		color: var(--text-muted, #888);
	}

	.key-button.small {
		font-size: 0.7rem;
		padding: 0.375rem 0.5rem;
		min-width: 2rem;
		min-height: 2rem;
	}

	.key-button.arrow {
		font-size: 1rem;
		font-weight: 600;
		min-width: 3rem;
		background: var(--primary-subtle, #1e3a8a);
		border-color: var(--primary, #3b82f6);
	}

	.key-button.arrow:hover:not(:disabled) {
		background: var(--primary, #3b82f6);
		border-color: var(--primary-bright, #60a5fa);
	}

	.key-button.ctrl {
		background: var(--accent-subtle, #dc2626);
		border-color: var(--accent-muted, #ef4444);
		color: var(--text-on-accent, #fff);
	}

	.key-button.ctrl:hover:not(:disabled) {
		background: var(--accent, #ef4444);
		border-color: var(--accent-bright, #f87171);
	}

	/* Responsive adjustments */
	@media (max-width: 480px) {
		.mobile-keyboard-toolbar {
			padding: 0.5rem;
			gap: 0.375rem;
		}

		.key-button {
			font-size: 0.75rem;
			padding: 0.4rem 0.6rem;
			min-width: 2.25rem;
			min-height: 2.25rem;
		}

		.key-button.small {
			font-size: 0.65rem;
			padding: 0.3rem 0.4rem;
			min-width: 1.75rem;
			min-height: 1.75rem;
		}
	}

	@media (max-width: 360px) {
		.mobile-keyboard-toolbar {
			padding: 0.375rem;
			gap: 0.25rem;
		}

		.key-group {
			gap: 0.25rem;
		}

		.key-button {
			font-size: 0.7rem;
			padding: 0.35rem 0.5rem;
			min-width: 2rem;
			min-height: 2rem;
		}
	}

	/* Hide on desktop */
	@media (min-width: 769px) {
		.mobile-keyboard-toolbar {
			display: none;
		}
	}
</style>