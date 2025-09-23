<!--
	MobileTerminalView.svelte
	
	Mobile-optimized terminal view using HTML rendering instead of xterm.js.
	Provides better touch scrolling and mobile performance.
-->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';
	import { getStoredAuthToken } from '$lib/client/shared/socket-auth.js';
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

	// Get JWT token from cookie for authentication
	let key = getStoredAuthToken();

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
				if (
					after.includes('http') ||
					after.includes('www.') ||
					(after.match(/>[^<]{1,30}</g) && !before.includes('│'))
				) {
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
			if (line || index < newLines.length - 1) {
				// Include empty lines except the last one
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
	/* Component-specific mobile terminal overrides */
	.mobile-terminal-wrapper {
		height: 100%;
		display: flex;
		flex-direction: column;
		position: relative;
	}
	.terminal-scroll {
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
</style>
