<script>
	import { goto } from '$app/navigation';
	import { io } from 'socket.io-client';
	import Container from '$lib/shared/components/Container.svelte';
	import PublicUrlDisplay from '$lib/shared/components/PublicUrlDisplay.svelte';
	import { onMount } from 'svelte';
	let key = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(() => {
		// Check if already authenticated
		const storedAuth = localStorage.getItem('dispatch-auth-token');
		if (storedAuth && storedAuth !== 'no-auth') {
			// Test if stored auth still works
			const socket = io({ transports: ['websocket', 'polling'] });
			socket.emit('auth', storedAuth, (resp) => {
				if (resp?.success === true) {
					goto('/projects');
				} else {
					// Stored auth is invalid, clear it
					localStorage.removeItem('dispatch-auth-token');
				}
				socket.disconnect();
			});
			return;
		} else if (storedAuth === 'no-auth') {
			// Legacy no-auth token, need to check current server state
			localStorage.removeItem('dispatch-auth-token');
		}

		// Check if auth is required by testing with the default dev key
		const testKey = 'testkey12345'; // Default dev key from CLAUDE.md
		const socket = io({ transports: ['websocket', 'polling'] });
		socket.emit('auth', testKey, (resp) => {
			if (resp?.success === true) {
				// Dev mode with default key, auto-authenticate
				localStorage.setItem('dispatch-auth-token', testKey);
				goto('/projects');
			}
			// Otherwise show the login form
			socket.disconnect();
		});
	});

	async function handleLogin(e) {
		e.preventDefault();
		loading = true;
		error = '';
		const socket = io({ transports: ['websocket', 'polling'] });
		socket.emit('auth', key, (resp) => {
			loading = false;
			if (resp?.success === true) {
				localStorage.setItem('dispatch-auth-token', key);
				goto('/projects');
			} else {
				error = resp.error || 'Invalid key';
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
					<input
						type="password"
						placeholder="terminal key"
						bind:value={key}
						required
						autocomplete="off"
						disabled={loading}
					/>
					<button
						type="submit"
						disabled={loading}
						data-augmented-ui="br-clip bl-clip tl-clip tr-clip border"
					>
						{loading ? 'connecting...' : 'connect'}
					</button>
				</form>
			</div>

			<PublicUrlDisplay />
			{#if error}
				<div class="error">{error}</div>
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
		display: flex;
		justify-content: center;
		--aug-border-bg: var(--primary-muted);
		transition: all 0.3s ease;

		&:hover {
			--aug-border-bg: var(--secondary);
			box-shadow:
				0 0 125px rgba(0, 255, 136, 0.15),
				0 0 50px rgba(0, 255, 136, 0.05),
				inset 0 1px 0 rgba(255, 255, 255, 0.08);
		}

		button {
			--aug-border-bg: var(--primary-muted);
			border: none;
			cursor: pointer;
			transition:
				all 0.3s ease,
				--aug-border-bg 0.3s ease,
				box-shadow 0.3s ease,
				text-shadow 0.3s ease;
			box-shadow:
				0 0 0px rgba(0, 255, 136, 0),
				0 0 0px rgba(0, 255, 136, 0),
				inset 0 1px 0 rgba(255, 255, 255, 0);

			&:hover {
				--aug-border-bg: var(--primary);
				text-shadow:
					0 0 15px var(--primary),
					0 0 30px var(--primary);
				box-shadow:
					0 0 20px rgba(0, 255, 136, 0.4),
					0 0 40px rgba(0, 255, 136, 0.15),
					inset 0 1px 0 rgba(255, 255, 255, 0.15);
			}
		}

		input {
			transition:
				all 0.3s ease,
				border-color 0.3s ease,
				box-shadow 0.3s ease;
			box-shadow:
				0 0 0px rgba(0, 255, 136, 0),
				0 0 0px rgba(0, 255, 136, 0);

			&:hover {
				border-color: rgba(0, 255, 136, 0.6);
				box-shadow:
					0 0 12px rgba(0, 255, 136, 0.15),
					0 0 24px rgba(0, 255, 136, 0.05);
			}
		}
	}
</style>
