/**
 * ClaudeCreationFormViewModel - Handles Claude session creation form logic
 *
 * Manages form state, validation, and Claude authentication using ClaudeClient.
 * UI components should be thin and only handle presentation.
 */

import { ClaudeClient } from '../io/ClaudeClient.js';
import { io } from 'socket.io-client';

export class ClaudeCreationFormViewModel {
	// Private fields
	#claudeClient = null;
	#onError = null;

	// Form state
	sessionName = $state('');
	claudeModel = $state('claude-3.5-sonnet');
	maxTokens = $state(8192);
	temperature = $state(0.7);
	workingDirectory = $state('');
	enableCodeExecution = $state(true);
	enableFileAccess = $state(true);
	systemPrompt = $state(
		'You are Claude, an AI assistant created by Anthropic. You are helping with software development.'
	);

	// Validation state
	validationErrors = $state({});
	isValidating = $state(false);

	// Claude authentication state
	claudeAuthStatus = $state('checking'); // 'checking', 'needed', 'authenticating', 'ready', 'error'
	authError = $state('');
	oauthUrl = $state('');
	userToken = $state('');

	// Session data for parent component
	sessionData = $state(null);

	// Configuration
	projectId = $state('');
	sessionType = $state(null);
	socket = $state(null);

	// Available Claude models
	claudeModels = [
		{
			id: 'claude-3.5-sonnet',
			name: 'Claude 3.5 Sonnet',
			description: 'Best for coding and analysis'
		},
		{ id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Most capable, slower' },
		{ id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', description: 'Balanced performance' },
		{ id: 'claude-3-haiku', name: 'Claude 3 Haiku', description: 'Fast and efficient' }
	];

	// Actions - static object to prevent reactive loops
	actions;

	constructor({ projectId = '', sessionType = null, onError = null } = {}) {
		this.projectId = projectId;
		this.sessionType = sessionType;
		this.#onError = onError;

		// Initialize static actions object
		this.actions = {
			initialize: this.initialize.bind(this),
			cleanup: this.cleanup.bind(this),
			startClaudeAuth: this.startClaudeAuth.bind(this),
			submitAuthToken: this.submitAuthToken.bind(this),
			checkClaudeAuth: this.checkClaudeAuth.bind(this),
			handleSubmit: this.handleSubmit.bind(this),
			clearFieldError: this.clearFieldError.bind(this),
			validateForm: this.validateForm.bind(this)
		};
	}

	/**
	 * Initialize the view model
	 */
	async initialize() {
		console.log('ClaudeCreationFormViewModel: Starting initialization...');
		try {
			// Initialize Claude client
			console.log('ClaudeCreationFormViewModel: Creating ClaudeClient...');
			this.#claudeClient = new ClaudeClient(io);

			// Set up authentication event handlers
			console.log('ClaudeCreationFormViewModel: Setting up authentication handlers...');
			this.#setupAuthenticationHandlers();

			// Check initial authentication status
			console.log('ClaudeCreationFormViewModel: Checking Claude auth...');
			await this.checkClaudeAuth();
			console.log('ClaudeCreationFormViewModel: Initialization complete');
		} catch (error) {
			console.error('Failed to initialize Claude creation form:', error);
			this.claudeAuthStatus = 'error';
			this.authError = error.message;
		}
	}

	/**
	 * Clean up resources
	 */
	cleanup() {
		if (this.#claudeClient) {
			this.#claudeClient.disconnect();
			this.#claudeClient = null;
		}
	}

	/**
	 * Check Claude authentication status
	 */
	async checkClaudeAuth() {
		console.log('ClaudeCreationFormViewModel: checkClaudeAuth called, client exists:', !!this.#claudeClient);
		if (!this.#claudeClient) return;

		try {
			console.log('ClaudeCreationFormViewModel: Setting auth status to checking...');
			this.claudeAuthStatus = 'checking';
			console.log('ClaudeCreationFormViewModel: Calling claudeClient.checkAuth()...');
			const response = await this.#claudeClient.checkAuth();
			console.log('ClaudeCreationFormViewModel: checkAuth response:', response);
			
			if (response.authenticated) {
				console.log('ClaudeCreationFormViewModel: Auth successful, setting status to ready');
				this.claudeAuthStatus = 'ready';
			} else {
				console.log('ClaudeCreationFormViewModel: Auth needed, setting status to needed');
				this.claudeAuthStatus = 'needed';
			}
		} catch (error) {
			console.error('Failed to check Claude auth:', error);
			this.claudeAuthStatus = 'error';
			this.authError = error.message;
		}
	}

	/**
	 * Start Claude authentication process
	 */
	async startClaudeAuth() {
		if (!this.#claudeClient) return;

		try {
			this.claudeAuthStatus = 'authenticating';
			this.authError = '';
			this.oauthUrl = '';
			this.userToken = '';

			await this.#claudeClient.startAuth();
		} catch (error) {
			console.error('Failed to start Claude auth:', error);
			this.claudeAuthStatus = 'error';
			this.authError = error.message;
		}
	}

	/**
	 * Submit authentication token
	 */
	async submitAuthToken() {
		if (!this.#claudeClient || !this.userToken.trim()) return;

		try {
			await this.#claudeClient.submitToken({ token: this.userToken.trim() });
			// Response will come through auth-completed event
		} catch (error) {
			console.error('Failed to submit auth token:', error);
			this.authError = error.message;
		}
	}

	/**
	 * Validate form data
	 */
	validateForm() {
		const errors = {};

		// Session name validation (optional but if provided must be valid)
		if (this.sessionName.trim() && this.sessionName.length < 3) {
			errors.sessionName = 'Session name must be at least 3 characters';
		}

		if (this.sessionName.length > 50) {
			errors.sessionName = 'Session name must be less than 50 characters';
		}

		// Claude model validation
		const validModels = this.claudeModels.map((m) => m.id);
		if (!validModels.includes(this.claudeModel)) {
			errors.claudeModel = 'Invalid Claude model selected';
		}

		// Claude authentication validation
		if (this.claudeAuthStatus !== 'ready') {
			errors.claudeAuth = 'Claude authentication is required';
		}

		// Temperature validation
		if (this.temperature < 0 || this.temperature > 1) {
			errors.temperature = 'Temperature must be between 0 and 1';
		}

		// Max tokens validation
		if (this.maxTokens < 1 || this.maxTokens > 100000) {
			errors.maxTokens = 'Max tokens must be between 1 and 100,000';
		}

		// System prompt validation
		if (this.systemPrompt.length > 1000) {
			errors.systemPrompt = 'System prompt must be less than 1000 characters';
		}

		this.validationErrors = errors;

		// Report validation errors
		if (Object.keys(errors).length > 0 && this.#onError) {
			this.#onError({ message: 'Form validation failed', errors });
		}

		return Object.keys(errors).length === 0;
	}

	/**
	 * Update session data for parent component
	 */
	updateSessionData() {
		if (Object.keys(this.validationErrors).length > 0) {
			this.sessionData = null;
			return;
		}

		const finalSessionName = this.sessionName.trim() || `Claude Session ${Date.now()}`;

		this.sessionData = {
			sessionType: 'claude',
			name: finalSessionName,
			options: {
				claudeModel: this.claudeModel,
				authenticated: this.claudeAuthStatus === 'ready',
				maxTokens: parseInt(this.maxTokens),
				temperature: parseFloat(this.temperature),
				workingDirectory: this.workingDirectory.trim() || undefined,
				systemPrompt: this.systemPrompt.trim() || undefined,
				enableCodeExecution: this.enableCodeExecution,
				enableFileAccess: this.enableFileAccess,
				cols: 120,
				rows: 30
			}
		};
	}

	/**
	 * Handle form submission
	 */
	handleSubmit(event) {
		event?.preventDefault?.();

		this.isValidating = true;
		const isValid = this.validateForm();

		setTimeout(() => {
			this.isValidating = false;

			if (isValid) {
				this.updateSessionData();
			}
		}, 100);
	}

	/**
	 * Clear validation errors for a field
	 */
	clearFieldError(fieldName) {
		const newErrors = { ...this.validationErrors };
		delete newErrors[fieldName];
		this.validationErrors = newErrors;
	}

	// Private methods

	#setupAuthenticationHandlers() {
		if (!this.#claudeClient) return;

		this.#claudeClient.setOnAuthStarted((data) => {
			console.log('Claude auth started:', data);
		});

		this.#claudeClient.setOnAuthOutput((data) => {
			console.log('Claude auth output:', data);
		});

		this.#claudeClient.setOnAuthUrl((data) => {
			console.log('Claude OAuth URL received:', data);
			this.oauthUrl = data.url;
		});

		this.#claudeClient.setOnAuthCompleted((data) => {
			console.log('Claude auth completed:', data);
			if (data.success && data.authenticated) {
				this.claudeAuthStatus = 'ready';
				this.oauthUrl = '';
				this.userToken = '';
			} else {
				this.claudeAuthStatus = 'error';
				this.authError = data.message || 'Authentication failed';
			}
		});
	}
}