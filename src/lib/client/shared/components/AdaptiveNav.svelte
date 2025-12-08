<script>
	/**
	 * AdaptiveNav Component
	 *
	 * Unified navigation that adapts between desktop (top) and mobile (bottom) modes.
	 * Features touch-friendly targets, keyboard navigation, and smooth transitions.
	 *
	 * @file src/lib/client/shared/components/AdaptiveNav.svelte
	 */
	import { page } from '$app/stores';
	import IconTerminal from './Icons/IconTerminal.svelte';
	import IconSettings from './Icons/IconSettings.svelte';
	import IconRobot from './Icons/IconRobot.svelte';
	import IconFolder from './Icons/IconFolder.svelte';
	import IconHistory from './Icons/IconHistory.svelte';

	let {
		/** @type {'desktop' | 'mobile' | 'auto'} */
		mode = 'auto',
		/** @type {() => void} */
		onNavigate = () => {}
	} = $props();

	// Navigation items with icons and routes
	const navItems = [
		{ id: 'workspace', label: 'Workspace', href: '/workspace', icon: IconFolder, shortcut: 'W' },
		{ id: 'cron', label: 'Tasks', href: '/cron', icon: IconHistory, shortcut: 'T' },
		{ id: 'settings', label: 'Settings', href: '/settings', icon: IconSettings, shortcut: 'S' }
	];

	// Current path for active state
	const currentPath = $derived($page?.url?.pathname || '/workspace');

	// Check if item is active (including sub-routes)
	function isActive(href) {
		if (href === '/workspace') {
			return currentPath === '/workspace' || currentPath === '/';
		}
		return currentPath.startsWith(href);
	}

	// Keyboard navigation handler
	function handleKeydown(e) {
		// Cmd/Ctrl + number shortcuts
		if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
			const num = parseInt(e.key);
			if (num >= 1 && num <= navItems.length) {
				e.preventDefault();
				const item = navItems[num - 1];
				if (item) {
					window.location.href = item.href;
					onNavigate();
				}
			}
		}
	}

	// Add global keyboard listener
	if (typeof window !== 'undefined') {
		$effect(() => {
			window.addEventListener('keydown', handleKeydown);
			return () => window.removeEventListener('keydown', handleKeydown);
		});
	}
</script>

<nav
	class="adaptive-nav"
	class:desktop={mode === 'desktop'}
	class:mobile={mode === 'mobile'}
	role="navigation"
	aria-label="Main navigation"
>
	{#each navItems as item (item.id)}
		{@const active = isActive(item.href)}
		{@const IconComponent = item.icon}
		<a
			href={item.href}
			class="nav-item"
			class:active
			aria-current={active ? 'page' : undefined}
			onclick={() => onNavigate()}
		>
			<span class="nav-icon">
				<IconComponent size={20} />
			</span>
			<span class="nav-label">{item.label}</span>
			{#if active}
				<span class="nav-indicator"></span>
			{/if}
		</a>
	{/each}
</nav>

<style>
	.adaptive-nav {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}

	/* Desktop mode - horizontal top nav */
	.adaptive-nav.desktop,
	.adaptive-nav:not(.mobile) {
		flex-direction: row;
	}

	/* Mobile mode - bottom tab bar */
	.adaptive-nav.mobile {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		justify-content: space-around;
		padding: var(--space-2) var(--space-3);
		padding-bottom: max(var(--space-2), env(safe-area-inset-bottom));
		background: var(--surface);
		border-top: 1px solid var(--surface-border);
		z-index: 100;
		gap: 0;
	}

	.nav-item {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		color: var(--text-muted);
		text-decoration: none;
		border-radius: var(--radius);
		transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
		-webkit-tap-highlight-color: transparent;
		touch-action: manipulation;
		user-select: none;
	}

	/* Desktop nav item */
	.adaptive-nav:not(.mobile) .nav-item {
		min-height: 36px;
	}

	/* Mobile nav item - stacked icon + label */
	.adaptive-nav.mobile .nav-item {
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-2);
		min-width: 64px;
		min-height: 56px;
		justify-content: center;
	}

	.nav-item:hover {
		color: var(--text);
		background: var(--surface-hover);
	}

	.nav-item:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	.nav-item:active {
		transform: scale(0.96);
	}

	.nav-item.active {
		color: var(--primary);
		background: color-mix(in oklab, var(--primary) 10%, transparent);
	}

	.nav-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.2s ease;
	}

	.nav-item:hover .nav-icon {
		transform: scale(1.1);
	}

	.nav-item.active .nav-icon {
		filter: drop-shadow(0 0 4px var(--primary-glow-30));
	}

	.nav-label {
		font-size: var(--font-size-1);
		font-weight: 500;
		font-family: var(--font-mono);
		white-space: nowrap;
	}

	/* Mobile label sizing */
	.adaptive-nav.mobile .nav-label {
		font-size: 10px;
		letter-spacing: 0.02em;
	}

	/* Active indicator */
	.nav-indicator {
		position: absolute;
		background: var(--primary);
		transition: all 0.2s ease;
	}

	/* Desktop indicator - bottom line */
	.adaptive-nav:not(.mobile) .nav-indicator {
		bottom: -2px;
		left: 50%;
		transform: translateX(-50%);
		width: 16px;
		height: 2px;
		border-radius: var(--radius-full);
	}

	/* Mobile indicator - top dot */
	.adaptive-nav.mobile .nav-indicator {
		top: 4px;
		left: 50%;
		transform: translateX(-50%);
		width: 4px;
		height: 4px;
		border-radius: var(--radius-full);
		box-shadow: 0 0 8px var(--primary-glow-40);
	}

	/* Hide desktop nav on mobile */
	@media (max-width: 768px) {
		.adaptive-nav:not(.mobile) {
			display: none;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		.nav-item,
		.nav-icon,
		.nav-indicator {
			transition: none;
		}

		.nav-item:active {
			transform: none;
		}
	}
</style>
