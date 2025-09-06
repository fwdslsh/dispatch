<!--
  ClaudeCreationForm.svelte - Claude AI Session Creation Form
  
  Provides Claude-specific session configuration options including:
  - Claude model selection
  - Authentication token input
  - Temperature and token limits
  - Project directory selection
  - Capability toggles
-->

<script>
	import DirectoryPicker from '$lib/sessions/components/DirectoryPicker.svelte';

	// Props
	let {
		projectId = null,
		sessionType = null,
		bind: sessionData = null,
		onError = null,
		socket = null
	} = $props();

	// Form state
	let sessionName = $state('');
	let claudeModel = $state('claude-3.5-sonnet');
	let maxTokens = $state(8192);
	let temperature = $state(0.7);
	let workingDirectory = $state('');
	let enableCodeExecution = $state(true);
	let enableFileAccess = $state(true);
	let systemPrompt = $state(
		'You are Claude, an AI assistant created by Anthropic. You are helping with software development.'
	);

	// Validation state
	let validationErrors = $state({});
	let isValidating = $state(false);

	// Claude authentication state
	let claudeAuthStatus = $state('checking'); // 'checking', 'needed', 'authenticating', 'ready', 'error'
	let authError = $state('');
	let oauthUrl = $state('');
	let userToken = $state('');
	let authSessionId = $state(null);

	// Available Claude models
	const claudeModels = [
		{
			id: 'claude-3.5-sonnet',
			name: 'Claude 3.5 Sonnet',
			description: 'Best for coding and analysis'
		},
		{ id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Most capable, slower' },
		{ id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', description: 'Balanced performance' },
		{ id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and efficient' }
	];

	// Initialize Claude client and check authentication
	import { onMount } from 'svelte';
	import { ClaudeClient } from '../io/ClaudeClient.js';
	import { io } from 'socket.io-client';

	let claudeClient = $state(null);

	onMount(() => {
		// Initialize Claude client
		claudeClient = new ClaudeClient(io, { baseUrl: '' });

		// Set up authentication event handlers
		claudeClient.setOnAuthStarted(handleAuthStarted);
		claudeClient.setOnAuthOutput(handleAuthOutput);
		claudeClient.setOnAuthUrl(handleAuthUrl);
		claudeClient.setOnAuthCompleted(handleAuthCompleted);

		// Check initial authentication status
		checkClaudeAuth();

		return () => {
			if (claudeClient) {
				claudeClient.disconnect();
			}
		};
	});

	// Authentication functions
	async function checkClaudeAuth() {
		if (!claudeClient) return;

		try {
			claudeAuthStatus = 'checking';
			const response = await claudeClient.checkAuth();
			
			if (response.authenticated) {
				claudeAuthStatus = 'ready';
			} else {
				claudeAuthStatus = 'needed';
			}
		} catch (error) {
			console.error('Failed to check Claude auth:', error);
			claudeAuthStatus = 'error';
			authError = error.message;
		}
	}

	async function startClaudeAuth() {
		if (!claudeClient) return;

		try {
			claudeAuthStatus = 'authenticating';
			authError = '';
			oauthUrl = '';
			userToken = '';

			const response = await claudeClient.startAuth();
			authSessionId = response.authSessionId;
		} catch (error) {
			console.error('Failed to start Claude auth:', error);
			claudeAuthStatus = 'error';
			authError = error.message;
		}
	}

	async function submitAuthToken() {
		if (!claudeClient || !userToken.trim()) return;

		try {
			await claudeClient.submitToken({ token: userToken.trim() });
			// Response will come through auth-completed event
		} catch (error) {
			console.error('Failed to submit auth token:', error);
			authError = error.message;
		}
	}

	// Event handlers
	function handleAuthStarted(data) {
		console.log('Claude auth started:', data);
	}

	function handleAuthOutput(data) {
		console.log('Claude auth output:', data);
	}

	function handleAuthUrl(data) {
		console.log('Claude OAuth URL received:', data);
		oauthUrl = data.url;
	}

	function handleAuthCompleted(data) {
		console.log('Claude auth completed:', data);
		if (data.success && data.authenticated) {
			claudeAuthStatus = 'ready';
			oauthUrl = '';
			userToken = '';
			authSessionId = null;
		} else {
			claudeAuthStatus = 'error';
			authError = data.message || 'Authentication failed';
		}
	}

	// Remove reactive validation that caused infinite loops
	// Validation will be called explicitly when needed

	// Validate form data
	function validateForm() {
		const errors = {};

		// Session name validation (optional but if provided must be valid)
		if (sessionName.trim() && sessionName.length < 3) {
			errors.sessionName = 'Session name must be at least 3 characters';
		}

		if (sessionName.length > 50) {
			errors.sessionName = 'Session name must be less than 50 characters';
		}

		// Claude model validation
		const validModels = claudeModels.map((m) => m.id);
		if (!validModels.includes(claudeModel)) {
			errors.claudeModel = 'Invalid Claude model selected';
		}

		// Claude authentication validation
		if (claudeAuthStatus !== 'ready') {
			errors.claudeAuth = 'Claude authentication is required';
		}

		// Temperature validation
		if (temperature < 0 || temperature > 1) {
			errors.temperature = 'Temperature must be between 0 and 1';
		}

		// Max tokens validation
		if (maxTokens < 1 || maxTokens > 100000) {
			errors.maxTokens = 'Max tokens must be between 1 and 100,000';
		}

		// System prompt validation
		if (systemPrompt.length > 1000) {
			errors.systemPrompt = 'System prompt must be less than 1000 characters';
		}

		validationErrors = errors;

		// Report validation errors
		if (Object.keys(errors).length > 0 && onError) {
			onError({ message: 'Form validation failed', errors });
		}
	}

	// Update session data for parent component
	function updateSessionData() {
		if (Object.keys(validationErrors).length > 0) {
			sessionData = null;
			return;
		}

		const finalSessionName = sessionName.trim() || `Claude Session ${Date.now()}`;

		sessionData = {
			sessionType: 'claude',
			name: finalSessionName,
			options: {
				claudeModel,
				authenticated: claudeAuthStatus === 'ready',
				maxTokens: parseInt(maxTokens),
				temperature: parseFloat(temperature),
				workingDirectory: workingDirectory.trim() || undefined,
				systemPrompt: systemPrompt.trim() || undefined,
				enableCodeExecution,
				enableFileAccess,
				cols: 120,
				rows: 30
			}
		};
	}

	// Handle form submission
	function handleSubmit(event) {
		event.preventDefault();

		isValidating = true;
		validateForm();

		setTimeout(() => {
			isValidating = false;

			if (Object.keys(validationErrors).length === 0) {
				updateSessionData();
			}
		}, 100);
	}

	// Clear validation errors for a field
	function clearFieldError(fieldName) {
		const newErrors = { ...validationErrors };
		delete newErrors[fieldName];
		validationErrors = newErrors;
	}
</script>

<form class="claude-form" onsubmit={handleSubmit}>
	<div class="form-header">
		<h4 class="form-title">Configure Claude AI Session</h4>
		<p class="form-description">
			Set up your Claude AI assistant with authentication and preferences
		</p>
	</div>

	<div class="form-body">
		<!-- Session Name -->
		<div class="form-group">
			<label for="session-name" class="form-label">
				Session Name <span class="optional">(optional)</span>
			</label>
			<input
				type="text"
				id="session-name"
				class="form-input"
				class:error={validationErrors.sessionName}
				placeholder="e.g., My Claude Session"
				bind:value={sessionName}
				oninput={() => clearFieldError('sessionName')}
				maxlength="50"
			/>
			{#if validationErrors.sessionName}
				<div class="error-message">{validationErrors.sessionName}</div>
			{/if}
		</div>

		<!-- Claude Model Selection -->
		<div class="form-group">
			<label for="claude-model" class="form-label">Claude Model</label>
			<select
				id="claude-model"
				class="form-select"
				class:error={validationErrors.claudeModel}
				bind:value={claudeModel}
				onchange={() => clearFieldError('claudeModel')}
			>
				{#each claudeModels as model}
					<option value={model.id}>
						{model.name} - {model.description}
					</option>
				{/each}
			</select>
			{#if validationErrors.claudeModel}
				<div class="error-message">{validationErrors.claudeModel}</div>
			{/if}
		</div>

		<!-- Claude Authentication -->
		<div class="form-group" data-testid="claude-auth">
			<label class="form-label">
				Claude AI Authentication
				{#if claudeAuthStatus === 'checking'}
					<span class="auth-status checking">🔍 Checking</span>
				{:else if claudeAuthStatus === 'ready'}
					<span class="auth-status ready">✅ Ready</span>
				{:else if claudeAuthStatus === 'needed'}
					<span class="auth-status needed">🤖 Authentication required</span>
				{:else if claudeAuthStatus === 'authenticating'}
					<span class="auth-status authenticating">⏳ Authenticating</span>
				{:else if claudeAuthStatus === 'error'}
					<span class="auth-status error">❌ Error</span>
				{/if}
			</label>

			{#if claudeAuthStatus === 'needed'}
				<div class="auth-panel">
					<div class="auth-message">
						Click the button below to start the authentication process.
					</div>
					<button 
						type="button" 
						class="auth-button" 
						onclick={startClaudeAuth}
						data-testid="start-claude-auth"
					>
						🚀 Start Authentication
					</button>
				</div>
			{:else if claudeAuthStatus === 'authenticating'}
				<div class="auth-panel">
					{#if oauthUrl}
						<div class="auth-step">
							<div class="auth-message">
								Visit this URL to get your authentication token:
							</div>
							<div class="oauth-url">
								<a href={oauthUrl} target="_blank" class="oauth-link">
									{oauthUrl}
								</a>
							</div>
							<div class="token-input-section">
								<label for="user-token" class="form-label">Paste your token here:</label>
								<div class="token-input-row">
									<input
										type="text"
										id="user-token"
										class="form-input token-input"
										placeholder="Paste authentication token..."
										bind:value={userToken}
									/>
									<button 
										type="button" 
										class="submit-token-button" 
										onclick={submitAuthToken}
										disabled={!userToken.trim()}
										data-testid="submit-auth-token"
									>
										Submit
									</button>
								</div>
							</div>
						</div>
					{:else}
						<div class="auth-message">
							Setting up authentication... Please wait.
						</div>
					{/if}
				</div>
			{:else if claudeAuthStatus === 'ready'}
				<div class="auth-panel">
					<div class="auth-message success">
						Claude AI is authenticated and ready to use!
					</div>
				</div>
			{:else if claudeAuthStatus === 'error'}
				<div class="auth-panel">
					<div class="auth-message error">
						{authError || 'Authentication failed'}
					</div>
					<button 
						type="button" 
						class="auth-button retry" 
						onclick={checkClaudeAuth}
					>
						🔄 Retry
					</button>
				</div>
			{/if}
		</div>

		<!-- Model Parameters -->
		<div class="form-row">
			<div class="form-group">
				<label for="temperature" class="form-label">Temperature</label>
				<input
					type="number"
					id="temperature"
					class="form-input"
					class:error={validationErrors.temperature}
					bind:value={temperature}
					oninput={() => clearFieldError('temperature')}
					min="0"
					max="1"
					step="0.1"
				/>
				{#if validationErrors.temperature}
					<div class="error-message">{validationErrors.temperature}</div>
				{:else}
					<div class="help-text">0.0 = focused, 1.0 = creative</div>
				{/if}
			</div>

			<div class="form-group">
				<label for="max-tokens" class="form-label">Max Tokens</label>
				<input
					type="number"
					id="max-tokens"
					class="form-input"
					class:error={validationErrors.maxTokens}
					bind:value={maxTokens}
					oninput={() => clearFieldError('maxTokens')}
					min="1"
					max="100000"
					step="1"
				/>
				{#if validationErrors.maxTokens}
					<div class="error-message">{validationErrors.maxTokens}</div>
				{:else}
					<div class="help-text">Maximum response length</div>
				{/if}
			</div>
		</div>

		<!-- Working Directory -->
		{#if projectId && socket}
			<div class="form-group">
				<label class="form-label">Working Directory</label>
				<DirectoryPicker
					bind:selectedPath={workingDirectory}
					{socket}
					{projectId}
					placeholder="Select directory (optional)"
					disabled={!socket}
				/>
				<div class="help-text">Starting directory for Claude's file operations</div>
			</div>
		{/if}

		<!-- System Prompt -->
		<div class="form-group">
			<label for="system-prompt" class="form-label">
				System Prompt <span class="optional">(optional)</span>
			</label>
			<textarea
				id="system-prompt"
				class="form-textarea"
				class:error={validationErrors.systemPrompt}
				placeholder="You are Claude, an AI assistant..."
				bind:value={systemPrompt}
				oninput={() => clearFieldError('systemPrompt')}
				rows="3"
				maxlength="1000"
			></textarea>
			{#if validationErrors.systemPrompt}
				<div class="error-message">{validationErrors.systemPrompt}</div>
			{:else}
				<div class="help-text">Custom instructions for Claude's behavior</div>
			{/if}
		</div>

		<!-- Capabilities -->
		<div class="form-group">
			<label class="form-label">Capabilities</label>
			<div class="checkbox-group">
				<label class="checkbox-label">
					<input type="checkbox" class="checkbox-input" bind:checked={enableCodeExecution} />
					<span class="checkbox-text">Enable Code Execution</span>
				</label>

				<label class="checkbox-label">
					<input type="checkbox" class="checkbox-input" bind:checked={enableFileAccess} />
					<span class="checkbox-text">Enable File Access</span>
				</label>
			</div>
			<div class="help-text">Allow Claude to execute code and access project files</div>
		</div>

		<!-- Submit Button (Hidden - form submission handled by parent) -->
		<button
			type="submit"
			class="hidden-submit"
			disabled={isValidating || Object.keys(validationErrors).length > 0 || claudeAuthStatus !== 'ready'}
		>
			Create Session
		</button>
	</div>
</form>

<style>
	.claude-form {
		width: 100%;
		max-width: 600px;
	}

	.form-header {
		padding-bottom: 1.5rem;
		border-bottom: 1px solid var(--border, #e0e0e0);
		margin-bottom: 1.5rem;
	}

	.form-title {
		margin: 0 0 0.5rem 0;
		font-size: 1.25rem;
		font-weight: 600;
		color: var(--text-primary, #333);
	}

	.form-description {
		margin: 0;
		color: var(--text-secondary, #666);
		line-height: 1.5;
	}

	.form-body {
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
	}

	.form-label {
		font-weight: 500;
		color: var(--text-primary, #333);
		font-size: 0.9rem;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.required {
		color: var(--error, #f44336);
		font-size: 0.8rem;
	}

	.optional {
		color: var(--text-secondary, #666);
		font-weight: normal;
		font-size: 0.8rem;
	}

	.form-input,
	.form-select,
	.form-textarea {
		padding: 0.75rem;
		border: 1px solid var(--border, #e0e0e0);
		border-radius: 6px;
		background: var(--surface, #fff);
		color: var(--text-primary, #333);
		font-size: 0.9rem;
		transition: all 0.2s ease;
	}

	.form-input:focus,
	.form-select:focus,
	.form-textarea:focus {
		outline: none;
		border-color: var(--primary, #0066cc);
		box-shadow: 0 0 0 2px var(--primary-light, #e3f2fd);
	}

	.form-input.error,
	.form-select.error,
	.form-textarea.error {
		border-color: var(--error, #f44336);
		box-shadow: 0 0 0 2px var(--error-light, #ffebee);
	}

	.form-textarea {
		resize: vertical;
		min-height: 80px;
		line-height: 1.4;
	}

	.checkbox-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.5rem 0;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-size: 0.9rem;
	}

	.checkbox-input {
		width: 18px;
		height: 18px;
		accent-color: var(--primary, #0066cc);
	}

	.checkbox-text {
		color: var(--text-primary, #333);
		user-select: none;
	}

	.error-message {
		color: var(--error, #f44336);
		font-size: 0.8rem;
		padding: 0.25rem 0;
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.error-message::before {
		content: '⚠️';
		font-size: 0.9rem;
	}

	.help-text {
		color: var(--text-secondary, #666);
		font-size: 0.8rem;
		line-height: 1.4;
	}

	.help-text a {
		color: var(--primary, #0066cc);
		text-decoration: none;
	}

	.help-text a:hover {
		text-decoration: underline;
	}

	.hidden-submit {
		display: none;
	}

	/* Claude Authentication Styles */
	.auth-status {
		margin-left: 0.5rem;
		font-size: 0.9rem;
		font-weight: normal;
	}

	.auth-status.checking {
		color: var(--warning, #ff9800);
	}

	.auth-status.ready {
		color: var(--success, #4caf50);
	}

	.auth-status.needed {
		color: var(--info, #2196f3);
	}

	.auth-status.authenticating {
		color: var(--warning, #ff9800);
	}

	.auth-status.error {
		color: var(--error, #f44336);
	}

	.auth-panel {
		padding: 1rem;
		border: 1px solid var(--border, #e0e0e0);
		border-radius: 6px;
		background: var(--surface-light, #f9f9f9);
		margin-top: 0.5rem;
	}

	.auth-message {
		margin-bottom: 1rem;
		color: var(--text-primary, #333);
		line-height: 1.4;
	}

	.auth-message.success {
		color: var(--success, #4caf50);
		font-weight: 500;
	}

	.auth-message.error {
		color: var(--error, #f44336);
	}

	.auth-button {
		padding: 0.75rem 1.5rem;
		background: var(--primary, #0066cc);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.9rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.auth-button:hover {
		background: var(--primary-dark, #0056b3);
		transform: translateY(-1px);
	}

	.auth-button.retry {
		background: var(--warning, #ff9800);
	}

	.auth-button.retry:hover {
		background: var(--warning-dark, #e68900);
	}

	.oauth-url {
		margin: 1rem 0;
		padding: 0.75rem;
		background: var(--code-bg, #f5f5f5);
		border: 1px solid var(--border, #e0e0e0);
		border-radius: 4px;
		word-break: break-all;
	}

	.oauth-link {
		color: var(--primary, #0066cc);
		text-decoration: none;
		font-family: monospace;
		font-size: 0.85rem;
	}

	.oauth-link:hover {
		text-decoration: underline;
	}

	.token-input-section {
		margin-top: 1rem;
	}

	.token-input-row {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	.token-input {
		flex: 1;
		font-family: monospace;
		font-size: 0.85rem;
	}

	.submit-token-button {
		padding: 0.75rem 1rem;
		background: var(--success, #4caf50);
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		white-space: nowrap;
		transition: all 0.2s ease;
	}

	.submit-token-button:hover:not(:disabled) {
		background: var(--success-dark, #45a049);
	}

	.submit-token-button:disabled {
		background: var(--disabled, #ccc);
		cursor: not-allowed;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.form-row {
			grid-template-columns: 1fr;
		}

		.form-header {
			padding-bottom: 1rem;
			margin-bottom: 1rem;
		}

		.form-body {
			gap: 1rem;
		}

		.form-input,
		.form-select,
		.form-textarea {
			padding: 0.6rem;
		}
	}

	/* Dark mode support */
	@media (prefers-color-scheme: dark) {
		.form-title {
			color: var(--text-primary-dark, #fff);
		}

		.form-description {
			color: var(--text-secondary-dark, #aaa);
		}

		.form-label {
			color: var(--text-primary-dark, #fff);
		}

		.optional {
			color: var(--text-secondary-dark, #aaa);
		}

		.form-input,
		.form-select,
		.form-textarea {
			background: var(--surface-dark, #2d2d2d);
			border-color: var(--border-dark, #404040);
			color: var(--text-primary-dark, #fff);
		}

		.checkbox-text {
			color: var(--text-primary-dark, #fff);
		}

		.help-text {
			color: var(--text-secondary-dark, #aaa);
		}

		.help-text a {
			color: var(--primary-light, #64b5f6);
		}
	}
</style>
