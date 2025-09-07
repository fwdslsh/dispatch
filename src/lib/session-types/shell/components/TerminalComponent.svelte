<!--
  TerminalComponent - Simple XTerm.js wrapper
  
  Just a basic terminal interface without complex ViewModels or business logic.
  The parent component (ShellSession) handles all the socket communication via its ViewModel.
-->
<script>
	import { Xterm } from '@battlefieldduck/xterm-svelte';
	import { FitAddon } from '@xterm/addon-fit';
	import { onMount, onDestroy } from 'svelte';

	let { socket, sessionId, options = {}, initialContent = '' } = $props();

	// XTerm instance reference
	let terminal = $state();
	let terminalElement = $state();
	let fitAddon = $state();
	let isSetup = $state(false);
	let cleanup = $state(null);

	// Simple terminal options with good defaults
	const terminalOptions = $derived({
		convertEol: true,
		cursorBlink: true,
		fontFamily: 'Courier New, Monaco, monospace',
		fontSize: 14,
		fontWeight: 'normal',
		scrollback: 10000,
		disableStdin: false,
		allowTransparency: false,
		localEcho: false, // Disable local echo to prevent character duplication
		theme: {
			background: '#0a0a0a',
			foreground: '#ffffff',
			cursor: '#00ff88',
			cursorAccent: '#0a0a0a',
			selectionBackground: 'rgba(0, 255, 136, 0.3)',
			black: '#0a0a0a',
			red: '#ff6b6b',
			green: '#00ff88',
			yellow: '#ffeb3b',
			blue: '#2196f3',
			magenta: '#e91e63',
			cyan: '#00bcd4',
			white: '#ffffff',
			brightBlack: '#666666',
			brightRed: '#ff5252',
			brightGreen: '#69f0ae',
			brightYellow: '#ffff00',
			brightBlue: '#448aff',
			brightMagenta: '#ff4081',
			brightCyan: '#18ffff',
			brightWhite: '#ffffff'
		},
		...options
	});

	onMount(() => {
		if (terminal) {
			// Initialize fit addon
			fitAddon = new FitAddon();
			terminal.loadAddon(fitAddon);
			
			if (socket && sessionId) {
				setupTerminal();
			}
		}
	});

	// Set up terminal when we have all dependencies
	$effect(() => {
		if (terminal && socket && sessionId && !isSetup) {
			setupTerminal();
		}
	});

	function setupTerminal() {
		if (!terminal || !socket || isSetup) return;
		
		isSetup = true;

		// Write initial content if provided
		if (initialContent) {
			terminal.write(initialContent);
		}

		// Handle user input - send to socket
		terminal.onData((data) => {
			if (socket && sessionId) {
				socket.emit('shell:input', data);
			}
		});

		// Handle terminal resize - notify socket
		terminal.onResize((size) => {
			if (socket && sessionId) {
				socket.emit('shell:resize', { cols: size.cols, rows: size.rows });
			}
		});

		// Listen for output from socket
		const handleOutput = (data) => {
			if (terminal) {
				terminal.write(data);
			}
		};

		const handleSessionEnded = (data) => {
			if (data.sessionId === sessionId && terminal) {
				terminal.write('\r\n\x1b[31mSession ended.\x1b[0m\r\n');
			}
		};

		// Set up socket listeners  
		socket.on('terminal-output', handleOutput);
		socket.on('shell:session-ended', handleSessionEnded);

		// Store cleanup function
		cleanup = () => {
			if (socket) {
				socket.off('terminal-output', handleOutput);
				socket.off('shell:session-ended', handleSessionEnded);
			}
		};
	}

	function cleanupTerminal() {
		if (cleanup) {
			cleanup();
			cleanup = null;
		}
		// Don't reset isSetup here to avoid infinite loops
	}

	// Public methods for parent component
	export function focus() {
		terminal?.focus();
	}

	export function clear() {
		terminal?.clear();
	}

	export function write(data) {
		terminal?.write(data);
	}

	export function resize(cols, rows) {
		terminal?.resize(cols, rows);
	}

	// Fit terminal to container
	function fitTerminal() {
		if (fitAddon && terminal && terminalElement) {
			fitAddon.fit();
		}
	}

	// Auto-fit on mount and resize
	onMount(() => {
		// Fit after a short delay to ensure DOM is ready
		setTimeout(fitTerminal, 100);

		// Listen for window resize
		window.addEventListener('resize', fitTerminal);
	});

	onDestroy(() => {
		// Clean up terminal setup
		cleanupTerminal();
		
		// Clean up window listener
		window.removeEventListener('resize', fitTerminal);
	});
</script>

<div class="terminal-container" bind:this={terminalElement}>
	<Xterm bind:terminal options={terminalOptions} />
</div>

<style>
	.terminal-container {
		height: 100%;
		width: 100%;
		background: #0a0a0a;
	}

	.terminal-container :global(.xterm) {
		height: 100% !important;
		width: 100% !important;
	}

	.terminal-container :global(.xterm-screen) {
		height: 100% !important;
	}

	.terminal-container :global(.xterm-viewport) {
		height: 100% !important;
	}
</style>
