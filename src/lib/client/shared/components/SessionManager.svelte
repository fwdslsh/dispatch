<!--
  SessionManager.svelte

  Comprehensive session management UI with logout functionality and session details.
  Allows users to view, manage, and terminate their active authentication sessions.
-->

<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import Modal from './Modal.svelte';
	import ConfirmationDialog from './ConfirmationDialog.svelte';

	const dispatch = createEventDispatcher();

	// Props
	let {
		autoLoad = true,
		showTitle = true,
		compact = false,
		showCurrentSession = true
	} = $props();

	// State
	let sessions = $state([]);
	let currentSession = $state(null);
	let loading = $state(false);
	let error = $state(null);
	let success = $state(null);

	// Modal states
	let showSessionDetails = $state(false);
	let showLogoutConfirm = $state(false);
	let showLogoutAllConfirm = $state(false);
	let selectedSession = $state(null);

	// Session statistics
	let sessionStats = $derived.by(() => {
		const now = new Date();
		const active = sessions.filter(s => new Date(s.expiresAt) > now);
		const expired = sessions.filter(s => new Date(s.expiresAt) <= now);
		const devices = new Set(sessions.map(s => s.deviceId)).size;

		return {
			total: sessions.length,
			active: active.length,
			expired: expired.length,
			devices
		};
	});

	/**
	 * Load user sessions from the server
	 */
	async function loadSessions() {
		if (!browser) return;

		loading = true;
		error = null;

		try {
			const response = await fetch('/api/user/sessions', {
				method: 'GET',
				credentials: 'include'
			});

			const data = await response.json();

			if (data.success) {
				sessions = data.sessions || [];
				currentSession = data.currentSession || null;
			} else {
				error = data.error || 'Failed to load your sessions';
			}
		} catch (err) {
			error = err.message || 'Network error loading sessions';
			console.error('Error loading user sessions:', err);
		} finally {
			loading = false;
		}
	}

	/**
	 * Logout from a specific session
	 */
	async function logoutSession(sessionId) {
		try {
			const response = await fetch('/api/user/sessions/logout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					sessionId
				})
			});

			const data = await response.json();

			if (data.success) {
				success = 'Session terminated successfully';
				showLogoutConfirm = false;
				selectedSession = null;
				await loadSessions();

				dispatch('sessionTerminated', {
					sessionId,
					message: data.message
				});
			} else {
				error = data.error || 'Failed to terminate session';
			}
		} catch (err) {
			error = err.message || 'Network error terminating session';
		}
	}

	/**
	 * Logout from all sessions (except current)
	 */
	async function logoutAllSessions() {
		try {
			const response = await fetch('/api/user/sessions/logout-all', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include'
			});

			const data = await response.json();

			if (data.success) {
				success = `Terminated ${data.terminatedCount} session(s)`;
				showLogoutAllConfirm = false;
				await loadSessions();

				dispatch('allSessionsTerminated', {
					terminatedCount: data.terminatedCount,
					message: data.message
				});
			} else {
				error = data.error || 'Failed to terminate sessions';
			}
		} catch (err) {
			error = err.message || 'Network error terminating sessions';
		}
	}

	/**
	 * Logout from current session (redirect to login)
	 */
	async function logoutCurrent() {
		try {
			const response = await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include'
			});

			if (response.ok) {
				// Redirect to login page or home
				window.location.href = '/';
			} else {
				error = 'Failed to logout - please try again';
			}
		} catch (err) {
			error = err.message || 'Network error during logout';
		}
	}

	/**
	 * Open session details modal
	 */
	function openSessionDetails(session) {
		selectedSession = session;
		showSessionDetails = true;
	}

	/**
	 * Confirm session termination
	 */
	function confirmLogoutSession(session) {
		selectedSession = session;
		showLogoutConfirm = true;
	}

	/**
	 * Confirm logout all sessions
	 */
	function confirmLogoutAll() {
		showLogoutAllConfirm = true;
	}

	/**
	 * Clear messages
	 */
	function clearMessages() {
		error = null;
		success = null;
	}

	/**
	 * Format date for display
	 */
	function formatDate(dateString) {
		if (!dateString) return 'Unknown';
		return new Date(dateString).toLocaleString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	/**
	 * Format relative time (e.g., "2 hours ago")
	 */
	function formatRelativeTime(dateString) {
		if (!dateString) return 'Unknown';

		const date = new Date(dateString);
		const now = new Date();
		const diffMs = now - date;

		const diffMinutes = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMinutes < 1) return 'Just now';
		if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
		if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
		if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

		return formatDate(dateString);
	}

	/**
	 * Get session status display
	 */
	function getSessionStatus(session) {
		const now = new Date();
		const expiresAt = new Date(session.expiresAt);
		const isCurrentSession = session.id === currentSession?.id;

		if (isCurrentSession) {
			return {
				text: 'Current Session',
				class: 'current',
				icon: '📍'
			};
		} else if (expiresAt <= now) {
			return {
				text: 'Expired',
				class: 'expired',
				icon: '🔴'
			};
		} else {
			return {
				text: 'Active',
				class: 'active',
				icon: '🟢'
			};
		}
	}

	/**
	 * Get device icon based on user agent
	 */
	function getDeviceIcon(userAgent) {
		if (!userAgent) return '💻';

		const ua = userAgent.toLowerCase();
		if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
			return '📱';
		} else if (ua.includes('tablet') || ua.includes('ipad')) {
			return '📱';
		}
		return '💻';
	}

	// Load sessions on mount
	$effect(() => {
		if (autoLoad && browser) {
			loadSessions();
		}
	});

	onMount(() => {
		if (autoLoad && browser) {
			loadSessions();
		}
	});
</script>

<div class="session-manager" class:compact data-testid="session-manager">
	{#if showTitle && !compact}
		<div class="manager-header">
			<h3>Session Management</h3>
			<p class="subtitle">Manage your active authentication sessions</p>
		</div>
	{/if}

	<!-- Action bar with stats -->
	<div class="action-bar">
		<div class="session-stats">
			<div class="stat-item">
				<span class="stat-value">{sessionStats.active}</span>
				<span class="stat-label">Active</span>
			</div>
			<div class="stat-item">
				<span class="stat-value">{sessionStats.devices}</span>
				<span class="stat-label">Devices</span>
			</div>
		</div>

		<div class="action-buttons">
			<Button
				variant="secondary"
				size="sm"
				onclick={loadSessions}
				disabled={loading}
				aria-label="Refresh sessions list"
			>
				{#if loading}
					<LoadingSpinner size="xs" />
					<span>Loading...</span>
				{:else}
					🔄 Refresh
				{/if}
			</Button>

			{#if sessionStats.active > 1}
				<Button
					variant="danger"
					size="sm"
					onclick={confirmLogoutAll}
					data-testid="logout-all-btn"
					aria-label="Logout from all other sessions"
				>
					Logout All Others
				</Button>
			{/if}
		</div>
	</div>

	<!-- Status Messages -->
	{#if error}
		<div class="status-message error" role="alert">
			<span class="message-icon">⚠️</span>
			<span class="message-text">{error}</span>
			<button class="message-close" onclick={clearMessages} aria-label="Dismiss error">
				×
			</button>
		</div>
	{/if}

	{#if success}
		<div class="status-message success" role="alert">
			<span class="message-icon">✅</span>
			<span class="message-text">{success}</span>
			<button class="message-close" onclick={clearMessages} aria-label="Dismiss success message">
				×
			</button>
		</div>
	{/if}

	<!-- Loading State -->
	{#if loading && sessions.length === 0}
		<div class="loading-state">
			<LoadingSpinner size="lg" />
			<p>Loading your sessions...</p>
		</div>
	{:else if sessions.length === 0 && !loading}
		<div class="empty-state">
			<div class="empty-icon">🔒</div>
			<h4>No Sessions Found</h4>
			<p>You don't have any active sessions. This might indicate a configuration issue.</p>
		</div>
	{:else}
		<!-- Current Session (if enabled) -->
		{#if showCurrentSession && currentSession}
			<div class="current-session-section">
				<h4>Current Session</h4>
				<div class="session-card current">
					<div class="session-main">
						<div class="session-info">
							<div class="session-header">
								<span class="device-icon" aria-hidden="true">
									{getDeviceIcon(currentSession.userAgent)}
								</span>
								<div class="session-title">
									<h5 class="session-device">{currentSession.deviceName || 'Unknown Device'}</h5>
									<div class="session-status">
										<span class="status-icon" aria-hidden="true">📍</span>
										<span class="status-text current">Current Session</span>
									</div>
								</div>
							</div>

							{#if !compact}
								<div class="session-details">
									<div class="detail-item">
										<span class="detail-label">Started:</span>
										<span class="detail-value">{formatRelativeTime(currentSession.createdAt)}</span>
									</div>
									<div class="detail-item">
										<span class="detail-label">Expires:</span>
										<span class="detail-value">{formatDate(currentSession.expiresAt)}</span>
									</div>
									{#if currentSession.lastActivity}
										<div class="detail-item">
											<span class="detail-label">Last activity:</span>
											<span class="detail-value">{formatRelativeTime(currentSession.lastActivity)}</span>
										</div>
									{/if}
								</div>
							{/if}
						</div>

						<div class="session-actions">
							<Button
								variant="secondary"
								size="sm"
								onclick={() => openSessionDetails(currentSession)}
								aria-label="View session details"
								data-testid="session-details-btn"
							>
								Details
							</Button>

							<Button
								variant="danger"
								size="sm"
								onclick={logoutCurrent}
								aria-label="Logout from current session"
								data-testid="logout-current-btn"
							>
								Logout
							</Button>
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- All Sessions List -->
		<div class="sessions-section">
			<h4>All Sessions ({sessions.length})</h4>
			<div class="sessions-list" class:compact>
				{#each sessions as session (session.id)}
					{@const status = getSessionStatus(session)}
					<div class="session-card" class:current={session.id === currentSession?.id} class:expired={status.class === 'expired'}>
						<div class="session-main">
							<div class="session-info">
								<div class="session-header">
									<span class="device-icon" aria-hidden="true">
										{getDeviceIcon(session.userAgent)}
									</span>
									<div class="session-title">
										<h5 class="session-device">{session.deviceName || 'Unknown Device'}</h5>
										<div class="session-status">
											<span class="status-icon" aria-hidden="true">{status.icon}</span>
											<span class="status-text {status.class}">{status.text}</span>
										</div>
									</div>
								</div>

								{#if !compact}
									<div class="session-details">
										<div class="detail-item">
											<span class="detail-label">Started:</span>
											<span class="detail-value">{formatRelativeTime(session.createdAt)}</span>
										</div>
										<div class="detail-item">
											<span class="detail-label">Expires:</span>
											<span class="detail-value">{formatDate(session.expiresAt)}</span>
										</div>
										{#if session.lastActivity}
											<div class="detail-item">
												<span class="detail-label">Last activity:</span>
												<span class="detail-value">{formatRelativeTime(session.lastActivity)}</span>
											</div>
										{/if}
										{#if session.ipAddress}
											<div class="detail-item">
												<span class="detail-label">IP Address:</span>
												<span class="detail-value ip-address">{session.ipAddress}</span>
											</div>
										{/if}
									</div>
								{/if}
							</div>

							<div class="session-actions">
								<Button
									variant="secondary"
									size="sm"
									onclick={() => openSessionDetails(session)}
									aria-label="View session details"
									data-testid="session-details-btn-{session.id}"
								>
									Details
								</Button>

								{#if session.id !== currentSession?.id && status.class !== 'expired'}
									<Button
										variant="danger"
										size="sm"
										onclick={() => confirmLogoutSession(session)}
										aria-label="Terminate session"
										data-testid="session-logout-btn-{session.id}"
									>
										Terminate
									</Button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		{#if !compact}
			<div class="security-notice">
				<span class="notice-icon">🔒</span>
				<div class="notice-text">
					<strong>Session Security:</strong>
					Sessions are automatically terminated when they expire or when you logout.
					If you see unfamiliar sessions, terminate them immediately and check your device security.
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- Session Details Modal -->
{#if showSessionDetails && selectedSession}
	<Modal
		open={showSessionDetails}
		title="Session Details"
		size="medium"
		onclose={() => showSessionDetails = false}
		data-testid="session-details-modal"
	>
		{#snippet children()}
			<div class="session-details-content">
				<div class="detail-section">
					<h4>Session Information</h4>
					<div class="detail-grid">
						<div class="detail-row">
							<span class="detail-label">Session ID:</span>
							<span class="detail-value session-id">{selectedSession.id}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Device:</span>
							<span class="detail-value">{selectedSession.deviceName || 'Unknown Device'}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Status:</span>
							<span class="detail-value">
								{getSessionStatus(selectedSession).text}
							</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Started:</span>
							<span class="detail-value">{formatDate(selectedSession.createdAt)}</span>
						</div>
						<div class="detail-row">
							<span class="detail-label">Expires:</span>
							<span class="detail-value">{formatDate(selectedSession.expiresAt)}</span>
						</div>
						{#if selectedSession.lastActivity}
							<div class="detail-row">
								<span class="detail-label">Last Activity:</span>
								<span class="detail-value">{formatDate(selectedSession.lastActivity)}</span>
							</div>
						{/if}
					</div>
				</div>

				{#if selectedSession.ipAddress}
					<div class="detail-section">
						<h4>Connection Information</h4>
						<div class="connection-info">
							<div class="detail-row">
								<span class="detail-label">IP Address:</span>
								<span class="detail-value ip-address">{selectedSession.ipAddress}</span>
							</div>
							{#if selectedSession.userAgent}
								<div class="detail-row">
									<span class="detail-label">User Agent:</span>
									<div class="user-agent">{selectedSession.userAgent}</div>
								</div>
							{/if}
						</div>
					</div>
				{/if}

				{#if selectedSession.authMethod}
					<div class="detail-section">
						<h4>Authentication</h4>
						<div class="auth-info">
							<div class="detail-row">
								<span class="detail-label">Method:</span>
								<span class="detail-value auth-method">{selectedSession.authMethod}</span>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="modal-actions">
				<Button
					variant="secondary"
					onclick={() => showSessionDetails = false}
				>
					Close
				</Button>
				{#if selectedSession.id !== currentSession?.id && getSessionStatus(selectedSession).class !== 'expired'}
					<Button
						variant="danger"
						onclick={() => {
							showSessionDetails = false;
							confirmLogoutSession(selectedSession);
						}}
					>
						Terminate Session
					</Button>
				{/if}
			</div>
		{/snippet}
	</Modal>
{/if}

<!-- Logout Session Confirmation -->
{#if showLogoutConfirm && selectedSession}
	<ConfirmationDialog
		title="Terminate Session"
		message={`Are you sure you want to terminate the session on "${selectedSession.deviceName || 'Unknown Device'}"? This will immediately log out that device.`}
		confirmText="Terminate Session"
		confirmVariant="danger"
		onconfirm={() => logoutSession(selectedSession.id)}
		oncancel={() => {
			showLogoutConfirm = false;
			selectedSession = null;
		}}
		data-testid="logout-session-confirm"
	/>
{/if}

<!-- Logout All Sessions Confirmation -->
{#if showLogoutAllConfirm}
	<ConfirmationDialog
		title="Terminate All Other Sessions"
		message={`Are you sure you want to terminate all other active sessions? This will log out all other devices except the current one. You have ${sessionStats.active - 1} other active session${sessionStats.active - 1 !== 1 ? 's' : ''}.`}
		confirmText="Terminate All Others"
		confirmVariant="danger"
		onconfirm={logoutAllSessions}
		oncancel={() => showLogoutAllConfirm = false}
		data-testid="logout-all-confirm"
	/>
{/if}

<style>
	.session-manager {
		width: 100%;
	}

	.session-manager.compact {
		--spacing-sm: 0.5rem;
		--spacing-md: 0.75rem;
	}

	/* Header */
	.manager-header {
		margin-bottom: 1.5rem;
		text-align: center;
	}

	.manager-header h3 {
		margin: 0 0 0.5rem 0;
		color: var(--color-text);
		font-size: 1.5rem;
		font-weight: 600;
	}

	.subtitle {
		margin: 0;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
	}

	/* Action Bar */
	.action-bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: var(--color-bg-secondary);
		border-radius: 6px;
		border: 1px solid var(--color-border);
	}

	.session-stats {
		display: flex;
		gap: 1.5rem;
	}

	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--color-primary);
	}

	.stat-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.action-buttons {
		display: flex;
		gap: 0.5rem;
	}

	/* Status Messages */
	.status-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		margin-bottom: 1rem;
		border-radius: 6px;
		border: 1px solid;
		font-size: 0.875rem;
	}

	.status-message.error {
		background: var(--color-error-bg);
		border-color: var(--color-error);
		color: var(--color-error);
	}

	.status-message.success {
		background: var(--color-success-bg);
		border-color: var(--color-success);
		color: var(--color-success);
	}

	.message-icon {
		flex-shrink: 0;
		font-size: 1rem;
	}

	.message-text {
		flex: 1;
	}

	.message-close {
		background: none;
		border: none;
		font-size: 1.25rem;
		cursor: pointer;
		padding: 0;
		color: inherit;
		opacity: 0.7;
		transition: opacity 0.2s;
	}

	.message-close:hover {
		opacity: 1;
	}

	/* Loading and Empty States */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem;
		text-align: center;
	}

	.loading-state p {
		margin: 0;
		color: var(--color-text-secondary);
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.empty-state h4 {
		margin: 0 0 0.5rem 0;
		color: var(--color-text);
		font-size: 1.25rem;
	}

	.empty-state p {
		margin: 0;
		color: var(--color-text-secondary);
	}

	/* Session Sections */
	.current-session-section,
	.sessions-section {
		margin-bottom: 1.5rem;
	}

	.current-session-section h4,
	.sessions-section h4 {
		margin: 0 0 1rem 0;
		color: var(--color-text);
		font-size: 1.125rem;
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0.5rem;
	}

	/* Sessions List */
	.sessions-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.sessions-list.compact {
		gap: 0.75rem;
	}

	/* Session Cards */
	.session-card {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 8px;
		transition: border-color 0.2s ease;
	}

	.session-card.current {
		border-color: var(--color-primary);
		background: var(--color-primary-alpha);
	}

	.session-card.expired {
		opacity: 0.6;
		background: var(--color-bg-tertiary);
	}

	.session-card:hover {
		border-color: var(--color-primary-light);
	}

	.session-main {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 1rem;
		gap: 1rem;
	}

	/* Session Info */
	.session-info {
		flex: 1;
		min-width: 0;
	}

	.session-header {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.device-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.session-title {
		flex: 1;
		min-width: 0;
	}

	.session-device {
		margin: 0 0 0.25rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--color-text);
		word-break: break-word;
	}

	.session-status {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		font-size: 0.8rem;
	}

	.status-icon {
		font-size: 0.7rem;
	}

	.status-text {
		font-weight: 500;
	}

	.status-text.current {
		color: var(--color-primary);
	}

	.status-text.active {
		color: var(--color-success);
	}

	.status-text.expired {
		color: var(--color-error);
	}

	/* Session Details */
	.session-details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 0.5rem;
		margin-left: 2.25rem; /* Align with session title */
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.detail-label {
		font-size: 0.7rem;
		font-weight: 600;
		color: var(--color-text-secondary);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.detail-value {
		font-size: 0.8rem;
		color: var(--color-text);
		word-break: break-word;
	}

	.ip-address {
		font-family: monospace;
		font-size: 0.75rem;
		background: var(--color-bg-secondary);
		padding: 0.125rem 0.25rem;
		border-radius: 3px;
	}

	/* Session Actions */
	.session-actions {
		display: flex;
		gap: 0.5rem;
		flex-shrink: 0;
		align-items: flex-start;
	}

	/* Security Notice */
	.security-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		padding: 1rem;
		margin-top: 1.5rem;
		background: var(--color-info-bg);
		border: 1px solid var(--color-info);
		border-radius: 6px;
		font-size: 0.875rem;
		color: var(--color-info);
	}

	.notice-icon {
		flex-shrink: 0;
		font-size: 1rem;
	}

	.notice-text {
		line-height: 1.4;
	}

	/* Modal Content */
	.session-details-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.detail-section h4 {
		margin: 0 0 0.75rem 0;
		color: var(--color-text);
		font-size: 1rem;
		font-weight: 600;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: 0.5rem;
	}

	.detail-grid {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.detail-row {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-border-light);
		gap: 1rem;
	}

	.detail-row:last-child {
		border-bottom: none;
	}

	.detail-row .detail-label {
		font-weight: 500;
		color: var(--color-text-secondary);
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.detail-row .detail-value {
		font-weight: 400;
		color: var(--color-text);
		font-size: 0.875rem;
		text-align: right;
		word-break: break-word;
		flex: 1;
	}

	.session-id {
		font-family: monospace;
		font-size: 0.75rem;
		background: var(--color-bg-secondary);
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
	}

	.user-agent {
		font-family: monospace;
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		word-break: break-all;
		text-align: right;
		background: var(--color-bg-secondary);
		padding: 0.5rem;
		border-radius: 4px;
		margin-top: 0.25rem;
	}

	.auth-method {
		text-transform: capitalize;
		font-weight: 500;
		color: var(--color-primary);
	}

	.modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
		padding-top: 1.5rem;
		border-top: 1px solid var(--color-border);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.session-main {
			flex-direction: column;
			gap: 1rem;
		}

		.session-actions {
			align-self: stretch;
			justify-content: center;
		}

		.session-details {
			margin-left: 0;
			grid-template-columns: 1fr;
		}

		.action-bar {
			flex-direction: column;
			gap: 0.75rem;
		}

		.session-stats {
			gap: 2rem;
		}

		.detail-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}

		.detail-row .detail-value {
			text-align: left;
		}

		.user-agent {
			text-align: left;
		}
	}

	@media (max-width: 480px) {
		.session-card {
			border-radius: 6px;
		}

		.session-main {
			padding: 0.75rem;
		}

		.session-actions {
			flex-wrap: wrap;
		}

		.security-notice {
			padding: 0.75rem;
			font-size: 0.8rem;
		}

		.action-buttons {
			flex-wrap: wrap;
		}
	}
</style>