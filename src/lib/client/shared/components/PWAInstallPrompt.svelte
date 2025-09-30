<script>
	import { onMount } from 'svelte';
	import Button from './Button.svelte';

	let showInstallPrompt = $state(false);
	let deferredPrompt = null;
	let isInstalled = $state(false);
	let canInstall = $state(false);
	let isIOS = $state(false);
	let showManualPrompt = $state(false);

	onMount(() => {
		// Check if iOS
		isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(/** @type {any} */ (window).MSStream);

		// Check if app is already installed
		if (
			window.matchMedia('(display-mode: standalone)').matches ||
			/** @type {any} */ (window.navigator).standalone === true
		) {
			isInstalled = true;
			console.log('[PWA] App is already installed');
			return;
		}

		// For iOS, show manual install instructions after a delay
		if (isIOS && !isInstalled) {
			// Check if we've shown the prompt before
			const hasShownIOSPrompt = localStorage.getItem('pwa-ios-prompt-shown');
			if (!hasShownIOSPrompt) {
				setTimeout(() => {
					showManualPrompt = true;
				}, 3000); // Show after 3 seconds
			}
		}

		// Listen for beforeinstallprompt event (Chrome/Edge/Samsung)
		window.addEventListener('beforeinstallprompt', (e) => {
			console.log('[PWA] beforeinstallprompt event fired');
			// Prevent the default prompt
			e.preventDefault();
			// Store the event for later use
			deferredPrompt = e;
			canInstall = true;
			// Show our custom install prompt
			showInstallPrompt = true;
		});

		// Listen for successful installation
		window.addEventListener('appinstalled', () => {
			console.log('[PWA] App was installed');
			showInstallPrompt = false;
			showManualPrompt = false;
			isInstalled = true;
			deferredPrompt = null;
			canInstall = false;
		});

		// Check if the PWA can be installed (for debugging)
		console.log('[PWA] Service Worker support:', 'serviceWorker' in navigator);
		console.log(
			'[PWA] HTTPS or localhost:',
			window.location.protocol === 'https:' || window.location.hostname === 'localhost'
		);
		console.log('[PWA] Display mode:', window.matchMedia('(display-mode: standalone)').matches);
	});

	async function handleInstall() {
		if (!deferredPrompt) {
			console.log('[PWA] No deferred prompt available');
			return;
		}

		// Show the browser's install prompt
		deferredPrompt.prompt();

		// Wait for the user's response
		const { outcome } = await deferredPrompt.userChoice;

		if (outcome === 'accepted') {
			console.log('[PWA] User accepted the install prompt');
		} else {
			console.log('[PWA] User dismissed the install prompt');
		}

		// Clear the deferred prompt
		deferredPrompt = null;
		showInstallPrompt = false;
		canInstall = false;
	}

	function dismissPrompt() {
		showInstallPrompt = false;
	}

	function dismissManualPrompt() {
		showManualPrompt = false;
		// Remember that we've shown the iOS prompt
		if (isIOS) {
			localStorage.setItem('pwa-ios-prompt-shown', 'true');
		}
	}
</script>

{#if showInstallPrompt && !isInstalled}
	<div class="pwa-install-prompt animate-slide-in" data-augmented-ui="tl-clip br-clip exe">
		<div class="flex gap-4 flex-wrap">
			<div class="prompt-icon">📱</div>
			<div class="flex-1" style="min-width: 200px;">
				<h3 class="text-primary m-0" style="font-family: 'Exo 2', sans-serif; font-size: 1.1rem;">
					Install Dispatch
				</h3>
				<p class="text-muted m-0" style="font-size: 0.9rem; margin-top: 0.25rem;">
					Install this app for quick access and offline support
				</p>
			</div>
			<div class="flex gap-2 mobile-full-width" style="margin-top: 0.5rem;">
				<Button
					variant="primary"
					onclick={handleInstall}
					text="Install"
					class="install-btn"
					augmented="tl-clip br-clip exe"
				/>
				<Button
					variant="ghost"
					onclick={dismissPrompt}
					text="Not Now"
					class="dismiss-btn"
					augmented="none"
				/>
			</div>
		</div>
	</div>
{/if}

{#if showManualPrompt && isIOS && !isInstalled}
	<div class="pwa-install-prompt animate-slide-in" data-augmented-ui="tl-clip br-clip exe">
		<div class="flex gap-4 flex-wrap">
			<div class="prompt-icon">📱</div>
			<div class="flex-1" style="min-width: 200px;">
				<h3 class="text-primary m-0" style="font-family: 'Exo 2', sans-serif; font-size: 1.1rem;">
					Install Dispatch
				</h3>
				<p class="ios-instructions">To install this app on iOS:</p>
				<ol class="ios-steps">
					<li>Tap the share button <span class="ios-icon">⎙</span></li>
					<li>Scroll down and tap "Add to Home Screen"</li>
					<li>Tap "Add" to install</li>
				</ol>
			</div>
			<div class="flex gap-2 mobile-full-width" style="margin-top: 0.5rem;">
				<Button
					variant="primary"
					onclick={dismissManualPrompt}
					text="Got it"
					class="dismiss-btn full-width"
					augmented="none"
				/>
			</div>
		</div>
	</div>
{/if}

<style>
	.pwa-install-prompt {
		position: fixed;
		bottom: 20px;
		left: 50%;
		transform: translateX(-50%);
		background: rgba(0, 0, 0, 0.95);
		border: 1px solid var(--aug-border-all);
		--aug-border-all: 1px;
		--aug-border-bg: var(--color-primary);
		padding: 1rem;
		z-index: 10000;
		max-width: 400px;
		width: calc(100% - 40px);
	}

	.prompt-icon {
		font-size: 2rem;
		flex-shrink: 0;
	}

	.install-btn,
	.dismiss-btn {
		padding: 0.5rem 1rem;
		border: none;
		background: transparent;
		color: white;
		cursor: pointer;
		font-family: 'Share Tech Mono', monospace;
		transition: all 0.2s ease;
	}

	.install-btn {
		background: var(--color-primary);
		--aug-border-all: 1px;
		--aug-border-bg: var(--color-primary);
		flex: 1;
	}

	.install-btn:hover {
		filter: brightness(1.2);
	}

	.dismiss-btn {
		color: #777;
	}

	.dismiss-btn:hover {
		color: #aaa;
	}

	.full-width {
		width: 100%;
	}

	/* iOS-specific styles */
	.ios-instructions {
		margin: 0.5rem 0;
		color: #ccc;
	}

	.ios-steps {
		margin: 0.5rem 0 0.5rem 1.5rem;
		padding: 0;
		color: #aaa;
		font-size: 0.85rem;
	}

	.ios-steps li {
		margin: 0.25rem 0;
	}

	.ios-icon {
		display: inline-block;
		background: #333;
		padding: 0.1rem 0.3rem;
		border-radius: 3px;
		font-size: 1rem;
		vertical-align: middle;
		margin: 0 0.2rem;
	}

	@media (max-width: 480px) {
		.pwa-install-prompt {
			bottom: 0;
			left: 0;
			right: 0;
			transform: none;
			width: 100%;
			max-width: none;
			border-radius: 0;
		}
	}
</style>
