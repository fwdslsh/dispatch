<script>
	import { mount, onMount, unmount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { ProjectViewModel } from '$lib/viewmodels/ProjectViewModel.svelte.js';
	import Container from '$lib/components/Container.svelte';
	import HeaderToolbar from '$lib/components/HeaderToolbar.svelte';
	import Terminal from '$lib/components/Terminal.svelte';
	import Chat from '$lib/components/ChatInterface.svelte';
	import SessionList from '$lib/components/SessionList.svelte';
	import CreateSessionForm from '$lib/components/CreateSessionForm.svelte';
	import DirectoryPicker from '$lib/components/DirectoryPicker.svelte';
	import BackIcon from '$lib/components/Icons/BackIcon.svelte';
	import { createClaudeAuthContext } from '$lib/contexts/claude-auth-context.svelte.js';
	import {
		validateSessionNameRealtime,
		validateSessionNameWithFeedback
	} from '$lib/utils/session-name-validation.js';

	// Create view model instance
	const projectId = $derived(page.params.id);
	const vm = new ProjectViewModel(projectId);

	// Claude authentication state
	let claudeAuthState = $state('unchecked');
	let claudeAuthSessionId = $state(null);
	let claudeOAuthUrl = $state(null);
	let claudeAuthToken = $state('');

	// Session creation state
	let sessionMode = $state('shell');
	let sessionName = $state('');
	let workingDirectory = $state('');
	let nameValidation = $state({ isValid: true, message: '', severity: 'info' });

	// Component mounting state
	let currentTerminal = $state(null);
	let currentChat = $state(null);

	// Create Claude auth context for Chat components
	const claudeAuthContext = createClaudeAuthContext();

	// Reactive validation
	$effect(() => {
		nameValidation = validateSessionNameRealtime(sessionName);
	});

	onMount(() => {
		vm.initialize().then(() => {
			// Set up Claude authentication event handlers
			if (vm.socket) {
				setupClaudeAuthHandlers();
				checkClaudeAuth();
			}
		});

		return () => {
			cleanupCurrentComponents();
			vm.destroy();
		};
	});

	function setupClaudeAuthHandlers() {
		// Claude authentication event handlers
		vm.socket.on('claude-auth-url', (data) => {
			console.log('Received Claude OAuth URL:', data);
			claudeOAuthUrl = data.url;
			claudeAuthState = 'waiting-for-token';
		});

		vm.socket.on('claude-token-saved', (data) => {
			console.log('Claude token saved:', data);
			claudeAuthState = 'authenticated';
			claudeOAuthUrl = null;
			claudeAuthToken = '';
			claudeAuthSessionId = null;
		});

		vm.socket.on('claude-auth-error', (data) => {
			console.error('Claude auth error:', data.error);
			claudeAuthState = 'not-authenticated';
		});

		vm.socket.on('claude-auth-ended', (data) => {
			console.log('Claude auth session ended:', data);
			if (data.exitCode === 0) {
				claudeAuthState = 'authenticated';
			} else {
				claudeAuthState = 'not-authenticated';
			}
			claudeOAuthUrl = null;
			claudeAuthToken = '';
			claudeAuthSessionId = null;
		});
	}

	function checkClaudeAuth() {
		if (!vm.socket || !projectId) return;

		claudeAuthState = 'checking';
		vm.socket.emit('check-claude-auth', { projectId }, (response) => {
			if (response.success) {
				claudeAuthState = response.authenticated ? 'authenticated' : 'not-authenticated';
			} else {
				claudeAuthState = 'not-authenticated';
			}
		});
	}

	function startClaudeAuth() {
		if (!vm.socket || !projectId) return;

		claudeAuthState = 'authenticating';
		claudeOAuthUrl = null;
		claudeAuthToken = '';

		vm.socket.emit('start-claude-auth', { projectId }, (response) => {
			if (response.success) {
				claudeAuthSessionId = response.sessionId;
			} else {
				console.error('Failed to start Claude auth:', response.error);
				claudeAuthState = 'not-authenticated';
			}
		});
	}

	function submitAuthToken() {
		if (!vm.socket || !claudeAuthSessionId || !claudeAuthToken.trim()) return;

		vm.socket.emit(
			'submit-auth-token',
			{
				sessionId: claudeAuthSessionId,
				token: claudeAuthToken.trim()
			},
			(response) => {
				if (response.success) {
					console.log('Token submitted successfully');
				} else {
					console.error('Failed to submit token:', response.error);
				}
			}
		);
	}

	// Enhanced create session with Claude support
	async function handleCreateSession(name, mode) {
		try {
			const finalValidation = validateSessionNameWithFeedback(name);
			nameValidation = finalValidation;

			if (!finalValidation.isValid && name.trim()) {
				return;
			}

			// Check Claude authentication if creating a Claude session
			if (mode === 'claude' && claudeAuthState !== 'authenticated') {
				nameValidation = {
					isValid: false,
					message: 'Claude authentication required. Please authenticate first.',
					severity: 'error'
				};
				return;
			}

			const options = {
				mode,
				name: name.trim(),
				cols: 120,
				rows: 30,
				project: projectId
			};

			// Add working directory for Claude sessions
			if (mode === 'claude' && workingDirectory) {
				options.workingDirectory = workingDirectory;
			}

			const sessionId = await vm.createSession(name.trim(), mode);
			if (sessionId) {
				// Clear form
				sessionName = '';
				workingDirectory = '';
				nameValidation = { isValid: true, message: '', severity: 'info' };

				// Auto-attach to new session
				await handleAttachSession(sessionId);
			}
		} catch (error) {
			nameValidation = {
				isValid: false,
				message: error.message,
				severity: 'error'
			};
		}
	}

	async function handleAttachSession(sessionId) {
		// Clean up current components first
		cleanupCurrentComponents();

		const success = await vm.attachToSession(sessionId);
		if (success) {
			// Mount appropriate component based on session type
			const sessionInfo = [...vm.sessions].find(
				(s) => s.id === sessionId || s.sessionId === sessionId
			);

			setTimeout(() => {
				if (sessionInfo?.type === 'claude') {
					// Create chat component
					const chatContainer = document.getElementById('chat-container');
					if (chatContainer) {
						currentChat = mount(Chat, {
							target: chatContainer,
							props: {
								sessionId,
								socket: vm.socket,
								claudeAuthContext: claudeAuthContext
							}
						});
					}
				} else {
					// Create terminal component
					const terminalContainer = document.getElementById('terminal-container');
					if (terminalContainer) {
						currentTerminal = mount(Terminal, {
							target: terminalContainer,
							props: {
								socket: vm.socket,
								sessionId,
								projectId
							}
						});
					}
				}
			}, 100);
		} else {
			alert('Failed to attach to session');
		}
	}

	function cleanupCurrentComponents() {
		if (currentTerminal) {
			try {
				unmount(currentTerminal);
			} catch (e) {
				console.warn('Error unmounting terminal:', e);
			}
			currentTerminal = null;
		}

		if (currentChat) {
			try {
				unmount(currentChat);
			} catch (e) {
				console.warn('Error unmounting chat:', e);
			}
			currentChat = null;
		}
	}

	async function handleEndSession(sessionId) {
		if (!confirm('End this session?')) return;

		const success = await vm.endSession(sessionId);
		if (success && vm.activeSessionId === sessionId) {
			cleanupCurrentComponents();
		}
	}

	function backToProjects() {
		goto('/projects');
	}
</script>

<Container sessionContainer={!!vm.activeSessionId}>
	{#snippet header()}
		<HeaderToolbar>
			{#snippet left()}
				<button
					class="btn-icon-only"
					onclick={backToProjects}
					title="Back to projects"
					aria-label="Back to projects"
				>
					<BackIcon />
				</button>
			{/snippet}
			{#snippet right()}
				<div class="header-content">
					<h2>{vm.project?.name || 'Loading...'}</h2>
					{#if vm.project?.description}
						<p class="project-description">{vm.project.description}</p>
					{/if}
				</div>
			{/snippet}
		</HeaderToolbar>
	{/snippet}

	{#snippet children()}
		{#if vm.loading}
			<div class="loading">
				<p>Loading project...</p>
			</div>
		{:else if vm.error}
			<div class="error">
				<p>Error: {vm.error}</p>
				<button onclick={() => vm.loadProject()}>Retry</button>
			</div>
		{:else}
			<div class="project-layout">
				<!-- Sessions Sidebar -->
				<aside class="sessions-panel">
					<h3>Sessions</h3>

					<SessionList
						sessions={vm.sessions}
						activeSessionId={vm.activeSessionId}
						onAttach={handleAttachSession}
						onEnd={handleEndSession}
					/>

					<!-- Enhanced Session Form with Claude Support -->
					<div class="session-form">
						<h4>New Session</h4>

						<!-- Session Mode Selection -->
						<div class="form-group">
							<label for="session-mode">Type</label>
							<select id="session-mode" bind:value={sessionMode}>
								<option value="shell">Terminal (Shell)</option>
								<option value="claude">Claude Agent</option>
							</select>

							<!-- Claude Authentication Status -->
							{#if sessionMode === 'claude'}
								<div class="session-mode-info">
									{#if claudeAuthState === 'checking'}
										<p>🔍 <strong>Checking Claude Authentication...</strong></p>
									{:else if claudeAuthState === 'authenticated'}
										<p>✅ <strong>Claude AI Ready</strong></p>
										<p>You're authenticated and ready to create Claude sessions.</p>
									{:else if claudeAuthState === 'not-authenticated'}
										<p>🤖 <strong>Claude AI Authentication Required</strong></p>
										<p>Click the button below to start the authentication process.</p>
										<button class="btn-auth" onclick={startClaudeAuth}>
											🚀 Start Authentication
										</button>
									{:else if claudeAuthState === 'authenticating'}
										<p>⏳ <strong>Starting Authentication...</strong></p>
									{:else if claudeAuthState === 'waiting-for-token'}
										<p>🔗 <strong>OAuth Authentication</strong></p>
										<p>1. Click the link below to authenticate with Claude AI:</p>
										<a href={claudeOAuthUrl} target="_blank" class="oauth-link">
											🔗 Open Claude Authentication
										</a>
										<p>2. After completing authentication, enter your token code:</p>
										<div class="token-input-group">
											<input
												type="text"
												bind:value={claudeAuthToken}
												placeholder="Paste your authentication token here"
												class="token-input"
												onkeydown={(e) => e.key === 'Enter' && submitAuthToken()}
											/>
											<button
												class="btn-submit-token"
												onclick={submitAuthToken}
												disabled={!claudeAuthToken.trim()}
											>
												Submit Token
											</button>
										</div>
									{/if}
								</div>
							{/if}
						</div>

						<!-- Session Name -->
						<div class="form-group">
							<label for="session-name">
								Name <span class="optional">(optional)</span>
							</label>
							<input
								type="text"
								id="session-name"
								placeholder="Session name"
								bind:value={sessionName}
								class:invalid={!nameValidation.isValid && !!sessionName.trim()}
								class:valid={nameValidation.isValid && nameValidation.severity === 'success'}
							/>
							{#if nameValidation.message}
								<div class="validation-message {nameValidation.severity}">
									{nameValidation.message}
								</div>
							{/if}
						</div>

						<!-- Directory Picker for Claude Sessions -->
						{#if sessionMode === 'claude'}
							<DirectoryPicker
								bind:selectedPath={workingDirectory}
								socket={vm.socket}
								{projectId}
								disabled={!vm.socket}
							/>
						{/if}

						<button
							type="submit"
							class="btn-primary"
							onclick={() => handleCreateSession(sessionName, sessionMode)}
							disabled={(!nameValidation.isValid && !!sessionName.trim()) ||
								(sessionMode === 'claude' && claudeAuthState !== 'authenticated')}
						>
							Create Session
						</button>
					</div>
				</aside>

				<!-- Terminal/Chat Area -->
				<main class="content-panel">
					{#if vm.activeSessionId}
						{#if vm.sessions.find((s) => s.id === vm.activeSessionId || s.sessionId === vm.activeSessionId)?.type === 'claude'}
							<div id="chat-container" class="session-content"></div>
						{:else}
							<div id="terminal-container" class="session-content"></div>
						{/if}
					{:else}
						<div class="no-session">
							<h2>No Active Session</h2>
							<p>Select a session from the sidebar or create a new one.</p>
						</div>
					{/if}
				</main>
			</div>
		{/if}
	{/snippet}
</Container>

<style>
	.header-content {
		text-align: center;
		flex: 1;
	}

	.project-description {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin: 0;
		font-weight: normal;
	}

	.loading,
	.error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		color: var(--text);
		padding: 2rem;
	}

	.error {
		color: var(--error);
	}

	.project-layout {
		display: flex;
		height: 100%;
		gap: var(--space-md);
		padding: var(--space-md);
	}

	.sessions-panel {
		width: 350px;
		flex-shrink: 0;
		background: rgba(26, 26, 26, 0.8);
		border: 1px solid rgba(0, 255, 136, 0.3);
		padding: var(--space-md);
		backdrop-filter: blur(10px);
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.sessions-panel h3,
	.sessions-panel h4 {
		margin: 0;
		color: var(--text-primary);
		padding-bottom: 0.5rem;
		border-bottom: 1px solid rgba(0, 255, 136, 0.2);
	}

	.session-form {
		border-top: 1px solid rgba(0, 255, 136, 0.2);
		padding-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-group label {
		font-weight: 500;
		color: var(--text-primary);
	}

	.optional {
		font-weight: normal;
		color: var(--text-secondary);
		font-size: 0.85rem;
	}

	.form-group input,
	.form-group select {
		padding: 0.5rem;
		background: rgba(26, 26, 26, 0.8);
		color: var(--text-primary);
		border: 1px solid rgba(0, 255, 136, 0.3);
		border-radius: 4px;
	}

	.form-group input:focus,
	.form-group select:focus {
		outline: none;
		border-color: var(--primary);
		box-shadow: 0 0 4px rgba(0, 255, 136, 0.3);
	}

	.form-group input.invalid {
		border-color: var(--error);
	}

	.form-group input.valid {
		border-color: var(--success);
	}

	.validation-message {
		font-size: 0.85rem;
		padding: 0.25rem 0.5rem;
		border-radius: 3px;
	}

	.validation-message.error {
		color: var(--error);
		background: rgba(255, 107, 107, 0.1);
		border: 1px solid rgba(255, 107, 107, 0.3);
	}

	.validation-message.success {
		color: var(--success);
		background: rgba(0, 255, 136, 0.1);
		border: 1px solid rgba(0, 255, 136, 0.3);
	}

	.validation-message.info {
		color: var(--text-secondary);
	}

	.session-mode-info {
		margin-top: 0.5rem;
		padding: 0.75rem;
		background: rgba(42, 42, 42, 0.4);
		border: 1px solid rgba(0, 255, 136, 0.2);
		border-radius: 4px;
		font-size: 0.9rem;
	}

	.btn-auth {
		margin-top: 0.5rem;
		padding: 0.5rem 1rem;
		background: var(--primary);
		color: var(--bg-dark);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	.oauth-link {
		display: inline-block;
		margin: 0.5rem 0;
		padding: 0.5rem 1rem;
		background: rgba(0, 255, 136, 0.1);
		color: var(--primary);
		text-decoration: none;
		border: 1px solid var(--primary);
		border-radius: 4px;
		font-weight: 500;
	}

	.oauth-link:hover {
		background: rgba(0, 255, 136, 0.2);
	}

	.token-input-group {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.token-input {
		flex: 1;
	}

	.btn-submit-token,
	.btn-primary {
		padding: 0.5rem 1rem;
		background: var(--primary);
		color: var(--bg-dark);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	.btn-primary:disabled {
		background: rgba(0, 255, 136, 0.3);
		cursor: not-allowed;
	}

	.content-panel {
		flex: 1;
		background: transparent;
		border: 1px solid rgba(0, 255, 136, 0.3);
		padding: 0;
		backdrop-filter: blur(10px);
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.session-content {
		flex: 1;
		height: 100%;
	}

	.no-session {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		text-align: center;
		color: var(--text-muted);
		padding: 2rem;
	}

	.no-session h2 {
		margin-bottom: var(--space-sm);
		color: var(--text-secondary);
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.project-layout {
			flex-direction: column;
			padding: var(--space-sm);
		}

		.sessions-panel {
			width: auto;
			max-height: 50vh;
			overflow-y: auto;
		}
	}
</style>
