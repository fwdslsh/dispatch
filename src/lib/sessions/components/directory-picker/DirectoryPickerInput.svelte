<!--
DirectoryPickerInput.svelte - Input field component for directory selection
Pure presentation component with input field, browse button, and clear button
~60 lines - uses foundation Input component with consistent styling
-->
<script>
	import { Input, Button } from '../foundation/index.js';

	let {
		selectedPath = '',
		disabled = false,
		loading = false,
		onToggle = () => {},
		onClear = () => {}
	} = $props();

	// Handle keyboard events
	const handleKeydown = (event) => {
		if (event.key === 'Space' || event.key === 'Enter') {
			event.preventDefault();
			if (!disabled && !loading) {
				onToggle();
			}
		}
	};
</script>

<div class="directory-picker-input">
	<label>Working Directory (optional)</label>

	<div class="input-container">
		<Input
			type="text"
			value={selectedPath}
			placeholder="/ (project root)"
			readonly
			{disabled}
			class="directory-input"
			onKeydown={handleKeydown}
		/>

		<Button
			variant="outline"
			size="small"
			{disabled}
			{loading}
			onclick={onToggle}
			title="Browse directories"
			class="browse-btn"
		>
			📁
		</Button>

		{#if selectedPath}
			<Button
				variant="outline"
				size="small"
				{disabled}
				onclick={onClear}
				title="Clear selection"
				class="clear-btn"
			>
				✕
			</Button>
		{/if}
	</div>

	<div class="help-text">
		Select a specific folder within the project as the working directory for this Claude session.
	</div>
</div>

<style>
	.directory-picker-input label {
		display: block;
		margin-bottom: var(--space-xs);
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	.input-container {
		display: flex;
		gap: var(--space-xs);
		align-items: stretch;
	}

	:global(.directory-input) {
		flex: 1;
		font-family: 'Courier New', monospace;
	}

	:global(.browse-btn),
	:global(.clear-btn) {
		width: 32px !important;
		padding: var(--space-xs) !important;
		display: flex !important;
		align-items: center !important;
		justify-content: center !important;
	}

	.help-text {
		margin-top: var(--space-xs);
		font-size: 0.75rem;
		color: var(--text-muted);
		line-height: 1.3;
	}
</style>
