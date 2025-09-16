<script>
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import { SOCKET_EVENTS } from '$lib/shared/socket-events.js';
	import '@xterm/xterm/css/xterm.css';
	import sessionSocketManager from '$lib/client/shared/components/SessionSocketManager';

	const fitAddon = new FitAddon();
	let { sessionId, shouldResume = false, workspacePath = null } = $props();
	let socket, term, el;
	// Also observe container size changes (e.g., parent layout changes)
	let ro;

	// State for history loading
	let isCatchingUp = $state(false);
	let historyLoaded = false;

	let key; // = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
	// Handle window resize and ensure terminal fits its container
	const resize = () => {
		// Fit terminal to container first so cols/rows update
		try {
			fitAddon.fit();
		} catch (e) {
			// fit may throw if terminal not yet attached; ignore
		}

		if (socket && socket.connected) {
			socket.emit(SOCKET_EVENTS.TERMINAL_RESIZE, {
				key,
				id: sessionId,
				cols: term.cols,
				rows: term.rows
			});
		}
	};
	async function loadBufferedHistory() {
		if (!shouldResume || !sessionId || historyLoaded) return;

		try {
			console.log('[TERMINAL] Loading buffered messages from server for session:', sessionId);
			isCatchingUp = true;

			// Request buffered messages from the server
			// The server will replay them through normal TERMINAL_OUTPUT events
			const bufferedMessages = await sessionSocketManager.loadSessionHistory(sessionId);
			console.log(
				`[TERMINAL] Loaded ${bufferedMessages.length} buffered messages for session ${sessionId}`
			);

			historyLoaded = true;

			// Clear catching up state after a short delay if no messages are actively arriving
			setTimeout(() => {
				if (isCatchingUp) {
					isCatchingUp = false;
				}
			}, 1000);
		} catch (error) {
			console.error('[TERMINAL] Failed to load buffered history:', error);
			isCatchingUp = false;
		}
	}

	onMount(async () => {
		// Debug logging for undefined sessionId issue
		console.log('[TERMINAL] TerminalPane mounted with sessionId:', sessionId);
		console.log('[TERMINAL] TerminalPane props:', { sessionId, shouldResume, workspacePath });

		// Safety check - don't proceed if sessionId is invalid
		if (!sessionId || sessionId === 'undefined') {
			console.error('[TERMINAL] Invalid sessionId, cannot initialize terminal');
			return;
		}

		// Detect touch device
		const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
		key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
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
		// Fit once after opening so cols/rows are correct for the initial emit
		fitAddon.fit();

		// Get or create socket for this specific session
		socket = sessionSocketManager.getSocket(sessionId);
		console.log('[TERMINAL] Creating socket for session:', sessionId);
		sessionSocketManager.handleSessionFocus(sessionId);

		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			console.log('[TERMINAL] Socket connected for session:', sessionId);

			// Handle user input
			term.onData((data) => {
				console.log('[TERMINAL] Sending input for session:', sessionId);
				socket.emit(SOCKET_EVENTS.TERMINAL_WRITE, { key, id: sessionId, data });
			});

			// Send initial size
			socket.emit(SOCKET_EVENTS.TERMINAL_RESIZE, {
				key,
				id: sessionId,
				cols: term.cols,
				rows: term.rows
			});

			// Send initial enter to trigger prompt (only for new terminals)
			if (!shouldResume) {
				setTimeout(() => {
					console.log('[TERMINAL] Sending initial enter for session:', sessionId);
					socket.emit(SOCKET_EVENTS.TERMINAL_WRITE, { key, id: sessionId, data: '\r' });
				}, 200);
			}
		});

		// Listen for terminal data (canonical)
		socket.on(SOCKET_EVENTS.TERMINAL_OUTPUT, (payload) => {
			try {
				// If we receive output while catching up, clear the flag
				if (isCatchingUp) {
					isCatchingUp = false;
					console.log('[TERMINAL] Received output from active session - caught up');
				}

				console.log('[TERMINAL] Output received for session:', sessionId, payload);
				const text = typeof payload === 'string' ? payload : payload?.data;
				if (text) {
					term.write(text);
				}
			} catch (e) {
				console.error('[TERMINAL] Error handling output:', e);
			}
		});

		// Listen for terminal exit (canonical)
		socket.on(SOCKET_EVENTS.TERMINAL_EXIT, (payload) => {
			try {
				console.log('Terminal exited with code:', payload?.exitCode);
				isCatchingUp = false; // Clear catching up state on exit
			} catch {}
		});

		// Handle session catchup complete event
		socket.on(SOCKET_EVENTS.SESSION_CATCHUP_COMPLETE, (data) => {
			console.log('[TERMINAL] Session catchup complete:', data);
			isCatchingUp = false;
			// Update last message timestamp if provided
			if (data?.lastTimestamp) {
				sessionSocketManager.updateLastTimestamp(sessionId, data.lastTimestamp);
			}
		});

		window.addEventListener('resize', resize);

		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(resize);
			ro.observe(el);
		}

		// Load buffered messages after socket is ready and listening
		// This ensures we don't miss any events that might arrive while loading
		if (shouldResume) {
			await loadBufferedHistory();

			// Check if session has pending messages from the backend
			if (socket.connected) {
				console.log('[TERMINAL] Socket already connected - checking session activity state');
				// Query the backend for actual session state
				const hasPending = await sessionSocketManager.checkForPendingMessages(sessionId);
				if (!hasPending) {
					console.log('[TERMINAL] Session is idle, no pending messages');
					isCatchingUp = false;
				}
			}
		}
	});

	onDestroy(() => {
		// Cleanup handled in onMount return function

		// Don't disconnect the socket immediately as it might be used by other panes
		// The SessionSocketManager will handle cleanup when appropriate
		if (socket) {
			socket.removeAllListeners();
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
	{#if isCatchingUp}
		<div class="terminal-loading">
			<div class="loading-message">
				<span class="loading-icon">⟳</span>
				<span>Reconnecting to terminal session...</span>
			</div>
		</div>
	{/if}
	<div bind:this={el} class="terminal-container"></div>
</div>

<style>
	.terminal-wrapper {
		position: relative;
		height: 100%;
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
		height: 100%;
		min-height: 400px;
		overflow: hidden;
		/* Enable touch scrolling on mobile devices */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	.terminal-container :global(.xterm) {
		padding: var(--space-3);
		font-family: var(--font-mono) !important;
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
</style>
