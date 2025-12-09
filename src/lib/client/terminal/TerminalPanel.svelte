<script>
	import { onMount, onDestroy } from 'svelte';
	import { Terminal } from '@xterm/xterm';
	import { FitAddon } from '@xterm/addon-fit';
	import '@xterm/xterm/css/xterm.css';
	import { TerminalPanelViewModel } from './viewmodels/TerminalPanelViewModel.svelte.js';
	import MobileTerminalView from './MobileTerminalView.svelte';

	const fitAddon = new FitAddon();
	let { sessionId, shouldResume = false } = $props();
	let term,
		el = $state();
	// Also observe container size changes (e.g., parent layout changes)
	let ro;

	/**
	 * Read theme CSS variables from :root and convert to xterm.js theme object
	 * @returns {object} Xterm.js theme configuration
	 */
	function getXtermTheme() {
		const rootStyles = getComputedStyle(document.documentElement);

		// Helper to get CSS variable value
		const getCssVar = (varName) => rootStyles.getPropertyValue(varName).trim();

		return {
			background: getCssVar('--theme-background') || '#0c1210',
			foreground: getCssVar('--theme-foreground') || '#d9ffe6',
			cursor: getCssVar('--theme-cursor') || '#2ee66b',
			cursorAccent: getCssVar('--theme-cursor-accent') || '#0c1210',
			selectionBackground: getCssVar('--theme-selection-bg') || '#2ee66b40',
			selectionForeground: undefined, // Let xterm use default contrast
			black: getCssVar('--theme-ansi-black') || '#121a17',
			red: getCssVar('--theme-ansi-red') || '#ef476f',
			green: getCssVar('--theme-ansi-green') || '#2ee66b',
			yellow: getCssVar('--theme-ansi-yellow') || '#ffd166',
			blue: getCssVar('--theme-ansi-blue') || '#00c2ff',
			magenta: getCssVar('--theme-ansi-magenta') || '#ff6b9d',
			cyan: getCssVar('--theme-ansi-cyan') || '#56b6c2',
			white: getCssVar('--theme-ansi-white') || '#cfe7d8',
			brightBlack: getCssVar('--theme-ansi-bright-black') || '#8aa699',
			brightRed: getCssVar('--theme-ansi-bright-red') || '#ef476f',
			brightGreen: getCssVar('--theme-ansi-bright-green') || '#4eff82',
			brightYellow: getCssVar('--theme-ansi-bright-yellow') || '#ffd166',
			brightBlue: getCssVar('--theme-ansi-bright-blue') || '#00c2ff',
			brightMagenta: getCssVar('--theme-ansi-bright-magenta') || '#ff6b9d',
			brightCyan: getCssVar('--theme-ansi-bright-cyan') || '#56b6c2',
			brightWhite: getCssVar('--theme-ansi-bright-white') || '#d9ffe6'
		};
	}

	// Mobile detection
	let isTouchDevice = $state(false);

	// Detect if device supports touch and is mobile
	function detectTouchDevice() {
		return ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth <= 768;
	}

	// Initialize ViewModel
	// Authentication handled via session cookies (no auth key needed)
	const viewModel = new TerminalPanelViewModel({
		sessionId,
		authKey: null, // Socket.IO authenticates via session cookie
		shouldResume
	});

	// Handle window resize and ensure terminal fits its container
	const resize = () => {
		// Fit terminal to container first so cols/rows update
		try {
			fitAddon.fit();
		} catch (_error) {
			// Intentionally ignoring error - fit may throw if terminal not yet attached
		}

		// Use ViewModel to handle resize
		if (viewModel.isAttached) {
			viewModel.resizeTerminal(term.cols, term.rows);
		}
	};

	// Event handler for terminal data from ViewModel
	function handleTerminalEvent(event) {
		if (event.type === 'data') {
			term.write(event.data);
		} else if (event.type === 'exit') {
			console.log('[TERMINAL] Terminal exited with code:', event.exitCode);
		}
	}

	onMount(async () => {
		// Debug logging
		console.log('[TERMINAL] TerminalPanel mounted with sessionId:', sessionId);
		console.log('[TERMINAL] TerminalPanel props:', { sessionId, shouldResume });

		// Detect if we should use touch-optimized mobile view
		isTouchDevice = detectTouchDevice();
		console.log('[TERMINAL] Touch device detected:', isTouchDevice);

		// If touch device, don't initialize xterm.js - let MobileTerminalView handle it
		if (isTouchDevice) {
			return;
		}

		// Detect touch device for xterm.js optimizations (for non-mobile touch devices)
		const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

		// Initialize terminal with theme from CSS variables
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
			scrollSensitivity: isTouch ? 3 : 1, // Increase scroll sensitivity on touch devices
			// Apply theme from CSS variables
			theme: getXtermTheme()
		});
		term.loadAddon(fitAddon);
		term.open(el);
		// Fit once after opening so cols/rows are correct for the initial resize
		fitAddon.fit();

		// Initialize ViewModel with event handler
		const result = await viewModel.initialize(handleTerminalEvent);

		if (result.success) {
			// Handle user input
			term.onData((data) => {
				viewModel.sendInput(data);
			});

			// Send initial resize
			viewModel.resizeTerminal(term.cols, term.rows);
		}

		// Set up window resize listener
		window.addEventListener('resize', resize);

		// Set up ResizeObserver for container size changes
		if (typeof ResizeObserver !== 'undefined') {
			ro = new ResizeObserver(() => {
				resize();
			});
			ro.observe(el);
		}
	});

	onDestroy(() => {
		// Cleanup ViewModel
		viewModel.cleanup();

		// Cleanup UI resources
		try {
			window.removeEventListener('resize', resize);
		} catch (_error) {
			// Intentionally ignoring cleanup errors - component is being destroyed
		}
		try {
			if (ro) ro.disconnect();
		} catch (_error) {
			// Intentionally ignoring cleanup errors - component is being destroyed
		}
		try {
			if (term) term.dispose();
		} catch (_error) {
			// Intentionally ignoring cleanup errors - component is being destroyed
		}
	});
</script>

<div class="terminal-wrapper">
	{#if isTouchDevice}
		<!-- Mobile terminal view for touch devices -->
		<MobileTerminalView {sessionId} {shouldResume} />
	{:else}
		<!-- Desktop xterm.js terminal view -->
		{#if viewModel.isCatchingUp}
			<div class="terminal-loading">
				<div class="loading-message">
					<span class="loading-icon">⟳</span>
					<span>Reconnecting to terminal session...</span>
				</div>
			</div>
		{/if}

		{#if viewModel.connectionError}
			<div class="terminal-error">
				<div class="error-message">
					<span class="error-icon">⚠</span>
					<span>{viewModel.connectionError}</span>
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
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		position: relative;
		overflow: visible;
	}

	.terminal-container {
		display: flex;
		flex-direction: column;
		flex: 1;
		width: 100%;
		height: 100%;
		min-height: 0;
		overflow: hidden;
		position: relative;
	}

	.xterm-container {
		display: flex;
		flex: 1;
		width: 100%;
		height: 100%;
		min-height: 0;
	}

	/* Ensure xterm.js fills the container */
	.terminal-container :global(.xterm) {
		width: 100% !important;
		height: 100% !important;
	}

	.terminal-container :global(.xterm .xterm-viewport) {
		width: 100% !important;
		height: 100% !important;
	}

	.terminal-container :global(.xterm .xterm-screen) {
		height: 100% !important;
	}

	.terminal-loading {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			var(--surface-primary-95),
			color-mix(in oklab, var(--bg) 80%, transparent)
		);
		padding: var(--space-3);
		animation: fadeIn 0.3s ease-in;
	}

	.loading-message {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--primary);
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
	}

	.terminal-error {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		z-index: 10;
		background: linear-gradient(
			to bottom,
			color-mix(in oklab, var(--bg) 95%, #ef476f 5%),
			color-mix(in oklab, var(--bg) 80%, transparent)
		);
		padding: var(--space-3);
		animation: fadeIn 0.3s ease-in;
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: #ef476f;
		font-size: var(--font-size-1);
		font-family: var(--font-mono);
	}

	.error-icon,
	.loading-icon {
		animation: pulse 2s ease-in-out infinite;
	}
</style>
