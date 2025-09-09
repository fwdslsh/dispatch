<script>
	import { goto } from '$app/navigation';
	import { io } from 'socket.io-client';
	import { Container, PublicUrlDisplay, Button, Input, ErrorDisplay } from '$lib/shared/components';
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
	<Container>
		{#snippet children()}
			<h1>dispatch</h1>
			<p>terminal access via web</p>

			<div class="form-container" data-augmented-ui="br-clip bl-clip tl-clip tr-clip border">
				<form onsubmit={handleLogin}>
					<Input
						bind:value={key}
						type="password"
						placeholder="terminal key"
						required
						disabled={loading}
						autocomplete="off"
						size="large"
					/>
					<Button
						type="submit"
						disabled={loading}
						{loading}
						text={loading ? 'connecting...' : 'connect'}
						variant="primary"
						size="large"
						augmented="br-clip bl-clip tl-clip tr-clip"
					/>
				</form>
			</div>

			<PublicUrlDisplay />
			{#if error}
				<ErrorDisplay {error} />
			{/if}
		{/snippet}
	</Container>
</main>

<style>
	@property --aug-border-bg {
		syntax: '<color>';
		inherits: false;
		initial-value: rgba(0, 255, 136, 0.314);
	}

	:global(.login-page .container-content) {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		h1,
		p {
			text-align: center;
			margin-bottom: 0;
		}
	}
	@media (max-width: 800px) {
		.login-page :global(.container) {
			display: flex;
			flex-direction: column;
			justify-content: center;
			padding-inline: var(--space-lg);

			h1 {
				font-size: 5rem;
			}
		}
	}
	.form-container {
		margin-top: var(--space-lg);
		--aug-border-bg: var(--primary-muted);
		transition: all 0.3s ease;
		padding: var(--space-lg);

		&:hover {
			--aug-border-bg: var(--secondary);
			box-shadow:
				0 0 125px rgba(0, 255, 136, 0.15),
				0 0 50px rgba(0, 255, 136, 0.05),
				inset 0 1px 0 rgba(255, 255, 255, 0.08);
		}

		form {
			display: flex;
			flex-direction: column;
			gap: var(--space-md);
			align-items: center;
			min-width: 300px;
		}
	}
</style>
