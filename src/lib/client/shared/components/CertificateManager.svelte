<script>
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import ConfirmationDialog from './ConfirmationDialog.svelte';

	const dispatch = createEventDispatcher();

	let certificates = [];
	let health = null;
	let loading = true;
	let error = null;
	let showUpload = false;
	let showLetsEncrypt = false;
	let showConfirmDelete = false;
	let certificateToDelete = null;

	// Upload form data
	let uploadForm = {
		name: '',
		domains: '',
		certificate: '',
		privateKey: ''
	};

	// Let's Encrypt form data
	let letsEncryptForm = {
		domain: '',
		email: ''
	};

	onMount(async () => {
		await loadCertificates();
		await loadHealth();
		loading = false;
	});

	async function loadCertificates() {
		try {
			const response = await fetch('/api/security/certificates');
			const data = await response.json();

			if (data.success) {
				certificates = data.certificates;
			} else {
				error = data.error || 'Failed to load certificates';
			}
		} catch (err) {
			error = err.message;
		}
	}

	async function loadHealth() {
		try {
			const response = await fetch('/api/security/certificates?action=health');
			const data = await response.json();

			if (data.success) {
				health = data.health;
			}
		} catch (err) {
			console.warn('Failed to load certificate health:', err.message);
		}
	}

	async function uploadMkcertCertificate() {
		try {
			const domains = uploadForm.domains
				.split(',')
				.map((d) => d.trim())
				.filter((d) => d);

			const response = await fetch('/api/security/certificates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'upload-mkcert',
					name: uploadForm.name,
					domains,
					certificate: uploadForm.certificate,
					privateKey: uploadForm.privateKey
				})
			});

			const data = await response.json();

			if (data.success) {
				dispatch('success', { message: 'mkcert certificate uploaded successfully' });
				showUpload = false;
				resetUploadForm();
				await loadCertificates();
				await loadHealth();
			} else {
				dispatch('error', { error: data.error || 'Failed to upload certificate' });
			}
		} catch (err) {
			dispatch('error', { error: err.message });
		}
	}

	async function provisionLetsEncrypt() {
		try {
			const response = await fetch('/api/security/certificates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'provision-letsencrypt',
					domain: letsEncryptForm.domain,
					email: letsEncryptForm.email
				})
			});

			const data = await response.json();

			if (data.success) {
				dispatch('success', { message: "Let's Encrypt certificate provisioned successfully" });
				showLetsEncrypt = false;
				resetLetsEncryptForm();
				await loadCertificates();
				await loadHealth();
			} else {
				dispatch('error', { error: data.error || 'Failed to provision certificate' });
			}
		} catch (err) {
			dispatch('error', { error: err.message });
		}
	}

	async function renewCertificate(certificateId) {
		try {
			const response = await fetch('/api/security/certificates', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'renew',
					certificateId
				})
			});

			const data = await response.json();

			if (data.success) {
				dispatch('success', { message: 'Certificate renewed successfully' });
				await loadCertificates();
				await loadHealth();
			} else {
				dispatch('error', { error: data.error || 'Failed to renew certificate' });
			}
		} catch (err) {
			dispatch('error', { error: err.message });
		}
	}

	function confirmDelete(certificate) {
		certificateToDelete = certificate;
		showConfirmDelete = true;
	}

	async function deleteCertificate() {
		if (!certificateToDelete) return;

		try {
			const response = await fetch('/api/security/certificates', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					certificateId: certificateToDelete.id
				})
			});

			const data = await response.json();

			if (data.success) {
				dispatch('success', { message: 'Certificate deleted successfully' });
				await loadCertificates();
				await loadHealth();
			} else {
				dispatch('error', { error: data.error || 'Failed to delete certificate' });
			}
		} catch (err) {
			dispatch('error', { error: err.message });
		} finally {
			showConfirmDelete = false;
			certificateToDelete = null;
		}
	}

	function resetUploadForm() {
		uploadForm = {
			name: '',
			domains: '',
			certificate: '',
			privateKey: ''
		};
	}

	function resetLetsEncryptForm() {
		letsEncryptForm = {
			domain: '',
			email: ''
		};
	}

	function formatDate(date) {
		return new Date(date).toLocaleDateString();
	}

	function getCertificateStatusColor(cert) {
		if (cert.isExpired) return '#f87171';
		if (cert.daysUntilExpiry <= 7) return '#fbbf24';
		if (cert.daysUntilExpiry <= 30) return '#fb923c';
		return '#4ade80';
	}

	function getCertificateTypeIcon(type) {
		switch (type) {
			case 'letsencrypt':
				return '🔐';
			case 'mkcert':
				return '🛠️';
			case 'self-signed':
				return '📝';
			default:
				return '📄';
		}
	}
</script>

<div class="certificate-manager">
	<div class="header">
		<h3>Certificate Management</h3>
		{#if health}
			<div class="health-summary">
				<span class="health-stat">
					<span class="count">{health.healthy}</span>
					<span class="label">Healthy</span>
				</span>
				<span class="health-stat warning">
					<span class="count">{health.expiring}</span>
					<span class="label">Expiring</span>
				</span>
				<span class="health-stat error">
					<span class="count">{health.expired}</span>
					<span class="label">Expired</span>
				</span>
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="loading">
			<LoadingSpinner />
			<p>Loading certificates...</p>
		</div>
	{:else if error}
		<div class="error">
			<p>Error: {error}</p>
			<Button
				variant="secondary"
				on:click={() => {
					loadCertificates();
					loadHealth();
				}}
			>
				Retry
			</Button>
		</div>
	{:else}
		<div class="certificates-section">
			<!-- Action Buttons -->
			<div class="actions">
				<Button variant="primary" on:click={() => (showUpload = true)}>
					Upload mkcert Certificate
				</Button>
				<Button variant="secondary" on:click={() => (showLetsEncrypt = true)}>
					Provision Let's Encrypt
				</Button>
				<Button
					variant="secondary"
					on:click={() => {
						loadCertificates();
						loadHealth();
					}}
				>
					Refresh
				</Button>
			</div>

			<!-- Certificates List -->
			{#if certificates.length === 0}
				<div class="no-certificates">
					<p>No certificates found</p>
					<p>Upload an mkcert certificate or provision one from Let's Encrypt to get started.</p>
				</div>
			{:else}
				<div class="certificates-list">
					{#each certificates as cert}
						<div class="certificate-card" class:expired={cert.isExpired}>
							<div class="cert-header">
								<div class="cert-icon">
									{getCertificateTypeIcon(cert.type)}
								</div>
								<div class="cert-info">
									<div class="cert-domain">{cert.domain}</div>
									<div class="cert-type">{cert.type}</div>
								</div>
								<div class="cert-status" style="color: {getCertificateStatusColor(cert)}">
									{#if cert.isExpired}
										Expired
									{:else if cert.daysUntilExpiry <= 0}
										Expires Today
									{:else}
										{cert.daysUntilExpiry} days left
									{/if}
								</div>
							</div>

							<div class="cert-details">
								<div class="detail-row">
									<span class="label">Expires:</span>
									<span class="value">{formatDate(cert.expiresAt)}</span>
								</div>
								<div class="detail-row">
									<span class="label">Auto-Renew:</span>
									<span class="value {cert.autoRenew ? 'enabled' : 'disabled'}">
										{cert.autoRenew ? '✓ Yes' : '✗ No'}
									</span>
								</div>
								<div class="detail-row">
									<span class="label">Status:</span>
									<span class="value {cert.isActive ? 'active' : 'inactive'}">
										{cert.isActive ? 'Active' : 'Inactive'}
									</span>
								</div>
							</div>

							<div class="cert-actions">
								{#if cert.type === 'letsencrypt' && (cert.daysUntilExpiry <= 30 || cert.isExpired)}
									<Button variant="primary" size="sm" on:click={() => renewCertificate(cert.id)}>
										Renew
									</Button>
								{/if}
								<Button variant="danger" size="sm" on:click={() => confirmDelete(cert)}>
									Delete
								</Button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Upload mkcert Certificate Modal -->
{#if showUpload}
	<div class="modal-overlay" on:click={() => (showUpload = false)}>
		<div class="modal" on:click|stopPropagation>
			<div class="modal-header">
				<h4>Upload mkcert Certificate</h4>
				<button class="close-btn" on:click={() => (showUpload = false)}>×</button>
			</div>

			<div class="modal-body">
				<div class="form-group">
					<label for="cert-name">Certificate Name:</label>
					<input
						id="cert-name"
						type="text"
						bind:value={uploadForm.name}
						placeholder="localhost-cert"
					/>
				</div>

				<div class="form-group">
					<label for="domains">Domains (comma-separated):</label>
					<input
						id="domains"
						type="text"
						bind:value={uploadForm.domains}
						placeholder="localhost, 127.0.0.1, ::1"
					/>
				</div>

				<div class="form-group">
					<label for="certificate">Certificate (PEM):</label>
					<textarea
						id="certificate"
						bind:value={uploadForm.certificate}
						placeholder="-----BEGIN CERTIFICATE-----"
						rows="8"
					></textarea>
				</div>

				<div class="form-group">
					<label for="private-key">Private Key (PEM):</label>
					<textarea
						id="private-key"
						bind:value={uploadForm.privateKey}
						placeholder="-----BEGIN PRIVATE KEY-----"
						rows="8"
					></textarea>
				</div>
			</div>

			<div class="modal-actions">
				<Button variant="secondary" on:click={() => (showUpload = false)}>Cancel</Button>
				<Button
					variant="primary"
					on:click={uploadMkcertCertificate}
					disabled={!uploadForm.name || !uploadForm.certificate || !uploadForm.privateKey}
				>
					Upload Certificate
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- Let's Encrypt Provisioning Modal -->
{#if showLetsEncrypt}
	<div class="modal-overlay" on:click={() => (showLetsEncrypt = false)}>
		<div class="modal" on:click|stopPropagation>
			<div class="modal-header">
				<h4>Provision Let's Encrypt Certificate</h4>
				<button class="close-btn" on:click={() => (showLetsEncrypt = false)}>×</button>
			</div>

			<div class="modal-body">
				<div class="warning-box">
					⚠️ This requires your domain to be publicly accessible for HTTP-01 challenge validation.
				</div>

				<div class="form-group">
					<label for="le-domain">Domain:</label>
					<input
						id="le-domain"
						type="text"
						bind:value={letsEncryptForm.domain}
						placeholder="example.com"
					/>
				</div>

				<div class="form-group">
					<label for="le-email">Email (for Let's Encrypt account):</label>
					<input
						id="le-email"
						type="email"
						bind:value={letsEncryptForm.email}
						placeholder="admin@example.com"
					/>
				</div>
			</div>

			<div class="modal-actions">
				<Button variant="secondary" on:click={() => (showLetsEncrypt = false)}>Cancel</Button>
				<Button
					variant="primary"
					on:click={provisionLetsEncrypt}
					disabled={!letsEncryptForm.domain || !letsEncryptForm.email}
				>
					Provision Certificate
				</Button>
			</div>
		</div>
	</div>
{/if}

<!-- Delete Confirmation Dialog -->
{#if showConfirmDelete && certificateToDelete}
	<ConfirmationDialog
		title="Delete Certificate"
		message="Are you sure you want to delete the certificate for {certificateToDelete.domain}? This action cannot be undone."
		confirmText="Delete"
		confirmVariant="danger"
		on:confirm={deleteCertificate}
		on:cancel={() => {
			showConfirmDelete = false;
			certificateToDelete = null;
		}}
	/>
{/if}

<style>
	.certificate-manager {
		border: 1px solid var(--color-border);
		border-radius: 8px;
		padding: 1.5rem;
		margin: 1rem 0;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	.health-summary {
		display: flex;
		gap: 1rem;
	}

	.health-stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		font-size: 0.85rem;
	}

	.health-stat .count {
		font-weight: bold;
		font-size: 1.2rem;
	}

	.health-stat .label {
		color: var(--color-text-secondary);
	}

	.health-stat.warning .count {
		color: var(--color-warning);
	}

	.health-stat.error .count {
		color: var(--color-error);
	}

	.loading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 2rem 0;
		justify-content: center;
	}

	.error {
		text-align: center;
		padding: 1rem;
		color: var(--color-error);
	}

	.actions {
		display: flex;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.no-certificates {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--color-text-secondary);
	}

	.certificates-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.certificate-card {
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 1rem;
		background: var(--color-bg-secondary);
		transition: border-color 0.2s ease;
	}

	.certificate-card.expired {
		border-color: var(--color-error);
		background: var(--color-error-bg);
	}

	.cert-header {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 0.75rem;
	}

	.cert-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.cert-info {
		flex: 1;
	}

	.cert-domain {
		font-weight: 600;
		font-size: 1.1rem;
		color: var(--color-text-primary);
	}

	.cert-type {
		color: var(--color-text-secondary);
		font-size: 0.9rem;
		text-transform: capitalize;
	}

	.cert-status {
		font-weight: 500;
		font-size: 0.9rem;
	}

	.cert-details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.5rem;
		margin-bottom: 1rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		padding: 0.25rem 0;
	}

	.detail-row .label {
		color: var(--color-text-secondary);
		font-weight: 500;
	}

	.detail-row .value.enabled {
		color: var(--color-success);
	}

	.detail-row .value.disabled {
		color: var(--color-text-secondary);
	}

	.detail-row .value.active {
		color: var(--color-success);
	}

	.detail-row .value.inactive {
		color: var(--color-text-secondary);
	}

	.cert-actions {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
	}

	.modal {
		background: var(--color-bg-primary);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		width: 90%;
		max-width: 600px;
		max-height: 90vh;
		overflow: auto;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem;
		border-bottom: 1px solid var(--color-border);
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: var(--color-text-secondary);
	}

	.modal-body {
		padding: 1rem;
	}

	.warning-box {
		background: var(--color-warning-bg);
		color: var(--color-warning);
		padding: 0.75rem;
		border-radius: 4px;
		margin-bottom: 1rem;
		font-size: 0.9rem;
	}

	.form-group {
		margin-bottom: 1rem;
	}

	.form-group label {
		display: block;
		margin-bottom: 0.5rem;
		font-weight: 500;
		color: var(--color-text-primary);
	}

	.form-group input,
	.form-group textarea {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		font-family: inherit;
		resize: vertical;
	}

	.modal-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		padding: 1rem;
		border-top: 1px solid var(--color-border);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.actions {
			flex-direction: column;
		}

		.cert-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.cert-details {
			grid-template-columns: 1fr;
		}

		.cert-actions {
			justify-content: flex-start;
		}

		.modal {
			width: 95%;
			margin: 1rem;
		}

		.modal-actions {
			flex-direction: column;
		}
	}
</style>
