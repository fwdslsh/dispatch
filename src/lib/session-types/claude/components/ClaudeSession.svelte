<!-- 
  ClaudeSession - Claude AI chat session with command menu support
  
  Uses ChatInterface for messaging and CommandMenu for enhanced commands.
  No terminal integration - pure chat-based interface.
-->
<script>
	import { onMount, onDestroy } from 'svelte';
	import ChatInterface from './ChatInterface.svelte';
	import CommandMenu from './CommandMenu.svelte';
	import ClaudeCreationForm from './ClaudeCreationForm.svelte';
	import { ClaudeSessionViewModel } from './ClaudeSessionViewModel.svelte.js';
	import { ClaudeClient } from '../io/ClaudeClient.js';
	import { io } from 'socket.io-client';

	let {
		projectId,
		sessionOptions = {},
		onSessionCreated = () => {},
		onSessionEnded = () => {},
		socket = null,
		terminalKey = 'testkey12345'
	} = $props();

	// Create ViewModel once with initial props - no reactive updates to avoid infinite loops
	let viewModel = new ClaudeSessionViewModel(projectId, sessionOptions, terminalKey);
	let claudeClient = $state(null);

	// Component refs
	let chatInterface = $state();
	let commandMenu = $state();

	// Reactive state from ViewModel - access properties directly to avoid getter loops
	let sessionId = $derived(viewModel.sessionId);
	let isReady = $derived(
		viewModel.sessionId && viewModel.isTerminalAuthenticated && viewModel.authStep === 'ready'
	);
	let error = $derived(viewModel.error);
	let connectionStatus = $derived(viewModel.connectionStatus);
	let isConnecting = $derived(viewModel.isConnecting);
	let authStep = $derived(viewModel.authStep);
	let needsTerminalAuth = $derived(!viewModel.isTerminalAuthenticated);
	let needsClaudeAuth = $derived(
		viewModel.isTerminalAuthenticated && viewModel.authStep === 'claude-check'
	);

	// Actions from ViewModel - access directly to avoid $derived loops
	let { connect, disconnect, retry } = viewModel.actions;

	// Available commands for the command menu
	let commands = $state([
		{
			id: 'explain-code',
			name: 'Explain Code',
			description: 'Explain how a piece of code works',
			category: 'Analysis',
			shortcut: 'Ctrl+E'
		},
		{
			id: 'review-code',
			name: 'Review Code',
			description: 'Get a code review with suggestions',
			category: 'Analysis',
			shortcut: 'Ctrl+R'
		},
		{
			id: 'refactor-code',
			name: 'Refactor Code',
			description: 'Suggest refactoring improvements',
			category: 'Improvement',
			shortcut: 'Ctrl+Shift+R'
		},
		{
			id: 'write-tests',
			name: 'Write Tests',
			description: 'Generate unit tests for code',
			category: 'Testing',
			shortcut: 'Ctrl+T'
		},
		{
			id: 'debug-help',
			name: 'Debug Help',
			description: 'Help debug an issue or error',
			category: 'Debugging',
			shortcut: 'Ctrl+D'
		},
		{
			id: 'optimize-code',
			name: 'Optimize Code',
			description: 'Suggest performance optimizations',
			category: 'Improvement'
		},
		{
			id: 'document-code',
			name: 'Document Code',
			description: 'Generate documentation for code',
			category: 'Documentation'
		},
		{
			id: 'clear-chat',
			name: 'Clear Chat',
			description: 'Clear the chat history',
			category: 'Utility',
			shortcut: 'Ctrl+L'
		}
	]);

	onMount(async () => {
		// Create Claude client
		claudeClient = new ClaudeClient(io);

		// Set up callbacks
		viewModel.setCallbacks({
			onSessionCreated,
			onSessionEnded
		});

		// Connect to session
		await viewModel.connect();
		viewModel.initializeClaudeSession();

		
	});

	onDestroy(() => {
			viewModel.disconnect();
		if (claudeClient) {
			claudeClient.disconnect();
		}
	});


	/**
	 * Handle message sending from chat interface
	 */
	function handleSendMessage(message) {
		// Message is already added to chat by ChatInterface
		// Could add additional processing here if needed
		console.log('Claude session message:', message);
	}

	/**
	 * Handle command execution from command menu
	 */
	function handleExecuteCommand(command) {
		switch (command.id) {
			case 'clear-chat':
				if (chatInterface) {
					chatInterface.clearHistory();
				}
				break;
			case 'explain-code':
				promptForCodeAction(
					"Please paste the code you'd like me to explain:",
					'Explain this code:'
				);
				break;
			case 'review-code':
				promptForCodeAction(
					"Please paste the code you'd like me to review:",
					'Please review this code and provide suggestions:'
				);
				break;
			case 'refactor-code':
				promptForCodeAction(
					"Please paste the code you'd like me to refactor:",
					'Please suggest refactoring improvements for this code:'
				);
				break;
			case 'write-tests':
				promptForCodeAction(
					"Please paste the code you'd like tests for:",
					'Please write unit tests for this code:'
				);
				break;
			case 'debug-help':
				promptForCodeAction(
					'Please paste the code and describe the issue:',
					'I need help debugging this code:'
				);
				break;
			case 'optimize-code':
				promptForCodeAction(
					"Please paste the code you'd like me to optimize:",
					'Please suggest performance optimizations for this code:'
				);
				break;
			case 'document-code':
				promptForCodeAction(
					"Please paste the code you'd like documented:",
					'Please generate documentation for this code:'
				);
				break;
			default:
				if (chatInterface) {
					chatInterface.addMessage({
						sender: 'assistant',
						content: `Command "${command.name}" executed. How can I help you with this?`,
						timestamp: new Date()
					});
				}
		}
	}

	/**
	 * Prompt user for code and add a pre-filled message
	 */
	function promptForCodeAction(promptText, prefix) {
		if (chatInterface) {
			chatInterface.addMessage({
				sender: 'assistant',
				content: promptText,
				timestamp: new Date()
			});
		}
	}

	// Expose methods for external access
	export function clearChat() {
		if (chatInterface) {
			chatInterface.clearHistory();
		}
	}

	export function endClaudeSession() {
		viewModel.endSession();
	}
</script>

<div class="claude-session">
	{#if error}
		<div class="error">
			<h3>Connection Error</h3>
			<p>{error}</p>
			<button onclick={retry}>Retry Connection</button>
		</div>
	{:else if isConnecting || needsTerminalAuth}
		<div class="loading">
			<h3>Connecting to Claude...</h3>
			<p>Setting up your AI coding assistant...</p>
		</div>
	{:else if needsClaudeAuth && !viewModel.isClaudeAuthenticated}
		<ClaudeCreationForm {projectId} />
	{:else}
		<!-- Main chat interface -->
		<div class="chat-container">
			<ChatInterface
				bind:this={chatInterface}
				{sessionId}
				{claudeClient}
				onSendMessage={handleSendMessage}
			/>
		</div>

		<!-- Command menu overlay -->
		<CommandMenu
			bind:this={commandMenu}
			{commands}
			{sessionId}
			onExecuteCommand={handleExecuteCommand}
		/>
	{/if}
</div>

<style>
	.claude-session {
		max-height: 60svh;
		display: flex;
		flex-direction: column;
		background: var(--bg-dark);
		color: var(--text-primary);
		font-family: var(--font-sans);
		overflow: auto;
	}

	.error,
	.loading {
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
		background: var(--primary);
		color: var(--bg-dark);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
	}

	.loading {
		background: var(--surface);
	}

	.chat-container {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	/* Mobile responsive */
	@media (max-width: 768px) {
		.claude-session {
			height: 100vh;
		}

		.error,
		.loading {
			padding: 1rem;
		}
	}
</style>
