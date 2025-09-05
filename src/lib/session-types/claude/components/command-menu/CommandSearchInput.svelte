<script>
	import Input from '$lib/shared/components/Input.svelte';

	// Props
	let {
		query = '',
		placeholder = 'Search commands...',
		shortcut = 'Ctrl+K',
		onInput = () => {},
		...restProps
	} = $props();

	let inputElement = $state();

	// Expose focus method
	export function focus() {
		if (inputElement?.focus) {
			inputElement.focus();
		}
	}

	// Handle input changes
	function handleInput(event) {
		const newQuery = event.target.value;
		onInput(newQuery);
	}

	// Handle keydown events (passed through from parent)
	function handleKeydown(event) {
		// Let the parent handle navigation keys
		// Input should only handle text input
		if (!['ArrowUp', 'ArrowDown', 'Enter', 'Escape'].includes(event.key)) {
			// Allow normal typing
			return;
		}
	}
</script>

<div class="search-container">
	<div class="search-icon">⚡</div>
	<Input
		bind:element={inputElement}
		type="text"
		class="command-search"
		{placeholder}
		value={query}
		oninput={handleInput}
		onkeydown={handleKeydown}
		autocomplete="off"
		spellcheck="false"
		{...restProps}
	/>
	<div class="search-shortcut">{shortcut}</div>
</div>

<style>
	.search-container {
		display: flex;
		align-items: center;
		padding: var(--space-md);
		border-bottom: 1px solid var(--border);
		background: var(--surface);
	}

	.search-icon {
		color: var(--primary);
		font-size: 1.2rem;
		margin-right: var(--space-sm);
		flex-shrink: 0;
	}

	:global(.command-search) {
		flex: 1;
		background: transparent !important;
		border: none !important;
		color: var(--text-primary);
		font-size: 1.1rem;
		line-height: 1.4;
		font-family: var(--font-sans);
		padding: var(--space-xs) 0 !important;
		margin: 0 !important;
		box-shadow: none !important;
	}

	:global(.command-search:focus) {
		outline: none !important;
		box-shadow: none !important;
	}

	:global(.command-search::placeholder) {
		color: var(--text-muted);
	}

	.search-shortcut {
		background: var(--bg-dark);
		color: var(--text-secondary);
		padding: var(--space-xs) var(--space-sm);
		border-radius: 4px;
		font-size: 0.75rem;
		font-family: var(--font-mono);
		border: 1px solid var(--border);
		flex-shrink: 0;
		margin-left: var(--space-sm);
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.search-container {
			padding: var(--space-sm);
		}

		.search-icon {
			font-size: 1rem;
		}

		:global(.command-search) {
			font-size: 1rem !important;
		}

		.search-shortcut {
			display: none;
		}
	}
</style>