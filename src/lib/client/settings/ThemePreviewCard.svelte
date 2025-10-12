<script>
	/**
	 * ThemePreviewCard - Terminal-style theme preview component
	 * Displays theme colors with ANSI palette and provides activation/deletion actions
	 *
	 * Props:
	 * @param {Object} theme - Theme metadata with name, description, and color values
	 * @param {boolean} isActive - Whether this theme is currently active
	 * @param {Function} onActivate - Callback when theme is activated
	 * @param {Function} onDelete - Callback when theme is deleted
	 * @param {boolean} canDelete - Whether delete button should be shown
	 */

	import Button from '../shared/components/Button.svelte';

	let {
		theme,
		isActive = false,
		onActivate = () => {},
		onDelete = () => {},
		canDelete = true
	} = $props();

	// Extract colors from theme (supports both direct properties and cssVariables)
	const colors = $derived.by(() => {
		if (!theme) {
			return {
				background: '#000000',
				foreground: '#ffffff',
				cursor: '#ffffff',
				green: '#00ff00',
				cyan: '#00ffff',
				yellow: '#ffff00',
				brightBlack: '#555555'
			};
		}

		// If theme has cssVariables (from API), extract from there
		if (theme.cssVariables) {
			const cv = theme.cssVariables;
			return {
				background: cv['--theme-background'] || '#000000',
				foreground: cv['--theme-foreground'] || '#ffffff',
				cursor: cv['--theme-cursor'] || '#ffffff',
				green: cv['--theme-ansi-green'] || '#00ff00',
				cyan: cv['--theme-ansi-cyan'] || '#00ffff',
				yellow: cv['--theme-ansi-yellow'] || '#ffff00',
				brightBlack: cv['--theme-ansi-bright-black'] || '#555555'
			};
		}

		// Fallback to direct properties
		return {
			background: theme.background || '#000000',
			foreground: theme.foreground || '#ffffff',
			cursor: theme.cursor || '#ffffff',
			green: theme.green || '#00ff00',
			cyan: theme.cyan || '#00ffff',
			yellow: theme.yellow || '#ffff00',
			brightBlack: theme.brightBlack || '#555555'
		};
	});

	// Extract ANSI colors from theme
	const ansiColors = $derived.by(() => {
		if (!theme) return { normal: [], bright: [] };

		// If theme has cssVariables, extract from there
		if (theme.cssVariables) {
			const cv = theme.cssVariables;
			const normal = [
				cv['--theme-ansi-black'],
				cv['--theme-ansi-red'],
				cv['--theme-ansi-green'],
				cv['--theme-ansi-yellow'],
				cv['--theme-ansi-blue'],
				cv['--theme-ansi-magenta'],
				cv['--theme-ansi-cyan'],
				cv['--theme-ansi-white']
			];

			const bright = [
				cv['--theme-ansi-bright-black'],
				cv['--theme-ansi-bright-red'],
				cv['--theme-ansi-bright-green'],
				cv['--theme-ansi-bright-yellow'],
				cv['--theme-ansi-bright-blue'],
				cv['--theme-ansi-bright-magenta'],
				cv['--theme-ansi-bright-cyan'],
				cv['--theme-ansi-bright-white']
			];

			return { normal, bright };
		}

		// Fallback to direct properties
		const normal = [
			theme.black,
			theme.red,
			theme.green,
			theme.yellow,
			theme.blue,
			theme.magenta,
			theme.cyan,
			theme.white
		];

		const bright = [
			theme.brightBlack,
			theme.brightRed,
			theme.brightGreen,
			theme.brightYellow,
			theme.brightBlue,
			theme.brightMagenta,
			theme.brightCyan,
			theme.brightWhite
		];

		return { normal, bright };
	});
</script>

<div
	class="theme-card"
	class:active={isActive}
	role="article"
	aria-label={`${theme.name} theme preview`}
>
	<!-- Window chrome with macOS-style dots -->
	<div class="chrome">
		<span class="title">{theme.name}</span>
		{#if isActive}
			<span class="active-badge" role="status">Active</span>
		{/if}
	</div>
	<!-- Theme description -->
	{#if theme.description}
		<div class="description">
			{theme.description}
		</div>
	{/if}
	<!-- Terminal preview showing background, foreground, and cursor -->
	<div
		class="preview"
		style="
			background-color: {colors.background};
			color: {colors.foreground};
		"
	>
		<div class="preview-line">
			<span class="prompt" style="color: {colors.green};">&dollar;</span>
			<span class="command" style="color: {colors.cyan};">dispatch</span>
			<span class="arg" style="color: {colors.yellow};">--theme</span>
			<span style="color: {colors.foreground};">"{theme.name}"</span>
		</div>
		<div class="preview-line">
			<span style="color: {colors.brightBlack};"># Terminal theme preview</span>
		</div>
		<div class="cursor-line">
			<span class="cursor" style="background-color: {colors.cursor};" aria-hidden="true"></span>
		</div>
	</div>

	<!-- ANSI color palette display -->
	<div class="palette" role="img" aria-label="ANSI color palette">
		<div class="palette-label">ANSI Colors:</div>

		<!-- Normal colors (0-7) -->
		<div class="palette-row">
			{#each ansiColors.normal as color, index (index)}
				<span
					class="color-block"
					style="background-color: {color};"
					title="ANSI {index}: {color}"
					aria-label="Color {index}"
				></span>
			{/each}
		</div>

		<!-- Bright colors (8-15) -->
		<div class="palette-row">
			{#each ansiColors.bright as color, index (index + 8)}
				<span
					class="color-block"
					style="background-color: {color};"
					title="ANSI Bright {index}: {color}"
					aria-label="Bright color {index}"
				></span>
			{/each}
		</div>
	</div>

	<!-- Action buttons -->
	<div class="actions">
		<Button
			variant={isActive ? 'secondary' : 'primary'}
			size="medium"
			text={isActive ? 'Active' : 'Activate'}
			disabled={isActive}
			onclick={onActivate}
			ariaLabel={isActive ? 'Currently active theme' : `Activate ${theme.name} theme`}
		/>
		{#if canDelete}
			<Button
				variant="danger"
				size="medium"
				text="Delete"
				onclick={onDelete}
				ariaLabel={`Delete ${theme.name} theme`}
			/>
		{/if}
	</div>
</div>

<style>
	.theme-card {
		display: flex;
		flex-direction: column;
		justify-content: space-evenly;
		border: 1px solid var(--line);
		border-radius: var(--radius-xs);
		overflow: hidden;
		max-width: 250px;
		background: var(--surface);
		transition: all 0.2s ease;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}

	.theme-card:hover {
		box-shadow:
			0 2px 4px rgba(0, 0, 0, 0.18),
			0 0 0 1.5px var(--primary-glow-20);

		filter: brightness(1.05);
	}

	.theme-card.active {
		border-color: var(--primary);
		box-shadow:
			0 0 0 1.5px var(--primary-glow-25),
			0 2px 6px rgba(46, 230, 107, 0.13);
	}

	/* Window chrome */
	.chrome {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-1) var(--space-2);
		background: var(--surface-primary-98);
		border-bottom: 1px solid var(--line);
		justify-content: space-between;
	}

	.title {
		font-size: var(--font-size-0);
	}

	.active-badge {
		display: inline-flex;
		align-items: center;
		padding: 1px var(--space-1);
		font-family: var(--font-mono);
		font-size: 11px;
		font-weight: 600;
		color: var(--bg);
		background: var(--primary);
		border-radius: var(--radius-xs);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	/* Terminal preview area */
	.preview {
		padding: var(--space-2);
		min-height: 64px;
		font-family: var(--font-mono);
		font-size: 13px;
		line-height: 1.5;
		position: relative;
	}

	.preview-line {
		margin-bottom: 2px;
	}

	.prompt {
		font-weight: bold;
		margin-right: var(--space-1);
	}

	.command,
	.arg {
		margin-right: 6px;
	}

	.cursor-line {
		margin-top: 8px;
	}

	.cursor {
		display: inline-block;
		width: 8px;
		height: 16px;
	}

	/* ANSI palette */
	.palette {
		padding: var(--space-2);
	}

	.palette-label {
		font-size: 11px;
		margin-bottom: 2px;
	}

	.palette-row {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 2px;
		margin-bottom: 2px;
	}

	.palette-row:last-child {
		margin-bottom: 0;
	}

	.color-block {
		aspect-ratio: 1;
		border-radius: 3px;
		border: 1px solid rgba(0, 0, 0, 0.2);
		cursor: help;
		transition: transform 0.15s ease;
	}

	.color-block:hover {
		transform: scale(1.2);
		z-index: 1;
	}

	/* Description */
	.description {
		padding: var(--space-2);
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--muted);
		line-height: 1.5;
		font-style: italic;
	}

	/* Action buttons */
	.actions {
		display: flex;
		gap: var(--space-1);
		padding: var(--space-2);
		border-top: 1px solid var(--line);
		background: var(--surface-primary-98);
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.preview {
			font-size: 11px;
			min-height: 48px;
			padding: var(--space-1);
		}
		.palette-row {
			gap: 1px;
		}
		.actions {
			flex-direction: column;
		}
	}

	/* Accessibility: Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.theme-card {
			transition: none;
		}

		.theme-card:hover {
			transform: none;
		}

		.cursor {
			animation: none;
			opacity: 1;
		}

		.color-block:hover {
			transform: none;
		}
	}

	/* Accessibility: High contrast mode */
	@media (prefers-contrast: high) {
		.theme-card {
			border-width: var(--space-0);
		}

		.color-block {
			border-width: var(--space-0);
		}
	}
</style>
