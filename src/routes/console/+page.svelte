<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { io } from 'socket.io-client';

	export let data;
	
	let socket = null;
	let activeSockets = [];
	let socketEvents = [];
	let serverLogs = [];
	let socketHistories = [];
	let selectedHistory = null;
	let selectedTab = 'sockets';
	
	// Authentication state
	let terminalKey = '';
	let isAuthenticated = false;
	
	onMount(() => {
		// Check authentication
		const urlKey = $page.url.searchParams.get('key');
		if (urlKey && data.isAuthenticated) {
			terminalKey = urlKey;
			isAuthenticated = true;
			initializeAdminConsole();
		} else {
			// Show authentication form
			isAuthenticated = false;
		}
	});
	
	function authenticate() {
		if (terminalKey && terminalKey.trim()) {
			// Redirect with key parameter
			goto(`/console?key=${encodeURIComponent(terminalKey)}`);
		}
	}
	
	function initializeAdminConsole() {
		// Initialize Socket.IO connection for admin features
		socket = io();
		
		// Load initial data
		loadActiveSockets();
		loadServerLogs();
		loadSocketHistories();
		
		// Set up real-time updates
		socket.on('admin.socket.connected', (socketInfo) => {
			activeSockets = [...activeSockets, socketInfo];
		});
		
		socket.on('admin.socket.disconnected', (socketId) => {
			activeSockets = activeSockets.filter(s => s.id !== socketId);
		});
		
		socket.on('admin.event.logged', (eventData) => {
			socketEvents = [eventData, ...socketEvents].slice(0, 100); // Keep last 100 events
		});
	}
	
	async function loadActiveSockets() {
		try {
			const response = await fetch(`/api/admin/sockets?key=${encodeURIComponent(terminalKey)}`);
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
			const response = await fetch(`/api/admin/logs?key=${encodeURIComponent(terminalKey)}`);
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
			const response = await fetch(`/api/admin/history?key=${encodeURIComponent(terminalKey)}`);
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
			const response = await fetch(`/api/admin/history/${socketId}?key=${encodeURIComponent(terminalKey)}`);
			if (response.ok) {
				const data = await response.json();
				selectedHistory = data.history;
			} else {
				selectedHistory = null;
				alert('Failed to load socket history');
			}
		} catch (error) {
			console.error('Failed to load socket history:', error);
			selectedHistory = null;
			alert('Error loading socket history');
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
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ key: terminalKey })
			});
			
			if (response.ok) {
				// Remove from local list immediately
				activeSockets = activeSockets.filter(s => s.id !== socketId);
			} else {
				alert('Failed to disconnect socket');
			}
		} catch (error) {
			console.error('Failed to disconnect socket:', error);
			alert('Error disconnecting socket');
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

<div class="admin-console">
	{#if !isAuthenticated}
		<!-- Authentication Form -->
		<div class="auth-container">
			<div class="auth-form">
				<h1>Admin Console</h1>
				<p>Enter your terminal key to access the admin console:</p>
				<form on:submit|preventDefault={authenticate}>
					<input
						type="password"
						bind:value={terminalKey}
						placeholder="Terminal Key"
						required
						class="auth-input"
					/>
					<button type="submit" class="auth-button">Access Console</button>
				</form>
			</div>
		</div>
	{:else}
		<!-- Admin Console Interface -->
		<header class="console-header">
			<h1>Admin Console</h1>
			<div class="header-info">
				<span>Real-time monitoring and management</span>
				<button on:click={() => location.reload()} class="refresh-btn">Refresh</button>
			</div>
		</header>
		
		<nav class="console-nav">
			<button
				class="nav-tab {selectedTab === 'sockets' ? 'active' : ''}"
				on:click={() => selectedTab = 'sockets'}
			>
				Active Sockets ({activeSockets.length})
			</button>
			<button
				class="nav-tab {selectedTab === 'events' ? 'active' : ''}"
				on:click={() => selectedTab = 'events'}
			>
				Socket Events ({socketEvents.length})
			</button>
			<button
				class="nav-tab {selectedTab === 'history' ? 'active' : ''}"
				on:click={() => { selectedTab = 'history'; selectedHistory = null; }}
			>
				Socket History ({socketHistories.length})
			</button>
			<button
				class="nav-tab {selectedTab === 'logs' ? 'active' : ''}"
				on:click={() => selectedTab = 'logs'}
			>
				Server Logs ({serverLogs.length})
			</button>
		</nav>
		
		<main class="console-content">
			{#if selectedTab === 'sockets'}
				<div class="tab-content">
					<h2>Active Sockets</h2>
					{#if activeSockets.length === 0}
						<p class="empty-state">No active sockets</p>
					{:else}
						<div class="socket-list">
							{#each activeSockets as socket}
								<div class="socket-card">
									<div class="socket-header">
										<h3>Socket {socket.id}</h3>
										<button
											on:click={() => disconnectSocket(socket.id)}
											class="disconnect-btn"
										>
											Disconnect
										</button>
									</div>
									<div class="socket-details">
										<div class="detail-row">
											<span class="label">IP Address:</span>
											<span class="value">{socket.ip || 'Unknown'}</span>
										</div>
										<div class="detail-row">
											<span class="label">Connected:</span>
											<span class="value">{formatTimestamp(socket.connectedAt)}</span>
										</div>
										<div class="detail-row">
											<span class="label">Uptime:</span>
											<span class="value">{formatUptime(socket.connectedAt)}</span>
										</div>
										<div class="detail-row">
											<span class="label">Authenticated:</span>
											<span class="value {socket.authenticated ? 'authenticated' : 'not-authenticated'}">
												{socket.authenticated ? 'Yes' : 'No'}
											</span>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if selectedTab === 'events'}
				<div class="tab-content">
					<h2>Socket Events Monitor</h2>
					{#if socketEvents.length === 0}
						<p class="empty-state">No events logged yet</p>
					{:else}
						<div class="events-list">
							{#each socketEvents as event}
								<div class="event-card">
									<div class="event-header">
										<span class="event-type">{event.type}</span>
										<span class="event-timestamp">{formatTimestamp(event.timestamp)}</span>
									</div>
									<div class="event-details">
										<div class="detail-row">
											<span class="label">Socket:</span>
											<span class="value">{event.socketId}</span>
										</div>
										{#if event.data}
											<div class="detail-row">
												<span class="label">Data:</span>
												<pre class="event-data">{JSON.stringify(event.data, null, 2)}</pre>
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if selectedTab === 'logs'}
				<div class="tab-content">
					<h2>Server Logs</h2>
					{#if serverLogs.length === 0}
						<p class="empty-state">No server logs available</p>
					{:else}
						<div class="logs-list">
							{#each serverLogs as log}
								<div class="log-entry {log.level}">
									<span class="log-timestamp">{formatTimestamp(log.timestamp)}</span>
									<span class="log-level">[{log.level.toUpperCase()}]</span>
									<span class="log-message">{log.message}</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{:else if selectedTab === 'history'}
				<div class="tab-content">
					{#if selectedHistory}
						<!-- Individual Socket History View -->
						<div class="history-detail">
							<div class="history-header">
								<button on:click={goBackToHistoryList} class="back-btn">← Back to History List</button>
								<h2>Socket History: {selectedHistory.socketId}</h2>
							</div>
							
							<div class="history-metadata">
								<h3>Socket Information</h3>
								<div class="metadata-grid">
									<div class="detail-row">
										<span class="label">Socket ID:</span>
										<span class="value">{selectedHistory.socketId}</span>
									</div>
									<div class="detail-row">
										<span class="label">Connected:</span>
										<span class="value">{formatTimestamp(selectedHistory.metadata.connectedAt)}</span>
									</div>
									<div class="detail-row">
										<span class="label">IP Address:</span>
										<span class="value">{selectedHistory.metadata.ip}</span>
									</div>
									<div class="detail-row">
										<span class="label">User Agent:</span>
										<span class="value">{selectedHistory.metadata.userAgent}</span>
									</div>
									{#if selectedHistory.metadata.sessionType}
									<div class="detail-row">
										<span class="label">Session Type:</span>
										<span class="value session-type {selectedHistory.metadata.sessionType}">{selectedHistory.metadata.sessionType}</span>
									</div>
									{/if}
									{#if selectedHistory.metadata.sessionName}
									<div class="detail-row">
										<span class="label">Session Name:</span>
										<span class="value">{selectedHistory.metadata.sessionName}</span>
									</div>
									{/if}
									{#if selectedHistory.metadata.cwd}
									<div class="detail-row">
										<span class="label">Working Directory:</span>
										<span class="value">{selectedHistory.metadata.cwd}</span>
									</div>
									{/if}
								</div>
							</div>

							<div class="history-events">
								<h3>Communication Events ({selectedHistory.events.length})</h3>
								{#if selectedHistory.events.length === 0}
									<p class="empty-state">No events recorded</p>
								{:else}
									<div class="events-timeline">
										{#each selectedHistory.events as event}
											<div class="timeline-event {getEventTypeClass(event.type)}">
												<div class="event-header">
													<span class="event-type">{event.type}</span>
													<span class="event-direction direction-{event.direction}">{event.direction}</span>
													<span class="event-timestamp">{formatTimestamp(event.timestamp)}</span>
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
						<h2>Socket History</h2>
						<div class="history-controls">
							<button on:click={loadSocketHistories} class="refresh-btn">Refresh History</button>
						</div>
						
						{#if socketHistories.length === 0}
							<p class="empty-state">No socket histories available</p>
						{:else}
							<div class="history-list">
								{#each socketHistories as history}
									<div class="history-card {history.isActive ? 'active' : 'inactive'}">
										<div class="history-card-header">
											<h3>Socket {history.socketId}</h3>
											<div class="history-status">
												{#if history.isActive}
													<span class="status-badge active">Active</span>
												{:else}
													<span class="status-badge inactive">Disconnected</span>
												{/if}
											</div>
										</div>
										
										<div class="history-card-details">
											<div class="detail-row">
												<span class="label">Last Modified:</span>
												<span class="value">{formatTimestamp(history.lastModified)}</span>
											</div>
											<div class="detail-row">
												<span class="label">Events:</span>
												<span class="value">{history.eventCount}</span>
											</div>
											<div class="detail-row">
												<span class="label">File Size:</span>
												<span class="value">{formatFileSize(history.size)}</span>
											</div>
											{#if history.metadata.sessionType}
											<div class="detail-row">
												<span class="label">Type:</span>
												<span class="value session-type {history.metadata.sessionType}">{history.metadata.sessionType}</span>
											</div>
											{/if}
											{#if history.metadata.ip}
											<div class="detail-row">
												<span class="label">IP:</span>
												<span class="value">{history.metadata.ip}</span>
											</div>
											{/if}
										</div>
										
										<div class="history-card-actions">
											<button 
												on:click={() => selectSocketHistory(history.socketId)}
												class="view-btn"
											>
												View History
											</button>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{/if}
				</div>
			{/if}
		</main>
	{/if}
</div>

<style>
	.admin-console {
		min-height: 100vh;
		background: #1a1a1a;
		color: #e0e0e0;
		font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
	}
	
	/* Authentication Form */
	.auth-container {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 20px;
	}
	
	.auth-form {
		background: #2a2a2a;
		padding: 40px;
		border-radius: 8px;
		border: 1px solid #444;
		max-width: 400px;
		width: 100%;
	}
	
	.auth-form h1 {
		margin: 0 0 20px 0;
		color: #fff;
		text-align: center;
	}
	
	.auth-form p {
		margin: 0 0 30px 0;
		color: #ccc;
		text-align: center;
	}
	
	.auth-input {
		width: 100%;
		padding: 12px;
		background: #1a1a1a;
		border: 1px solid #444;
		border-radius: 4px;
		color: #e0e0e0;
		font-size: 16px;
		margin-bottom: 20px;
	}
	
	.auth-input:focus {
		outline: none;
		border-color: #0066cc;
	}
	
	.auth-button {
		width: 100%;
		padding: 12px;
		background: #0066cc;
		border: none;
		border-radius: 4px;
		color: white;
		font-size: 16px;
		cursor: pointer;
		transition: background 0.2s;
	}
	
	.auth-button:hover {
		background: #0052a3;
	}
	
	/* Console Interface */
	.console-header {
		background: #2a2a2a;
		border-bottom: 1px solid #444;
		padding: 20px;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	
	.console-header h1 {
		margin: 0;
		color: #fff;
	}
	
	.header-info {
		display: flex;
		align-items: center;
		gap: 20px;
	}
	
	.refresh-btn {
		padding: 8px 16px;
		background: #444;
		border: 1px solid #666;
		border-radius: 4px;
		color: #e0e0e0;
		cursor: pointer;
		transition: background 0.2s;
	}
	
	.refresh-btn:hover {
		background: #555;
	}
	
	.console-nav {
		background: #222;
		border-bottom: 1px solid #444;
		padding: 0 20px;
		display: flex;
		gap: 0;
	}
	
	.nav-tab {
		padding: 15px 20px;
		background: none;
		border: none;
		color: #ccc;
		cursor: pointer;
		border-bottom: 3px solid transparent;
		transition: all 0.2s;
	}
	
	.nav-tab:hover {
		color: #fff;
		background: #333;
	}
	
	.nav-tab.active {
		color: #fff;
		border-bottom-color: #0066cc;
	}
	
	.console-content {
		padding: 20px;
	}
	
	.tab-content h2 {
		margin: 0 0 20px 0;
		color: #fff;
	}
	
	.empty-state {
		color: #888;
		text-align: center;
		padding: 40px;
		font-style: italic;
	}
	
	/* Socket List */
	.socket-list {
		display: grid;
		gap: 15px;
	}
	
	.socket-card {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 6px;
		padding: 20px;
	}
	
	.socket-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15px;
	}
	
	.socket-header h3 {
		margin: 0;
		color: #fff;
		font-size: 18px;
	}
	
	.disconnect-btn {
		padding: 6px 12px;
		background: #dc3545;
		border: none;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		font-size: 12px;
		transition: background 0.2s;
	}
	
	.disconnect-btn:hover {
		background: #c82333;
	}
	
	.socket-details {
		display: grid;
		gap: 8px;
	}
	
	.detail-row {
		display: flex;
		gap: 10px;
	}
	
	.label {
		font-weight: bold;
		color: #ccc;
		min-width: 120px;
	}
	
	.value {
		color: #e0e0e0;
	}
	
	.authenticated {
		color: #28a745;
	}
	
	.not-authenticated {
		color: #dc3545;
	}
	
	/* Events List */
	.events-list {
		display: grid;
		gap: 10px;
		max-height: 70vh;
		overflow-y: auto;
	}
	
	.event-card {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 4px;
		padding: 15px;
	}
	
	.event-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10px;
	}
	
	.event-type {
		background: #0066cc;
		color: white;
		padding: 4px 8px;
		border-radius: 3px;
		font-size: 12px;
		font-weight: bold;
	}
	
	.event-timestamp {
		color: #888;
		font-size: 12px;
	}
	
	.event-data {
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 3px;
		padding: 10px;
		font-size: 12px;
		color: #e0e0e0;
		overflow-x: auto;
		margin: 0;
	}
	
	/* Logs List */
	.logs-list {
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 4px;
		padding: 15px;
		max-height: 70vh;
		overflow-y: auto;
		font-family: monospace;
	}
	
	.log-entry {
		display: flex;
		gap: 10px;
		margin-bottom: 5px;
		padding: 3px 0;
	}
	
	.log-timestamp {
		color: #888;
		font-size: 12px;
		min-width: 150px;
	}
	
	.log-level {
		font-weight: bold;
		min-width: 60px;
	}
	
	.log-entry.error .log-level {
		color: #dc3545;
	}
	
	.log-entry.warn .log-level {
		color: #ffc107;
	}
	
	.log-entry.info .log-level {
		color: #17a2b8;
	}
	
	.log-entry.debug .log-level {
		color: #6c757d;
	}
	
	.log-message {
		color: #e0e0e0;
	}

	/* Socket History Styles */
	.history-controls {
		margin-bottom: 20px;
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.history-list {
		display: grid;
		gap: 15px;
	}

	.history-card {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 6px;
		padding: 20px;
	}

	.history-card.active {
		border-color: #28a745;
		background: #2a3d2a;
	}

	.history-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15px;
	}

	.history-card-header h3 {
		margin: 0;
		color: #fff;
		font-size: 18px;
	}

	.status-badge {
		padding: 4px 8px;
		border-radius: 3px;
		font-size: 12px;
		font-weight: bold;
	}

	.status-badge.active {
		background: #28a745;
		color: white;
	}

	.status-badge.inactive {
		background: #6c757d;
		color: white;
	}

	.history-card-details {
		display: grid;
		gap: 8px;
		margin-bottom: 15px;
	}

	.history-card-actions {
		display: flex;
		gap: 10px;
	}

	.view-btn {
		padding: 8px 16px;
		background: #0066cc;
		border: none;
		border-radius: 4px;
		color: white;
		cursor: pointer;
		font-size: 14px;
		transition: background 0.2s;
	}

	.view-btn:hover {
		background: #0052a3;
	}

	.session-type {
		font-weight: bold;
		text-transform: uppercase;
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.session-type.terminal {
		background: #17a2b8;
		color: white;
	}

	.session-type.claude {
		background: #6f42c1;
		color: white;
	}

	/* History Detail View */
	.history-detail {
		max-width: 100%;
	}

	.history-header {
		display: flex;
		align-items: center;
		gap: 20px;
		margin-bottom: 20px;
	}

	.back-btn {
		padding: 8px 16px;
		background: #444;
		border: 1px solid #666;
		border-radius: 4px;
		color: #e0e0e0;
		cursor: pointer;
		transition: background 0.2s;
		text-decoration: none;
		font-size: 14px;
	}

	.back-btn:hover {
		background: #555;
	}

	.history-header h2 {
		margin: 0;
		color: #fff;
	}

	.history-metadata {
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 6px;
		padding: 20px;
		margin-bottom: 20px;
	}

	.history-metadata h3 {
		margin: 0 0 15px 0;
		color: #fff;
		font-size: 16px;
	}

	.metadata-grid {
		display: grid;
		gap: 10px;
	}

	.history-events {
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 6px;
		padding: 20px;
	}

	.history-events h3 {
		margin: 0 0 20px 0;
		color: #fff;
		font-size: 16px;
	}

	.events-timeline {
		max-height: 60vh;
		overflow-y: auto;
		display: grid;
		gap: 15px;
	}

	.timeline-event {
		background: #2a2a2a;
		border: 1px solid #444;
		border-radius: 4px;
		padding: 15px;
	}

	.timeline-event.event-connection {
		border-left: 4px solid #28a745;
	}

	.timeline-event.event-disconnect {
		border-left: 4px solid #dc3545;
	}

	.timeline-event.event-auth {
		border-left: 4px solid #ffc107;
	}

	.timeline-event.event-input {
		border-left: 4px solid #0066cc;
	}

	.timeline-event.event-output {
		border-left: 4px solid #17a2b8;
	}

	.timeline-event.event-system {
		border-left: 4px solid #6c757d;
	}

	.timeline-event .event-header {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-bottom: 10px;
	}

	.event-direction {
		font-size: 10px;
		font-weight: bold;
		padding: 2px 6px;
		border-radius: 3px;
		text-transform: uppercase;
	}

	.direction-in {
		background: #0066cc;
		color: white;
	}

	.direction-out {
		background: #17a2b8;
		color: white;
	}

	.direction-system {
		background: #6c757d;
		color: white;
	}

	.direction-unknown {
		background: #444;
		color: #ccc;
	}

	.event-data-container {
		margin-top: 10px;
	}

	.timeline-event .event-data {
		background: #1a1a1a;
		border: 1px solid #333;
		border-radius: 3px;
		padding: 10px;
		font-size: 12px;
		color: #e0e0e0;
		overflow-x: auto;
		margin: 0;
		max-height: 300px;
		overflow-y: auto;
	}
</style>