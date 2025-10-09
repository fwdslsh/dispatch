<!--
	StatusBar.svelte

	Main status bar component with left, center, and right groups
-->

<script>
	import { useService } from '../services/ServiceContainer.svelte.js';
	import { onMount } from 'svelte';

	// Props
	let { isMobile = false, left = null, center = null, right = null } = $props();

	// Version information
	let appVersion = $state('');

	// Fetch version on mount
	onMount(async () => {
		try {
			const environmentService = await useService('environment');
			appVersion = await environmentService.getAppVersion();
		} catch (error) {
			console.warn('Failed to fetch app version:', error);
			appVersion = '';
		}
	});
</script>

<footer class="status-bar-container">
	<div class="status-bar">
		<!-- Left group: System actions -->
		<div class="status-bar-group status-bar-left">
			{#if appVersion && appVersion !== 'unknown'}
				<span class="version-indicator" title="Application version: {appVersion}">
					v{appVersion}
				</span>
			{/if}
		</div>

		<!-- Center group: Main create session button -->
		<div class="status-bar-group status-bar-center">
			{@render center?.()}
		</div>

		<!-- Right group: Navigation and session menu -->
		<div class="status-bar-group status-bar-right">
			{@render right?.()}
		</div>
	</div>
</footer>

<style>
	/* Status bar layout styles */
	.status-bar-container {
		grid-area: footer;
	}

	.status-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.4rem 0.6rem;
		box-sizing: border-box;
		width: 100%;
		max-width: 100svw;
		background: var(--bg-panel);
		border-top: 1px solid var(--primary-dim);
	}

	.status-bar-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.status-bar-left {
		flex: 1 1 0;
		justify-content: flex-start;
	}

	.status-bar-center {
		flex: 0 0 auto;
		justify-content: center;
	}

	.status-bar-right {
		flex: 1 1 0;
		justify-content: flex-end;
	}

	/* Component-specific styles */
	.version-indicator {
		font-size: 0.75rem;
		color: var(--text-tertiary, #6b7280);
		opacity: 0.7;
		font-weight: 400;
		margin-left: var(--space-2);
		user-select: none;
		cursor: default;
		transition: opacity 0.2s ease;
	}

	.version-indicator:hover {
		opacity: 1;
	}

	/* Small screen adjustments */
	@media (max-width: 480px) {
		.status-bar {
			padding: 0.3rem 0.5rem;
		}

		.status-bar-group.status-bar-left,
		.status-bar-group.status-bar-right {
			gap: 0.25rem;
		}
	}

	/* Hide version on very small screens to save space */
	@media (max-width: 400px) {
		.version-indicator {
			display: none;
		}
	}
</style>
