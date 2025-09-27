<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';

	let step = $state(1);
	let loading = $state(false);
	let error = $state('');

	// Step 1: Admin creation
	let adminData = $state({
		email: '',
		displayName: '',
		password: '',
		confirmPassword: ''
	});

	// Step 2: Auth methods
	let authMethods = $state({
		local: true,
		webauthn: false,
		oauth_google: false,
		oauth_github: false
	});

	// Step 3: Security settings
	let securitySettings = $state({
		sessionTimeout: 24,
		requireDeviceTrust: false,
		enforceStrongPasswords: true
	});

	onMount(async () => {
		// Check if setup is already complete
		try {
			const response = await fetch('/api/admin/setup/complete');
			const data = await response.json();
			if (data.setupComplete) {
				goto('/');
				return;
			}
		} catch (err) {
			// Setup not complete, continue
		}
	});

	async function handleCreateAdmin() {
		if (adminData.password !== adminData.confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (adminData.password.length < 12) {
			error = 'Password must be at least 12 characters';
			return;
		}

		loading = true;
		error = '';

		try {
			const response = await fetch('/api/admin/setup/create-admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					adminUser: {
						email: adminData.email,
						displayName: adminData.displayName,
						password: adminData.password
					},
					terminalKey: process.env.TERMINAL_KEY || 'testkey12345'
				})
			});

			if (response.ok) {
				step = 2;
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to create admin user';
			}
		} catch (err) {
			error = 'Failed to create admin user';
		} finally {
			loading = false;
		}
	}

	async function handleConfigureAuth() {
		loading = true;
		error = '';

		try {
			const response = await fetch('/api/admin/setup/auth-methods', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ authMethods })
			});

			if (response.ok) {
				step = 3;
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to configure authentication';
			}
		} catch (err) {
			error = 'Failed to configure authentication';
		} finally {
			loading = false;
		}
	}

	async function handleCompleteSetup() {
		loading = true;
		error = '';

		try {
			const response = await fetch('/api/admin/setup/complete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ securitySettings })
			});

			if (response.ok) {
				goto('/admin');
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to complete setup';
			}
		} catch (err) {
			error = 'Failed to complete setup';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Setup - dispatch</title>
</svelte:head>

<main class="setup-container">
	<div class="setup-content">
		<h1>dispatch Setup</h1>
		<div class="setup-progress">
			<div class="step {step >= 1 ? 'active' : ''} {step > 1 ? 'completed' : ''}">1</div>
			<div class="step {step >= 2 ? 'active' : ''} {step > 2 ? 'completed' : ''}">2</div>
			<div class="step {step >= 3 ? 'active' : ''} {step > 3 ? 'completed' : ''}">3</div>
		</div>

		{#if step === 1}
			<section class="setup-step">
				<h2>Create Administrator Account</h2>
				<p>Set up the primary administrator account for your dispatch instance.</p>

				<form onsubmit={(e) => { e.preventDefault(); handleCreateAdmin(); }}>
					<Input
						bind:value={adminData.email}
						type="email"
						placeholder="Administrator email"
						required
						disabled={loading}
					/>
					<Input
						bind:value={adminData.displayName}
						type="text"
						placeholder="Display name"
						required
						disabled={loading}
					/>
					<Input
						bind:value={adminData.password}
						type="password"
						placeholder="Password (min 12 characters)"
						required
						disabled={loading}
					/>
					<Input
						bind:value={adminData.confirmPassword}
						type="password"
						placeholder="Confirm password"
						required
						disabled={loading}
					/>
					<Button type="submit" disabled={loading} class="primary">
						{loading ? 'Creating...' : 'Create Administrator'}
					</Button>
				</form>
			</section>
		{:else if step === 2}
			<section class="setup-step">
				<h2>Configure Authentication Methods</h2>
				<p>Choose which authentication methods to enable for your users.</p>

				<div class="auth-options">
					<label>
						<input type="checkbox" bind:checked={authMethods.local} />
						Local Authentication (Email/Password)
					</label>
					<label>
						<input type="checkbox" bind:checked={authMethods.webauthn} />
						WebAuthn / Passkeys
					</label>
					<label>
						<input type="checkbox" bind:checked={authMethods.oauth_google} />
						Google OAuth
					</label>
					<label>
						<input type="checkbox" bind:checked={authMethods.oauth_github} />
						GitHub OAuth
					</label>
				</div>

				<Button onclick={handleConfigureAuth} disabled={loading} class="primary">
					{loading ? 'Configuring...' : 'Configure Authentication'}
				</Button>
			</section>
		{:else if step === 3}
			<section class="setup-step">
				<h2>Security Settings</h2>
				<p>Configure security policies for your dispatch instance.</p>

				<div class="security-options">
					<label>
						Session timeout (hours):
						<Input
							bind:value={securitySettings.sessionTimeout}
							type="number"
							min="1"
							max="168"
							disabled={loading}
						/>
					</label>
					<label>
						<input type="checkbox" bind:checked={securitySettings.requireDeviceTrust} />
						Require device trust for sensitive operations
					</label>
					<label>
						<input type="checkbox" bind:checked={securitySettings.enforceStrongPasswords} />
						Enforce strong passwords
					</label>
				</div>

				<Button onclick={handleCompleteSetup} disabled={loading} class="primary">
					{loading ? 'Completing...' : 'Complete Setup'}
				</Button>
			</section>
		{/if}

		{#if error}
			<div class="error">{error}</div>
		{/if}
	</div>
</main>

<style>
	.setup-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--space-4);
		background: var(--bg);
	}

	.setup-content {
		width: 100%;
		max-width: 500px;
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		padding: var(--space-8);
	}

	.setup-content h1 {
		text-align: center;
		margin: 0 0 var(--space-6) 0;
		color: var(--primary);
		font-size: var(--font-size-5);
	}

	.setup-progress {
		display: flex;
		justify-content: center;
		gap: var(--space-4);
		margin-bottom: var(--space-8);
	}

	.step {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--surface-raised);
		border: 2px solid var(--surface-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		color: var(--muted);
	}

	.step.active {
		border-color: var(--primary);
		color: var(--primary);
	}

	.step.completed {
		background: var(--primary);
		border-color: var(--primary);
		color: white;
	}

	.setup-step h2 {
		margin: 0 0 var(--space-2) 0;
		color: var(--text);
	}

	.setup-step p {
		margin: 0 0 var(--space-6) 0;
		color: var(--muted);
	}

	form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}

	.auth-options, .security-options {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}

	.auth-options label, .security-options label {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		color: var(--text);
	}

	.error {
		margin-top: var(--space-4);
		padding: var(--space-3);
		background: var(--destructive-subtle);
		border: 1px solid var(--destructive);
		border-radius: 4px;
		color: var(--destructive);
		text-align: center;
	}
</style>