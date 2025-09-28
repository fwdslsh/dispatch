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
	/* StatusBar component uses utility classes - no additional styles needed */
	.version-indicator {
		font-size: 0.75rem;
		color: var(--text-tertiary, #6b7280);
		opacity: 0.7;
		font-weight: 400;
		margin-left: 8px;
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
