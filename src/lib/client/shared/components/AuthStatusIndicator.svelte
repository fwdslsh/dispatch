<script>
	import { onMount, createEventDispatcher } from 'svelte';

	const dispatch = createEventDispatcher();

	let {
		showSessionStatus = true,
		showExpiryWarning = true,
		showConnectionStatus = true,
		compact = false,
		warningThresholdMinutes = 15
	} = $props();

	let authStatus = $state({
		isAuthenticated: false,
		user: null,
		session: null,
		expiresAt: null,
		lastActivity: null,
		timeUntilExpiry: null,
		connectionStatus: 'checking'
	});

	let showingExpiryWarning = $state(false);
	let timeUntilExpiryText = $state('');
	let updateInterval;

	$effect(() => {
		checkAuthStatus();

		// Set up periodic updates
		updateInterval = setInterval(() => {
			updateExpiryStatus();
		}, 30000); // Update every 30 seconds

		return () => {
			if (updateInterval) {
				clearInterval(updateInterval);
			}
		};
	});

	async function checkAuthStatus() {
		try {
			authStatus.connectionStatus = 'checking';

			const response = await fetch('/api/auth/status');
			if (response.ok) {
				const data = await response.json();
				authStatus = {
					...authStatus,
					isAuthenticated: data.authenticated,
					user: data.user,
					session: data.session,
					expiresAt: data.session?.expiresAt,
					lastActivity: data.session?.lastActivity,
					connectionStatus: 'connected'
				};

				updateExpiryStatus();
			} else {
				authStatus = {
					...authStatus,
					isAuthenticated: false,
					user: null,
					session: null,
					connectionStatus: 'disconnected'
				};
			}
		} catch (error) {
			console.error('Failed to check auth status:', error);
			authStatus = {
				...authStatus,
				connectionStatus: 'error'
			};
		}
	}

	function updateExpiryStatus() {
		if (!authStatus.expiresAt) {
			authStatus.timeUntilExpiry = null;
			timeUntilExpiryText = '';
			showingExpiryWarning = false;
			return;
		}

		const now = new Date();
		const expiryDate = new Date(authStatus.expiresAt);
		const timeDiff = expiryDate.getTime() - now.getTime();

		authStatus.timeUntilExpiry = timeDiff;

		if (timeDiff <= 0) {
			// Session expired
			timeUntilExpiryText = 'Expired';
			showingExpiryWarning = true;
			dispatch('session-expired');
		} else {
			// Calculate time remaining
			const minutes = Math.floor(timeDiff / (1000 * 60));
			const hours = Math.floor(minutes / 60);
			const days = Math.floor(hours / 24);

			if (days > 0) {
				timeUntilExpiryText = `${days}d ${hours % 24}h`;
			} else if (hours > 0) {
				timeUntilExpiryText = `${hours}h ${minutes % 60}m`;
			} else {
				timeUntilExpiryText = `${minutes}m`;
			}

			// Show warning if expiring soon
			showingExpiryWarning = minutes <= warningThresholdMinutes;

			if (showingExpiryWarning && minutes <= 5) {
				dispatch('session-expiring-soon', { minutesRemaining: minutes });
			}
		}
	}

	function getConnectionStatusIcon() {
		switch (authStatus.connectionStatus) {
			case 'connected':
				return '🟢';
			case 'disconnected':
				return '🔴';
			case 'checking':
				return '🟡';
			case 'error':
				return '⚠️';
			default:
				return '❓';
		}
	}

	function getConnectionStatusText() {
		switch (authStatus.connectionStatus) {
			case 'connected':
				return 'Connected';
			case 'disconnected':
				return 'Disconnected';
			case 'checking':
				return 'Checking...';
			case 'error':
				return 'Connection Error';
			default:
				return 'Unknown';
		}
	}

	function getAuthStatusIcon() {
		if (!authStatus.isAuthenticated) return '🔒';
		if (authStatus.timeUntilExpiry && authStatus.timeUntilExpiry <= 0) return '⏰';
		if (showingExpiryWarning) return '⚠️';
		return '🔓';
	}

	function handleRefresh() {
		checkAuthStatus();
		dispatch('refresh');
	}

	function handleExtendSession() {
		dispatch('extend-session');
	}
</script>

<div class="auth-status-indicator {compact ? 'compact' : ''}" data-testid="auth-status-indicator">
	{#if showConnectionStatus}
		<div class="status-item connection-status">
			<span class="status-icon" title={getConnectionStatusText()}>
				{getConnectionStatusIcon()}
			</span>
			{#if !compact}
				<span class="status-text">{getConnectionStatusText()}</span>
			{/if}
		</div>
	{/if}

	{#if showSessionStatus && authStatus.isAuthenticated}
		<div class="status-item session-status">
			<span class="status-icon" title="Authentication Status">
				{getAuthStatusIcon()}
			</span>
			{#if !compact}
				<div class="session-details">
					<div class="session-user">
						{authStatus.user?.displayName || authStatus.user?.email || 'User'}
					</div>
					{#if authStatus.session}
						<div class="session-info">
							{authStatus.session.deviceName || 'Session'}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if showExpiryWarning && authStatus.isAuthenticated && authStatus.expiresAt}
		<div class="status-item expiry-status {showingExpiryWarning ? 'warning' : ''}">
			<span class="status-icon">⏱️</span>
			{#if !compact}
				<div class="expiry-details">
					<div class="expiry-text">
						{#if authStatus.timeUntilExpiry <= 0}
							Session Expired
						{:else}
							Expires in {timeUntilExpiryText}
						{/if}
					</div>
					{#if showingExpiryWarning && authStatus.timeUntilExpiry > 0}
						<button class="extend-button" onclick={handleExtendSession} title="Extend session">
							Extend
						</button>
					{/if}
				</div>
			{:else if showingExpiryWarning}
				<span class="compact-expiry" title="Session expires in {timeUntilExpiryText}">
					{timeUntilExpiryText}
				</span>
			{/if}
		</div>
	{/if}

	{#if !compact}
		<button class="refresh-button" onclick={handleRefresh} title="Refresh status"> 🔄 </button>
	{/if}
</div>

<style>
	.auth-status-indicator {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.5rem 0.75rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		transition: all 0.2s ease;
	}

	.auth-status-indicator.compact {
		gap: 0.5rem;
		padding: 0.375rem 0.5rem;
		font-size: 0.8125rem;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		min-width: 0;
	}

	.status-item.connection-status .status-text {
		color: #6b7280;
		font-weight: 500;
	}

	.status-item.session-status {
		border-left: 1px solid #e2e8f0;
		padding-left: 0.75rem;
	}

	.auth-status-indicator.compact .status-item.session-status {
		border-left: none;
		padding-left: 0;
	}

	.session-details {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.session-user {
		font-weight: 600;
		color: #374151;
		truncate: true;
	}

	.session-info {
		font-size: 0.75rem;
		color: #6b7280;
		truncate: true;
	}

	.status-item.expiry-status {
		border-left: 1px solid #e2e8f0;
		padding-left: 0.75rem;
	}

	.auth-status-indicator.compact .status-item.expiry-status {
		border-left: none;
		padding-left: 0;
	}

	.status-item.expiry-status.warning {
		color: #dc2626;
	}

	.status-item.expiry-status.warning .status-icon {
		animation: pulse 2s infinite;
	}

	.expiry-details {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: flex-start;
		min-width: 0;
	}

	.expiry-text {
		font-size: 0.8125rem;
		color: #6b7280;
		line-height: 1.3;
	}

	.status-item.expiry-status.warning .expiry-text {
		color: #dc2626;
		font-weight: 500;
	}

	.compact-expiry {
		font-size: 0.75rem;
		color: #dc2626;
		font-weight: 600;
	}

	.extend-button {
		font-size: 0.75rem;
		padding: 0.125rem 0.375rem;
		background: #dc2626;
		color: white;
		border: none;
		border-radius: 0.25rem;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.extend-button:hover {
		background: #b91c1c;
		transform: translateY(-1px);
	}

	.extend-button:active {
		transform: translateY(0);
	}

	.refresh-button {
		background: none;
		border: 1px solid #e2e8f0;
		border-radius: 0.25rem;
		padding: 0.25rem;
		cursor: pointer;
		font-size: 0.8125rem;
		color: #6b7280;
		transition: all 0.2s ease;
		margin-left: auto;
	}

	.refresh-button:hover {
		background: #f3f4f6;
		border-color: #d1d5db;
		color: #374151;
	}

	.status-icon {
		font-size: 1rem;
		line-height: 1;
		flex-shrink: 0;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.auth-status-indicator:not(.compact) {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.5rem;
		}

		.status-item.session-status,
		.status-item.expiry-status {
			border-left: none;
			padding-left: 0;
			border-top: 1px solid #e2e8f0;
			padding-top: 0.5rem;
			width: 100%;
		}

		.refresh-button {
			margin-left: 0;
			align-self: flex-end;
		}
	}
</style>
