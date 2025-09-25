<script>
	import { onMount } from 'svelte';

	let {
		title = 'Authentication',
		subtitle = '',
		showBackButton = false,
		compact = false,
		children
	} = $props();

	let isMobile = $state(false);
	let isLandscape = $state(false);

	$effect(() => {
		checkViewport();

		const handleResize = () => checkViewport();
		window.addEventListener('resize', handleResize);
		window.addEventListener('orientationchange', handleResize);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('orientationchange', handleResize);
		};
	});

	function checkViewport() {
		isMobile = window.innerWidth <= 768;
		isLandscape = window.innerWidth > window.innerHeight && window.innerWidth <= 1024;
	}

	function handleBackButton() {
		if (window.history.length > 1) {
			window.history.back();
		} else {
			// Fallback navigation
			window.location.href = '/';
		}
	}
</script>

<div
	class="mobile-auth-layout {compact ? 'compact' : ''} {isMobile ? 'mobile' : ''} {isLandscape
		? 'landscape'
		: ''}"
>
	<div class="auth-container">
		{#if isMobile}
			<!-- Mobile Header -->
			<div class="mobile-header">
				{#if showBackButton}
					<button class="back-button" onclick={handleBackButton} aria-label="Go back">
						<svg
							width="24"
							height="24"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="m15 18-6-6 6-6" />
						</svg>
					</button>
				{/if}

				<div class="header-content">
					<h1 class="auth-title">{title}</h1>
					{#if subtitle}
						<p class="auth-subtitle">{subtitle}</p>
					{/if}
				</div>

				<div class="header-spacer"></div>
			</div>
		{:else}
			<!-- Desktop Header -->
			<div class="desktop-header">
				<h1 class="auth-title">{title}</h1>
				{#if subtitle}
					<p class="auth-subtitle">{subtitle}</p>
				{/if}
			</div>
		{/if}

		<!-- Content Area -->
		<div class="auth-content">
			{@render children()}
		</div>

		<!-- Footer for mobile -->
		{#if isMobile && !compact}
			<div class="mobile-footer">
				<div class="footer-branding">
					<span class="app-name">Dispatch</span>
					<span class="version">v{globalThis.APP_VERSION || '1.0'}</span>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.mobile-auth-layout {
		min-height: 100vh;
		background: #f8fafc;
		display: flex;
		flex-direction: column;
	}

	.mobile-auth-layout.mobile {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
	}

	.mobile-auth-layout.landscape {
		flex-direction: row;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}

	.auth-container {
		flex: 1;
		display: flex;
		flex-direction: column;
		max-width: 480px;
		margin: 0 auto;
		position: relative;
	}

	.mobile-auth-layout.mobile .auth-container {
		background: white;
		margin: 0;
		max-width: none;
		border-radius: 0;
		box-shadow: none;
	}

	.mobile-auth-layout.landscape .auth-container {
		background: white;
		border-radius: 1rem;
		box-shadow:
			0 20px 25px -5px rgba(0, 0, 0, 0.1),
			0 10px 10px -5px rgba(0, 0, 0, 0.04);
		max-width: 900px;
		max-height: 600px;
		width: 100%;
		margin: 0;
	}

	/* Mobile Header */
	.mobile-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem 1.5rem;
		background: white;
		border-bottom: 1px solid #e5e7eb;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.mobile-auth-layout.landscape .mobile-header {
		position: static;
		border-bottom: none;
		border-radius: 1rem 1rem 0 0;
	}

	.back-button {
		background: none;
		border: none;
		padding: 0.5rem;
		cursor: pointer;
		color: #6b7280;
		border-radius: 0.375rem;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.back-button:hover {
		background: #f3f4f6;
		color: #374151;
	}

	.back-button:active {
		transform: scale(0.95);
	}

	.header-content {
		flex: 1;
		text-align: center;
		min-width: 0;
	}

	.header-spacer {
		width: 40px; /* Same width as back button */
	}

	/* Desktop Header */
	.desktop-header {
		padding: 2rem 2rem 1rem;
		text-align: center;
		background: white;
		border-radius: 0.75rem 0.75rem 0 0;
	}

	.auth-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1f2937;
		margin: 0;
		line-height: 1.3;
	}

	.mobile-auth-layout.mobile .auth-title {
		font-size: 1.25rem;
	}

	.mobile-auth-layout.landscape .auth-title {
		font-size: 1.375rem;
	}

	.auth-subtitle {
		font-size: 0.875rem;
		color: #6b7280;
		margin: 0.5rem 0 0 0;
		line-height: 1.4;
	}

	.mobile-auth-layout.mobile .auth-subtitle {
		font-size: 0.8125rem;
	}

	/* Content Area */
	.auth-content {
		flex: 1;
		padding: 1.5rem;
		background: white;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
	}

	.mobile-auth-layout.landscape .auth-content {
		border-radius: 0 0 1rem 1rem;
		display: flex;
		flex-direction: column;
		justify-content: center;
		padding: 2rem;
	}

	.mobile-auth-layout.mobile .auth-content {
		padding: 1rem 1.5rem 2rem;
		border-radius: 0;
	}

	.mobile-auth-layout.compact .auth-content {
		padding: 1rem;
	}

	/* Footer */
	.mobile-footer {
		background: #f8fafc;
		padding: 1rem 1.5rem;
		border-top: 1px solid #e5e7eb;
		text-align: center;
	}

	.footer-branding {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: #6b7280;
		font-size: 0.8125rem;
	}

	.app-name {
		font-weight: 600;
		color: #374151;
	}

	.version {
		font-family: 'Courier New', monospace;
		background: #e5e7eb;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
	}

	/* Responsive Breakpoints */
	@media (max-width: 640px) {
		.auth-content {
			padding: 1rem;
		}

		.mobile-header {
			padding: 0.75rem 1rem;
		}

		.auth-title {
			font-size: 1.125rem;
		}

		.auth-subtitle {
			font-size: 0.8125rem;
		}
	}

	@media (max-width: 480px) {
		.auth-content {
			padding: 0.75rem;
		}

		.mobile-header {
			padding: 0.5rem 0.75rem;
		}
	}

	/* Landscape phone optimization */
	@media (max-height: 480px) and (orientation: landscape) {
		.mobile-auth-layout.mobile {
			background: white;
		}

		.mobile-header {
			padding: 0.5rem 1rem;
		}

		.auth-title {
			font-size: 1.125rem;
		}

		.auth-content {
			padding: 0.75rem 1rem;
		}

		.mobile-footer {
			display: none;
		}
	}

	/* Safe area handling for devices with notches */
	@supports (padding-top: env(safe-area-inset-top)) {
		.mobile-auth-layout.mobile .mobile-header {
			padding-top: max(1rem, env(safe-area-inset-top));
		}

		.mobile-auth-layout.mobile .auth-content {
			padding-left: max(1.5rem, env(safe-area-inset-left));
			padding-right: max(1.5rem, env(safe-area-inset-right));
		}

		.mobile-auth-layout.mobile .mobile-footer {
			padding-bottom: max(1rem, env(safe-area-inset-bottom));
			padding-left: max(1.5rem, env(safe-area-inset-left));
			padding-right: max(1.5rem, env(safe-area-inset-right));
		}
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.mobile-auth-layout {
			background: #111827;
		}

		.auth-container,
		.mobile-header,
		.auth-content {
			background: #1f2937;
		}

		.auth-title {
			color: #f9fafb;
		}

		.auth-subtitle {
			color: #d1d5db;
		}

		.mobile-footer {
			background: #111827;
			border-top-color: #374151;
		}

		.footer-branding {
			color: #9ca3af;
		}

		.app-name {
			color: #d1d5db;
		}

		.version {
			background: #374151;
			color: #d1d5db;
		}

		.back-button {
			color: #9ca3af;
		}

		.back-button:hover {
			background: #374151;
			color: #d1d5db;
		}
	}

	/* High contrast mode */
	@media (prefers-contrast: high) {
		.mobile-header,
		.auth-content {
			border: 2px solid currentColor;
		}

		.auth-title {
			font-weight: 800;
		}

		.back-button:hover,
		.back-button:focus {
			outline: 2px solid currentColor;
			outline-offset: 2px;
		}
	}

	/* Reduced motion */
	@media (prefers-reduced-motion: reduce) {
		* {
			animation-duration: 0.01ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 0.01ms !important;
		}

		.back-button:active {
			transform: none;
		}
	}
</style>
