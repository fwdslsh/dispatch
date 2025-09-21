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
		onLogout = () => {},
		onInstallPWA = () => {},
		onOpenSettings = () => {},
		onCreateSession = () => {},
		onToggleSessionMenu = () => {},
		onNavigateSession = () => {},
		sessionMenuOpen = false,
		isMobile = false,
		hasActiveSessions = false,
		sessionCount = 0,
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
			<!-- {#if totalSessions > 0}
				<span class="session-counter">
					{Math.min(currentSessionIndex + 1, totalSessions)} / {totalSessions}
				</span>
			{/if} -->
		</div>

		<!-- Center group: Main create session button -->
		<div class="center-group">
			<CreateSessionButton {onCreateSession} />
		</div>

		<!-- Right group: Navigation and session menu -->
		<div class="right-group">
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

	.desktop-navigation {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-right: 0.5rem;
	}

	.desktop-navigation .session-counter {
		font-family: var(--font-mono);
		font-size: 0.75rem;
		color: var(--text-secondary);
		min-width: 40px;
		text-align: center;
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
