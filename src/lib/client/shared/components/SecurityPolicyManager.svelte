<script>
	import { onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	const dispatch = createEventDispatcher();

	let policies = null;
	let loading = true;
	let error = null;
	let updating = false;

	// Editable policy data
	let corsOrigins = '';
	let certificateContext = '';
	let showAdvanced = false;

	onMount(async () => {
		await loadPolicies();
		loading = false;
	});

	async function loadPolicies() {
		try {
			const response = await fetch('/api/security/policies');
			const data = await response.json();

			if (data.success) {
				policies = data.policies;
				corsOrigins = policies.cors.origin.join('\n');
				certificateContext = JSON.stringify(policies.context, null, 2);
			} else {
				error = data.error || 'Failed to load security policies';
			}
		} catch (err) {
			error = err.message;
		}
	}

	async function updateCORSOrigins() {
		updating = true;
		try {
			const origins = corsOrigins.split('\n').filter(origin => origin.trim());

			const response = await fetch('/api/security/policies', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					policy: 'cors',
					config: { origins }
				})
			});

			const data = await response.json();
			if (data.success) {
				dispatch('success', { message: 'CORS origins updated successfully' });
				await loadPolicies();
			} else {
				dispatch('error', { error: data.error || 'Failed to update CORS origins' });
			}
		} catch (err) {
			dispatch('error', { error: err.message });
		} finally {
			updating = false;
		}
	}

	async function updateCertificateContext() {
		updating = true;
		try {
			const context = JSON.parse(certificateContext);

			const response = await fetch('/api/security/policies', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					policy: 'certificate',
					config: { context }
				})
			});

			const data = await response.json();
			if (data.success) {
				dispatch('success', { message: 'Certificate context updated successfully' });
				await loadPolicies();
			} else {
				dispatch('error', { error: data.error || 'Failed to update certificate context' });
			}
		} catch (err) {
			dispatch('error', { error: err.message });
		} finally {
			updating = false;
		}
	}

	function getSecurityLevel() {
		if (!policies) return 'unknown';

		const { context, hsts, cors } = policies;

		if (context.isHttps && hsts.enabled && cors.origin.length === 1) {
			return 'high';
		} else if (context.isHttps || context.isSecureContext) {
			return 'medium';
		} else {
			return 'low';
		}
	}

	function getSecurityLevelColor(level) {
		switch (level) {
			case 'high': return '#4ade80';
			case 'medium': return '#fbbf24';
			case 'low': return '#f87171';
			default: return '#6b7280';
		}
	}

	function getContextDescription(context) {
		if (context.isCustomDomain) return 'Custom Domain';
		if (context.isTunnel) return 'Tunnel Access';
		if (context.isLocalhost) return 'Local Development';
		if (context.isLAN) return 'LAN Access';
		return 'Unknown Context';
	}
</script>

<div class="security-policy-manager">
	<div class="header">
		<h3>Security Policy Management</h3>
		{#if policies}
			<div class="security-level" style="color: {getSecurityLevelColor(getSecurityLevel())}">
				Security Level: {getSecurityLevel().toUpperCase()}
			</div>
		{/if}
	</div>

	{#if loading}
		<div class="loading">
			<LoadingSpinner />
			<p>Loading security policies...</p>
		</div>
	{:else if error}
		<div class="error">
			<p>Error: {error}</p>
			<Button variant="secondary" on:click={loadPolicies}>
				Retry
			</Button>
		</div>
	{:else if policies}
		<div class="policies-container">
			<!-- Context Information -->
			<div class="policy-section">
				<h4>Current Context</h4>
				<div class="context-info">
					<div class="context-item">
						<span class="label">Environment:</span>
						<span class="value">{getContextDescription(policies.context)}</span>
					</div>
					<div class="context-item">
						<span class="label">Protocol:</span>
						<span class="value">{policies.context.protocol}</span>
					</div>
					<div class="context-item">
						<span class="label">Hostname:</span>
						<span class="value">{policies.context.hostname}</span>
					</div>
					<div class="context-item">
						<span class="label">Secure Context:</span>
						<span class="value {policies.context.isSecureContext ? 'secure' : 'insecure'}">
							{policies.context.isSecureContext ? '✓ Yes' : '✗ No'}
						</span>
					</div>
				</div>
			</div>

			<!-- CORS Configuration -->
			<div class="policy-section">
				<h4>CORS Origins</h4>
				<p class="description">
					Configure allowed origins for cross-origin requests. One origin per line.
				</p>
				<textarea
					bind:value={corsOrigins}
					placeholder="https://example.com&#10;http://localhost:3000"
					rows="4"
				></textarea>
				<Button
					variant="primary"
					on:click={updateCORSOrigins}
					disabled={updating}
				>
					{updating ? 'Updating...' : 'Update CORS Origins'}
				</Button>
			</div>

			<!-- Security Headers -->
			<div class="policy-section">
				<h4>Security Headers</h4>
				<div class="headers-grid">
					<div class="header-item">
						<span class="header-name">HSTS:</span>
						<span class="header-status {policies.hsts.enabled ? 'enabled' : 'disabled'}">
							{policies.hsts.enabled ? `Enabled (${policies.hsts.maxAge}s)` : 'Disabled'}
						</span>
					</div>
					<div class="header-item">
						<span class="header-name">Content Security Policy:</span>
						<span class="header-status {policies.helmet.contentSecurityPolicy ? 'enabled' : 'disabled'}">
							{policies.helmet.contentSecurityPolicy ? 'Enabled' : 'Disabled'}
						</span>
					</div>
					<div class="header-item">
						<span class="header-name">X-Frame-Options:</span>
						<span class="header-status enabled">
							{policies.helmet.frameguard?.action || 'deny'}
						</span>
					</div>
					<div class="header-item">
						<span class="header-name">X-Content-Type-Options:</span>
						<span class="header-status {policies.helmet.noSniff ? 'enabled' : 'disabled'}">
							{policies.helmet.noSniff ? 'nosniff' : 'Disabled'}
						</span>
					</div>
				</div>
			</div>

			<!-- Cookie Security -->
			<div class="policy-section">
				<h4>Cookie Security</h4>
				<div class="cookie-settings">
					<div class="cookie-item">
						<span class="label">Secure Flag:</span>
						<span class="value {policies.cookies.secure ? 'secure' : 'insecure'}">
							{policies.cookies.secure ? '✓ Enabled' : '✗ Disabled'}
						</span>
					</div>
					<div class="cookie-item">
						<span class="label">SameSite:</span>
						<span class="value">{policies.cookies.sameSite}</span>
					</div>
					<div class="cookie-item">
						<span class="label">HttpOnly:</span>
						<span class="value {policies.cookies.httpOnly ? 'secure' : 'insecure'}">
							{policies.cookies.httpOnly ? '✓ Enabled' : '✗ Disabled'}
						</span>
					</div>
				</div>
			</div>

			<!-- Rate Limiting -->
			<div class="policy-section">
				<h4>Rate Limiting</h4>
				<div class="rate-limit-info">
					<div class="rate-item">
						<span class="label">Window:</span>
						<span class="value">{Math.round(policies.rateLimit.windowMs / 60000)} minutes</span>
					</div>
					<div class="rate-item">
						<span class="label">Max Requests:</span>
						<span class="value">{policies.rateLimit.max}</span>
					</div>
					<div class="rate-item">
						<span class="label">Skip Successful:</span>
						<span class="value">{policies.rateLimit.skipSuccessfulRequests ? 'Yes' : 'No'}</span>
					</div>
				</div>
			</div>

			<!-- Advanced Configuration -->
			{#if showAdvanced}
				<div class="policy-section advanced">
					<h4>Advanced Configuration</h4>
					<p class="description warning">
						⚠️ Advanced settings - modify with caution
					</p>
					<label for="cert-context">Certificate Context (JSON):</label>
					<textarea
						id="cert-context"
						bind:value={certificateContext}
						rows="8"
						class="code-input"
					></textarea>
					<Button
						variant="secondary"
						on:click={updateCertificateContext}
						disabled={updating}
					>
						{updating ? 'Updating...' : 'Update Certificate Context'}
					</Button>
				</div>
			{/if}

			<div class="actions">
				<Button
					variant="secondary"
					on:click={() => showAdvanced = !showAdvanced}
				>
					{showAdvanced ? 'Hide' : 'Show'} Advanced Settings
				</Button>
				<Button variant="primary" on:click={loadPolicies}>
					Refresh Policies
				</Button>
			</div>
		</div>
	{/if}
</div>

<style>
	.security-policy-manager {
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

	.security-level {
		font-weight: 600;
		font-size: 0.9rem;
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

	.policies-container {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.policy-section {
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 6px;
		padding: 1rem;
	}

	.policy-section.advanced {
		border-color: var(--color-warning);
		background: var(--color-warning-bg);
	}

	.policy-section h4 {
		margin: 0 0 1rem 0;
		color: var(--color-text-primary);
	}

	.description {
		margin: 0 0 1rem 0;
		color: var(--color-text-secondary);
		font-size: 0.9rem;
	}

	.description.warning {
		color: var(--color-warning);
		font-weight: 500;
	}

	.context-info, .cookie-settings, .rate-limit-info {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 0.5rem;
	}

	.context-item, .cookie-item, .rate-item {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem;
		background: var(--color-bg-primary);
		border-radius: 4px;
	}

	.label {
		font-weight: 500;
		color: var(--color-text-secondary);
	}

	.value {
		color: var(--color-text-primary);
	}

	.value.secure {
		color: var(--color-success);
	}

	.value.insecure {
		color: var(--color-error);
	}

	.headers-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 0.5rem;
	}

	.header-item {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem;
		background: var(--color-bg-primary);
		border-radius: 4px;
	}

	.header-name {
		font-weight: 500;
	}

	.header-status.enabled {
		color: var(--color-success);
	}

	.header-status.disabled {
		color: var(--color-text-secondary);
	}

	textarea {
		width: 100%;
		min-height: 100px;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 4px;
		background: var(--color-bg-primary);
		color: var(--color-text-primary);
		font-family: inherit;
		resize: vertical;
		margin-bottom: 1rem;
	}

	.code-input {
		font-family: 'Courier New', monospace;
		font-size: 0.85rem;
	}

	.actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-border);
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.context-info, .cookie-settings, .rate-limit-info, .headers-grid {
			grid-template-columns: 1fr;
		}

		.actions {
			flex-direction: column;
		}
	}
</style>