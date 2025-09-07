<!--
  ClaudeSession - Simple Claude AI chat session
-->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { ClaudeClient } from '../io/ClaudeClient.js';
	import { io } from 'socket.io-client';
	import { page } from '$app/state';

	let {
		projectId,
		sessionOptions = {},
		onSessionCreated = () => {},
		onSessionEnded = () => {}
	} = $props();

	// State
	let sessionId = $state(null);
	let isConnecting = $state(false);
	let error = $state(null);
	let needsAuth = $state(false); // Start as false, will be set based on auth check
	let messages = $state([]);
	let messageInput = $state('');
	let isTyping = $state(false);
	
	// Auth state
	let authUrl = $state('');
	let authToken = $state('');
	let authError = $state('');
	
	// Claude client
	let claudeClient = null;

	onMount(async () => {
		claudeClient = new ClaudeClient(io, {});
		setupEventHandlers();
		checkAuthAndConnect();
	});

	onDestroy(() => {
		if (claudeClient) {
			claudeClient.disconnect();
		}
	});

	function setupEventHandlers() {
		if (!claudeClient) return;
		
		// Auth event handlers
		claudeClient.setOnAuthStatus((data) => {
			console.log('Auth status received:', data);
			isConnecting = false;
			error = null; // Clear any previous errors
			if (data.authenticated) {
				needsAuth = false;
				createSession();
			} else {
				needsAuth = true;
			}
		});
		
		claudeClient.setOnAuthUrl((data) => {
			authUrl = data.url;
		});
		
		claudeClient.setOnAuthCompleted((data) => {
			if (data.success) {
				needsAuth = false;
				authUrl = '';
				authToken = '';
				authError = '';
				createSession();
			} else {
				authError = data.message || 'Authentication failed';
			}
		});
		
		// Session event handlers
		claudeClient.setOnSessionCreated((data) => {
			sessionId = data.sessionId;
			onSessionCreated({ sessionId: data.sessionId, type: 'claude', projectId: data.projectId });
		});

		claudeClient.setOnResponse((data) => {
			if (data.sessionId === sessionId) {
				messages = [...messages, data.message];
				isTyping = false;
			}
		});

		claudeClient.setOnTyping((data) => {
			if (data.sessionId === sessionId) {
				isTyping = data.isTyping;
			}
		});

		claudeClient.setOnSessionEnded((data) => {
			if (data.sessionId === sessionId) {
				onSessionEnded({ sessionId, type: 'claude' });
				sessionId = null;
				messages = [];
			}
		});

		claudeClient.setOnCleared((data) => {
			if (data.sessionId === sessionId) {
				messages = [{
					id: `msg-${Date.now()}`,
					role: 'assistant',
					content: 'Chat history cleared. How can I help you?',
					timestamp: new Date().toISOString()
				}];
			}
		});
	}

	function checkAuthAndConnect() {
		if (!claudeClient) return;
		
		isConnecting = true;
		
		// First authenticate with TERMINAL_KEY
		const terminalKey = page.data?.terminalKey || '';
		console.log('Authenticating with terminal key...');
		
		claudeClient.authenticate(terminalKey, (authResponse) => {
			console.log('Terminal key auth response:', authResponse);
			
			if (authResponse && authResponse.success) {
				// Now check Claude authentication
				console.log('Terminal auth success, checking Claude auth...');
				claudeClient.checkAuth(() => {
					// Response will be handled by setOnAuthStatus event handler
				});
			} else {
				isConnecting = false;
				error = 'Application authentication failed';
				console.error('Terminal key authentication failed:', authResponse?.error);
			}
		});
	}

	function createSession() {
		console.log('createSession called with projectId:', projectId, 'sessionOptions:', sessionOptions);
		if (!claudeClient) {
			console.log('createSession: claudeClient is null');
			return;
		}
		
		console.log('createSession: calling claudeClient.createSession');
		claudeClient.createSession(projectId, sessionOptions, (err, response) => {
			console.log('createSession callback - err:', err, 'response:', response);
			if (err) {
				console.log('createSession error:', err.message);
				error = err.message;
				return;
			}
			
			console.log('createSession success:', response);
			sessionId = response.session.id;
			if (response.session.welcomeMessage) {
				messages = [response.session.welcomeMessage];
			}
		});
	}

	function sendMessage() {
		if (!messageInput.trim() || !claudeClient || !sessionId) return;
		
		const userMessage = {
			id: `msg-${Date.now()}`,
			role: 'user',
			content: messageInput.trim(),
			timestamp: new Date().toISOString()
		};
		
		messages = [...messages, userMessage];
		isTyping = true;
		
		claudeClient.sendMessage(messageInput.trim(), (err) => {
			if (err) {
				console.error('Error sending message:', err);
				isTyping = false;
			}
		});
		
		messageInput = '';
	}

	function clearChat() {
		if (!claudeClient || !sessionId) return;
		claudeClient.clearChat(() => {});
	}

	function startAuth() {
		if (!claudeClient) return;
		authError = '';
		claudeClient.startAuth((err) => {
			if (err) {
				authError = err.message;
			}
		});
	}

	function submitAuthToken() {
		if (!claudeClient || !authToken.trim()) return;
		claudeClient.submitToken({ token: authToken.trim() }, (err) => {
			if (err) {
				authError = err.message;
			}
		});
	}
</script>

<div class="claude-session">
	{#if error}
		<div class="error">
			<h3>Error</h3>
			<p>{error}</p>
			<button onclick={() => { error = null; checkAuthAndConnect(); }}>Retry</button>
		</div>
	{:else if isConnecting}
		<div class="loading">
			<h3>Connecting...</h3>
			<p>Setting up Claude session...</p>
		</div>
	{:else if needsAuth}
		<div class="auth-form">
			<h3>Claude Authentication Required</h3>
			<p>You need to authenticate with Claude AI before creating a session.</p>
			<button onclick={startAuth} class="auth-btn">Start Authentication</button>
			
			{#if authUrl}
				<div class="auth-step">
					<p>Visit this URL to get your token:</p>
					<a href={authUrl} target="_blank" class="auth-url">{authUrl}</a>
					<div class="token-input">
						<input
							type="text"
							placeholder="Paste your token here..."
							bind:value={authToken}
						/>
						<button onclick={submitAuthToken} disabled={!authToken.trim()}>
							Submit
						</button>
					</div>
				</div>
			{/if}
			
			{#if authError}
				<div class="error-msg">{authError}</div>
			{/if}
		</div>
	{:else if sessionId}
		<!-- Chat Interface -->
		<div class="chat-container">
			<div class="messages">
				{#each messages as message}
					<div class="message {message.role}">
						<div class="message-content">{message.content}</div>
						<div class="message-time">
							{new Date(message.timestamp).toLocaleTimeString()}
						</div>
					</div>
				{/each}
				{#if isTyping}
					<div class="message assistant typing">
						<div class="message-content">Typing...</div>
					</div>
				{/if}
			</div>
			
			<div class="input-area">
				<div class="input-row">
					<input
						type="text"
						placeholder="Ask Claude anything..."
						bind:value={messageInput}
						onkeydown={(e) => e.key === 'Enter' && sendMessage()}
						class="message-input"
					/>
					<button onclick={sendMessage} disabled={!messageInput.trim()} class="send-btn">
						Send
					</button>
				</div>
				<div class="controls">
					<button onclick={clearChat} class="clear-btn">Clear Chat</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="loading">
			<p>Creating session...</p>
		</div>
	{/if}
</div>

<style>
	.claude-session {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 60svh;
		background: var(--bg-dark, #1a1a1a);
		color: var(--text-primary, #fff);
	}

	.error, .loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: 2rem;
		text-align: center;
	}

	.error {
		background: var(--error-bg, #2a1f1f);
		color: var(--error-text, #ff6b6b);
	}

	.error button {
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		background: var(--primary, #0066cc);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.chat-container {
		display: flex;
		flex-direction: column;
		height: 100%;
	}

	.messages {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.message {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		max-width: 85%;
	}

	.message.user {
		align-self: flex-end;
		align-items: flex-end;
	}

	.message.assistant {
		align-self: flex-start;
		align-items: flex-start;
	}

	.message-content {
		padding: 0.75rem 1rem;
		border-radius: 12px;
		line-height: 1.4;
		white-space: pre-wrap;
	}

	.message.user .message-content {
		background: var(--primary, #0066cc);
		color: white;
	}

	.message.assistant .message-content {
		background: var(--surface, #2d2d2d);
		color: var(--text-primary, #fff);
	}

	.message.typing .message-content {
		opacity: 0.7;
		font-style: italic;
	}

	.message-time {
		font-size: 0.75rem;
		color: var(--text-secondary, #888);
		padding: 0 0.5rem;
	}

	.input-area {
		border-top: 1px solid var(--border, #333);
		padding: 1rem;
		background: var(--surface, #2d2d2d);
	}

	.input-row {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.message-input {
		flex: 1;
		padding: 0.75rem;
		border: 1px solid var(--border, #555);
		border-radius: 6px;
		background: var(--bg-dark, #1a1a1a);
		color: var(--text-primary, #fff);
		font-size: 0.9rem;
	}

	.message-input:focus {
		outline: none;
		border-color: var(--primary, #0066cc);
	}

	.send-btn {
		padding: 0.75rem 1.5rem;
		background: var(--primary, #0066cc);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
	}

	.send-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.controls {
		display: flex;
		gap: 0.5rem;
	}

	.clear-btn {
		padding: 0.5rem 1rem;
		background: transparent;
		color: var(--text-secondary, #888);
		border: 1px solid var(--border, #555);
		border-radius: 4px;
		cursor: pointer;
		font-size: 0.8rem;
	}

	.clear-btn:hover {
		background: var(--surface-light, #3d3d3d);
	}

	.auth-form {
		padding: 2rem;
		text-align: center;
		max-width: 500px;
		margin: 0 auto;
	}

	.auth-btn {
		padding: 0.75rem 1.5rem;
		background: var(--primary, #0066cc);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		margin: 1rem 0;
	}

	.auth-step {
		margin-top: 2rem;
		padding: 1rem;
		background: var(--surface, #2d2d2d);
		border-radius: 6px;
	}

	.auth-url {
		display: block;
		margin: 1rem 0;
		padding: 0.5rem;
		background: var(--bg-dark, #1a1a1a);
		border: 1px solid var(--border, #555);
		border-radius: 4px;
		color: var(--primary, #0066cc);
		text-decoration: none;
		word-break: break-all;
		font-family: monospace;
	}

	.token-input {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.token-input input {
		flex: 1;
		padding: 0.5rem;
		border: 1px solid var(--border, #555);
		border-radius: 4px;
		background: var(--bg-dark, #1a1a1a);
		color: var(--text-primary, #fff);
	}

	.token-input button {
		padding: 0.5rem 1rem;
		background: var(--success, #4caf50);
		color: white;
		border: none;
		border-radius: 4px;
		cursor: pointer;
	}

	.token-input button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-msg {
		color: var(--error, #ff6b6b);
		margin-top: 1rem;
		padding: 0.5rem;
		background: rgba(255, 107, 107, 0.1);
		border-radius: 4px;
	}
</style>