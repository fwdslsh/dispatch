<script>
	import { onMount, onDestroy } from 'svelte';
	import { io } from 'socket.io-client';
	import Button from '$lib/shared/components/Button.svelte';
	// Using global styles for inputs

	let { sessionId, projectPath = null, shouldResume = false } = $props();

	/**
	 * @type {import("socket.io-client").Socket}
	 */
	let socket = $state();
	let messages = $state([]);
	let input = $state('');
	let loading = $state(false);

	function send(e) {
		e.preventDefault();
		if (!input.trim()) return;
		const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
		socket.emit('claude.send', { key, id: sessionId, input });
		messages = [...messages, { role: 'user', text: input }];
		input = '';
	}

	async function loadPreviousMessages() {
		if (!shouldResume || !projectPath || !sessionId) return;
		
		loading = true;
		try {
			// Extract project name from path and session ID from claude session
			const projectName = projectPath.split('/').pop() || projectPath;
			const claudeSessionId = sessionId.replace('claude_', '');
			
			const response = await fetch(`/api/claude/sessions/${encodeURIComponent(projectName)}/${encodeURIComponent(claudeSessionId)}?full=1`);
			
			if (response.ok) {
				const data = await response.json();
				const previousMessages = [];
				
				// Parse the .jsonl entries to reconstruct messages
				for (const entry of data.entries || []) {
					if (entry.role === 'user' && entry.content) {
						previousMessages.push({ role: 'user', text: entry.content });
					} else if (entry.role === 'assistant' && entry.content) {
						previousMessages.push({ role: 'assistant', text: entry.content });
					}
				}
				
				messages = previousMessages;
				console.log('Loaded previous messages:', previousMessages.length);
			}
		} catch (error) {
			console.error('Failed to load previous messages:', error);
		} finally {
			loading = false;
		}
	}

	onMount(async () => {
		// Load previous messages first if resuming
		if (shouldResume) {
			await loadPreviousMessages();
		}

		socket = io();
		socket.on('connect', () => {
			console.log('Claude Socket.IO connected');
		});

		socket.on('message.delta', (payload) => {
			console.log('Received message.delta:', payload);

			const result = payload.find((r) => r.type === 'result');
			messages = [...messages, { role: 'assistant', text: result.result || '' }];
		});
	});
	onDestroy(() => socket?.disconnect());
</script>

<div class="claude-pane">
	<div class="messages">
		{#if loading}
			<div class="loading-message">
				<div class="message__role">system:</div>
				<div class="message__text">Loading previous conversation...</div>
			</div>
		{/if}
		{#each messages as m}
			<div class="message message--{m.role}">
				<div class="message__role">{m.role}:</div>
				<div class="message__text">{m.text}</div>
			</div>
		{/each}
	</div>
	<form onsubmit={send} class="input-form">
		<input bind:value={input} placeholder="Ask Claude..." class="input" />
		<Button 
			type="submit" 
			text="Send" 
			variant="primary" 
			augmented="tr-clip bl-clip both"
			{...{icon: undefined}}
		/>
	</form>
</div>

<style>
	.claude-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
		color: var(--text-primary);
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-3);
		scroll-behavior: smooth;
	}

	.message {
		margin-bottom: var(--space-3);
		padding: var(--space-3);
		border-left: 3px solid var(--primary-dim);
		background: var(--bg-panel);
		border-radius: 0;
	}

	.message--user {
		border-left-color: var(--accent-amber);
		background: rgba(255, 209, 102, 0.05);
	}

	.message--assistant {
		border-left-color: var(--primary);
		background: rgba(46, 230, 107, 0.05);
	}

	.message__role {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--text-muted);
		font-size: 0.75rem;
		margin-bottom: var(--space-2);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.message__text {
		line-height: 1.5;
		word-wrap: break-word;
	}

	.loading-message {
		margin-bottom: var(--space-3);
		padding: var(--space-3);
		border-left: 3px solid var(--primary-dim);
		background: var(--bg-panel);
		border-radius: 0;
		opacity: 0.8;
		font-style: italic;
	}

	.input-form {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-3);
		border-top: 1px solid var(--primary-dim);
		background: var(--bg-panel);
	}

	.input-form .input {
		flex: 1;
	}
</style>
