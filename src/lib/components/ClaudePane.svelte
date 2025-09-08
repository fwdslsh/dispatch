<script>
	import { onMount, onDestroy } from 'svelte';
	import { io } from 'socket.io-client';

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
		socket.emit('claude.send', { id: sessionId, input });
		messages = [...messages, { role: 'user', text: input }];
		input = '';
	}

	onMount(() => {
		socket = io();
		socket.on('connect', () => {
			socket.emit('subscribe', `claude:${sessionId}`);
		});

		socket.on('message.delta', (payload) => {
			console.log('Received message.delta:', payload);

			const result = payload.find((r) => r.type === 'result');
			messages = [...messages, { role: 'assistant', text: result.result || '' }];
		});
	});
	onDestroy(() => socket?.disconnect());
</script>

<div class="pane">
	<div class="log">
		{#each messages as m}
			<div><strong>{m.role}:</strong> {m.text}</div>
		{/each}
	</div>
	<form onsubmit={send} style="display:flex; gap:8px; margin-top:8px;">
		<input bind:value={input} placeholder="Ask Claude…" style="flex:1" />
		<button>Send</button>
	</form>
</div>
