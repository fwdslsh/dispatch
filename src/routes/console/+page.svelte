<script>
	import { onMount, onDestroy } from 'svelte';
	import { io } from 'socket.io-client';
	import Shell from '$lib/client/shared/components/Shell.svelte';

	let socket = null;
	let activeSockets = [];
	let socketEvents = [];
	let serverLogs = [];
	let socketHistories = [];
	let selectedHistory = null;
	let selectedTab = 'sockets';

	onMount(() => {
		initializeAdminConsole();

		return () => {
			if (socket) {
				socket.disconnect();
			}
		};
	});
	// Helper to get Authorization header from localStorage
	function getAuthHeaders() {
		const key =
			typeof localStorage !== 'undefined' ? localStorage.getItem('dispatch-auth-key') : null;
		return key ? { Authorization: `Bearer ${key}` } : {};
	}
	function initializeAdminConsole() {
		// Initialize Socket.IO connection for admin features
		// Use current origin for socket connection to support remote access
		socket = io(window.location.origin);

		// Load initial data
		loadActiveSockets();
		loadServerLogs();
		loadSocketHistories();

		// Set up real-time updates
		socket.on('admin.socket.connected', (socketInfo) => {
			activeSockets = [...activeSockets, socketInfo];
		});

		socket.on('admin.socket.disconnected', (socketId) => {
			activeSockets = activeSockets.filter((s) => s.id !== socketId);
		});

		socket.on('admin.event.logged', (eventData) => {
			socketEvents = [eventData, ...socketEvents].slice(0, 100); // Keep last 100 events
		});
	}

	async function loadActiveSockets() {
		try {
			const response = await fetch('/api/admin/sockets', { headers: getAuthHeaders() });
			if (response.ok) {
				const data = await response.json();
				activeSockets = data.sockets || [];
			}
		} catch (error) {
			console.error('Failed to load active sockets:', error);
		}
	}

	async function loadServerLogs() {
		try {
			// Add ?key=test in dev mode for API auth
			let logsUrl = '/api/admin/logs';
			if (import.meta.env && import.meta.env.DEV) {
				logsUrl += '?key=test';
			}
			const response = await fetch(logsUrl, { headers: getAuthHeaders() });
			if (response.ok) {
				const data = await response.json();
				serverLogs = data.logs || [];
			}
		} catch (error) {
			console.error('Failed to load server logs:', error);
		}
	}

	async function loadSocketHistories() {
		try {
			const response = await fetch('/api/admin/history', { headers: getAuthHeaders() });
			if (response.ok) {
				const data = await response.json();
				socketHistories = data.histories || [];
			}
		} catch (error) {
			console.error('Failed to load socket histories:', error);
		}
	}

	async function loadSocketHistory(socketId) {
		try {
			const response = await fetch(`/api/admin/history/${socketId}`, { headers: getAuthHeaders() });
			if (response.ok) {
				const data = await response.json();
				selectedHistory = data.history;
			} else {
				selectedHistory = null;
				console.error('Failed to load socket history');
			}
		} catch (error) {
			console.error('Failed to load socket history:', error);
			selectedHistory = null;
		}
	}

	async function disconnectSocket(socketId) {
		if (!confirm(`Are you sure you want to disconnect socket ${socketId}?`)) {
			return;
		}

		try {
			const response = await fetch(`/api/admin/sockets/${socketId}/disconnect`, {
				method: 'POST',
				headers: {
					...getAuthHeaders(),
					'Content-Type': 'application/json'
				}
			});

			if (response.ok) {
				// Remove from local list immediately
				activeSockets = activeSockets.filter((s) => s.id !== socketId);
			} else {
				console.error('Failed to disconnect socket');
			}
		} catch (error) {
			console.error('Failed to disconnect socket:', error);
		}
	}

	function formatTimestamp(timestamp) {
		return new Date(timestamp).toLocaleString();
	}

	function formatUptime(connectedAt) {
		const now = Date.now();
		const diff = now - connectedAt;
		const minutes = Math.floor(diff / 60000);
		const seconds = Math.floor((diff % 60000) / 1000);
		return `${minutes}m ${seconds}s`;
	}

	function formatFileSize(bytes) {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function getEventTypeClass(eventType) {
		if (eventType === 'connection') return 'event-connection';
		if (eventType === 'disconnect') return 'event-disconnect';
		if (eventType.includes('auth')) return 'event-auth';
		if (eventType.includes('.send') || eventType.includes('.write')) return 'event-input';
		if (eventType.includes('.data') || eventType.includes('.delta')) return 'event-output';
		return 'event-system';
	}

	function selectSocketHistory(socketId) {
		loadSocketHistory(socketId);
	}

	function goBackToHistoryList() {
		selectedHistory = null;
	}
</script>

<svelte:head>
	<title>Admin Console - Dispatch</title>
</svelte:head>

<Shell>
	<div class="console-container">
		<!-- Console Header -->
		<header class="console-header">
			<div class="container">
				<div class="header-content">
					<h1 class="glow">Admin Console</h1>
					<div class="cluster">
						<span class="session-indicator active">Real-time monitoring</span>
						<button
							onclick={() => location.reload()}
							class="button aug ghost"
							data-augmented-ui="tl-clip br-clip both"
						>
							Refresh
						</button>
					</div>
				</div>
			</div>
		</header>

		<!-- Navigation Tabs -->
		<nav class="console-nav">
			<div class="container">
				<div class="nav-tabs">
					<button
						class="nav-tab {selectedTab === 'sockets' ? 'active' : ''}"
						onclick={() => (selectedTab = 'sockets')}
					>
						<span class="tab-label">Active Sockets</span>
						<span class="badge ok">{activeSockets.length}</span>
					</button>
					<button
						class="nav-tab {selectedTab === 'events' ? 'active' : ''}"
						onclick={() => (selectedTab = 'events')}
					>
						<span class="tab-label">Socket Events</span>
						<span class="badge">{socketEvents.length}</span>
					</button>
					<button
						class="nav-tab {selectedTab === 'history' ? 'active' : ''}"
						onclick={() => {
							selectedTab = 'history';
							selectedHistory = null;
						}}
					>
						<span class="tab-label">Socket History</span>
						<span class="badge">{socketHistories.length}</span>
					</button>
					<button
						class="nav-tab {selectedTab === 'logs' ? 'active' : ''}"
						onclick={() => (selectedTab = 'logs')}
					>
						<span class="tab-label">Server Logs</span>
						<span class="badge">{serverLogs.length}</span>
					</button>
				</div>
			</div>
		</nav>

		<!-- Main Content Area -->
		<main class="console-content">
			<div class="container">
				{#if selectedTab === 'sockets'}
					<section class="tab-section">
						<h2>Active Sockets</h2>
						{#if activeSockets.length === 0}
							<div class="empty-state card aug" data-augmented-ui="tl-clip br-clip both">
								<p>No active sockets</p>
							</div>
						{:else}
							<div class="term-grid">
								{#each activeSockets as socket}
									<div class="card aug socket-card" data-augmented-ui="tl-clip br-clip both">
										<div class="socket-header">
											<h3 class="session-indicator">Socket {socket.id}</h3>
											<button
												onclick={() => disconnectSocket(socket.id)}
												class="button danger aug"
												data-augmented-ui="tl-clip br-clip both"
											>
												Disconnect
											</button>
										</div>
										<div class="socket-details stack">
											<div class="detail-row">
												<span class="label muted">IP Address:</span>
												<span class="value">{socket.ip || 'Unknown'}</span>
											</div>
											<div class="detail-row">
												<span class="label muted">Connected:</span>
												<span class="value">{formatTimestamp(socket.connectedAt)}</span>
											</div>
											<div class="detail-row">
												<span class="label muted">Uptime:</span>
												<span class="value">{formatUptime(socket.connectedAt)}</span>
											</div>
											<div class="detail-row">
												<span class="label muted">Authenticated:</span>
												<span class="value">
													{#if socket.authenticated}
														<span class="badge ok">Yes</span>
													{:else}
														<span class="badge err">No</span>
													{/if}
												</span>
											</div>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{:else if selectedTab === 'events'}
					<section class="tab-section">
						<h2>Socket Events Monitor</h2>
						{#if socketEvents.length === 0}
							<div class="empty-state card aug" data-augmented-ui="tl-clip br-clip both">
								<p>No events logged yet</p>
							</div>
						{:else}
							<div class="events-list">
								{#each socketEvents as event}
									<div
										class="panel aug event-card {getEventTypeClass(event.type)}"
										data-augmented-ui="tl-clip br-clip both"
									>
										<div class="event-header">
											<span class="badge">{event.type}</span>
											<span class="muted">{formatTimestamp(event.timestamp)}</span>
										</div>
										<div class="event-details stack">
											<div class="detail-row">
												<span class="label muted">Socket:</span>
												<span class="value">{event.socketId}</span>
											</div>
											{#if event.data}
												<div class="event-data-section">
													<span class="label muted">Data:</span>
													<pre class="event-data">{JSON.stringify(event.data, null, 2)}</pre>
												</div>
											{/if}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{:else if selectedTab === 'logs'}
					<section class="tab-section">
						<h2>Server Logs</h2>
						{#if serverLogs.length === 0}
							<div class="empty-state card aug" data-augmented-ui="tl-clip br-clip both">
								<p>No server logs available</p>
							</div>
						{:else}
							<div class="logs-container panel aug" data-augmented-ui="tl-clip br-clip both">
								<div class="logs-list">
									{#each serverLogs as log}
										<div class="log-entry log-{log.level}">
											<span class="log-timestamp muted">{formatTimestamp(log.timestamp)}</span>
											<span class="log-level badge {log.level}">[{log.level.toUpperCase()}]</span>
											<span class="log-message">{log.message}</span>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</section>
				{:else if selectedTab === 'history'}
					<section class="tab-section">
						{#if selectedHistory}
							<!-- Individual Socket History View -->
							<div class="history-detail">
								<div class="history-header cluster">
									<button
										onclick={goBackToHistoryList}
										class="button aug"
										data-augmented-ui="tl-clip br-clip both"
									>
										← Back
									</button>
									<h2>Socket History: {selectedHistory.socketId}</h2>
								</div>

								<div class="card aug history-metadata" data-augmented-ui="tl-clip br-clip both">
									<h3>Socket Information</h3>
									<div class="metadata-grid">
										<div class="detail-row">
											<span class="label muted">Socket ID:</span>
											<span class="value">{selectedHistory.socketId}</span>
										</div>
										<div class="detail-row">
											<span class="label muted">Connected:</span>
											<span class="value"
												>{formatTimestamp(selectedHistory.metadata.connectedAt)}</span
											>
										</div>
										<div class="detail-row">
											<span class="label muted">IP Address:</span>
											<span class="value">{selectedHistory.metadata.ip}</span>
										</div>
										<div class="detail-row">
											<span class="label muted">User Agent:</span>
											<span class="value">{selectedHistory.metadata.userAgent}</span>
										</div>
										{#if selectedHistory.metadata.sessionType}
											<div class="detail-row">
												<span class="label muted">Session Type:</span>
												<span class="badge">{selectedHistory.metadata.sessionType}</span>
											</div>
										{/if}
										{#if selectedHistory.metadata.sessionName}
											<div class="detail-row">
												<span class="label muted">Session Name:</span>
												<span class="value">{selectedHistory.metadata.sessionName}</span>
											</div>
										{/if}
										{#if selectedHistory.metadata.cwd}
											<div class="detail-row">
												<span class="label muted">Working Directory:</span>
												<span class="value prompt">{selectedHistory.metadata.cwd}</span>
											</div>
										{/if}
									</div>
								</div>

								<div class="panel aug history-events" data-augmented-ui="tl-clip br-clip both">
									<h3>Communication Events ({selectedHistory.events.length})</h3>
									{#if selectedHistory.events.length === 0}
										<p class="empty-state">No events recorded</p>
									{:else}
										<div class="events-timeline">
											{#each selectedHistory.events as event}
												<div class="timeline-event {getEventTypeClass(event.type)}">
													<div class="event-header cluster">
														<span class="badge">{event.type}</span>
														<span class="badge direction-{event.direction}">{event.direction}</span>
														<span class="muted">{formatTimestamp(event.timestamp)}</span>
													</div>
													{#if event.data}
														<div class="event-data-container">
															<pre class="event-data">{JSON.stringify(event.data, null, 2)}</pre>
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{:else}
							<!-- Socket History List View -->
							<div class="history-list-header cluster">
								<h2>Socket History</h2>
								<button
									onclick={loadSocketHistories}
									class="button aug"
									data-augmented-ui="tl-clip br-clip both"
								>
									Refresh
								</button>
							</div>

							{#if socketHistories.length === 0}
								<div class="empty-state card aug" data-augmented-ui="tl-clip br-clip both">
									<p>No socket histories available</p>
								</div>
							{:else}
								<div class="term-grid">
									{#each socketHistories as history}
										<div
											class="card aug history-card {history.isActive ? 'active' : ''}"
											data-augmented-ui="tl-clip br-clip both"
										>
											<div class="history-card-header">
												<h3 class="session-indicator {history.isActive ? 'active' : ''}">
													Socket {history.socketId}
												</h3>
												<div class="history-status">
													{#if history.isActive}
														<span class="badge ok">Active</span>
													{:else}
														<span class="badge">Disconnected</span>
													{/if}
												</div>
											</div>

											<div class="history-card-details stack">
												<div class="detail-row">
													<span class="label muted">Created:</span>
													<span class="value">{formatTimestamp(history.createdAt)}</span>
												</div>
												<div class="detail-row">
													<span class="label muted">Last Updated:</span>
													<span class="value">{formatTimestamp(history.updatedAt)}</span>
												</div>
												<div class="detail-row">
													<span class="label muted">Last Event:</span>
													<span class="value"
														>{history.lastEventTime
															? formatTimestamp(history.lastEventTime)
															: '—'}</span
													>
												</div>
												<div class="detail-row">
													<span class="label muted">Events:</span>
													<span class="value">{history.eventCount}</span>
												</div>
												<div class="detail-row">
													<span class="label muted">IP:</span>
													<span class="value">{history.metadata?.ip || '—'}</span>
												</div>
												<div class="detail-row">
													<span class="label muted">User Agent:</span>
													<span class="value">{history.metadata?.userAgent || '—'}</span>
												</div>
											</div>

											<div class="history-card-actions">
												<button
													onclick={() => selectSocketHistory(history.socketId)}
													class="button primary aug"
													data-augmented-ui="tl-clip br-clip both"
												>
													View History
												</button>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						{/if}
					</section>
				{/if}
			</div>
		</main>
	</div>
</Shell>

<style>
	/* Container and Layout */
	.console-container {
		min-height: 100vh;
		background: var(--bg);
	}

	/* Console Header */
	.console-header {
		background: var(--surface);
		border-bottom: 1px solid var(--line);
		padding: var(--space-5) 0;
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-4);
	}

	.console-header h1 {
		margin: 0;
	}

	/* Navigation */
	.console-nav {
		background: var(--elev);
		border-bottom: 1px solid var(--line);
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.nav-tabs {
		display: flex;
		gap: 0;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.nav-tab {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--space-4) var(--space-5);
		background: none;
		border: none;
		color: var(--muted);
		cursor: pointer;
		border-bottom: 3px solid transparent;
		transition: all 0.2s ease;
		white-space: nowrap;
		font-family: var(--font-mono);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.nav-tab:hover {
		color: var(--text);
		background: color-mix(in oklab, var(--surface) 50%, transparent);
	}

	.nav-tab.active {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.tab-label {
		font-size: var(--font-size-1);
	}

	/* Content Area */
	.console-content {
		padding: var(--space-6) 0;
	}

	.tab-section h2 {
		margin-bottom: var(--space-5);
	}

	/* Empty State */
	.empty-state {
		text-align: center;
		padding: var(--space-6);
		color: var(--muted);
		font-style: italic;
	}

	/* Socket Cards */
	.socket-card {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.socket-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: var(--space-4);
		gap: var(--space-3);
	}

	.socket-header h3 {
		margin: 0;
		font-size: var(--font-size-2);
		word-break: break-all;
	}

	.socket-details {
		flex: 1;
	}

	.detail-row {
		display: flex;
		gap: var(--space-2);
		align-items: baseline;
		flex-wrap: wrap;
	}

	.label {
		font-weight: 600;
		min-width: 120px;
	}

	.value {
		color: var(--text);
		word-break: break-word;
	}

	/* Events */
	.events-list {
		display: grid;
		gap: var(--space-4);
		max-height: 70vh;
		overflow-y: auto;
		padding-right: var(--space-2);
	}

	.event-card {
		position: relative;
	}

	.event-card.event-connection {
		border-left: 4px solid var(--ok);
	}

	.event-card.event-disconnect {
		border-left: 4px solid var(--err);
	}

	.event-card.event-auth {
		border-left: 4px solid var(--warn);
	}

	.event-card.event-input {
		border-left: 4px solid var(--accent);
	}

	.event-card.event-output {
		border-left: 4px solid var(--info);
	}

	.event-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-3);
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.event-details {
		gap: var(--space-3);
	}

	.event-data-section {
		margin-top: var(--space-3);
	}

	.event-data {
		background: var(--bg);
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: var(--space-3);
		font-size: var(--font-size-0);
		color: var(--text);
		overflow-x: auto;
		margin: var(--space-2) 0 0 0;
		max-height: 300px;
		overflow-y: auto;
	}

	/* Logs */
	.logs-container {
		max-height: 70vh;
		overflow: hidden;
	}

	.logs-list {
		padding: var(--space-4);
		overflow-y: auto;
		max-height: calc(70vh - var(--space-6));
		font-family: var(--font-mono);
	}

	.log-entry {
		display: flex;
		gap: var(--space-3);
		margin-bottom: var(--space-2);
		padding: var(--space-1) 0;
		align-items: baseline;
		flex-wrap: wrap;
	}

	.log-timestamp {
		min-width: 150px;
		font-size: var(--font-size-0);
	}

	.log-level {
		min-width: 60px;
		text-align: center;
	}

	.log-level.error,
	.badge.error {
		background-color: var(--err);
		color: var(--bg);
	}

	.log-level.warn,
	.badge.warn {
		background-color: var(--warn);
		color: var(--bg);
	}

	.log-level.info,
	.badge.info {
		background-color: var(--info);
		color: var(--bg);
	}

	.log-level.debug,
	.badge.debug {
		background-color: var(--muted);
		color: var(--bg);
	}

	.log-message {
		flex: 1;
		word-break: break-word;
	}

	/* History */
	.history-list-header {
		margin-bottom: var(--space-5);
	}

	.history-card.active {
		--aug-border-bg: var(--ok);
		--aug-border-opacity: 0.4;
	}

	.history-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--space-4);
		gap: var(--space-3);
	}

	.history-card-header h3 {
		margin: 0;
		font-size: var(--font-size-2);
	}

	.history-card-details {
		margin-bottom: var(--space-4);
	}

	.history-card-actions {
		margin-top: auto;
		padding-top: var(--space-4);
	}

	/* History Detail */
	.history-detail {
		max-width: 100%;
	}

	.history-header {
		margin-bottom: var(--space-5);
	}

	.history-metadata,
	.history-events {
		margin-bottom: var(--space-5);
	}

	.metadata-grid {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-4);
	}

	.events-timeline {
		max-height: 60vh;
		overflow-y: auto;
		display: grid;
		gap: var(--space-4);
		padding-right: var(--space-2);
		margin-top: var(--space-4);
	}

	.timeline-event {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: 6px;
		padding: var(--space-4);
	}

	.timeline-event.event-connection {
		border-left: 4px solid var(--ok);
	}

	.timeline-event.event-disconnect {
		border-left: 4px solid var(--err);
	}

	.timeline-event.event-auth {
		border-left: 4px solid var(--warn);
	}

	.timeline-event.event-input {
		border-left: 4px solid var(--accent);
	}

	.timeline-event.event-output {
		border-left: 4px solid var(--info);
	}

	.timeline-event.event-system {
		border-left: 4px solid var(--muted);
	}

	.event-data-container {
		margin-top: var(--space-3);
	}

	/* Direction badges */
	.direction-in {
		background-color: var(--accent);
		color: var(--bg);
	}

	.direction-out {
		background-color: var(--info);
		color: var(--bg);
	}

	.direction-system {
		background-color: var(--muted);
		color: var(--bg);
	}

	.direction-unknown {
		background-color: var(--surface);
		color: var(--text);
	}

	/* Responsive Design */
	@media (max-width: 768px) {
		.header-content {
			flex-direction: column;
			align-items: flex-start;
		}

		.nav-tabs {
			width: 100%;
		}

		.nav-tab {
			padding: var(--space-3) var(--space-4);
		}

		.detail-row {
			flex-direction: column;
			gap: var(--space-1);
		}

		.label {
			min-width: auto;
		}

		.socket-header {
			flex-direction: column;
			align-items: stretch;
		}

		.socket-header button {
			width: 100%;
		}
	}
</style>
