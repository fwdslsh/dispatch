<script>
	import { goto } from '$app/navigation';
	import { io } from 'socket.io-client';
	import { PublicUrlDisplay, ErrorDisplay } from '$lib/client/shared/components';
	import { onMount } from 'svelte';
	let key = $state('');
	let error = $state('');
	let loading = $state(false);

	onMount(async () => {
		// Check if already authenticated via HTTP (more robust than socket for login)
		const storedKey = localStorage.getItem('dispatch-auth-key');
		if (storedKey) {
			try {
				const r = await fetch(`/api/auth/check?key=${encodeURIComponent(storedKey)}`);
				if (r.ok) {
					goto('/workspace');
				} else {
					localStorage.removeItem('dispatch-auth-key');
				}
			} catch {
				// Ignore; user can try manual login
			}
			return;
		}
	});

	async function handleLogin(e) {
		e.preventDefault();
		loading = true;
		error = '';
		try {
			const r = await fetch('/api/auth/check', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ key })
			});
			loading = false;
			if (r.ok) {
				localStorage.setItem('dispatch-auth-key', key);
				goto('/workspace');
			} else {
				const j = await r.json().catch(() => ({}));
				error = j?.error || 'Invalid key';
			}
		} catch {
			loading = false;
			error = 'Unable to reach server';
		}
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
