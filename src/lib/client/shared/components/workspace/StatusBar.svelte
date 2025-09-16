<!--
	StatusBar.svelte

	Main status bar component with left, center, and right groups
	Integrates mobile navigation, create session button, and action buttons
-->
<script>
	import { uiState } from '$lib/client/shared/state/ui-state.svelte.js';
	import { sessionState } from '$lib/client/shared/state/session-state.svelte.js';
	import MobileNavigation from './MobileNavigation.svelte';
	import CreateSessionButton from './CreateSessionButton.svelte';
	import IconButton from '../IconButton.svelte';
	import {
		IconLogout2,
		IconAppWindow,
		IconAdjustmentsAlt,
		IconCodeDots,
		IconCodeMinus
	} from '@tabler/icons-svelte';

	// Props
	let {
		onLogout = () => {},
		onInstallPWA = () => {},
		onOpenSettings = () => {},
		onCreateSession = () => {},
		onToggleSessionMenu = () => {},
		onNavigateSession = () => {},
		sessionMenuOpen = false
	} = $props();

	// Derived values from state
	const currentBreakpoint = $derived(
		uiState.layout.isMobile ? 'mobile' : uiState.layout.isTablet ? 'tablet' : 'desktop'
	);
	const sessionCount = $derived(sessionState.all.length);

	// Reactive state
	const isMobile = $derived(currentBreakpoint === 'mobile');
	const hasActiveSessions = $derived(sessionCount > 0);
</script>

<footer class="status-bar-container">
	<div class="status-bar">
		<!-- Left group: System actions -->
		<div class="left-group">
			<!-- <IconButton onclick={onLogout} aria-label="Logout" title="Logout">
				<IconLogout2 size={18} />
			</IconButton>

			<IconButton onclick={onInstallPWA} aria-label="Install app" title="Install App">
				<IconAppWindow size={18} />
			</IconButton> -->

			<IconButton onclick={onOpenSettings} aria-label="Open settings" title="Settings">
				<IconAdjustmentsAlt size={18} />
			</IconButton>
		</div>

		<!-- Center group: Main create session button -->
		<div class="center-group">
			<CreateSessionButton {onCreateSession} />
		</div>

		<!-- Right group: Navigation and session menu -->
		<div class="right-group">
			{#if isMobile}
				<MobileNavigation {onNavigateSession} disabled={!hasActiveSessions} />
			{/if}

			<IconButton onclick={onToggleSessionMenu} aria-label="Open sessions">
				{#if sessionMenuOpen}
					<IconCodeMinus size={18} />
				{:else}
					<IconCodeDots size={18} />
				{/if}
			</IconButton>
		</div>
	</div>
</footer>

<style>
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

	.left-group,
	.center-group,
	.right-group {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.left-group {
		flex: 1 1 0;
		justify-content: flex-start;
	}

	.center-group {
		flex: 0 0 auto;
		justify-content: center;
	}

	.right-group {
		flex: 1 1 0;
		justify-content: flex-end;
	}

	/* Mobile-specific touch improvements */
	@media (hover: none) and (pointer: coarse) {
		:global(.bottom-btn:active) {
			opacity: 0.8;
			transform: scale(0.95);
		}
	}

	/* Very small screens adjustments */
	@media (max-width: 480px) {
		.status-bar {
			padding: 0.3rem 0.5rem;
		}

		.left-group,
		.right-group {
			gap: 0.25rem;
		}
	}
</style>
