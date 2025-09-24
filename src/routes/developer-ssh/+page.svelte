<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Button from '$lib/client/shared/components/Button.svelte';
	import Input from '$lib/client/shared/components/Input.svelte';
	import LoadingSpinner from '$lib/client/shared/components/LoadingSpinner.svelte';
	import ErrorDisplay from '$lib/client/shared/components/ErrorDisplay.svelte';

	let user = $state(null);
	let loading = $state(true);
	let error = $state('');
	let sshKeys = $state([]);
	let generatingKey = $state(false);
	let newKeyName = $state('');
	let showAddKey = $state(false);

	onMount(async () => {
		// Check authentication
		try {
			const authResponse = await fetch('/api/auth/check');
			if (!authResponse.ok) {
				goto('/');
				return;
			}
			const authData = await authResponse.json();
			user = authData.user;

			// Load SSH keys
			await loadSSHKeys();
		} catch (err) {
			console.error('Auth check failed:', err);
			goto('/');
		} finally {
			loading = false;
		}
	});

	async function loadSSHKeys() {
		try {
			const response = await fetch('/api/auth/ssh-keys');
			if (response.ok) {
				const data = await response.json();
				sshKeys = data.keys || [];
			}
		} catch (err) {
			console.error('Failed to load SSH keys:', err);
		}
	}

	async function generateSSHKey() {
		if (!newKeyName.trim()) {
			error = 'Please enter a name for the SSH key';
			return;
		}

		generatingKey = true;
		error = '';

		try {
			const response = await fetch('/api/auth/generate-ssh-key', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ keyName: newKeyName.trim() })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to generate SSH key');
			}

			// Download the ZIP file
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			a.download = `${newKeyName.trim()}-ssh-key.zip`;
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			document.body.removeChild(a);

			// Reset form and reload keys
			newKeyName = '';
			showAddKey = false;
			await loadSSHKeys();
		} catch (err) {
			error = err.message;
		} finally {
			generatingKey = false;
		}
	}

	async function deleteSSHKey(keyId) {
		if (!confirm('Are you sure you want to delete this SSH key? This action cannot be undone.')) {
			return;
		}

		try {
			const response = await fetch('/api/auth/ssh-keys', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ keyId })
			});

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Failed to delete SSH key');
			}

			await loadSSHKeys();
		} catch (err) {
			error = err.message;
		}
	}

	function formatDate(timestamp) {
		return new Date(timestamp).toLocaleDateString();
	}
</script>

<svelte:head>
	<title>Developer SSH Access - Dispatch</title>
</svelte:head>

<main class="developer-ssh-page">
	<div class="container">
		<header class="page-header">
			<h1>Developer SSH Access</h1>
			<p class="page-description">
				Generate and manage SSH keys for terminal access to your Dispatch server.
			</p>
		</header>

		{#if loading}
			<div class="loading-section">
				<LoadingSpinner />
				<p>Loading SSH keys...</p>
			</div>
		{:else}
			{#if error}
				<ErrorDisplay {error} />
			{/if}

			<section class="ssh-info">
				<div class="info-card">
					<h2>SSH Connection Information</h2>
					<div class="connection-details">
						<div class="detail-item">
							<label>Server:</label>
							<code>{window.location.hostname}</code>
						</div>
						<div class="detail-item">
							<label>Port:</label>
							<code>2222</code>
						</div>
						<div class="detail-item">
							<label>Username:</label>
							<code>{user?.username || 'user'}</code>
						</div>
					</div>
					<div class="connection-example">
						<h3>Example Connection Command:</h3>
						<code class="command">
							ssh -p 2222 -i /path/to/your/private/key {user?.username || 'user'}@{window.location.hostname}
						</code>
					</div>
				</div>
			</section>

			<section class="ssh-keys-section">
				<div class="section-header">
					<h2>Your SSH Keys</h2>
					<Button 
						onclick={() => showAddKey = true} 
						variant="primary"
						disabled={showAddKey}
					>
						Generate New Key
					</Button>
				</div>

				{#if showAddKey}
					<div class="add-key-form">
						<h3>Generate SSH Key Pair</h3>
						<p class="form-description">
							This will generate an Ed25519 SSH key pair. The public key will be added to the server,
							and you'll download a ZIP file containing both the private and public keys plus a README.
						</p>
						
						<div class="form-group">
							<label for="keyName">Key Name</label>
							<Input 
								id="keyName"
								bind:value={newKeyName}
								placeholder="e.g., my-laptop, work-desktop"
								disabled={generatingKey}
							/>
						</div>

						<div class="form-actions">
							<Button 
								onclick={() => { showAddKey = false; newKeyName = ''; error = ''; }}
								variant="ghost"
								disabled={generatingKey}
							>
								Cancel
							</Button>
							<Button 
								onclick={generateSSHKey}
								variant="primary"
								disabled={!newKeyName.trim() || generatingKey}
								loading={generatingKey}
							>
								Generate & Download Key
							</Button>
						</div>
					</div>
				{/if}

				<div class="keys-list">
					{#if sshKeys.length === 0}
						<div class="empty-state">
							<p>No SSH keys found. Generate your first key to get started.</p>
						</div>
					{:else}
						{#each sshKeys as key}
							<div class="key-item">
								<div class="key-info">
									<h4 class="key-name">{key.name}</h4>
									<div class="key-details">
										<span class="key-fingerprint">
											<strong>Fingerprint:</strong> {key.fingerprint}
										</span>
										<span class="key-date">
											<strong>Created:</strong> {formatDate(key.created_at)}
										</span>
									</div>
								</div>
								<div class="key-actions">
									<Button 
										onclick={() => deleteSSHKey(key.id)}
										variant="danger"
										size="small"
									>
										Delete
									</Button>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</section>

			<section class="help-section">
				<div class="help-card">
					<h2>Need Help?</h2>
					<div class="help-content">
						<div class="help-item">
							<h3>Setting up SSH</h3>
							<p>
								After downloading your SSH key, extract the ZIP file and save the private key 
								(usually named <code>id_ed25519</code>) in your <code>~/.ssh/</code> directory.
								Make sure to set the correct permissions: <code>chmod 600 ~/.ssh/id_ed25519</code>
							</p>
						</div>
						<div class="help-item">
							<h3>Connecting</h3>
							<p>
								Use the SSH command shown above, replacing <code>/path/to/your/private/key</code> 
								with the actual path to your private key file.
							</p>
						</div>
						<div class="help-item">
							<h3>Troubleshooting</h3>
							<p>
								If you can't connect, check that:
								- The SSH service is enabled on the server
								- You're using the correct port (2222)
								- Your private key has the correct permissions (600)
								- The key hasn't been deleted from the server
							</p>
						</div>
					</div>
				</div>
			</section>
		{/if}
	</div>
</main>

<style>
	.developer-ssh-page {
		min-height: 100vh;
		background: var(--background);
		color: var(--text);
		padding: 2rem 1rem;
	}

	.container {
		max-width: 1200px;
		margin: 0 auto;
	}

	.page-header {
		text-align: center;
		margin-bottom: 3rem;
	}

	.page-header h1 {
		color: var(--primary);
		font-size: 2.5rem;
		margin-bottom: 0.5rem;
	}

	.page-description {
		color: var(--text-muted);
		font-size: 1.1rem;
	}

	.loading-section {
		text-align: center;
		padding: 3rem;
	}

	.loading-section p {
		margin-top: 1rem;
		color: var(--text-muted);
	}

	.ssh-info, .ssh-keys-section, .help-section {
		margin-bottom: 3rem;
	}

	.info-card, .help-card {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		padding: 2rem;
	}

	.info-card h2, .help-card h2 {
		color: var(--primary);
		margin-bottom: 1.5rem;
	}

	.connection-details {
		display: grid;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.detail-item {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.detail-item label {
		font-weight: 600;
		min-width: 80px;
	}

	.detail-item code, .command {
		background: var(--surface-hover);
		padding: 0.5rem;
		border-radius: 4px;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.9rem;
	}

	.command {
		display: block;
		padding: 1rem;
		margin-top: 0.5rem;
		word-break: break-all;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	.section-header h2 {
		color: var(--primary);
		margin: 0;
	}

	.add-key-form {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		padding: 2rem;
		margin-bottom: 2rem;
	}

	.add-key-form h3 {
		color: var(--primary);
		margin-bottom: 1rem;
	}

	.form-description {
		color: var(--text-muted);
		margin-bottom: 2rem;
		line-height: 1.5;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 600;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
	}

	.keys-list {
		background: var(--surface);
		border: 1px solid var(--surface-border);
		border-radius: 8px;
		overflow: hidden;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: var(--text-muted);
	}

	.key-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid var(--surface-border);
	}

	.key-item:last-child {
		border-bottom: none;
	}

	.key-info {
		flex: 1;
	}

	.key-name {
		color: var(--primary);
		margin-bottom: 0.5rem;
		font-size: 1.1rem;
	}

	.key-details {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.9rem;
		color: var(--text-muted);
	}

	.key-fingerprint {
		font-family: 'Monaco', 'Menlo', monospace;
	}

	.help-content {
		display: grid;
		gap: 2rem;
	}

	.help-item h3 {
		color: var(--primary);
		margin-bottom: 0.5rem;
	}

	.help-item p {
		line-height: 1.6;
		color: var(--text-muted);
	}

	.help-item code {
		background: var(--surface-hover);
		padding: 0.2rem 0.4rem;
		border-radius: 3px;
		font-family: 'Monaco', 'Menlo', monospace;
		font-size: 0.9rem;
	}

	@media (max-width: 768px) {
		.section-header {
			flex-direction: column;
			gap: 1rem;
			align-items: stretch;
		}

		.form-actions {
			flex-direction: column;
		}

		.key-item {
			flex-direction: column;
			align-items: stretch;
			gap: 1rem;
		}

		.key-actions {
			align-self: flex-end;
		}

		.connection-details {
			font-size: 0.9rem;
		}

		.command {
			font-size: 0.8rem;
		}
	}
</style>