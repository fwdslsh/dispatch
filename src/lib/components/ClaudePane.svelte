<script>
	import { onMount, onDestroy } from 'svelte';
	import { io } from 'socket.io-client';
	// Using global styles for buttons and inputs

	let { sessionId } = $props();

	/**
	 * @type {import("socket.io-client").Socket}
	 */
	let socket = $state();
	let messages = $state([]);
	let input = $state('');

	function send(e) {
		e.preventDefault();
		if (!input.trim()) return;
		const key = localStorage.getItem('dispatch-auth-key') || 'testkey12345';
		socket.emit('claude.send', { key, id: sessionId, input });
		messages = [...messages, { role: 'user', text: input }];
		input = '';
	}

	onMount(() => {
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
		{#each messages as m}
			<div class="message message--{m.role}">
				<div class="message__role">{m.role}:</div>
				<div class="message__text">{m.text}</div>
			</div>
		{/each}
	</div>
	<form onsubmit={send} class="input-form">
		<input bind:value={input} placeholder="Ask Claude..." />
		<button class="button primary" type="submit">Send</button>
	</form>
</div>

<style>
	.claude-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg);
		color: var(--text);
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
		border-left: 3px solid var(--line);
		background: var(--surface);
	}

	.message--user {
		border-left-color: var(--accent);
	}

	.message--assistant {
		border-left-color: var(--accent-2);
		background: var(--elev);
	}

	.message__role {
		font-family: var(--font-mono);
		font-weight: 700;
		color: var(--muted);
		font-size: var(--font-size-0);
		margin-bottom: var(--space-2);
		text-transform: uppercase;
	}

	.message__text {
		line-height: 1.5;
		word-wrap: break-word;
	}

	.input-form {
		display: flex;
		gap: var(--space-3);
		padding: var(--space-3);
		border-top: 1px solid var(--line);
		background: var(--surface);
	}

	.input-form input {
		flex: 1;
	}
</style>
