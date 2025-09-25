<script>
	import { SecurityState } from '../state/SecurityState.svelte.js';
	import SecurityWarningBanner from './SecurityWarningBanner.svelte';
	import AuthMethodIndicator from './AuthMethodIndicator.svelte';

	let {
		showWarnings = true,
		showMethodStatus = true,
		showSecurityContext = true,
		context = 'general',
		compact = false
	} = $props();

	const securityState = new SecurityState();

	// Get warnings for the current context
	const contextWarnings = $derived(() => {
		return securityState.getWarningsForContext(context);
	});

	const availableMethods = $derived(() => {
		return securityState.getAvailableMethods();
	});

	const unavailableMethods = $derived(() => {
		return securityState.getUnavailableMethods();
	});

	const securityScore = $derived(() => {
		let score = 0;
		let maxScore = 0;

		// HTTPS check (25 points)
		maxScore += 25;
		if (
			securityState.securityContext.isHttps ||
			securityState.securityContext.hostname === 'localhost'
		) {
			score += 25;
		}

		// Multiple auth methods (25 points)
		maxScore += 25;
		if (availableMethods().length > 1) {
			score += 25;
		} else if (availableMethods().length === 1) {
			score += 10;
		}

		// WebAuthn availability (25 points)
		maxScore += 25;
		if (securityState.methodAvailability.webauthn.available) {
			score += 25;
		}

		// OAuth availability (25 points)
		maxScore += 25;
		if (securityState.methodAvailability.oauth.available) {
			score += 25;
		}

		return { score, maxScore, percentage: Math.round((score / maxScore) * 100) };
	});

	const securityGrade = $derived(() => {
		const percentage = securityScore().percentage;
		if (percentage >= 90) return { grade: 'A', color: '#10b981' };
		if (percentage >= 80) return { grade: 'B', color: '#f59e0b' };
		if (percentage >= 70) return { grade: 'C', color: '#f59e0b' };
		if (percentage >= 60) return { grade: 'D', color: '#ef4444' };
		return { grade: 'F', color: '#ef4444' };
	});

	function handleWarningAction(event) {
		const { action } = event.detail;

		switch (action.action) {
			case 'learn-https':
				// Could open documentation or help modal
				console.log('Learn HTTPS action triggered');
				break;
			case 'configure-auth-methods':
				// Could navigate to admin settings
				console.log('Configure auth methods action triggered');
				break;
			case 'configure-oauth':
				// Could navigate to OAuth settings
				console.log('Configure OAuth action triggered');
				break;
			case 'understand-webauthn-tunnel':
				// Could show WebAuthn tunnel explanation
				console.log('Understand WebAuthn tunnel action triggered');
				break;
		}
	}

	function handleWarningDismiss(warningId) {
		securityState.dismissWarning(warningId);
	}

	async function refreshSecurity() {
		await securityState.refresh();
	}
</script>

<div class="security-dashboard {compact ? 'compact' : ''}" data-testid="security-dashboard">
	{#if showWarnings && contextWarnings().length > 0}
		<div class="warnings-section">
			{#each contextWarnings() as warning (warning.id)}
				<SecurityWarningBanner
					type={warning.type}
					title={warning.title}
					message={warning.message}
					dismissible={warning.dismissible}
					actions={warning.actions}
					visible={true}
					on:action={handleWarningAction}
					on:dismiss={() => handleWarningDismiss(warning.id)}
				/>
			{/each}
		</div>
	{/if}

	{#if showSecurityContext && !compact}
		<div class="security-overview">
			<div class="overview-header">
				<h3>Security Overview</h3>
				<button class="refresh-btn" onclick={refreshSecurity} title="Refresh security status">
					🔄
				</button>
			</div>

			<div class="security-metrics">
				<div class="security-score">
					<div class="score-circle" style="--score-color: {securityGrade().color}">
						<span class="score-grade">{securityGrade().grade}</span>
						<span class="score-percentage">{securityScore().percentage}%</span>
					</div>
					<div class="score-details">
						<p class="score-title">Security Score</p>
						<p class="score-description">
							{securityScore().score} of {securityScore().maxScore} security points
						</p>
					</div>
				</div>

				<div class="context-info">
					<div class="context-item">
						<span class="context-label">Connection:</span>
						<span
							class="context-value {securityState.securityContext.isHttps ? 'secure' : 'insecure'}"
						>
							{securityState.securityContext.isHttps ? 'HTTPS' : 'HTTP'}
						</span>
					</div>
					<div class="context-item">
						<span class="context-label">Environment:</span>
						<span class="context-value">
							{securityState.securityContext.tunnelActive ? 'Tunnel' : 'Local'}
						</span>
					</div>
					<div class="context-item">
						<span class="context-label">Auth Methods:</span>
						<span class="context-value">
							{availableMethods().length} available
						</span>
					</div>
				</div>
			</div>
		</div>
	{/if}

	{#if showMethodStatus}
		<div class="method-status-section">
			<h4>Authentication Methods</h4>

			<div class="methods-grid">
				<div class="available-methods">
					<h5>Available Methods</h5>
					{#if availableMethods().length > 0}
						<div class="method-list">
							{#each availableMethods() as method (method.method)}
								<AuthMethodIndicator
									method={method.method}
									showStatus={true}
									showReason={!compact}
									{compact}
								/>
							{/each}
						</div>
					{:else}
						<p class="no-methods">No authentication methods available</p>
					{/if}
				</div>

				{#if unavailableMethods().length > 0 && !compact}
					<div class="unavailable-methods">
						<h5>Unavailable Methods</h5>
						<div class="method-list">
							{#each unavailableMethods() as method (method.method)}
								<AuthMethodIndicator
									method={method.method}
									showStatus={true}
									showReason={true}
									compact={false}
								/>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.security-dashboard {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		padding: 1rem;
		background-color: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
	}

	.security-dashboard.compact {
		gap: 1rem;
		padding: 0.75rem;
	}

	.warnings-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.security-overview {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 0.375rem;
		padding: 1rem;
	}

	.overview-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.overview-header h3 {
		margin: 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
	}

	.refresh-btn {
		background: none;
		border: 1px solid #d1d5db;
		border-radius: 0.25rem;
		padding: 0.25rem 0.5rem;
		cursor: pointer;
		font-size: 0.875rem;
		transition: all 0.2s ease;
	}

	.refresh-btn:hover {
		background-color: #f3f4f6;
		border-color: #9ca3af;
	}

	.security-metrics {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 1.5rem;
		align-items: center;
	}

	.security-score {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.score-circle {
		width: 4rem;
		height: 4rem;
		border-radius: 50%;
		border: 3px solid var(--score-color);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background-color: rgba(255, 255, 255, 0.8);
	}

	.score-grade {
		font-size: 1.25rem;
		font-weight: 700;
		line-height: 1;
		color: var(--score-color);
	}

	.score-percentage {
		font-size: 0.75rem;
		font-weight: 500;
		color: var(--score-color);
		line-height: 1;
	}

	.score-details {
		flex: 1;
	}

	.score-title {
		font-weight: 600;
		color: #374151;
		margin: 0 0 0.25rem 0;
		font-size: 0.9375rem;
	}

	.score-description {
		font-size: 0.8125rem;
		color: #6b7280;
		margin: 0;
	}

	.context-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.context-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.875rem;
	}

	.context-label {
		color: #6b7280;
		font-weight: 500;
	}

	.context-value {
		font-weight: 600;
		color: #374151;
	}

	.context-value.secure {
		color: #059669;
	}

	.context-value.insecure {
		color: #dc2626;
	}

	.method-status-section {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 0.375rem;
		padding: 1rem;
	}

	.method-status-section h4 {
		margin: 0 0 1rem 0;
		font-size: 1.125rem;
		font-weight: 600;
		color: #1f2937;
	}

	.methods-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}

	@media (min-width: 768px) {
		.methods-grid {
			grid-template-columns: 1fr 1fr;
		}
	}

	.available-methods h5,
	.unavailable-methods h5 {
		margin: 0 0 0.75rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #374151;
	}

	.method-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.no-methods {
		color: #6b7280;
		font-style: italic;
		font-size: 0.875rem;
		margin: 0;
		padding: 1rem;
		text-align: center;
		background-color: #f9fafb;
		border-radius: 0.25rem;
	}

	/* Mobile responsive adjustments */
	@media (max-width: 640px) {
		.security-dashboard {
			padding: 0.75rem;
			gap: 1rem;
		}

		.security-metrics {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.score-circle {
			width: 3.5rem;
			height: 3.5rem;
		}

		.methods-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
