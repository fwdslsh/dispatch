<!--
	StatusBar.svelte

	Main status bar component with left, center, and right groups
	Integrates mobile navigation, create session button, and action buttons
-->

<script>
	import MobileNavigation from './MobileNavigation.svelte';
	import CreateSessionButton from './CreateSessionButton.svelte';
	import IconButton from '../IconButton.svelte';
	import IconAdjustmentsAlt from '../Icons/IconAdjustmentsAlt.svelte';
	import IconCodeDots from '../Icons/IconCodeDots.svelte';
	import IconCodeMinus from '../Icons/IconCodeMinus.svelte';
	import IconPlayerTrackNext from '../Icons/IconPlayerTrackNext.svelte';
	import IconPlayerTrackPrev from '../Icons/IconPlayerTrackPrev.svelte';

	// Props
	let {
		onOpenSettings = () => {},
		onCreateSession = () => {},
		onToggleSessionMenu = () => {},
		onNavigateSession = () => {},
		sessionMenuOpen = false,
		isMobile = false,
		hasActiveSessions = false,
		currentSessionIndex = 0,
		totalSessions = 0,
		viewMode = 'window-manager'
	} = $props();

	const singleSessionActive = $derived(viewMode === 'single-session');
	const desktopNavDisabled = $derived(!hasActiveSessions || totalSessions <= 1);
	const desktopPrevDisabled = $derived(desktopNavDisabled || currentSessionIndex <= 0);
	const desktopNextDisabled = $derived(
		desktopNavDisabled || currentSessionIndex >= Math.max(totalSessions - 1, 0)
	);
</script>

<footer class="status-bar-container">
	<div class="status-bar">
		<!-- Left group: System actions -->
		<div class="status-bar-group status-bar-left">
			<!-- <IconButton onclick={onLogout} aria-label="Logout" title="Logout">
				<IconLogout2 size={18} />
			</IconButton>

			<IconButton onclick={onInstallPWA} aria-label="Install app" title="Install App">
				<IconAppWindow size={18} />
			</IconButton> -->
			<IconButton onclick={onOpenSettings} aria-label="Open settings" title="Settings">
				<IconAdjustmentsAlt size={18} />
			</IconButton>

			<!-- {#if totalSessions > 0}
				<span class="session-counter">
					{Math.min(currentSessionIndex + 1, totalSessions)} / {totalSessions}
				</span>
			{/if} -->
		</div>

		<!-- Center group: Main create session button -->
		<div class="status-bar-group status-bar-center">
			<CreateSessionButton {onCreateSession} />
		</div>

		<!-- Right group: Navigation and session menu -->
		<div class="status-bar-group status-bar-right">
			{#if isMobile}
				<MobileNavigation
					{onNavigateSession}
					disabled={!hasActiveSessions}
					currentIndex={currentSessionIndex}
					{totalSessions}
				/>
			{/if}

			{#if !isMobile && singleSessionActive}
				<div class="desktop-navigation">
					<IconButton
						onclick={() => onNavigateSession('prev')}
						disabled={desktopPrevDisabled}
						aria-label="Previous session"
						title="Previous session"
					>
						<IconPlayerTrackPrev size={18} />
					</IconButton>
					<!--
					{#if totalSessions > 0}
						<span class="session-counter">
							{Math.min(currentSessionIndex + 1, totalSessions)} / {totalSessions}
						</span>
					{/if} -->

					<IconButton
						onclick={() => onNavigateSession('next')}
						disabled={desktopNextDisabled}
						aria-label="Next session"
						title="Next session"
					>
						<IconPlayerTrackNext size={18} />
					</IconButton>
				</div>
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
		gap: var(--space-2);
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

	.desktop-navigation {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	/* Small screen adjustments */
	@media (max-width: 800px) {
		.status-bar {
			padding: var(--space-1) var(--space-2);
		}

		.status-bar-group {
			gap: var(--space-1);
		}
	}
</style>
