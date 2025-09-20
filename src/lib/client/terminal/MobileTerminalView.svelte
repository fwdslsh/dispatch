<!--
	MobileTerminalView.svelte
	
	Mobile-optimized terminal view using HTML rendering instead of xterm.js.
	Provides better touch scrolling and mobile performance.
-->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { runSessionClient } from '$lib/client/shared/services/RunSessionClient.js';
	import MobileKeyboardToolbar from './MobileKeyboardToolbar.svelte';
	import MobileTextInput from './MobileTextInput.svelte';

	// Props
	let { sessionId, shouldResume = false } = $props();

	// State
	let terminalContent = $state('');
	let container = $state();
	let isAttached = $state(false);
	let isCatchingUp = $state(false);
	let connectionError = $state(null);
	let shouldAutoScroll = $state(true);

	let key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';

	// ANSI-to-HTML conversion (simplified - you might want to use ansi_up library)
	function ansiToHtml(text) {
		// Basic ANSI escape sequence handling
		return text
			.replace(/\x1b\[([0-9;]*[a-zA-Z])/g, (match, codes) => {
				// Handle basic ANSI codes
				if (codes === '0m') return '</span>'; // Reset
				if (codes === '1m') return '<span class="ansi-bold">'; // Bold
				if (codes === '31m') return '<span class="ansi-red-fg">'; // Red
				if (codes === '32m') return '<span class="ansi-green-fg">'; // Green
				if (codes === '33m') return '<span class="ansi-yellow-fg">'; // Yellow
				if (codes === '34m') return '<span class="ansi-blue-fg">'; // Blue
				if (codes === '35m') return '<span class="ansi-magenta-fg">'; // Magenta
				if (codes === '36m') return '<span class="ansi-cyan-fg">'; // Cyan
				if (codes === '37m') return '<span class="ansi-white-fg">'; // White
				// Clear screen
				if (codes === '2J' || codes === 'H') return '';
				return '';
			})
			.replace(/\r\n/g, '\n')
			.replace(/\r/g, '\n');
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
					const htmlContent = ansiToHtml(text);
					terminalContent += htmlContent;
					
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

	// Handle mobile keyboard input
	function handleMobileKeypress(event) {
		if (isAttached && runSessionClient.getStatus().connected) {
			try {
				console.log('[MOBILE-TERMINAL] Sending mobile key:', event.detail.key);
				runSessionClient.sendInput(sessionId, event.detail.key);
			} catch (error) {
				console.error('[MOBILE-TERMINAL] Failed to send mobile key:', error);
			}
		}
	}

	// Handle mobile text input
	function handleMobileTextSubmit(event) {
		if (isAttached && runSessionClient.getStatus().connected) {
			try {
				console.log('[MOBILE-TERMINAL] Sending mobile command:', event.detail.command);
				runSessionClient.sendInput(sessionId, event.detail.command);
			} catch (error) {
				console.error('[MOBILE-TERMINAL] Failed to send mobile command:', error);
			}
		}
	}

	onMount(async () => {
		console.log('[MOBILE-TERMINAL] MobileTerminalView mounted with sessionId:', sessionId);

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
	
	<!-- Mobile text input area -->
	<MobileTextInput
		visible={true}
		disabled={!isAttached}
		on:submit={handleMobileTextSubmit}
		placeholder="Type commands here..."
	/>
	
	<!-- Mobile terminal output -->
	<div 
		bind:this={container} 
		class="terminal-scroll" 
		onscroll={onScroll} 
		aria-label="Read-only terminal output"
	>
		<div class="terminal-pre">{@html terminalContent}</div>
	</div>
	
	<!-- Mobile keyboard toolbar -->
	<MobileKeyboardToolbar
		visible={true}
		disabled={!isAttached}
		on:keypress={handleMobileKeypress}
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
		background: #0b0b0b;
		color: #e6e6e6;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
		font-size: 13px;
		line-height: 1.35;
		-webkit-font-smoothing: antialiased;
		/* Enable touch scrolling */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}

	.terminal-pre { 
		white-space: pre; 
		word-wrap: normal; 
		tab-size: 8; 
		padding: 8px 10px 24px; 
	}

	/* ANSI color theme */
	:global(.ansi-black-fg) { color: #000; }      
	:global(.ansi-black-bg) { background:#000; }
	:global(.ansi-red-fg) { color: #e06c75; }     
	:global(.ansi-red-bg) { background:#e06c75; }
	:global(.ansi-green-fg) { color: #98c379; }   
	:global(.ansi-green-bg) { background:#98c379; }
	:global(.ansi-yellow-fg) { color: #e5c07b; }  
	:global(.ansi-yellow-bg) { background:#e5c07b; }
	:global(.ansi-blue-fg) { color: #61afef; }    
	:global(.ansi-blue-bg) { background:#61afef; }
	:global(.ansi-magenta-fg) { color: #c678dd; } 
	:global(.ansi-magenta-bg) { background:#c678dd; }
	:global(.ansi-cyan-fg) { color: #56b6c2; }    
	:global(.ansi-cyan-bg) { background:#56b6c2; }
	:global(.ansi-white-fg) { color: #abb2bf; }   
	:global(.ansi-white-bg) { background:#abb2bf; }
	:global(.ansi-bright-black-fg) { color:#5c6370; }   
	:global(.ansi-bright-black-bg) { background:#5c6370; }
	:global(.ansi-bright-red-fg) { color:#e06c75; }     
	:global(.ansi-bright-red-bg) { background:#e06c75; }
	:global(.ansi-bright-green-fg) { color:#98c379; }   
	:global(.ansi-bright-green-bg) { background:#98c379; }
	:global(.ansi-bright-yellow-fg) { color:#e5c07b; }  
	:global(.ansi-bright-yellow-bg) { background:#e5c07b; }
	:global(.ansi-bright-blue-fg) { color:#61afef; }    
	:global(.ansi-bright-blue-bg) { background:#61afef; }
	:global(.ansi-bright-magenta-fg) { color:#c678dd; } 
	:global(.ansi-bright-magenta-bg) { background:#c678dd; }
	:global(.ansi-bright-cyan-fg) { color:#56b6c2; }    
	:global(.ansi-bright-cyan-bg) { background:#56b6c2; }
	:global(.ansi-bright-white-fg) { color:#ffffff; }   
	:global(.ansi-bright-white-bg) { background:#ffffff; }

	/* SGR styles that ansi_up emits as inline styles – keep for consistency */
	:global(span.ansi-bold) { font-weight: bold; }
	:global(span.ansi-italic) { font-style: italic; }
	:global(span.ansi-underline) { text-decoration: underline; }

	/* Mobile specific adjustments */
	@media (max-width: 768px) {
		.terminal-scroll {
			font-size: 12px;
		}
		
		.terminal-pre {
			padding: 6px 8px 20px;
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
</style>