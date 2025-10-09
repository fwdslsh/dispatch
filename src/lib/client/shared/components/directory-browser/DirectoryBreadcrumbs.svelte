<script>
	import IconX from '../Icons/IconX.svelte';
	import IconButton from '../IconButton.svelte';

	/**
	 * DirectoryBreadcrumbs Component
	 *
	 * Displays navigation breadcrumbs for directory hierarchy.
	 * Allows clicking on any breadcrumb to navigate to that directory.
	 *
	 * If breadcrumbs exceed 5 items, shows first 2, ellipsis, and last 2.
	 */
	let {
		breadcrumbs = [],
		selected = '',
		loading = false,
		isAlwaysOpen = false,
		onNavigate,
		onClose
	} = $props();

	/**
	 * Compute display breadcrumbs with ellipsis for long paths
	 * Shows first 2 and last 2 when total > 5
	 */
	const displayBreadcrumbs = $derived.by(() => {
		if (breadcrumbs.length <= 5) {
			return breadcrumbs.map((crumb, i) => ({ ...crumb, index: i, isEllipsis: false }));
		}

		// Show first 2, ellipsis, last 2
		const first = breadcrumbs
			.slice(0, 2)
			.map((crumb, i) => ({ ...crumb, index: i, isEllipsis: false }));
		const last = breadcrumbs.slice(-2).map((crumb, i) => ({
			...crumb,
			index: breadcrumbs.length - 2 + i,
			isEllipsis: false
		}));

		// Ellipsis marker (middle element for visual separation)
		const ellipsis = {
			name: '…',
			path: null,
			index: 2,
			isEllipsis: true
		};

		return [...first, ellipsis, ...last];
	});
</script>

<div
	class="directory-breadcrumb-enhanced {selected > '' ? 'bg-primary-glow-10' : ''}"
	aria-label="Breadcrumbs"
>
	<div class="flex items-center gap-1 overflow-x-auto flex-1">
		{#each displayBreadcrumbs as crumb, i}
			{#if i > 0}
				<span class="breadcrumb-separator">/</span>
			{/if}
			{#if crumb.isEllipsis}
				<span class="breadcrumb-ellipsis" title="Hidden directories">
					{crumb.name}
				</span>
			{:else}
				<button
					type="button"
					class="breadcrumb-item-enhanced"
					onclick={() => onNavigate(crumb.path)}
					disabled={loading}
				>
					{crumb.name}
				</button>
			{/if}
		{/each}
	</div>
	<div class="flex items-center gap-1 ml-auto shrink-0">
		{#if !isAlwaysOpen}
			<IconButton type="button" onclick={onClose} title="Close directory browser" variant="ghost">
				<IconX size={16} />
			</IconButton>
		{/if}
	</div>
</div>

<style>
	.directory-breadcrumb-enhanced {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-3) var(--space-4);
		background: color-mix(in oklab, var(--surface) 95%, var(--primary) 5%);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 10%, transparent);
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		overflow-x: auto;
	}

	.breadcrumb-item-enhanced {
		padding: var(--space-1) var(--space-2);
		border: none;
		background: transparent;
		color: var(--text);
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.breadcrumb-item-enhanced:hover {
		color: var(--primary);
	}

	.breadcrumb-ellipsis {
		padding: var(--space-1) var(--space-2);
		color: var(--muted);
		white-space: nowrap;
		flex-shrink: 0;
		user-select: none;
		cursor: default;
	}

	.breadcrumb-separator {
		color: var(--muted);
		opacity: 0.5;
		margin: 0 var(--space-1);
	}

	@media (max-width: 768px) {
		.directory-breadcrumb-enhanced {
			padding: var(--space-4);
			gap: var(--space-3);
		}

		.breadcrumb-item-enhanced {
			padding: var(--space-2) var(--space-3);
			min-height: 40px;
		}

		.breadcrumb-ellipsis {
			padding: var(--space-2) var(--space-3);
		}
	}
</style>
