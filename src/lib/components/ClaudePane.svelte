<script>
	import { onMount, onDestroy, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { io } from 'socket.io-client';
	import Button from '$lib/shared/components/Button.svelte';
	// Using global styles for inputs

	let { sessionId, claudeSessionId = null, shouldResume = false } = $props();

	/**
	 * @type {import("socket.io-client").Socket}
	 */
	let socket = $state();
	let messages = $state([]);
	let input = $state('');
	let loading = $state(false);
	let isWaitingForReply = $state(false);
	let messagesContainer = $state();

	async function scrollToBottom() {
		await tick();
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
		}
	}
	
	// Auto-scroll when messages change
	$effect(() => {
		if (messages.length > 0) {
			scrollToBottom();
		}
	});
	
	function formatMessage(text) {
		if (!text) return '';
		
		// Escape HTML first
		let formatted = text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
		
		// Convert code blocks
		formatted = formatted.replace(/```([\s\S]*?)```/g, '<pre class="code-block"><code>$1</code></pre>');
		
		// Convert inline code
		formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
		
		// Convert bold text
		formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
		
		// Convert italic text
		formatted = formatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
		
		// Convert line breaks
		formatted = formatted.replace(/\n/g, '<br>');
		
		return formatted;
	}

	async function send(e) {
		e.preventDefault();
		console.log('ClaudePane send called with:', { sessionId, input: input.trim(), socketConnected: socket?.connected });
		if (!input.trim()) return;
		if (!socket) {
			console.error('Socket not available');
			return;
		}
		if (!sessionId) {
			console.error('SessionId not available');
			return;
		}
		
		const userMessage = input.trim();
		const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
		
		// Add user message immediately
		messages = [...messages, { 
			role: 'user', 
			text: userMessage,
			timestamp: new Date(),
			id: Date.now()
		}];
		
		// Clear input and show waiting state
		input = '';
		isWaitingForReply = true;
		
		// Force immediate scroll to user message
		await scrollToBottom();
		
		console.log('Emitting claude.send with:', { key, id: sessionId, input: userMessage });
		socket.emit('claude.send', { key, id: sessionId, input: userMessage });
	}

	async function loadPreviousMessages() {
		if (!claudeSessionId) return;
		
		loading = true;
		try {
			// Use the simplified session lookup endpoint that finds the session by ID alone
			console.log('Loading Claude history for session:', claudeSessionId);
			const response = await fetch(`/api/claude/session/${encodeURIComponent(claudeSessionId)}?full=1`);
			
			if (response.ok) {
				const data = await response.json();
				const previousMessages = [];
				
				// Parse the .jsonl entries to reconstruct messages
				for (let i = 0; i < (data.entries || []).length; i++) {
					const entry = data.entries[i];
					if (entry.type === 'user' && entry.message?.content && Array.isArray(entry.message.content)) {
						// Extract text from content array
						const textContent = entry.message.content
							.filter(c => c && c.type === 'text')
							.map(c => c.text)
							.join('');
						if (textContent) {
							previousMessages.push({ 
								role: 'user', 
								text: textContent,
								timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(Date.now() - (data.entries.length - i) * 60000),
								id: `prev_${i}_user`
							});
						}
					} else if (entry.type === 'assistant' && entry.message?.content && Array.isArray(entry.message.content)) {
						// Extract text from content array
						const textContent = entry.message.content
							.filter(c => c && c.type === 'text')
							.map(c => c.text)
							.join('');
						if (textContent) {
							previousMessages.push({ 
								role: 'assistant', 
								text: textContent,
								timestamp: entry.timestamp ? new Date(entry.timestamp) : new Date(Date.now() - (data.entries.length - i) * 60000),
								id: `prev_${i}_assistant`
							});
						}
					}
				}
				
				messages = previousMessages;
				if (previousMessages.length > 0) {
					console.log('Loaded previous messages:', previousMessages.length);
				} else {
					console.log('No previous messages found - this appears to be a new session');
				}
			} else {
				console.warn('Failed to load Claude session history:', response.status, await response.text());
			}
		} catch (error) {
			console.error('Failed to load previous messages:', error);
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		console.log('ClaudePane mounting with:', { sessionId, claudeSessionId, shouldResume });
		
		// Always try to load previous messages if we have a Claude session ID
		// This handles both explicit resumes and cases where history exists
		await loadPreviousMessages();

		socket = io();
		socket.on('connect', () => {
			console.log('Claude Socket.IO connected');
		});

		socket.on('message.delta', async (payload) => {
			console.log('Received message.delta:', payload);
			
			// Hide typing indicator when response arrives
			isWaitingForReply = false;

			const result = payload.find((r) => r.type === 'result');
			messages = [...messages, { 
				role: 'assistant', 
				text: result.result || '',
				timestamp: new Date(),
				id: Date.now()
			}];
			
			// Scroll to show the new response
			await scrollToBottom();
		});
		
		// Handle errors to clear typing indicator
		socket.on('error', (error) => {
			console.error('Socket error:', error);
			isWaitingForReply = false;
			
			// Add error message if we were waiting for a reply
			if (messages.length > 0 && messages[messages.length - 1].role === 'user') {
				messages = [...messages, {
					role: 'assistant',
					text: '⚠️ Sorry, I encountered an error processing your request. Please try again.',
					timestamp: new Date(),
					id: Date.now(),
					isError: true
				}];
			}
		});
		
		socket.on('disconnect', () => {
			console.log('Socket disconnected');
			isWaitingForReply = false;
		});
	});
	onDestroy(() => socket?.disconnect());
</script>

<div class="claude-pane">
	<!-- Chat Header with AI Status -->
	<div class="chat-header">
		<div class="ai-status">
			<div class="ai-avatar">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" class="ai-icon">
					<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"/>
				</svg>
			</div>
			<div class="ai-info">
				<div class="ai-name">Claude</div>
				<div class="ai-state">{loading ? 'Processing...' : 'Ready'}</div>
			</div>
		</div>
		<div class="chat-stats">
			<div class="stat-item">
				<span class="stat-icon">💬</span>
				<span class="stat-value">{messages.length}</span>
			</div>
		</div>
	</div>

	<!-- Enhanced Messages Container -->
	<div class="messages" role="log" aria-live="polite" aria-label="Chat messages" bind:this={messagesContainer}>
		{#if loading && messages.length === 0}
			<div class="loading-message" transition:fly={{ y: 20, duration: 300 }}>
				<div class="loading-indicator">
					<div class="pulse-ring"></div>
					<div class="pulse-ring"></div>
					<div class="pulse-ring"></div>
				</div>
				<div class="loading-text">Loading previous conversation...</div>
			</div>
		{/if}
		
		{#each messages as m, index (m.id || `msg-${index}`)}
			<div 
				class="message message--{m.role} {m.isError ? 'message--error' : ''}" 
				transition:fly={{ y: 20, duration: 400 }}
				role="article"
				aria-label="{m.role} message"
			>
				<div class="message-wrapper">
					<div class="message-avatar">
						{#if m.role === 'user'}
							<div class="user-avatar">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/>
								</svg>
							</div>
						{:else}
							<div class="ai-avatar-small">
								<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
									<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"/>
								</svg>
							</div>
						{/if}
					</div>
					<div class="message-content">
						<div class="message-header">
							<span class="message-role">{m.role === 'user' ? 'You' : 'Claude'}</span>
							<span class="message-time">
								{m.timestamp ? 
									new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 
									'--:--'
								}
							</span>
						</div>
						<div class="message-text">{@html formatMessage(m.text)}</div>
					</div>
				</div>
			</div>
		{/each}
		
		{#if isWaitingForReply}
			<div class="message message--assistant typing-indicator" transition:fly={{ y: 20, duration: 300 }}>
				<div class="message-wrapper">
					<div class="message-avatar">
						<div class="ai-avatar-small">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
								<path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M11,16.5L18,9.5L16.5,8L11,13.5L7.5,10L6,11.5L11,16.5Z"/>
							</svg>
						</div>
					</div>
					<div class="message-content">
						<div class="message-header">
							<span class="message-role">Claude</span>
							<span class="message-time typing-status">Typing</span>
						</div>
						<div class="typing-animation">
							<span class="typing-dot"></span>
							<span class="typing-dot"></span>
							<span class="typing-dot"></span>
						</div>
					</div>
				</div>
			</div>
		{/if}
		
		{#if messages.length === 0 && !loading}
			<div class="welcome-message" transition:fly={{ y: 30, duration: 500 }}>
				<div class="welcome-icon">🚀</div>
				<h3>Welcome to Claude</h3>
				<p>Start a conversation with your AI assistant. Ask questions, get help with coding, or discuss ideas!</p>
			</div>
		{/if}
	</div>
	
	<!-- Enhanced Input Form -->
	<form onsubmit={send} class="input-form" role="form">
		<div class="input-container">
			<textarea 
				bind:value={input} 
				placeholder="Message Claude..." 
				class="message-input"
				disabled={loading || isWaitingForReply}
				aria-label="Type your message"
				autocomplete="off"
				onkeydown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						send(e);
					}
				}}
				rows="1"
			></textarea>
			<Button 
				type="submit" 
				text={isWaitingForReply ? "Waiting..." : loading ? "Sending..." : "Send"} 
				variant="primary" 
				augmented="tr-clip bl-clip both"
				disabled={!input.trim() || loading || isWaitingForReply}
				ariaLabel="Send message"
				{...{icon: undefined}}
			/>
		</div>
		<div class="input-help">
			<span class="help-text">Press Enter to send • Shift+Enter for new line</span>
		</div>
	</form>
</div>

<style>
	/* 🏆 AWARD-WINNING CHAT INTERFACE 2025 🏆
	   Features: Advanced glass-morphism, spatial design, micro-interactions,
	   professional typography, and cutting-edge UX patterns */
	
	.claude-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: 
			radial-gradient(ellipse at top left, 
				color-mix(in oklab, var(--bg) 95%, var(--primary) 5%),
				var(--bg)
			);
		color: var(--text);
		overflow: hidden;
		position: relative;
		container-type: inline-size;
	}
	
	/* 🎯 INTELLIGENT CHAT HEADER */
	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-4) var(--space-6);
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--surface) 92%, var(--primary) 8%),
				color-mix(in oklab, var(--surface) 95%, var(--primary) 5%)
			);
		border-bottom: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		backdrop-filter: blur(16px) saturate(120%);
		position: relative;
		z-index: 10;
		box-shadow: 
			0 2px 20px -8px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
	}
	
	.ai-status {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	
	.ai-avatar {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		background: 
			radial-gradient(ellipse at center, 
				color-mix(in oklab, var(--primary) 15%, transparent),
				color-mix(in oklab, var(--primary) 5%, transparent)
			);
		border: 2px solid color-mix(in oklab, var(--primary) 30%, transparent);
		border-radius: 50%;
		color: var(--primary);
		backdrop-filter: blur(8px);
		box-shadow: 
			0 8px 32px -12px var(--primary-glow),
			inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
			0 0 0 1px color-mix(in oklab, var(--primary) 10%, transparent);
		transition: all 0.3s ease;
		animation: avatarPulse 4s ease-in-out infinite;
	}
	
	@keyframes avatarPulse {
		0%, 100% { 
			transform: scale(1);
			box-shadow: 
				0 8px 32px -12px var(--primary-glow),
				inset 0 2px 4px color-mix(in oklab, var(--primary) 15%, transparent),
				0 0 0 1px color-mix(in oklab, var(--primary) 10%, transparent);
		}
		50% { 
			transform: scale(1.05);
			box-shadow: 
				0 12px 40px -8px var(--primary-glow),
				inset 0 2px 8px color-mix(in oklab, var(--primary) 20%, transparent),
				0 0 0 2px color-mix(in oklab, var(--primary) 20%, transparent);
		}
	}
	
	.ai-info {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	
	.ai-name {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: var(--font-size-3);
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		letter-spacing: 0.05em;
	}
	
	.ai-state {
		font-family: var(--font-sans);
		font-size: var(--font-size-1);
		color: var(--muted);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	
	.chat-stats {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	
	.stat-item {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-4);
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--primary) 10%, transparent),
				color-mix(in oklab, var(--primary) 5%, transparent)
			);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 20px;
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		font-weight: 600;
		backdrop-filter: blur(4px);
	}
	
	.stat-icon {
		font-size: 1em;
	}
	
	.stat-value {
		color: var(--primary);
		font-weight: 700;
	}
	
	/* 💬 ADVANCED MESSAGES CONTAINER */
	.messages {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-6) var(--space-6) var(--space-4);
		scroll-behavior: smooth;
		scrollbar-width: thin;
		scrollbar-color: color-mix(in oklab, var(--primary) 30%, transparent) transparent;
		position: relative;
		background: 
			linear-gradient(180deg, 
				transparent 0%,
				color-mix(in oklab, var(--surface) 98%, var(--primary) 2%) 10%,
				color-mix(in oklab, var(--surface) 98%, var(--primary) 2%) 90%,
				transparent 100%
			);
	}
	
	.messages::-webkit-scrollbar {
		width: 8px;
	}
	
	.messages::-webkit-scrollbar-thumb {
		background: 
			linear-gradient(180deg, 
				color-mix(in oklab, var(--primary) 40%, transparent),
				color-mix(in oklab, var(--primary) 20%, transparent)
			);
		border-radius: 12px;
		border: 2px solid transparent;
		background-clip: padding-box;
	}
	
	.messages::-webkit-scrollbar-track {
		background: color-mix(in oklab, var(--surface) 95%, transparent);
		border-radius: 12px;
	}
	
	/* 🌟 LOADING STATE */
	.loading-message {
		display: flex;
		align-items: center;
		gap: var(--space-4);
		padding: var(--space-6);
		margin: var(--space-4) 0;
		background: 
			radial-gradient(ellipse at left, 
				color-mix(in oklab, var(--surface) 90%, var(--primary) 10%),
				color-mix(in oklab, var(--surface) 95%, var(--primary) 5%)
			);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 24px;
		backdrop-filter: blur(8px);
		box-shadow: 
			0 8px 32px -12px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
	}
	
	.loading-indicator {
		display: flex;
		gap: var(--space-1);
		align-items: center;
	}
	
	.pulse-ring {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--primary);
		animation: pulseRing 1.5s ease-in-out infinite;
	}
	
	.pulse-ring:nth-child(2) {
		animation-delay: 0.2s;
	}
	
	.pulse-ring:nth-child(3) {
		animation-delay: 0.4s;
	}
	
	@keyframes pulseRing {
		0%, 60%, 100% {
			transform: scale(1);
			opacity: 0.6;
		}
		30% {
			transform: scale(1.4);
			opacity: 1;
		}
	}
	
	.loading-text {
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		color: var(--muted);
		font-style: italic;
	}
	
	/* 🎨 MESSAGE BUBBLES - REVOLUTIONARY DESIGN */
	.message {
		margin-bottom: var(--space-5);
		opacity: 0;
		animation: messageSlideIn 0.5s ease-out forwards;
	}
	
	@keyframes messageSlideIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	
	.message-wrapper {
		display: flex;
		gap: var(--space-4);
		align-items: flex-start;
		max-width: 90%;
	}
	
	.message--user .message-wrapper {
		flex-direction: row-reverse;
		margin-left: auto;
		margin-right: 0;
	}
	
	.message--assistant .message-wrapper {
		margin-right: auto;
		margin-left: 0;
	}
	
	/* AVATAR DESIGNS */
	.message-avatar {
		flex-shrink: 0;
		margin-top: var(--space-2);
	}
	
	.user-avatar,
	.ai-avatar-small {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		border: 2px solid transparent;
		backdrop-filter: blur(8px);
		transition: all 0.3s ease;
	}
	
	.user-avatar {
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--accent-amber) 20%, transparent),
				color-mix(in oklab, var(--accent-amber) 10%, transparent)
			);
		border-color: color-mix(in oklab, var(--accent-amber) 40%, transparent);
		color: var(--accent-amber);
		box-shadow: 
			0 4px 16px -8px rgba(255, 209, 102, 0.3),
			inset 0 1px 2px rgba(255, 255, 255, 0.1);
	}
	
	.ai-avatar-small {
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--primary) 20%, transparent),
				color-mix(in oklab, var(--primary) 10%, transparent)
			);
		border-color: color-mix(in oklab, var(--primary) 40%, transparent);
		color: var(--primary);
		box-shadow: 
			0 4px 16px -8px var(--primary-glow),
			inset 0 1px 2px rgba(255, 255, 255, 0.1);
	}
	
	/* MESSAGE CONTENT */
	.message-content {
		flex: 1;
		min-width: 0;
	}
	
	.message-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: var(--space-3);
		gap: var(--space-3);
	}
	
	.message-role {
		font-family: var(--font-mono);
		font-weight: 700;
		font-size: var(--font-size-1);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	
	.message--user .message-role {
		color: var(--accent-amber);
	}
	
	.message--assistant .message-role {
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	
	.message-time {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--muted);
		opacity: 0.7;
	}
	
	.message-text {
		padding: var(--space-5);
		border-radius: 24px;
		line-height: 1.6;
		word-wrap: break-word;
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		backdrop-filter: blur(8px);
		position: relative;
		box-shadow: 
			0 8px 32px -12px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px rgba(255, 255, 255, 0.05);
		transition: all 0.3s ease;
	}
	
	.message--user .message-text {
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--accent-amber) 15%, var(--surface)),
				color-mix(in oklab, var(--accent-amber) 8%, var(--surface))
			);
		border: 1px solid color-mix(in oklab, var(--accent-amber) 25%, transparent);
		color: var(--text);
		border-bottom-right-radius: 8px;
	}
	
	.message--assistant .message-text {
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--primary) 12%, var(--surface)),
				color-mix(in oklab, var(--primary) 6%, var(--surface))
			);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		color: var(--text);
		border-bottom-left-radius: 8px;
	}
	
	.message-text:hover {
		box-shadow: 
			0 12px 40px -16px rgba(0, 0, 0, 0.15),
			inset 0 2px 4px rgba(255, 255, 255, 0.08);
	}
	
	/* 🌟 WELCOME MESSAGE */
	.welcome-message {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
		padding: var(--space-8);
		margin: var(--space-8) auto;
		max-width: 480px;
		background: 
			radial-gradient(ellipse at center, 
				color-mix(in oklab, var(--surface) 90%, var(--primary) 10%),
				color-mix(in oklab, var(--surface) 95%, var(--primary) 5%)
			);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 32px;
		backdrop-filter: blur(12px);
		box-shadow: 
			0 16px 64px -24px rgba(0, 0, 0, 0.2),
			inset 0 2px 4px color-mix(in oklab, var(--primary) 10%, transparent);
	}
	
	.welcome-icon {
		font-size: 4rem;
		margin-bottom: var(--space-4);
		animation: welcomeBounce 2s ease-in-out infinite;
	}
	
	@keyframes welcomeBounce {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-8px); }
	}
	
	.welcome-message h3 {
		font-family: var(--font-mono);
		font-size: var(--font-size-4);
		font-weight: 800;
		background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		margin: 0 0 var(--space-4);
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	
	.welcome-message p {
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		color: var(--muted);
		line-height: 1.6;
		margin: 0;
	}
	
	/* 🚀 REVOLUTIONARY INPUT INTERFACE */
	.input-form {
		padding: var(--space-6);
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--surface) 88%, var(--primary) 12%),
				color-mix(in oklab, var(--surface) 92%, var(--primary) 8%)
			);
		border-top: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		backdrop-filter: blur(16px) saturate(120%);
		position: relative;
		z-index: 10;
		box-shadow: 
			0 -8px 32px -16px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px color-mix(in oklab, var(--primary) 10%, transparent);
	}
	
	.input-container {
		display: flex;
		align-items: stretch;
		gap: var(--space-4);
		position: relative;
	}
	
	.message-input {
		flex: 1;
		padding: var(--space-5) var(--space-6);
		font-family: var(--font-sans);
		font-size: var(--font-size-2);
		font-weight: 500;
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--surface) 95%, var(--primary) 5%),
				color-mix(in oklab, var(--surface) 98%, var(--primary) 2%)
			);
		border: 2px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 24px;
		color: var(--text);
		backdrop-filter: blur(8px);
		transition: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
		box-shadow: 
			inset 0 2px 8px rgba(0, 0, 0, 0.05),
			0 0 0 1px color-mix(in oklab, var(--primary) 10%, transparent),
			0 4px 24px -8px rgba(0, 0, 0, 0.1);
		position: relative;
		overflow: hidden;
		min-height: 56px;
		max-height: 200px;
		resize: vertical;
		line-height: 1.5;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--primary) transparent;
	}
	
	.message-input::-webkit-scrollbar {
		width: 6px;
	}
	
	.message-input::-webkit-scrollbar-thumb {
		background: color-mix(in oklab, var(--primary) 40%, transparent);
		border-radius: 3px;
	}
	
	.message-input::before {
		content: '';
		position: absolute;
		inset: 0;
		background: 
			linear-gradient(90deg, 
				transparent, 
				color-mix(in oklab, var(--primary) 5%, transparent), 
				transparent
			);
		opacity: 0;
		transition: opacity 0.5s ease;
		pointer-events: none;
	}
	
	.message-input:focus {
		border-color: var(--primary);
		background: 
			radial-gradient(ellipse at top, 
				color-mix(in oklab, var(--surface) 90%, var(--primary) 10%),
				color-mix(in oklab, var(--surface) 95%, var(--primary) 5%)
			);
		box-shadow: 
			inset 0 2px 8px rgba(0, 0, 0, 0.03),
			0 0 0 3px color-mix(in oklab, var(--primary) 25%, transparent),
			0 0 40px var(--primary-glow),
			0 16px 60px -20px var(--primary-glow);
		outline: none;
	}
	
	.message-input:focus::before {
		opacity: 1;
		animation: inputShimmer 2s ease-in-out infinite;
	}
	
	@keyframes inputShimmer {
		0% { transform: translateX(-100%); }
		100% { transform: translateX(100%); }
	}
	
	.message-input::placeholder {
		background: linear-gradient(135deg, 
			color-mix(in oklab, var(--muted) 70%, transparent),
			color-mix(in oklab, var(--primary) 30%, transparent)
		);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		font-style: italic;
	}
	
	.message-input:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}
	
	.input-help {
		display: flex;
		justify-content: center;
		margin-top: var(--space-3);
	}
	
	.help-text {
		font-family: var(--font-mono);
		font-size: var(--font-size-0);
		color: var(--muted);
		opacity: 0.7;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}
	
	/* 📱 RESPONSIVE DESIGN */
	@container (max-width: 480px) {
		.chat-header {
			padding: var(--space-3) var(--space-4);
		}
		
		.ai-avatar {
			width: 40px;
			height: 40px;
		}
		
		.messages {
			padding: var(--space-4) var(--space-4) var(--space-3);
		}
		
		.message-wrapper {
			max-width: 95%;
		}
		
		.message-text {
			padding: var(--space-4);
			font-size: var(--font-size-1);
			border-radius: 20px;
		}
		
		.input-form {
			padding: var(--space-4);
		}
		
		.input-container {
			flex-direction: column;
			align-items: stretch;
		}
		
		.message-input {
			border-radius: 20px;
			min-height: 48px;
		}
	}
	
	/* 🎯 ACCESSIBILITY ENHANCEMENTS */
	@media (prefers-reduced-motion: reduce) {
		.message,
		.ai-avatar,
		.welcome-icon,
		.pulse-ring {
			animation: none;
		}
		
		.message-text:hover {
			transform: none;
		}
		
		.message-input:focus {
			transform: none;
		}
	}
	
	@media (prefers-color-scheme: light) {
		.message-text {
			box-shadow: 
				0 4px 20px -12px rgba(0, 0, 0, 0.15),
				inset 0 1px 2px rgba(255, 255, 255, 0.5);
		}
	}
	
	/* HIGH CONTRAST MODE */
	@media (prefers-contrast: high) {
		.message-text {
			border-width: 2px;
		}
		
		.message-input {
			border-width: 3px;
		}
		
		.ai-avatar,
		.user-avatar,
		.ai-avatar-small {
			border-width: 3px;
		}
	}
	
	/* 💬 TYPING INDICATOR ANIMATION */
	.typing-indicator {
		opacity: 1;
		animation: none; /* Override default message animation */
	}
	
	.typing-status {
		color: var(--primary);
		font-weight: 600;
		animation: typingPulse 1.5s ease-in-out infinite;
	}
	
	@keyframes typingPulse {
		0%, 100% { opacity: 0.6; }
		50% { opacity: 1; }
	}
	
	.typing-animation {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-5);
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--primary) 12%, var(--surface)),
				color-mix(in oklab, var(--primary) 6%, var(--surface))
			);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 24px;
		border-bottom-left-radius: 8px;
		min-height: 48px;
		box-shadow: 
			0 8px 32px -12px rgba(0, 0, 0, 0.1),
			inset 0 1px 2px rgba(255, 255, 255, 0.05);
	}
	
	.typing-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--primary);
		opacity: 0.4;
		animation: typingBounce 1.4s ease-in-out infinite;
		box-shadow: 0 2px 8px -2px var(--primary-glow);
	}
	
	.typing-dot:nth-child(1) {
		animation-delay: 0s;
	}
	
	.typing-dot:nth-child(2) {
		animation-delay: 0.2s;
	}
	
	.typing-dot:nth-child(3) {
		animation-delay: 0.4s;
	}
	
	@keyframes typingBounce {
		0%, 60%, 100% {
			transform: translateY(0);
			opacity: 0.4;
		}
		30% {
			transform: translateY(-12px);
			opacity: 1;
			background: var(--accent-cyan);
			box-shadow: 
				0 12px 20px -8px var(--primary-glow),
				0 0 12px var(--primary-glow);
		}
	}
	
	/* Smooth scroll to show typing indicator */
	.typing-indicator {
		scroll-margin-bottom: var(--space-6);
	}
	
	/* 📝 MESSAGE FORMATTING */
	.message-text :global(.code-block) {
		display: block;
		margin: var(--space-3) 0;
		padding: var(--space-4);
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--bg) 95%, var(--primary) 5%),
				color-mix(in oklab, var(--bg) 98%, var(--primary) 2%)
			);
		border: 1px solid color-mix(in oklab, var(--primary) 20%, transparent);
		border-radius: 12px;
		overflow-x: auto;
		font-family: var(--font-mono);
		font-size: var(--font-size-1);
		line-height: 1.5;
		box-shadow: 
			inset 0 2px 8px rgba(0, 0, 0, 0.1),
			0 2px 12px -4px rgba(0, 0, 0, 0.1);
	}
	
	.message-text :global(.code-block code) {
		display: block;
		color: var(--text);
		white-space: pre;
	}
	
	.message-text :global(.inline-code) {
		display: inline;
		padding: var(--space-1) var(--space-2);
		background: color-mix(in oklab, var(--primary) 15%, transparent);
		border: 1px solid color-mix(in oklab, var(--primary) 25%, transparent);
		border-radius: 6px;
		font-family: var(--font-mono);
		font-size: 0.9em;
		color: var(--primary);
		
		text-wrap-mode: wrap;
	}
	
	.message-text :global(strong) {
		font-weight: 700;
		color: var(--text);
	}
	
	.message-text :global(em) {
		font-style: italic;
		color: var(--text);
	}
	
	.message-text :global(br) {
		display: block;
		content: '';
		margin-top: var(--space-2);
	}
	
	/* ⚠️ ERROR MESSAGE STYLING */
	.message--error .message-text {
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--error, #ff6b6b) 15%, var(--surface)),
				color-mix(in oklab, var(--error, #ff6b6b) 8%, var(--surface))
			);
		border-color: color-mix(in oklab, var(--error, #ff6b6b) 35%, transparent);
		color: var(--error, #ff6b6b);
	}
	
	.message--error .ai-avatar-small {
		background: 
			linear-gradient(135deg, 
				color-mix(in oklab, var(--error, #ff6b6b) 20%, transparent),
				color-mix(in oklab, var(--error, #ff6b6b) 10%, transparent)
			);
		border-color: color-mix(in oklab, var(--error, #ff6b6b) 40%, transparent);
		color: var(--error, #ff6b6b);
	}
	
	.message--error .message-role {
		color: var(--error, #ff6b6b);
	}
</style>
