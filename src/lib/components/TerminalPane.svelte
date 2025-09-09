<script>
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import { io } from 'socket.io-client';
	import '@xterm/xterm/css/xterm.css';

	export let ptyId;
	let socket, term, el;

	onMount(() => {
		term = new Terminal({
			convertEol: true,
			cursorBlink: true,
			fontFamily: 'var(--font-mono)',
			fontSize: 14,
			lineHeight: 1.2,
			letterSpacing: 0.5,
		});
		const fitAddon = new FitAddon();
		term.loadAddon(fitAddon);
		term.open(el);
		// Fit once after opening so cols/rows are correct for the initial emit
		fitAddon.fit();

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

			// Send initial enter to trigger prompt
			setTimeout(() => {
				socket.emit('terminal.write', { key, id: ptyId, data: '\r' });
			}, 200);
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
	});

	onDestroy(() => {
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
	});
</script>

<div bind:this={el} class="terminal-container"></div>

<style>
	.terminal-container {
		height: 100%;
		min-height: 400px;
		overflow: hidden;
	}

	.terminal-container :global(.xterm) {
		padding: var(--space-3);
		font-family: var(--font-mono) !important;
	}

	.terminal-container :global(.xterm-viewport) {
		background: var(--bg) !important;
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
