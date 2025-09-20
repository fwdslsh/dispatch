<script>
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import '@xterm/xterm/css/xterm.css';
	import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';
	import MobileKeyboardToolbar from './MobileKeyboardToolbar.svelte';
	import MobileTextInput from './MobileTextInput.svelte';

	const fitAddon = new FitAddon();
	let { sessionId, shouldResume = false } = $props();
	let term, el;
	// Also observe container size changes (e.g., parent layout changes)
	let ro;

	// State for history loading
	let isCatchingUp = $state(false);
	let historyLoaded = $state(false);
	let isAttached = $state(false);
	let connectionError = $state(null);

	// Mobile interface state
	let isMobile = $state(false);
	let isCompactMobile = $state(false);
	let showMobileKeyboard = $state(false);
	let showMobileInput = $state(true);
	let mobileInputDisabled = $state(false);

	let key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
	// Handle window resize and ensure terminal fits its container
	const resize = () => {
		// Fit terminal to container first so cols/rows update
		try {
			fitAddon.fit();
		} catch (e) {
			// fit may throw if terminal not yet attached; ignore
		}

		if (isAttached && runSessionClient.getStatus().connected) {
			try {
				runSessionClient.resizeTerminal(sessionId, term.cols, term.rows);
			} catch (error) {
				console.error('[TERMINAL] Failed to resize terminal:', error);
			}
		}
	};

	// Mobile device detection
	const detectMobile = () => {
		return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;
	};

	// Update mobile state on window resize
	const updateMobileState = () => {
		const wasMobile = isMobile;
		isMobile = detectMobile();
		isCompactMobile = isMobile && window.innerWidth <= 480;
		
		// Show mobile components on mobile devices
		if (isMobile && !wasMobile) {
			showMobileKeyboard = true;
			showMobileInput = true;
		} else if (!isMobile && wasMobile) {
			showMobileKeyboard = false;
			showMobileInput = false;
		}
	};

	// Handle mobile keyboard key press
	const handleMobileKeypress = (event) => {
		const { key } = event.detail;
		if (isAttached && runSessionClient.getStatus().connected) {
			try {
				console.log('[TERMINAL] Sending mobile key:', key);
				runSessionClient.sendInput(sessionId, key);
			} catch (error) {
				console.error('[TERMINAL] Failed to send mobile key:', error);
			}
		}
	};

	// Handle mobile text input submit
	const handleMobileTextSubmit = (event) => {
		const { command } = event.detail;
		if (isAttached && runSessionClient.getStatus().connected) {
			try {
				console.log('[TERMINAL] Sending mobile command:', command);
				runSessionClient.sendInput(sessionId, command);
			} catch (error) {
				console.error('[TERMINAL] Failed to send mobile command:', error);
			}
		}
	};
	// Event handler for terminal data from run session
	function handleRunEvent(event) {
		try {
			// If we receive output while catching up, clear the flag
			if (isCatchingUp) {
				isCatchingUp = false;
				console.log('[TERMINAL] Received output from active session - caught up');
			}

			console.log('[TERMINAL] Event received:', event);

			// Handle different event channels
			if (event.channel === 'pty:stdout' || event.channel === 'pty:stderr') {
				const data = event.payload;
				if (data) {
					// Convert Uint8Array to string if needed
					const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
					term.write(text);
				}
			} else if (event.channel === 'pty:exit') {
				console.log('[TERMINAL] Terminal exited with code:', event.payload?.exitCode);
				isCatchingUp = false;
			}
		} catch (e) {
			console.error('[TERMINAL] Error handling run event:', e);
		}
	}

	onMount(async () => {
		// Debug logging for undefined sessionId issue
		console.log('[TERMINAL] TerminalPane mounted with sessionId:', sessionId);
		console.log('[TERMINAL] TerminalPane props:', { sessionId, shouldResume });

		// Safety check - don't proceed if sessionId is invalid
		if (!sessionId || sessionId === 'undefined') {
			console.error('[TERMINAL] Invalid sessionId, cannot initialize terminal');
			return;
		}

		// Detect mobile device and initialize mobile state
		isMobile = detectMobile();
		isCompactMobile = isMobile && window.innerWidth <= 480;
		if (isMobile) {
			showMobileKeyboard = true;
			showMobileInput = true;
		}

		// Detect touch device
		const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

		// Initialize terminal
		term = new Terminal({
			convertEol: true,
			cursorBlink: true,
			fontFamily: 'var(--font-mono)',
			fontSize: 14,
			lineHeight: 1.2,
			letterSpacing: 0.5,
			// Enable better touch scrolling
			scrollback: 1000,
			smoothScrollDuration: isTouchDevice ? 0 : 125, // Disable smooth scroll on touch for better performance
			fastScrollModifier: 'shift',
			fastScrollSensitivity: 5,
			scrollSensitivity: isTouchDevice ? 3 : 1 // Increase scroll sensitivity on touch devices
		});
		term.loadAddon(fitAddon);
		term.open(el);
		// Fit once after opening so cols/rows are correct for the initial resize
		fitAddon.fit();

		try {
			// Authenticate if not already done
			if (!runSessionClient.getStatus().authenticated) {
				await runSessionClient.authenticate(key);
			}

			// Attach to the run session and get backlog
			console.log('[TERMINAL] Attaching to run session:', sessionId);
			isCatchingUp = shouldResume;

			const result = await runSessionClient.attachToRunSession(sessionId, handleRunEvent, 0);
			isAttached = true;
			connectionError = null;
			console.log('[TERMINAL] Attached to run session:', result);

			// Handle user input
			term.onData((data) => {
				console.log('[TERMINAL] Sending input for session:', sessionId);
				try {
					runSessionClient.sendInput(sessionId, data);
				} catch (error) {
					console.error('[TERMINAL] Failed to send input:', error);
				}
			});

			// Send initial resize
			runSessionClient.resizeTerminal(sessionId, term.cols, term.rows);

			// Send initial enter to trigger prompt (only for new terminals)
			if (!shouldResume) {
				setTimeout(() => {
					console.log('[TERMINAL] Sending initial enter for session:', sessionId);
					try {
						runSessionClient.sendInput(sessionId, '\r');
					} catch (error) {
						console.error('[TERMINAL] Failed to send initial enter:', error);
					}
				}, 200);
			}

			// Clear catching up state after a delay if no messages arrived
			if (shouldResume) {
				setTimeout(() => {
					if (isCatchingUp) {
						isCatchingUp = false;
						console.log('[TERMINAL] Timeout reached, clearing catching up state');
					}
				}, 2000);
			}

		} catch (error) {
			console.error('[TERMINAL] Failed to attach to run session:', error);
			connectionError = `Failed to connect: ${error.message}`;
			isCatchingUp = false;
		}

		window.addEventListener('resize', resize);
		window.addEventListener('resize', updateMobileState);

		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(() => {
				resize();
				updateMobileState();
			});
			ro.observe(el);
		}
	});

	onDestroy(() => {
		// Detach from run session
		if (isAttached && sessionId) {
			try {
				runSessionClient.detachFromRunSession(sessionId);
				console.log('[TERMINAL] Detached from run session:', sessionId);
			} catch (error) {
				console.error('[TERMINAL] Failed to detach from run session:', error);
			}
		}

		try {
			// remove listeners and observers
			window.removeEventListener('resize', resize);
			window.removeEventListener('resize', updateMobileState);
		} catch (e) {}
		try {
			if (ro) ro.disconnect();
		} catch (e) {}
		try {
			if (term) term.dispose();
		} catch (e) {}
	});
</script>

<div class="terminal-wrapper">
	{#if isCatchingUp}
		<div class="terminal-loading">
			<div class="loading-message">
				<span class="loading-icon">⟳</span>
				<span>Reconnecting to terminal session...</span>
			</div>
		</div>
	{/if}
	
	<!-- Mobile text input area for easier typing -->
	{#if isMobile && showMobileInput}
		<MobileTextInput
			visible={true}
			disabled={mobileInputDisabled || !isAttached}
			placeholder="Type commands here..."
			autoFocus={false}
			on:submit={handleMobileTextSubmit}
		/>
	{/if}
	
	<!-- Terminal container with touch layer for mobile scrolling -->
	<div class="terminal-container" class:mobile={isMobile}>
		{#if isMobile}
			<!-- Invisible touch layer for better mobile scrolling -->
			<div class="touch-scroll-layer"></div>
		{/if}
		<div bind:this={el} class="xterm-container"></div>
	</div>
	
	<!-- Mobile keyboard toolbar -->
	{#if isMobile && showMobileKeyboard}
		<MobileKeyboardToolbar
			visible={true}
			disabled={mobileInputDisabled || !isAttached}
			compact={isCompactMobile}
			on:keypress={handleMobileKeypress}
		/>
	{/if}
</div>

<style>
	.terminal-wrapper {
		position: relative;
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.terminal-loading {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			color-mix(in oklab, var(--bg) 95%, var(--accent) 5%),
			color-mix(in oklab, var(--bg) 80%, transparent)
		);
		padding: var(--space-3);
		animation: fadeIn 0.3s ease-in;
	}

	.loading-message {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--accent);
		font-size: 0.875rem;
		font-family: var(--font-mono);
	}

	.loading-icon {
		display: inline-block;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.terminal-container {
		flex: 1;
		overflow: hidden;
		/* Enable touch scrolling on mobile devices */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		position: relative;
		min-height: 0;
	}

	.terminal-container.mobile {
		/* Adjustments for mobile layout */
		display: flex;
		flex-direction: column;
	}

	.touch-scroll-layer {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1;
		pointer-events: auto;
		/* Allow touch scrolling but prevent text selection */
		touch-action: pan-y;
		user-select: none;
		background: transparent;
	}

	.xterm-container {
		flex: 1;
		height: 100%;
		position: relative;
		z-index: 0;
	}

	.terminal-container :global(.xterm) {
		padding: var(--space-3);
		font-family: var(--font-mono) !important;
		height: 100% !important;
	}

	.terminal-container :global(.xterm-viewport) {
		background: var(--bg) !important;
		/* Enable smooth touch scrolling */
		-webkit-overflow-scrolling: touch !important;
		overscroll-behavior: contain !important;
	}

	.terminal-container :global(.xterm-screen) {
		background: var(--bg) !important;
	}

	.terminal-container :global(.xterm-cursor) {
		background: var(--accent) !important;
	}

	.terminal-container :global(.xterm-selection) {
		background: color-mix(in oklab, var(--accent) 30%, transparent) !important;
	}

	/* Mobile-specific adjustments */
	@media (max-width: 768px) {
		.terminal-wrapper {
			height: 100vh; /* Use full viewport height on mobile */
		}

		.terminal-container {
			/* Reduce padding on mobile for more space */
			overflow: hidden;
		}

		.terminal-container :global(.xterm) {
			padding: var(--space-2);
		}

		/* Improve touch interaction on mobile */
		.terminal-container :global(.xterm-viewport) {
			touch-action: pan-y;
		}

		/* Hide scrollbars on mobile for cleaner look */
		.terminal-container :global(.xterm-viewport)::-webkit-scrollbar {
			display: none;
		}

		.terminal-container :global(.xterm-viewport) {
			scrollbar-width: none;
		}
	}

	/* Very small screens */
	@media (max-width: 480px) {
		.terminal-container :global(.xterm) {
			padding: var(--space-1);
			font-size: 13px;
		}
	}

	/* Landscape mobile orientation */
	@media (max-width: 768px) and (orientation: landscape) {
		.terminal-wrapper {
			height: 100vh;
		}
	}
</style>
