<!--
	WorkspaceHeader.svelte

	Extracted header component with brand logo and layout controls
	Uses ViewModels for state management and business logic
-->

<script>
	import BrandLogo from '$lib/client/shared/components/BrandLogo.svelte';
	import IconButton from '$lib/client/shared/components/IconButton.svelte';
	import IconLogout from '$lib/client/shared/components/Icons/IconLogout.svelte';
	import TunnelIndicator from '$lib/client/shared/components/TunnelIndicator.svelte';

	// Props
	let {
		hasActiveSessions: _hasActiveSessions = false,
		sessionCount = 0,
		currentSessionIndex = 0,
		onLogout = () => {},
		onInstallPWA: _onInstallPWA = () => {},
		isSingleSessionMode = false
	} = $props();
</script>

<header class="workspace-header">
	<div>
		<BrandLogo />
	</div>

	<!-- Navigation Links -->
	<nav class="header-nav">
		<a
			href="/workspace"
			class="nav-link"
			class:active={globalThis.location?.pathname === '/workspace'}
		>
			Project
		</a>
		<a href="/cron" class="nav-link" class:active={globalThis.location?.pathname === '/cron'}>
			Cron Jobs
		</a>
		<a
			href="/settings"
			class="nav-link"
			class:active={globalThis.location?.pathname === '/settings'}
		>
			Settings
		</a>
	</nav>

	<div class="flex-1"></div>

	<!-- Tunnel indicator -->
	<TunnelIndicator />

	<div class="flex gap-3">
		<!-- <IconButton onclick={onInstallPWA} aria-label="Install app" title="Install App">
			<IconAppWindow size={18} />
		</IconButton> -->
		{#if isSingleSessionMode && sessionCount > 0}
			<div class="flex items-center justify-center">
				<span>
					{Math.min(currentSessionIndex + 1, sessionCount)} / {sessionCount}
				</span>
			</div>
		{/if}
		<IconButton onclick={onLogout} aria-label="Logout">
			<IconLogout size={18} />
		</IconButton>
	</div>
</header>

<style>
	/* Component-specific sizing only */
	.workspace-header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.header-nav {
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}

	.nav-link {
		padding: var(--space-2) var(--space-3);
		font-size: var(--font-size-sm);
		font-weight: 500;
		color: var(--text-secondary);
		text-decoration: none;
		border-radius: var(--radius-md);
		transition: all 0.2s ease;
	}

	.nav-link:hover {
		color: var(--text-primary);
		background: var(--bg-hover);
	}

	.nav-link.active {
		color: var(--text-primary);
		background: var(--bg-secondary);
	}

	@media (max-width: 800px) {
		.workspace-header {
			padding: var(--space-2) var(--space-3);
			padding-block: 0;
			gap: var(--space-2);
		}

		.header-nav {
			display: none;
		}
	}
</style>
