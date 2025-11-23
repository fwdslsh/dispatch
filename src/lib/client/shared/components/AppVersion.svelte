<script>
	/**
	 * @component AppVersion
	 * @description
	 * Displays application version number fetched from environment service.
	 * Shows version in compact format with hover tooltip.
	 * Automatically hidden on very small screens (<400px) to save space.
	 *
	 * @example
	 * ```svelte
	 * <!-- Basic usage in status bar -->
	 * <StatusBar>
	 *   <AppVersion />
	 * </StatusBar>
	 * ```
	 */
	import { useService } from '../services/ServiceContainer.svelte.js';
	import { onMount } from 'svelte';

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

<span class="version-indicator" title="Version: {appVersion}">
	v{appVersion}
</span>

<style>
	/* StatusBar component uses utility classes - no additional styles needed */
	.version-indicator {
		font-size: 0.75rem;
		color: var(--text-primary, #6b7280);
		opacity: 0.8;
		font-weight: 400;
		margin-left: var(--space-2);
		user-select: none;
		cursor: default;
		transition: opacity 0.2s ease;
	}

	.version-indicator:hover {
		opacity: 1;
	}

	/* Hide version on very small screens to save space */
	@media (max-width: 400px) {
		.version-indicator {
			display: none;
		}
	}
</style>
