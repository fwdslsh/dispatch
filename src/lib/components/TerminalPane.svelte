<script>
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { io } from 'socket.io-client';
	import '@xterm/xterm/css/xterm.css';

	export let ptyId;
	let socket, term, el;

	onMount(() => {
		term = new Terminal({ convertEol: true, cursorBlink: true });
		term.open(el);

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

		// Handle window resize
		const resize = () => {
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
	});

	onDestroy(() => {
		if (socket) {
			socket.disconnect();
		}
	});
</script>

<div bind:this={el} class="terminal-container"></div>

<style>
	.terminal-container {
		height: 100%;
		min-height: 400px;
		background: var(--bg-dark);
		border-radius: 4px;
		overflow: hidden;
	}

	.terminal-container :global(.xterm) {
		padding: var(--space-sm);
	}

	.terminal-container :global(.xterm-viewport) {
		background: var(--bg-dark) !important;
	}

	.terminal-container :global(.xterm-screen) {
		background: var(--bg-dark) !important;
	}

	.terminal-container :global(.xterm-cursor) {
		background: var(--primary) !important;
	}

	.terminal-container :global(.xterm-selection) {
		background: var(--primary-muted) !important;
	}
</style>
