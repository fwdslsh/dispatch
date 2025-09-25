<script>
	import { onMount } from 'svelte';

	// Props
	let {
		apiClient,
		isVisible = false
	} = $props();

	// State
	let securityPosture = $state({
		overall: { score: 0, level: 'low' },
		factors: {
			httpsEnabled: false,
			strongAuthentication: false,
			certificateStatus: 'none',
			sessionSecurity: true
		},
		recommendations: [],
		warnings: []
	});

	let systemStats = $state({
		users: { total: 0, admins: 0, activeInLast30Days: 0 },
		sessions: { total: 0, active: 0 },
		devices: { total: 0, trusted: 0 },
		authEvents: { total: 0, logins: 0, logouts: 0, failures: 0 }
	});

	let loading = $state(false);
	let error = $state('');

	// Load data when component becomes visible
	$effect(() => {
		if (isVisible) {
			loadSecurityPosture();
			loadSystemStats();
		}
	});

	async function loadSecurityPosture() {
		loading = true;
		error = '';

		try {
			const response = await apiClient.post('/api/admin/security/posture');

			if (response.ok) {
				const data = await response.json();
				securityPosture = data.posture;
			} else {
				const errorData = await response.json();
				error = errorData.error || 'Failed to load security posture';
			}
		} catch (err) {
			error = 'Network error: ' + err.message;
		} finally {
			loading = false;
		}
	}

	async function loadSystemStats() {
		try {
			const response = await apiClient.post('/api/admin/stats');

			if (response.ok) {
				const data = await response.json();
				systemStats = data.stats;
			} else {
				console.warn('Failed to load system stats');
			}
		} catch (err) {
			console.warn('Network error loading stats:', err.message);
		}
	}

	function refreshData() {
		loadSecurityPosture();
		loadSystemStats();
	}

	function closeError() {
		error = '';
	}

	function getSecurityLevelColor(level) {
		switch (level) {
			case 'high': return '#28a745';
			case 'medium': return '#ffc107';
			case 'low': return '#dc3545';
			default: return '#6c757d';
		}
	}

	function getScoreColor(score) {
		if (score >= 80) return '#28a745';
		if (score >= 50) return '#ffc107';
		return '#dc3545';
	}

	function getSeverityColor(severity) {
		switch (severity) {
			case 'high': return '#dc3545';
			case 'medium': return '#ffc107';
			case 'low': return '#17a2b8';
			default: return '#6c757d';
		}
	}

	function getRecommendationTypeIcon(type) {
		switch (type) {
			case 'authentication': return '🔐';
			case 'certificate': return '📜';
			case 'security': return '🛡️';
			case 'configuration': return '⚙️';
			default: return '💡';
		}
	}
</script>

{#if isVisible}
	<div class="security-dashboard">
		<div class="dashboard-header">
			<h3>Security Posture Dashboard</h3>
			<div class="header-actions">
				<button class="btn btn-secondary" onclick={refreshData}>
					Refresh
				</button>
			</div>
		</div>

		<!-- Error Message -->
		{#if error}
			<div class="alert alert-error">
				{error}
				<button class="btn-close" onclick={closeError}>&times;</button>
			</div>
		{/if}

		<!-- Loading State -->
		{#if loading}
			<div class="loading">Loading security posture...</div>
		{/if}

		{#if !loading}
			<!-- Overall Security Score -->
			<div class="security-score-card">
				<div class="score-display">
					<div class="score-circle" style="--score-color: {getScoreColor(securityPosture.overall.score)}">
						<div class="score-value">{securityPosture.overall.score}</div>
						<div class="score-label">Security Score</div>
					</div>
					<div class="score-details">
						<div class="security-level" style="background-color: {getSecurityLevelColor(securityPosture.overall.level)}">
							{securityPosture.overall.level.toUpperCase()} SECURITY
						</div>
						<div class="score-description">
							{#if securityPosture.overall.level === 'high'}
								Your system has strong security measures in place.
							{:else if securityPosture.overall.level === 'medium'}
								Your system has decent security but could be improved.
							{:else}
								Your system needs immediate security improvements.
							{/if}
						</div>
					</div>
				</div>
			</div>

			<div class="dashboard-grid">
				<!-- Security Factors -->
				<div class="dashboard-section">
					<h4>Security Factors</h4>
					<div class="factors-grid">
						<div class="factor-card">
							<div class="factor-icon">{securityPosture.factors.httpsEnabled ? '🟢' : '🔴'}</div>
							<div class="factor-info">
								<div class="factor-name">HTTPS Enabled</div>
								<div class="factor-status {securityPosture.factors.httpsEnabled ? 'enabled' : 'disabled'}">
									{securityPosture.factors.httpsEnabled ? 'Active' : 'Inactive'}
								</div>
							</div>
						</div>

						<div class="factor-card">
							<div class="factor-icon">{securityPosture.factors.strongAuthentication ? '🟢' : '🔴'}</div>
							<div class="factor-info">
								<div class="factor-name">Strong Authentication</div>
								<div class="factor-status {securityPosture.factors.strongAuthentication ? 'enabled' : 'disabled'}">
									{securityPosture.factors.strongAuthentication ? 'Active' : 'Basic Only'}
								</div>
							</div>
						</div>

						<div class="factor-card">
							<div class="factor-icon">📜</div>
							<div class="factor-info">
								<div class="factor-name">Certificate Status</div>
								<div class="factor-status certificate-{securityPosture.factors.certificateStatus}">
									{securityPosture.factors.certificateStatus === 'none' ? 'No Certificate' :
									 securityPosture.factors.certificateStatus === 'mkcert' ? 'Development' :
									 securityPosture.factors.certificateStatus === 'letsencrypt' ? 'Production' :
									 securityPosture.factors.certificateStatus}
								</div>
							</div>
						</div>

						<div class="factor-card">
							<div class="factor-icon">{securityPosture.factors.sessionSecurity ? '🟢' : '🔴'}</div>
							<div class="factor-info">
								<div class="factor-name">Session Security</div>
								<div class="factor-status {securityPosture.factors.sessionSecurity ? 'enabled' : 'disabled'}">
									{securityPosture.factors.sessionSecurity ? 'Secure' : 'Weak'}
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- System Statistics -->
				<div class="dashboard-section">
					<h4>System Statistics</h4>
					<div class="stats-grid">
						<div class="stat-card">
							<div class="stat-value">{systemStats.users.total}</div>
							<div class="stat-label">Total Users</div>
							<div class="stat-detail">{systemStats.users.admins} administrators</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{systemStats.sessions.active}</div>
							<div class="stat-label">Active Sessions</div>
							<div class="stat-detail">{systemStats.sessions.total} total sessions</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{systemStats.devices.total}</div>
							<div class="stat-label">Registered Devices</div>
							<div class="stat-detail">{systemStats.devices.trusted} trusted</div>
						</div>

						<div class="stat-card">
							<div class="stat-value">{systemStats.authEvents.logins}</div>
							<div class="stat-label">Recent Logins</div>
							<div class="stat-detail">Last 7 days</div>
						</div>
					</div>
				</div>
			</div>

			<!-- Warnings -->
			{#if securityPosture.warnings.length > 0}
				<div class="dashboard-section">
					<h4>Security Warnings</h4>
					<div class="warnings-list">
						{#each securityPosture.warnings as warning}
							<div class="warning-card severity-{warning.severity}">
								<div class="warning-icon">⚠️</div>
								<div class="warning-content">
									<div class="warning-title">{warning.title}</div>
									<div class="warning-description">{warning.description}</div>
									<div class="warning-severity">
										Severity: <span class="severity-badge {warning.severity}">{warning.severity}</span>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Recommendations -->
			{#if securityPosture.recommendations.length > 0}
				<div class="dashboard-section">
					<h4>Security Recommendations</h4>
					<div class="recommendations-list">
						{#each securityPosture.recommendations as recommendation}
							<div class="recommendation-card">
								<div class="recommendation-icon">{getRecommendationTypeIcon(recommendation.type)}</div>
								<div class="recommendation-content">
									<div class="recommendation-title">{recommendation.title}</div>
									<div class="recommendation-description">{recommendation.description}</div>
									<div class="recommendation-action">
										<strong>Action:</strong> {recommendation.action}
									</div>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Quick Actions -->
			<div class="dashboard-section">
				<h4>Quick Actions</h4>
				<div class="quick-actions">
					<button class="action-button" onclick={() => window.dispatchEvent(new CustomEvent('navigate-to', { detail: 'certificates' }))}>
						<span class="action-icon">📜</span>
						<span class="action-label">Manage Certificates</span>
					</button>

					<button class="action-button" onclick={() => window.dispatchEvent(new CustomEvent('navigate-to', { detail: 'auth-config' }))}>
						<span class="action-icon">🔐</span>
						<span class="action-label">Configure Authentication</span>
					</button>

					<button class="action-button" onclick={() => window.dispatchEvent(new CustomEvent('navigate-to', { detail: 'audit-logs' }))}>
						<span class="action-icon">📊</span>
						<span class="action-label">View Audit Logs</span>
					</button>

					<button class="action-button" onclick={() => window.dispatchEvent(new CustomEvent('navigate-to', { detail: 'oauth-config' }))}>
						<span class="action-icon">🔗</span>
						<span class="action-label">OAuth Settings</span>
					</button>
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.security-dashboard {
		padding: 20px;
		background: #f5f5f5;
		border-radius: 8px;
		margin: 10px 0;
	}

	.dashboard-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
	}

	.dashboard-header h3 {
		margin: 0;
		color: #333;
	}

	.alert {
		padding: 12px 16px;
		border-radius: 6px;
		margin-bottom: 16px;
		position: relative;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.alert-error {
		background: #fee;
		border: 1px solid #fcc;
		color: #c33;
	}

	.btn-close {
		background: none;
		border: none;
		font-size: 18px;
		cursor: pointer;
		color: inherit;
		opacity: 0.7;
	}

	.btn-close:hover {
		opacity: 1;
	}

	.loading {
		text-align: center;
		padding: 40px;
		color: #666;
	}

	.security-score-card {
		background: white;
		border-radius: 12px;
		padding: 30px;
		margin-bottom: 30px;
		box-shadow: 0 4px 8px rgba(0,0,0,0.1);
	}

	.score-display {
		display: flex;
		align-items: center;
		gap: 40px;
		justify-content: center;
	}

	.score-circle {
		width: 120px;
		height: 120px;
		border-radius: 50%;
		background: conic-gradient(var(--score-color) 0deg, var(--score-color) calc(var(--score, 0) * 3.6deg), #e9ecef calc(var(--score, 0) * 3.6deg), #e9ecef 360deg);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		position: relative;
		--score: var(--score-value, 0);
	}

	.score-circle::before {
		content: '';
		position: absolute;
		width: 80px;
		height: 80px;
		background: white;
		border-radius: 50%;
	}

	.score-value {
		font-size: 24px;
		font-weight: bold;
		color: var(--score-color);
		position: relative;
		z-index: 1;
	}

	.score-label {
		font-size: 11px;
		color: #666;
		text-transform: uppercase;
		font-weight: 500;
		position: relative;
		z-index: 1;
	}

	.score-details {
		display: flex;
		flex-direction: column;
		gap: 12px;
		max-width: 300px;
	}

	.security-level {
		color: white;
		padding: 8px 16px;
		border-radius: 6px;
		text-align: center;
		font-weight: bold;
		font-size: 14px;
	}

	.score-description {
		color: #666;
		line-height: 1.5;
	}

	.dashboard-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		margin-bottom: 30px;
	}

	@media (max-width: 768px) {
		.dashboard-grid {
			grid-template-columns: 1fr;
		}

		.score-display {
			flex-direction: column;
			gap: 20px;
		}
	}

	.dashboard-section {
		background: white;
		border-radius: 8px;
		padding: 20px;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}

	.dashboard-section h4 {
		margin: 0 0 16px 0;
		color: #333;
		border-bottom: 2px solid #eee;
		padding-bottom: 8px;
	}

	.factors-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.factor-card {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: #f8f9fa;
		border-radius: 6px;
		border-left: 3px solid #007bff;
	}

	.factor-icon {
		font-size: 24px;
	}

	.factor-info {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.factor-name {
		font-weight: 600;
		color: #333;
		font-size: 13px;
	}

	.factor-status {
		font-size: 12px;
		font-weight: 500;
	}

	.factor-status.enabled {
		color: #28a745;
	}

	.factor-status.disabled {
		color: #dc3545;
	}

	.factor-status.certificate-none {
		color: #dc3545;
	}

	.factor-status.certificate-mkcert {
		color: #ffc107;
	}

	.factor-status.certificate-letsencrypt {
		color: #28a745;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.stat-card {
		text-align: center;
		padding: 16px;
		background: #f8f9fa;
		border-radius: 6px;
		border-left: 3px solid #28a745;
	}

	.stat-value {
		font-size: 24px;
		font-weight: bold;
		color: #333;
		margin-bottom: 4px;
	}

	.stat-label {
		font-size: 12px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		margin-bottom: 4px;
	}

	.stat-detail {
		font-size: 11px;
		color: #999;
	}

	.warnings-list,
	.recommendations-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.warning-card {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 16px;
		border-radius: 6px;
		border-left: 4px solid;
	}

	.warning-card.severity-high {
		background: #fff5f5;
		border-left-color: #dc3545;
	}

	.warning-card.severity-medium {
		background: #fffbf0;
		border-left-color: #ffc107;
	}

	.warning-card.severity-low {
		background: #f0f9ff;
		border-left-color: #17a2b8;
	}

	.warning-icon {
		font-size: 20px;
		margin-top: 2px;
	}

	.warning-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.warning-title {
		font-weight: 600;
		color: #333;
	}

	.warning-description {
		color: #666;
		font-size: 14px;
		line-height: 1.4;
	}

	.warning-severity {
		font-size: 12px;
		color: #666;
	}

	.severity-badge {
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 10px;
		text-transform: uppercase;
		font-weight: 500;
	}

	.severity-badge.high {
		background: #f8d7da;
		color: #721c24;
	}

	.severity-badge.medium {
		background: #fff3cd;
		color: #856404;
	}

	.severity-badge.low {
		background: #d1ecf1;
		color: #0c5460;
	}

	.recommendation-card {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 16px;
		background: #f8f9fa;
		border-radius: 6px;
		border-left: 3px solid #007bff;
	}

	.recommendation-icon {
		font-size: 20px;
		margin-top: 2px;
	}

	.recommendation-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.recommendation-title {
		font-weight: 600;
		color: #333;
	}

	.recommendation-description {
		color: #666;
		font-size: 14px;
		line-height: 1.4;
	}

	.recommendation-action {
		color: #666;
		font-size: 13px;
	}

	.recommendation-action strong {
		color: #333;
	}

	.quick-actions {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 16px;
	}

	.action-button {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 20px;
		background: white;
		border: 2px solid #e9ecef;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
		text-decoration: none;
		color: inherit;
	}

	.action-button:hover {
		border-color: #007bff;
		background: #f8f9fa;
	}

	.action-icon {
		font-size: 24px;
	}

	.action-label {
		font-weight: 500;
		color: #333;
		font-size: 14px;
		text-align: center;
	}

	.btn {
		padding: 6px 12px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.2s;
	}

	.btn:hover {
		background: #f5f5f5;
	}

	.btn-secondary {
		background: #6c757d;
		color: white;
		border-color: #6c757d;
	}

	.btn-secondary:hover {
		background: #545b62;
	}
</style>