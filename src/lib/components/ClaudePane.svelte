<script>
	import { onMount, onDestroy } from 'svelte';
	import { io } from 'socket.io-client';
	import { Button, Input } from '$lib/shared/components';

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
		<Input bind:value={input} placeholder="Ask Claude..." />
		<Button type="submit" text="Send" variant="primary" />
	</form>
</div>

<style>
	.claude-pane {
		display: flex;
		flex-direction: column;
		height: 100%;
		background: var(--bg-dark);
		color: var(--text-primary);
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: var(--space-sm);
		scroll-behavior: smooth;
	}

	.message {
		margin-bottom: var(--space-sm);
		padding: var(--space-sm);
		border-radius: 4px;
		border-left: 3px solid var(--border);
	}

	.message--user {
		background: var(--surface);
		border-left-color: var(--primary);
	}

	.message--assistant {
		background: var(--surface-hover);
		border-left-color: var(--secondary);
	}

	.message__role {
		font-weight: 600;
		color: var(--text-secondary);
		font-size: 0.875rem;
		margin-bottom: var(--space-xs);
	}

	.message__text {
		line-height: 1.5;
		word-wrap: break-word;
	}

	.input-form {
		display: flex;
		gap: var(--space-sm);
		padding: var(--space-sm);
		border-top: 1px solid var(--border);
		background: var(--surface);
	}

	.input-form :global(.input) {
		flex: 1;
	}
</style>
