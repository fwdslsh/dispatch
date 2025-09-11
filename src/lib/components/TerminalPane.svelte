<script>
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import { io } from 'socket.io-client';
	import '@xterm/xterm/css/xterm.css';

	let { ptyId, shouldResume = false, workspacePath = null } = $props();
	let socket, term, el;

	async function loadTerminalHistory() {
		if (!shouldResume || !ptyId) return;
		
		try {
			const response = await fetch(`/api/sessions/${encodeURIComponent(ptyId)}/history`);
			if (response.ok) {
				const data = await response.json();
				if (data.history) {
					console.log(`Loading terminal history for ${ptyId}, size: ${data.history.length} chars`);
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
			scrollSensitivity: isTouchDevice ? 3 : 1, // Increase scroll sensitivity on touch devices
		});
		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(el);
		// Fit once after opening so cols/rows are correct for the initial emit
		fitAddon.fit();

		// Load history before connecting if resuming
		if (shouldResume) {
			await loadTerminalHistory();
		}

		socket = io();
		const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';

		socket.on('connect', () => {
			console.log('Socket.IO connected');

			// Handle user input
			term.onData((data) => {
				socket.emit('terminal.write', { key, id: ptyId, data });
			});

			// Send initial size
			socket.emit('terminal.resize', {
				key,
				id: ptyId,
				cols: term.cols,
				rows: term.rows
			});

			// Send initial enter to trigger prompt (only for new terminals)
			if (!shouldResume) {
				setTimeout(() => {
					socket.emit('terminal.write', { key, id: ptyId, data: '\r' });
				}, 200);
			}
		});

		// Listen for terminal data
		socket.on('data', (data) => {
			term.write(data);
		});

		// Listen for terminal exit
		socket.on('exit', (data) => {
			console.log('Terminal exited with code:', data.exitCode);
		});

		// Handle window resize and ensure terminal fits its container
		const resize = () => {
			// Fit terminal to container first so cols/rows update
			try {
				fitAddon.fit();
			} catch (e) {
				// fit may throw if terminal not yet attached; ignore
			}

			if (socket && socket.connected) {
				socket.emit('terminal.resize', {
					key,
					id: ptyId,
					cols: term.cols,
					rows: term.rows
				});
			}
		};
		window.addEventListener('resize', resize);
		// Also observe container size changes (e.g., parent layout changes)
		let ro;
		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(resize);
			ro.observe(el);
		}

		// Cleanup function
		return () => {
			if (socket) {
				socket.disconnect();
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
		};
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
