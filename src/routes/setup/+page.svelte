<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';

	let currentStep = $state(1);
	let loading = $state(false);
	let error = $state('');
	let setupData = $state({
		username: '',
		email: '',
		oauth: {
			github: { enabled: false, clientId: '', clientSecret: '' },
			google: { enabled: false, clientId: '', clientSecret: '' }
		},
		sshKeys: []
	});
	let newSSHKey = $state({ name: '', publicKey: '' });

	onMount(async () => {
		// Check if setup is needed
		try {
			const response = await fetch('/api/auth/setup');
			const data = await response.json();
			
			if (!data.isFirstUser) {
				// Setup already completed, redirect to login
				goto('/');
				return;
			}
		} catch (err) {
			error = 'Failed to check setup status';
		}
	});

	function nextStep() {
		if (currentStep < 4) {
			currentStep++;
		}
	}

	function prevStep() {
		if (currentStep > 1) {
			currentStep--;
		}
	}

	function addSSHKey() {
		if (newSSHKey.publicKey.trim()) {
			setupData.sshKeys.push({
				name: newSSHKey.name || `Key ${setupData.sshKeys.length + 1}`,
				publicKey: newSSHKey.publicKey.trim()
			});
			newSSHKey = { name: '', publicKey: '' };
		}
	}

	function removeSSHKey(index) {
		setupData.sshKeys.splice(index, 1);
	}

	async function completeSetup() {
		loading = true;
		error = '';

		try {
			const payload = {
				username: setupData.username,
				email: setupData.email,
				oauth: {},
				sshKeys: setupData.sshKeys
			};

			// Include OAuth config if enabled
			if (setupData.oauth.github.enabled && setupData.oauth.github.clientId) {
				payload.oauth.github = {
					clientId: setupData.oauth.github.clientId,
					clientSecret: setupData.oauth.github.clientSecret
				};
			}

			if (setupData.oauth.google.enabled && setupData.oauth.google.clientId) {
				payload.oauth.google = {
					clientId: setupData.oauth.google.clientId,
					clientSecret: setupData.oauth.google.clientSecret
				};
			}

			const response = await fetch('/api/auth/setup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (response.ok) {
				goto('/');
			} else {
				const data = await response.json();
				error = data.error || 'Setup failed';
			}
		} catch (err) {
			error = 'Setup failed';
		} finally {
			loading = false;
		}
	}

	function isValidEmail(email) {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	function isValidSSHKey(key) {
		return /^(ssh-rsa|ssh-ed25519|ecdsa-sha2-|ssh-dss)\s+[A-Za-z0-9+\/=]+/.test(key.trim());
	}

	const canProceedStep1 = $derived(setupData.username.trim() && setupData.email.trim() && isValidEmail(setupData.email));
	const canComplete = $derived(canProceedStep1);
</script>

<svelte:head>
	<title>Setup - dispatch</title>
</svelte:head>

<main class="setup-container">
	<div class="container">
		<div class="setup-content">
			<h1 class="glow">dispatch setup</h1>
			<p>Configure authentication for your dispatch instance</p>

			<div class="card aug setup-wizard" data-augmented-ui="tl-clip br-clip both">
				<!-- Step Progress -->
				<div class="step-progress">
					{#each Array(4) as _, i}
						<div class="step-indicator" class:active={currentStep >= i + 1}>
							{i + 1}
						</div>
						{#if i < 3}
							<div class="step-line" class:active={currentStep > i + 1}></div>
						{/if}
					{/each}
				</div>

				{#if error}
					<ErrorDisplay {error} />
				{/if}

				<!-- Step 1: Admin User -->
				{#if currentStep === 1}
					<div class="setup-step">
						<h3>Create Admin User</h3>
						<p>Set up the first administrative user for this dispatch instance.</p>
						
						<div class="form-group">
							<label>Username</label>
							<Input 
								bind:value={setupData.username} 
								placeholder="admin" 
								required 
							/>
						</div>

						<div class="form-group">
							<label>Email</label>
							<Input 
								bind:value={setupData.email} 
								type="email" 
								placeholder="admin@example.com" 
								required 
							/>
						</div>

						<div class="step-actions">
							<Button onclick={nextStep} disabled={!canProceedStep1}>Next</Button>
						</div>
					</div>
				{/if}

				<!-- Step 2: OAuth Configuration -->
				{#if currentStep === 2}
					<div class="setup-step">
						<h3>OAuth Providers (Optional)</h3>
						<p>Configure OAuth authentication with GitHub and Google.</p>

						<div class="oauth-section">
							<div class="oauth-provider">
								<label class="checkbox-label">
									<input type="checkbox" bind:checked={setupData.oauth.github.enabled} />
									Enable GitHub OAuth
								</label>
								
								{#if setupData.oauth.github.enabled}
									<div class="oauth-config">
										<div class="form-group">
											<label>GitHub Client ID</label>
											<Input 
												bind:value={setupData.oauth.github.clientId} 
												placeholder="Your GitHub OAuth App Client ID"
											/>
										</div>
										<div class="form-group">
											<label>GitHub Client Secret</label>
											<Input 
												bind:value={setupData.oauth.github.clientSecret} 
												type="password"
												placeholder="Your GitHub OAuth App Client Secret"
											/>
										</div>
									</div>
								{/if}
							</div>

							<div class="oauth-provider">
								<label class="checkbox-label">
									<input type="checkbox" bind:checked={setupData.oauth.google.enabled} />
									Enable Google OAuth
								</label>
								
								{#if setupData.oauth.google.enabled}
									<div class="oauth-config">
										<div class="form-group">
											<label>Google Client ID</label>
											<Input 
												bind:value={setupData.oauth.google.clientId} 
												placeholder="Your Google OAuth Client ID"
											/>
										</div>
										<div class="form-group">
											<label>Google Client Secret</label>
											<Input 
												bind:value={setupData.oauth.google.clientSecret} 
												type="password"
												placeholder="Your Google OAuth Client Secret"
											/>
										</div>
									</div>
								{/if}
							</div>
						</div>

						<div class="step-actions">
							<Button onclick={prevStep} variant="ghost">Back</Button>
							<Button onclick={nextStep}>Next</Button>
						</div>
					</div>
				{/if}

				<!-- Step 3: SSH Keys -->
				{#if currentStep === 3}
					<div class="setup-step">
						<h3>SSH Keys (Optional)</h3>
						<p>Add SSH public keys for key-based authentication.</p>

						<div class="ssh-section">
							<div class="add-ssh-key">
								<div class="form-group">
									<label>Key Name</label>
									<Input 
										bind:value={newSSHKey.name} 
										placeholder="My SSH Key"
									/>
								</div>

								<div class="form-group">
									<label>Public Key</label>
									<textarea 
										bind:value={newSSHKey.publicKey}
										placeholder="ssh-rsa AAAAB3NzaC1yc2E... or ssh-ed25519 AAAAC3N..."
										rows="3"
									></textarea>
								</div>

								<Button 
									onclick={addSSHKey} 
									disabled={!newSSHKey.publicKey.trim() || !isValidSSHKey(newSSHKey.publicKey)}
									size="small"
								>
									Add SSH Key
								</Button>
							</div>

							{#if setupData.sshKeys.length > 0}
								<div class="ssh-keys-list">
									<h4>Added SSH Keys</h4>
									{#each setupData.sshKeys as key, index}
										<div class="ssh-key-item">
											<div class="key-info">
												<strong>{key.name}</strong>
												<code>{key.publicKey.substring(0, 50)}...</code>
											</div>
											<Button 
												onclick={() => removeSSHKey(index)}
												variant="ghost"
												size="small"
											>
												Remove
											</Button>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<div class="step-actions">
							<Button onclick={prevStep} variant="ghost">Back</Button>
							<Button onclick={nextStep}>Next</Button>
						</div>
					</div>
				{/if}

				<!-- Step 4: Review and Complete -->
				{#if currentStep === 4}
					<div class="setup-step">
						<h3>Review Configuration</h3>
						<p>Review your configuration and complete the setup.</p>

						<div class="review-section">
							<div class="review-item">
								<h4>Admin User</h4>
								<p><strong>Username:</strong> {setupData.username}</p>
								<p><strong>Email:</strong> {setupData.email}</p>
							</div>

							<div class="review-item">
								<h4>OAuth Providers</h4>
								<p><strong>GitHub:</strong> {setupData.oauth.github.enabled ? 'Enabled' : 'Disabled'}</p>
								<p><strong>Google:</strong> {setupData.oauth.google.enabled ? 'Enabled' : 'Disabled'}</p>
							</div>

							<div class="review-item">
								<h4>SSH Keys</h4>
								<p>{setupData.sshKeys.length} SSH key(s) configured</p>
							</div>
						</div>

						<div class="step-actions">
							<Button onclick={prevStep} variant="ghost">Back</Button>
							<Button 
								onclick={completeSetup} 
								disabled={!canComplete || loading}
								{loading}
							>
								Complete Setup
							</Button>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
</main>

<style>
	.setup-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-background);
		padding: 2rem;
	}

	.container {
		width: 100%;
		max-width: 600px;
	}

	.setup-content {
		text-align: center;
	}

	.setup-content h1 {
		font-size: 3rem;
		margin-bottom: 0.5rem;
		color: var(--primary);
	}

	.setup-content p {
		color: var(--text-muted);
		margin-bottom: 2rem;
	}

	.setup-wizard {
		background: var(--surface-elevated);
		border: 1px solid var(--surface-border);
		padding: 2rem;
		text-align: left;
	}

	.step-progress {
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 2rem;
		gap: 0.5rem;
	}

	.step-indicator {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--surface-border);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		color: var(--text-muted);
		transition: all 0.2s;
	}

	.step-indicator.active {
		background: var(--primary);
		color: white;
	}

	.step-line {
		width: 2rem;
		height: 2px;
		background: var(--surface-border);
		transition: all 0.2s;
	}

	.step-line.active {
		background: var(--primary);
	}

	.setup-step h3 {
		margin-bottom: 0.5rem;
		color: var(--text);
	}

	.setup-step > p {
		color: var(--text-muted);
		margin-bottom: 1.5rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: var(--text);
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 1rem;
		cursor: pointer;
	}

	.oauth-section {
		margin-bottom: 1.5rem;
	}

	.oauth-provider {
		margin-bottom: 1.5rem;
		padding: 1rem;
		border: 1px solid var(--surface-border);
		border-radius: 0.5rem;
	}

	.oauth-config {
		margin-top: 1rem;
		padding-left: 1.5rem;
	}

	textarea {
		width: 100%;
		min-height: 80px;
		padding: 0.75rem;
		border: 1px solid var(--surface-border);
		border-radius: 0.375rem;
		background: var(--surface);
		color: var(--text);
		font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
		font-size: 0.875rem;
		resize: vertical;
	}

	.ssh-keys-list {
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--surface-border);
	}

	.ssh-key-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem;
		border: 1px solid var(--surface-border);
		border-radius: 0.375rem;
		margin-bottom: 0.5rem;
	}

	.key-info code {
		display: block;
		font-size: 0.75rem;
		color: var(--text-muted);
		margin-top: 0.25rem;
	}

	.review-section {
		margin-bottom: 1.5rem;
	}

	.review-item {
		padding: 1rem;
		border: 1px solid var(--surface-border);
		border-radius: 0.375rem;
		margin-bottom: 1rem;
	}

	.review-item h4 {
		margin-bottom: 0.5rem;
		color: var(--text);
	}

	.review-item p {
		margin: 0.25rem 0;
		color: var(--text-muted);
	}

	.step-actions {
		display: flex;
		justify-content: space-between;
		gap: 1rem;
		margin-top: 2rem;
	}

	.glow {
		text-shadow: 0 0 20px var(--primary-alpha);
	}
</style>