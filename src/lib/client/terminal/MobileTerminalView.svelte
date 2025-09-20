<!--
	MobileTerminalView.svelte
	
	Mobile-optimized terminal view using HTML rendering instead of xterm.js.
	Provides better touch scrolling and mobile performance.
-->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';
	import MobileTerminalInput from './MobileTerminalInput.svelte';
	import { AnsiUp } from 'ansi_up';

	// Props
	let { sessionId, shouldResume = false } = $props();

	// State
	let terminalLines = $state([]);
	let container = $state();
	let isAttached = $state(false);
	let isCatchingUp = $state(false);
	let connectionError = $state(null);
	let shouldAutoScroll = $state(true);
	let wrapMode = $state('wrap'); // 'wrap' | 'scroll'
	const MAX_LINES = 1000; // Keep only last 1000 lines for performance
	let lineIdCounter = 0; // Unique counter for line IDs

	let key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';

	// Initialize AnsiUp for proper ANSI escape sequence handling
	const ansiUp = new AnsiUp();

	// Configure AnsiUp options for better terminal display
	ansiUp.use_classes = false; // Use inline styles for better control
	ansiUp.escape_html = true;

	// URL detection regex - more precise to avoid conflicts
	const urlRegex = /(https?:\/\/[^\s<>"]+)/g;

	// ANSI-to-HTML conversion with clickable links
	function ansiToHtml(text, lineId) {
		try {
			// First, apply URL detection to raw text before ANSI conversion
			// This prevents conflicts with ANSI escape sequences
			const urlPlaceholders = new Map();
			let placeholderIndex = 0;

			// Replace URLs with placeholders temporarily
			const textWithPlaceholders = text.replace(urlRegex, (match) => {
				const placeholder = `__URL_PLACEHOLDER_${placeholderIndex++}__`;
				urlPlaceholders.set(placeholder, match);
				return placeholder;
			});

			// Use ansi_up for proper ANSI escape sequence parsing
			let html = ansiUp.ansi_to_html(textWithPlaceholders);

			// Restore URLs as clickable links
			urlPlaceholders.forEach((url, placeholder) => {
				const linkHtml = `<span class="terminal-link" data-url="${url}">${url}</span>`;
				html = html.replace(placeholder, linkHtml);
			});

			// Clean up unwanted underlines from terminal UI elements
			// Remove underlines from decorative elements and excessive formatting
			html = html.replace(/text-decoration:underline;?/g, (match, offset, string) => {
				// Get surrounding context to determine if this is unwanted formatting
				const before = string.substring(Math.max(0, offset - 100), offset);
				const after = string.substring(offset, Math.min(string.length, offset + 100));

				// Keep underlines that seem intentional (around links, short text)
				if (after.includes('http') || after.includes('www.') ||
					(after.match(/>[^<]{1,30}</g) && !before.includes('│'))) {
					return match;
				}

				// Remove underlines from UI frames, long spans, or decorative elements
				return '';
			});

			return html;
		} catch (error) {
			console.warn('Failed to parse ANSI sequences, falling back to plain text:', error);
			// Fallback to plain text if parsing fails
			let escaped = text
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
				.replace(/'/g, '&#39;');

			// Apply URL detection to escaped text
			escaped = escaped.replace(urlRegex, '<span class="terminal-link" data-url="$1">$1</span>');

			return escaped;
		}
	}

	// Process incoming text into lines for efficient rendering
	function processIncomingText(text) {
		const newLines = text.split('\n');

		// If we have existing lines and the first new line doesn't start fresh,
		// append to the last existing line
		if (terminalLines.length > 0 && newLines[0] && !text.startsWith('\n')) {
			const lastLine = terminalLines[terminalLines.length - 1];
			terminalLines[terminalLines.length - 1] = {
				...lastLine,
				content: lastLine.raw + newLines[0],
				html: ansiToHtml(lastLine.raw + newLines[0], lastLine.id)
			};
			newLines.shift(); // Remove the first line since we merged it
		}

		// Add remaining lines
		newLines.forEach((line, index) => {
			if (line || index < newLines.length - 1) { // Include empty lines except the last one
				const lineId = `line_${lineIdCounter++}`;
				terminalLines.push({
					id: lineId,
					raw: line,
					content: line,
					html: ansiToHtml(line, lineId)
				});
			}
		});

		// Trim lines to prevent memory issues
		if (terminalLines.length > MAX_LINES) {
			terminalLines = terminalLines.slice(-MAX_LINES);
		}
	}

	// Handle scroll events
	function onScroll(event) {
		const { scrollTop, scrollHeight, clientHeight } = event.target;
		shouldAutoScroll = scrollTop + clientHeight >= scrollHeight - 10;
	}

	// Auto-scroll to bottom when new content arrives
	function scrollToBottom() {
		if (container && shouldAutoScroll) {
			container.scrollTop = container.scrollHeight;
		}
	}

	// Handle incoming terminal data
	function handleRunEvent(event) {
		try {
			if (isCatchingUp) {
				isCatchingUp = false;
				console.log('[MOBILE-TERMINAL] Received output from active session - caught up');
			}

			console.log('[MOBILE-TERMINAL] Event received:', event);

			if (event.channel === 'pty:stdout' || event.channel === 'pty:stderr') {
				const data = event.payload;
				if (data) {
					const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
					// Process text into lines for efficient rendering
					processIncomingText(text);

					// Auto-scroll after content update
					setTimeout(scrollToBottom, 0);
				}
			} else if (event.channel === 'pty:exit') {
				console.log('[MOBILE-TERMINAL] Terminal exited with code:', event.payload?.exitCode);
				isCatchingUp = false;
			}
		} catch (e) {
			console.error('[MOBILE-TERMINAL] Error handling run event:', e);
		}
	}

	// Handle special key input from toolbar
	function handleSpecialKey(event) {
		if (isAttached && runSessionClient.getStatus().connected) {
			try {
				console.log('[MOBILE-TERMINAL] Sending special key:', event.key);
				runSessionClient.sendInput(sessionId, event.key);
			} catch (error) {
				console.error('[MOBILE-TERMINAL] Failed to send special key:', error);
			}
		}
	}

	// Handle mobile text input
	function handleMobileTextSubmit(event) {
		if (isAttached && runSessionClient.getStatus().connected) {
			try {
				// Handle both direct object and event.detail patterns
				const command = event.detail ? event.detail.command : event.command;
				console.log('[MOBILE-TERMINAL] Sending mobile command:', command);
				runSessionClient.sendInput(sessionId, command);
			} catch (error) {
				console.error('[MOBILE-TERMINAL] Failed to send mobile command:', error);
			}
		}
	}

	// Handle tab completion
	function handleMobileTab(event) {
		if (isAttached && runSessionClient.getStatus().connected) {
			try {
				console.log('[MOBILE-TERMINAL] Sending tab for completion:', event.currentInput);
				// For mobile, we need to send the current input first, then tab
				// This is because the shell doesn't know what the user has typed in the mobile input
				if (event.currentInput && event.currentInput.trim()) {
					runSessionClient.sendInput(sessionId, event.currentInput + event.tabKey);
				} else {
					runSessionClient.sendInput(sessionId, event.tabKey);
				}
			} catch (error) {
				console.error('[MOBILE-TERMINAL] Failed to send tab completion:', error);
			}
		}
	}

	// Toggle between wrap and scroll modes
	function toggleWrapMode() {
		wrapMode = wrapMode === 'wrap' ? 'scroll' : 'wrap';
		// Store preference
		localStorage.setItem('terminal-wrap-mode', wrapMode);
	}

	// Handle clicks on terminal content using event delegation
	function handleTerminalClick(event) {
		const target = event.target;

		// Handle link clicks
		if (target.classList.contains('terminal-link')) {
			event.preventDefault();
			const url = target.dataset.url;
			if (url) {
				openLink(url);
			}
		}
		// Handle file path clicks
		else if (target.classList.contains('terminal-file-path')) {
			event.preventDefault();
			selectText(target);
		}
	}

	// Function for selecting text
	function selectText(element) {
		if (window.getSelection) {
			const selection = window.getSelection();
			const range = document.createRange();
			range.selectNodeContents(element);
			selection.removeAllRanges();
			selection.addRange(range);
		}
	}

	// Function for opening links safely
	function openLink(url) {
		try {
			// Validate the URL
			const validUrl = new URL(url);
			if (validUrl.protocol === 'http:' || validUrl.protocol === 'https:') {
				// Use window.open with proper security attributes
				window.open(url, '_blank', 'noopener,noreferrer');
			} else {
				console.warn('Invalid URL protocol:', validUrl.protocol);
			}
		} catch (error) {
			console.error('Invalid URL:', url, error);
		}
	}

	onMount(async () => {
		console.log('[MOBILE-TERMINAL] MobileTerminalView mounted with sessionId:', sessionId);

		// Load wrap mode preference
		const savedWrapMode = localStorage.getItem('terminal-wrap-mode');
		if (savedWrapMode === 'wrap' || savedWrapMode === 'scroll') {
			wrapMode = savedWrapMode;
		}

		if (!sessionId || sessionId === 'undefined') {
			console.error('[MOBILE-TERMINAL] Invalid sessionId, cannot initialize terminal');
			return;
		}

		try {
			// Authenticate if not already done
			if (!runSessionClient.getStatus().authenticated) {
				await runSessionClient.authenticate(key);
			}

			// Attach to the run session and get backlog
			console.log('[MOBILE-TERMINAL] Attaching to run session:', sessionId);
			isCatchingUp = shouldResume;

			const result = await runSessionClient.attachToRunSession(sessionId, handleRunEvent, 0);
			isAttached = true;
			connectionError = null;
			console.log('[MOBILE-TERMINAL] Attached to run session:', result);

			// Send initial enter to trigger prompt (only for new terminals)
			if (!shouldResume) {
				setTimeout(() => {
					console.log('[MOBILE-TERMINAL] Sending initial enter for session:', sessionId);
					try {
						runSessionClient.sendInput(sessionId, '\r');
					} catch (error) {
						console.error('[MOBILE-TERMINAL] Failed to send initial enter:', error);
					}
				}, 200);
			}

			// Clear catching up state after a delay if no messages arrived
			if (shouldResume) {
				setTimeout(() => {
					if (isCatchingUp) {
						isCatchingUp = false;
						console.log('[MOBILE-TERMINAL] Timeout reached, clearing catching up state');
					}
				}, 2000);
			}

		} catch (error) {
			console.error('[MOBILE-TERMINAL] Failed to attach to run session:', error);
			connectionError = `Failed to connect: ${error.message}`;
			isCatchingUp = false;
		}
	});

	onDestroy(() => {
		// Detach from run session
		if (isAttached && sessionId) {
			try {
				runSessionClient.detachFromRunSession(sessionId);
				console.log('[MOBILE-TERMINAL] Detached from run session:', sessionId);
			} catch (error) {
				console.error('[MOBILE-TERMINAL] Failed to detach from run session:', error);
			}
		}
	});
</script>

<div class="mobile-terminal-wrapper">
	{#if isCatchingUp}
		<div class="terminal-loading">
			<div class="loading-message">
				<span class="loading-icon">⟳</span>
				<span>Reconnecting to terminal session...</span>
			</div>
		</div>
	{/if}

	<!-- Mobile terminal output -->
	<div
		bind:this={container}
		class="terminal-scroll {wrapMode === 'wrap' ? 'wrap-mode' : 'scroll-mode'}"
		onscroll={onScroll}
		onclick={handleTerminalClick}
		role="log"
		aria-label="Terminal output with clickable links"
		aria-live="polite"
	>
		<div class="terminal-pre">
			{#each terminalLines as line (line.id)}
				<div class="terminal-line">{@html line.html}</div>
			{/each}
		</div>
	</div>

	<!-- Mobile terminal input with integrated toolbar -->
	<MobileTerminalInput
		visible={true}
		disabled={!isAttached}
		onSubmit={handleMobileTextSubmit}
		onTab={handleMobileTab}
		onSpecialKey={handleSpecialKey}
		placeholder="Type commands here..."
		{toggleWrapMode}
		{wrapMode}
	/>
</div>

<style>
	.mobile-terminal-wrapper {
		height: 100%;
		display: flex;
		flex-direction: column;
		position: relative;
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
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.terminal-scroll {
		flex: 1;
		height: 100%;
		overflow: auto;
		background: radial-gradient(
			ellipse at top left,
			color-mix(in oklab, var(--bg) 95%, var(--primary) 5%),
			var(--bg)
		);
		color: var(--text);
		font-family: var(--font-mono);
		font-size: 14px;
		line-height: 1.4;
		-webkit-font-smoothing: antialiased;
		/* Enable touch scrolling */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		position: relative;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklab, var(--primary) 30%, transparent) transparent;
		/* Enable text selection */
		user-select: text;
		-webkit-user-select: text;
		-moz-user-select: text;
		-ms-user-select: text;
	}

	/* Wrap mode - text wraps to viewport */
	.terminal-scroll.wrap-mode {
		overflow-x: hidden;
		overflow-y: auto;
	}

	/* Scroll mode - horizontal scrolling enabled */
	.terminal-scroll.scroll-mode {
		overflow-x: auto;
		overflow-y: auto;
		/* Enable horizontal scrolling on mobile devices */
		-webkit-overflow-scrolling: touch;
	}

	.terminal-scroll::-webkit-scrollbar {
		width: 8px;
	}

	.terminal-scroll::-webkit-scrollbar-thumb {
		background: linear-gradient(
			180deg,
			color-mix(in oklab, var(--primary) 40%, transparent),
			color-mix(in oklab, var(--primary) 20%, transparent)
		);
		border-radius: 12px;
		border: 2px solid transparent;
		background-clip: padding-box;
	}

	.terminal-scroll::-webkit-scrollbar-track {
		background: color-mix(in oklab, var(--surface) 95%, transparent);
		border-radius: 12px;
	}

	.terminal-pre {
		white-space: pre;
		word-wrap: normal;
		tab-size: 8;
		padding: var(--space-4) var(--space-4) var(--space-6);
		min-height: 100%;
		/* Enable text selection */
		user-select: text;
		-webkit-user-select: text;
		-moz-user-select: text;
		-ms-user-select: text;
	}

	/* Wrap mode styles */
	.wrap-mode .terminal-pre {
		white-space: pre-wrap;
		word-wrap: break-word;
		word-break: break-all;
	}

	/* Scroll mode styles */
	.scroll-mode .terminal-pre {
		white-space: pre;
		word-wrap: normal;
	}

	.terminal-line {
		white-space: inherit;
		word-wrap: inherit;
		word-break: inherit;
		line-height: inherit;
		/* Optimize rendering performance */
		contain: style layout;
	}

	/* ANSI color theme for ansi_up library classes */
	:global(.ansi-black-fg) { color: #2e3440; }
	:global(.ansi-red-fg) { color: #bf616a; }
	:global(.ansi-green-fg) { color: #a3be8c; }
	:global(.ansi-yellow-fg) { color: #ebcb8b; }
	:global(.ansi-blue-fg) { color: #81a1c1; }
	:global(.ansi-magenta-fg) { color: #b48ead; }
	:global(.ansi-cyan-fg) { color: #88c0d0; }
	:global(.ansi-white-fg) { color: #e5e9f0; }

	/* Bright colors */
	:global(.ansi-bright-black-fg) { color: #4c566a; }
	:global(.ansi-bright-red-fg) { color: #bf616a; }
	:global(.ansi-bright-green-fg) { color: #a3be8c; }
	:global(.ansi-bright-yellow-fg) { color: #ebcb8b; }
	:global(.ansi-bright-blue-fg) { color: #81a1c1; }
	:global(.ansi-bright-magenta-fg) { color: #b48ead; }
	:global(.ansi-bright-cyan-fg) { color: #8fbcbb; }
	:global(.ansi-bright-white-fg) { color: #eceff4; }

	/* Background colors */
	:global(.ansi-black-bg) { background-color: #2e3440; }
	:global(.ansi-red-bg) { background-color: #bf616a; }
	:global(.ansi-green-bg) { background-color: #a3be8c; }
	:global(.ansi-yellow-bg) { background-color: #ebcb8b; }
	:global(.ansi-blue-bg) { background-color: #81a1c1; }
	:global(.ansi-magenta-bg) { background-color: #b48ead; }
	:global(.ansi-cyan-bg) { background-color: #88c0d0; }
	:global(.ansi-white-bg) { background-color: #e5e9f0; }

	/* Text formatting */
	:global(.ansi-bold) { font-weight: bold; }
	:global(.ansi-dim) { opacity: 0.7; }
	:global(.ansi-italic) { font-style: italic; }
	:global(.ansi-underline) { text-decoration: underline; }
	:global(.ansi-strikethrough) { text-decoration: line-through; }
	:global(.ansi-blink) { animation: blink 1s linear infinite; }

	@keyframes blink {
		0%, 50% { opacity: 1; }
		51%, 100% { opacity: 0; }
	}

	/* Terminal links and interactive elements */
	:global(.terminal-link) {
		color: var(--primary, #0ea5e9);
		text-decoration: underline;
		cursor: pointer;
		transition: color 0.2s ease;
	}

	:global(.terminal-link:hover) {
		color: var(--accent-cyan, #06b6d4);
		text-decoration: underline;
	}

	:global(.terminal-link:visited) {
		color: color-mix(in oklab, var(--primary) 80%, var(--text) 20%);
	}

	:global(.terminal-file-path) {
		color: var(--accent-amber, #f59e0b);
		cursor: pointer;
		transition: all 0.2s ease;
		border-radius: 2px;
		padding: 0 2px;
	}

	:global(.terminal-file-path:hover) {
		background: color-mix(in oklab, var(--accent-amber) 20%, transparent);
		color: var(--accent-amber);
	}

	/* Mobile specific adjustments */
	@media (max-width: 768px) {
		.terminal-scroll {
			font-size: 12px;
			/* Improve touch scrolling and selection on mobile */
			touch-action: manipulation;
		}

		.terminal-pre {
			padding: var(--space-3) var(--space-2) var(--space-4);
		}

		/* Show horizontal scrollbar on mobile in scroll mode */
		.terminal-scroll.scroll-mode::-webkit-scrollbar {
			height: 8px;
			width: 8px;
		}

		.terminal-scroll.scroll-mode::-webkit-scrollbar-thumb {
			background: linear-gradient(
				90deg,
				color-mix(in oklab, var(--primary) 40%, transparent),
				color-mix(in oklab, var(--primary) 20%, transparent)
			);
			border-radius: 12px;
		}

		.terminal-scroll.scroll-mode::-webkit-scrollbar-corner {
			background: transparent;
		}

		/* Make links easier to tap on mobile */
		:global(.terminal-link) {
			padding: 2px 4px;
			margin: -2px -4px;
			border-radius: 4px;
			min-height: 44px; /* iOS accessibility guidelines */
			display: inline-flex;
			align-items: center;
		}

		:global(.terminal-file-path) {
			padding: 2px 4px;
			margin: -2px -4px;
			border-radius: 4px;
			min-height: 44px;
			display: inline-flex;
			align-items: center;
		}
	}

	@media (max-width: 480px) {
		.terminal-scroll {
			font-size: 11px;
		}

		.terminal-pre {
			padding: 4px 6px 16px;
		}
	}

	/* Touch device optimizations */
	@media (hover: none) and (pointer: coarse) {
		.terminal-scroll {
			/* Better touch scrolling performance */
			-webkit-overflow-scrolling: touch;
			scroll-behavior: auto; /* Disable smooth scrolling on touch devices */
		}

		/* Increase tap targets for touch devices */
		:global(.terminal-link),
		:global(.terminal-file-path) {
			min-height: 44px;
			min-width: 44px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			padding: 8px;
			margin: -8px;
		}
	}
</style>