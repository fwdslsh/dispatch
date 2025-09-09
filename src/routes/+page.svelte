<script>
	import { goto } from '$app/navigation';
	import { io } from 'socket.io-client';
	import { PublicUrlDisplay, ErrorDisplay } from '$lib/shared/components';
	import { onMount } from 'svelte';
	let key = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(() => {
		// Check if already authenticated
		const storedKey = localStorage.getItem('dispatch-auth-key');
		if (storedKey) {
			// Test if stored key works by attempting a simple Socket.IO connection
			const socket = io({ transports: ['websocket', 'polling'] });
			socket.emit('terminal.start', { key: storedKey, workspacePath: '/tmp' }, (resp) => {
				if (resp?.success !== false || resp?.error !== 'Invalid key') {
					// Key works (or at least isn't rejected for auth reasons)
					goto('/projects');
				} else {
					// Key is invalid, clear it
					localStorage.removeItem('dispatch-auth-key');
				}
				socket.disconnect();
			});
			return;
		}
	});

	async function handleLogin(e) {
		e.preventDefault();
		loading = true;
		error = '';
		const socket = io({ transports: ['websocket', 'polling'] });
		socket.emit('terminal.start', { key, workspacePath: '/tmp' }, (resp) => {
			loading = false;
			if (resp?.success !== false || resp?.error !== 'Invalid key') {
				localStorage.setItem('dispatch-auth-key', key);
				goto('/projects');
			} else {
				error = 'Invalid key';
			}
			socket.disconnect();
		});
	}
</script>

<svelte:head>
	<title>dispatch - Terminal Access</title>
</svelte:head>

<main class="login-page">
	<div class="container">
		<div class="login-content">
			<h1 class="glow">dispatch</h1>
			<p>terminal access via web</p>

			<div class="card aug" data-augmented-ui="tl-clip br-clip both">
				<form onsubmit={handleLogin}>
					<input
						bind:value={key}
						type="password"
						placeholder="terminal key"
						required
						disabled={loading}
						autocomplete="off"
					/>
					<button
						class="button primary aug"
						type="submit"
						disabled={loading}
						data-augmented-ui="l-clip r-clip both"
					>
						{loading ? 'connecting...' : 'connect'}
					</button>
				</form>
			</div>

			<PublicUrlDisplay />
			{#if error}
				<ErrorDisplay {error} />
			{/if}
		</div>
	</div>
</main>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
	}

	.login-content {
		text-align: center;
	}

	.login-content > * + * {
		margin-top: var(--space-5);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		align-items: center;
		min-width: 300px;
	}
</style>
