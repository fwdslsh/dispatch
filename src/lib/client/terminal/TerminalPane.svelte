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
	async function loadTerminalHistory() {
		if (!shouldResume || !sessionId) return;

		try {
			const response = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/history`);
			if (response.ok) {
				const data = await response.json();
				if (data.history) {
					console.log(
						`Loading terminal history for ${sessionId}, size: ${data.history.length} chars`
					);
					// Write history to terminal to restore previous state
					term.write(data.history);
				}
			}
		} catch (error) {
			console.error('Failed to load terminal history:', error);
		}
	}

	onMount(async () => {
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

		// Load history before connecting if resuming
		if (shouldResume) {
			await loadTerminalHistory();
		}

		// Get or create socket for this specific session
		socket = sessionSocketManager.getSocket(sessionId);
		sessionSocketManager.handleSessionFocus(sessionId);

		socket.on(SOCKET_EVENTS.CONNECTION, () => {
			console.log('Socket.IO connected');

			// Handle user input
			term.onData((data) => {
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
					socket.emit(SOCKET_EVENTS.TERMINAL_WRITE, { key, id: sessionId, data: '\r' });
				}, 200);
			}
		});

		// Listen for terminal data (canonical)
		socket.on(SOCKET_EVENTS.TERMINAL_OUTPUT, (payload) => {
			try {
				const text = typeof payload === 'string' ? payload : payload?.data;
				if (text) term.write(text);
			} catch {}
		});

		// Listen for terminal exit (canonical)
		socket.on(SOCKET_EVENTS.TERMINAL_EXIT, (payload) => {
			try {
				console.log('Terminal exited with code:', payload?.exitCode);
			} catch {}
		});

		window.addEventListener('resize', resize);

		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(resize);
			ro.observe(el);
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

<div bind:this={el} class="terminal-container"></div>

<style>
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
