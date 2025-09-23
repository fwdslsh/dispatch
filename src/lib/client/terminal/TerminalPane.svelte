<script>
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import '@xterm/xterm/css/xterm.css';
	import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';
	import MobileTerminalView from './MobileTerminalView.svelte';

	const fitAddon = new FitAddon();
	let { sessionId, shouldResume = false } = $props();
	let term, el;
	// Also observe container size changes (e.g., parent layout changes)
	let ro;

	// State for history loading
	let isCatchingUp = $state(false);
	let isAttached = $state(false);
	let connectionError = $state(null);

	// Mobile detection
	let isTouchDevice = $state(false);

	// Detect if device supports touch and is mobile
	function detectTouchDevice() {
		return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;
	}

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

		// Detect if we should use touch-optimized mobile view
		isTouchDevice = detectTouchDevice();
		console.log('[TERMINAL] Touch device detected:', isTouchDevice);

		// If touch device, don't initialize xterm.js - let MobileTerminalView handle it
		if (isTouchDevice) {
			return;
		}

		// Detect touch device for xterm.js optimizations (for non-mobile touch devices)
		const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

		// Initialize terminal
		term = new Terminal({
			convertEol: true,
			cursorBlink: true,
			fontFamily: 'var(--font-mono)',
			fontSize: 14,
			lineHeight: 1.2,
			letterSpacing: 0.5,
			// Enable better touch scrolling for non-mobile touch devices
			scrollback: 1000,
			smoothScrollDuration: isTouch ? 0 : 125, // Disable smooth scroll on touch for better performance
			fastScrollModifier: 'shift',
			fastScrollSensitivity: 5,
			scrollSensitivity: isTouch ? 3 : 1 // Increase scroll sensitivity on touch devices
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

		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(() => {
				resize();
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
	{#if isTouchDevice}
		<!-- Mobile terminal view for touch devices -->
		<MobileTerminalView {sessionId} {shouldResume} />
	{:else}
		<!-- Desktop xterm.js terminal view -->
		{#if isCatchingUp}
			<div class="terminal-loading">
				<div class="loading-message">
					<span class="loading-icon">⟳</span>
					<span>Reconnecting to terminal session...</span>
				</div>
			</div>
		{/if}

		<!-- Terminal container -->
		<div class="terminal-container">
			<div bind:this={el} class="xterm-container"></div>
		</div>
	{/if}
</div>

<style>
	/* Component-specific terminal overrides */
	.terminal-wrapper {
		display: contents;
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
</style>
