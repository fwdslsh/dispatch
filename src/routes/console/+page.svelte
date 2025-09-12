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
</style>