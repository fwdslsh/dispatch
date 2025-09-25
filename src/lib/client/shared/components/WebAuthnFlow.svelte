<!--
  WebAuthnFlow.svelte

  Enhanced WebAuthn registration and authentication flow with browser compatibility
  Provides step-by-step guidance and cross-browser support
-->

<script>
	import { onMount, createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';
	import Modal from './Modal.svelte';
	import {
		checkWebAuthnAvailability,
		getWebAuthnErrorMessage,
		formatCredentialForTransmission,
		prepareCreationOptions,
		prepareRequestOptions
	} from '../utils/webauthn.js';

	const dispatch = createEventDispatcher();

	// Props
	let {
		mode = 'authenticate', // 'authenticate' | 'register'
		userId = null,
		username = '',
		deviceName = '',
		open = $bindable(false),
		showCompatibilityCheck = true,
		autoStart = false
	} = $props();

	// State
	let currentStep = $state('compatibility'); // 'compatibility' | 'ready' | 'authenticating' | 'success' | 'error'
	let loading = $state(false);
	let error = $state(null);
	let availability = $state(null);
	let compatibilityDetails = $state(null);
	let flowTitle = $state('');
	let flowDescription = $state('');

	// Browser compatibility state
	let browserCompatibility = $state({
		supported: false,
		platformAuthenticator: false,
		conditionalUI: false,
		version: null,
		warnings: [],
		recommendations: []
	});

	/**
	 * Initialize the WebAuthn flow
	 */
	onMount(async () => {
		if (browser && open) {
			await initializeFlow();
		}
	});

	/**
	 * Initialize flow when modal opens
	 */
	$effect(() => {
		if (open && browser) {
			initializeFlow();
		}
	});

	/**
	 * Initialize the WebAuthn flow
	 */
	async function initializeFlow() {
		currentStep = 'compatibility';
		error = null;

		// Set flow titles and descriptions
		updateFlowContent();

		if (showCompatibilityCheck) {
			await checkBrowserCompatibility();
		} else {
			currentStep = 'ready';
		}

		if (autoStart && currentStep === 'ready') {
			await startWebAuthnFlow();
		}
	}

	/**
	 * Update flow content based on mode
	 */
	function updateFlowContent() {
		if (mode === 'register') {
			flowTitle = 'Register Passkey';
			flowDescription =
				"Set up a passkey for secure, password-free authentication using your device's biometric sensors or security key.";
		} else {
			flowTitle = 'Sign In with Passkey';
			flowDescription =
				"Use your previously registered passkey to sign in securely using your device's biometric sensors or security key.";
		}
	}

	/**
	 * Check comprehensive browser compatibility
	 */
	async function checkBrowserCompatibility() {
		loading = true;

		try {
			availability = await checkWebAuthnAvailability();

			// Detect browser and version
			const browserInfo = detectBrowser();

			browserCompatibility = {
				supported: availability.browserSupported,
				platformAuthenticator: availability.platformAvailable,
				conditionalUI: availability.conditionalUI,
				...browserInfo,
				warnings: availability.warnings,
				recommendations: generateCompatibilityRecommendations(availability, browserInfo)
			};

			if (availability.overall) {
				currentStep = 'ready';
			} else {
				currentStep = 'error';
				error = 'WebAuthn is not available in your current environment';
			}
		} catch (err) {
			currentStep = 'error';
			error = `Compatibility check failed: ${err.message}`;
		} finally {
			loading = false;
		}
	}

	/**
	 * Detect browser information
	 */
	function detectBrowser() {
		if (typeof navigator === 'undefined') return { name: 'unknown', version: 'unknown' };

		const userAgent = navigator.userAgent;
		let name = 'unknown';
		let version = 'unknown';

		if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
			name = 'Chrome';
			const match = userAgent.match(/Chrome\/(\d+)/);
			version = match ? match[1] : 'unknown';
		} else if (userAgent.includes('Firefox')) {
			name = 'Firefox';
			const match = userAgent.match(/Firefox\/(\d+)/);
			version = match ? match[1] : 'unknown';
		} else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
			name = 'Safari';
			const match = userAgent.match(/Version\/(\d+)/);
			version = match ? match[1] : 'unknown';
		} else if (userAgent.includes('Edg')) {
			name = 'Edge';
			const match = userAgent.match(/Edg\/(\d+)/);
			version = match ? match[1] : 'unknown';
		}

		return { name, version };
	}

	/**
	 * Generate compatibility recommendations
	 */
	function generateCompatibilityRecommendations(availability, browserInfo) {
		const recommendations = [];

		if (!availability.browserSupported) {
			recommendations.push({
				type: 'upgrade',
				message: 'Update your browser to the latest version for WebAuthn support',
				severity: 'high'
			});
		}

		if (!availability.isSecure) {
			recommendations.push({
				type: 'security',
				message: 'Use HTTPS for secure WebAuthn operations',
				severity: 'high'
			});
		}

		if (
			!availability.platformAvailable &&
			browserInfo.name === 'Chrome' &&
			parseInt(browserInfo.version) < 85
		) {
			recommendations.push({
				type: 'version',
				message: 'Chrome 85+ recommended for optimal WebAuthn support',
				severity: 'medium'
			});
		}

		if (
			!availability.platformAvailable &&
			browserInfo.name === 'Firefox' &&
			parseInt(browserInfo.version) < 90
		) {
			recommendations.push({
				type: 'version',
				message: 'Firefox 90+ recommended for platform authenticators',
				severity: 'medium'
			});
		}

		if (browserInfo.name === 'Safari' && parseInt(browserInfo.version) < 14) {
			recommendations.push({
				type: 'version',
				message: 'Safari 14+ required for WebAuthn support',
				severity: 'high'
			});
		}

		return recommendations;
	}

	/**
	 * Start the WebAuthn authentication or registration flow
	 */
	async function startWebAuthnFlow() {
		currentStep = 'authenticating';
		loading = true;
		error = null;

		try {
			if (mode === 'register') {
				await handleRegistration();
			} else {
				await handleAuthentication();
			}

			currentStep = 'success';

			setTimeout(() => {
				open = false;
			}, 2000);
		} catch (err) {
			console.error('WebAuthn flow error:', err);
			currentStep = 'error';
			error = getWebAuthnErrorMessage(err);
			dispatch('error', { error: error });
		} finally {
			loading = false;
		}
	}

	/**
	 * Handle WebAuthn registration
	 */
	async function handleRegistration() {
		if (!userId) {
			throw new Error('User ID is required for registration');
		}

		// Begin registration
		const beginResponse = await fetch('/api/webauthn/register/begin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId,
				deviceName: deviceName || getDefaultDeviceName()
			})
		});

		const beginData = await beginResponse.json();
		if (!beginData.success) {
			throw new Error(beginData.details || beginData.error);
		}

		// Prepare options for browser API
		const creationOptions = prepareCreationOptions(beginData.challenge);

		// Create credential
		const credential = await navigator.credentials.create({
			publicKey: creationOptions
		});

		if (!credential) {
			throw new Error('Failed to create credential');
		}

		// Format for transmission
		const credentialData = formatCredentialForTransmission(credential);

		// Complete registration
		const completeResponse = await fetch('/api/webauthn/register/complete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId: beginData.sessionId,
				credential: credentialData
			})
		});

		const completeData = await completeResponse.json();
		if (!completeData.success) {
			throw new Error(completeData.details || completeData.error);
		}

		dispatch('success', {
			type: 'register',
			message: completeData.message || 'Passkey registered successfully',
			credentialId: completeData.credentialId
		});
	}

	/**
	 * Handle WebAuthn authentication
	 */
	async function handleAuthentication() {
		// Begin authentication
		const beginResponse = await fetch('/api/webauthn/authenticate/begin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username })
		});

		const beginData = await beginResponse.json();
		if (!beginData.success) {
			throw new Error(beginData.details || beginData.error);
		}

		// Prepare options for browser API
		const requestOptions = prepareRequestOptions(beginData.challenge);

		// Get credential
		const credential = await navigator.credentials.get({
			publicKey: requestOptions
		});

		if (!credential) {
			throw new Error('Failed to get credential');
		}

		// Format for transmission
		const credentialData = formatCredentialForTransmission(credential);

		// Complete authentication
		const completeResponse = await fetch('/api/webauthn/authenticate/complete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				sessionId: beginData.sessionId,
				credential: credentialData
			})
		});

		const completeData = await completeResponse.json();
		if (!completeData.success) {
			throw new Error(completeData.details || completeData.error);
		}

		dispatch('success', {
			type: 'authenticate',
			user: completeData.user,
			authMethod: 'webauthn'
		});
	}

	/**
	 * Get default device name based on browser/OS
	 */
	function getDefaultDeviceName() {
		const browser = browserCompatibility.name || 'Browser';
		const platform = navigator.platform || '';

		if (platform.includes('Mac')) return `${browser} on macOS`;
		if (platform.includes('Win')) return `${browser} on Windows`;
		if (platform.includes('Linux')) return `${browser} on Linux`;
		if (platform.includes('iPhone') || platform.includes('iPad')) return `${browser} on iOS`;
		if (platform.includes('Android')) return `${browser} on Android`;

		return `${browser} Device`;
	}

	/**
	 * Retry the flow
	 */
	function retryFlow() {
		initializeFlow();
	}

	/**
	 * Skip compatibility check
	 */
	function skipCompatibilityCheck() {
		currentStep = 'ready';
	}
</script>

<Modal
	bind:open
	title={flowTitle}
	size="medium"
	closeOnBackdrop={false}
	closeOnEscape={true}
	showCloseButton={true}
	augmented="tl-clip tr-clip bl-clip br-clip both"
>
	{#snippet children()}
		<div class="webauthn-flow">
			{#if currentStep === 'compatibility'}
				<div class="compatibility-check">
					<div class="step-header">
						<div class="step-icon">🔍</div>
						<h3>Checking Browser Compatibility</h3>
						<p>Verifying WebAuthn support in your browser...</p>
					</div>

					{#if loading}
						<div class="loading-state">
							<LoadingSpinner size="lg" />
							<p>Analyzing browser capabilities...</p>
						</div>
					{:else if browserCompatibility}
						<div class="compatibility-results">
							<div class="compatibility-item" class:supported={browserCompatibility.supported}>
								<span class="status-icon">{browserCompatibility.supported ? '✅' : '❌'}</span>
								<span class="item-label">WebAuthn API Support</span>
								<span class="item-details"
									>{browserCompatibility.name} {browserCompatibility.version}</span
								>
							</div>

							<div
								class="compatibility-item"
								class:supported={browserCompatibility.platformAuthenticator}
							>
								<span class="status-icon"
									>{browserCompatibility.platformAuthenticator ? '✅' : '⚠️'}</span
								>
								<span class="item-label">Platform Authenticator</span>
								<span class="item-details">
									{browserCompatibility.platformAuthenticator ? 'Available' : 'Not detected'}
								</span>
							</div>

							<div class="compatibility-item" class:supported={availability?.isSecure}>
								<span class="status-icon">{availability?.isSecure ? '✅' : '⚠️'}</span>
								<span class="item-label">Secure Connection</span>
								<span class="item-details">{availability?.isSecure ? 'HTTPS' : 'HTTP'}</span>
							</div>

							{#if browserCompatibility.recommendations.length > 0}
								<div class="recommendations">
									<h4>Recommendations</h4>
									{#each browserCompatibility.recommendations as rec}
										<div class="recommendation {rec.severity}">
											<span class="rec-icon">
												{#if rec.severity === 'high'}🔴{:else if rec.severity === 'medium'}🟡{:else}🟢{/if}
											</span>
											<span class="rec-message">{rec.message}</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{:else if currentStep === 'ready'}
				<div class="ready-state">
					<div class="step-header">
						<div class="step-icon">🔐</div>
						<h3>{flowTitle}</h3>
						<p>{flowDescription}</p>
					</div>

					<div class="flow-instructions">
						{#if mode === 'register'}
							<div class="instruction-list">
								<div class="instruction-item">
									<span class="instruction-number">1</span>
									<span class="instruction-text"
										>Click "Continue" to start the registration process</span
									>
								</div>
								<div class="instruction-item">
									<span class="instruction-number">2</span>
									<span class="instruction-text"
										>Follow your browser's prompts to create a passkey</span
									>
								</div>
								<div class="instruction-item">
									<span class="instruction-number">3</span>
									<span class="instruction-text">Use biometrics or security key when prompted</span>
								</div>
							</div>
						{:else}
							<div class="instruction-list">
								<div class="instruction-item">
									<span class="instruction-number">1</span>
									<span class="instruction-text">Click "Continue" to authenticate</span>
								</div>
								<div class="instruction-item">
									<span class="instruction-number">2</span>
									<span class="instruction-text">Use your registered biometric or security key</span
									>
								</div>
							</div>
						{/if}

						<div class="browser-specific-tips">
							{#if browserCompatibility.name === 'Chrome'}
								<div class="tip">
									<span class="tip-icon">💡</span>
									<span class="tip-text">Chrome tip: Look for the key icon in your address bar</span
									>
								</div>
							{:else if browserCompatibility.name === 'Firefox'}
								<div class="tip">
									<span class="tip-icon">💡</span>
									<span class="tip-text"
										>Firefox tip: Check for security prompts at the top of the page</span
									>
								</div>
							{:else if browserCompatibility.name === 'Safari'}
								<div class="tip">
									<span class="tip-icon">💡</span>
									<span class="tip-text">Safari tip: Use Touch ID or Face ID when prompted</span>
								</div>
							{/if}
						</div>
					</div>

					<div class="action-buttons">
						<Button variant="primary" onclick={startWebAuthnFlow} disabled={loading}>
							{#if loading}
								<LoadingSpinner size="sm" />
							{/if}
							Continue with {mode === 'register' ? 'Registration' : 'Authentication'}
						</Button>
					</div>
				</div>
			{:else if currentStep === 'authenticating'}
				<div class="authenticating-state">
					<div class="step-header">
						<div class="step-icon animated-pulse">🔐</div>
						<h3>{mode === 'register' ? 'Creating Passkey' : 'Authenticating'}</h3>
						<p>
							{mode === 'register'
								? 'Follow the prompts to create your passkey...'
								: 'Use your passkey to authenticate...'}
						</p>
					</div>

					<div class="auth-progress">
						<LoadingSpinner size="lg" />
						<div class="progress-steps">
							<div class="progress-step active">
								<span class="step-dot"></span>
								<span class="step-label">Browser prompt</span>
							</div>
							<div class="progress-step">
								<span class="step-dot"></span>
								<span class="step-label"
									>{mode === 'register' ? 'Create passkey' : 'Verify identity'}</span
								>
							</div>
							<div class="progress-step">
								<span class="step-dot"></span>
								<span class="step-label">Complete</span>
							</div>
						</div>
					</div>

					<div class="auth-tips">
						<p>If you don't see a prompt, check:</p>
						<ul>
							<li>Browser notifications or permission requests</li>
							<li>Your device's biometric sensor is ready</li>
							<li>Security key is properly connected</li>
						</ul>
					</div>
				</div>
			{:else if currentStep === 'success'}
				<div class="success-state">
					<div class="step-header">
						<div class="step-icon success-icon">✅</div>
						<h3>{mode === 'register' ? 'Passkey Created!' : 'Authentication Successful!'}</h3>
						<p>
							{mode === 'register'
								? 'Your passkey has been successfully registered.'
								: 'You have been authenticated successfully.'}
						</p>
					</div>

					<div class="success-details">
						{#if mode === 'register'}
							<p>You can now use this passkey to sign in without a password.</p>
						{:else}
							<p>Welcome back! You are now signed in.</p>
						{/if}
					</div>
				</div>
			{:else if currentStep === 'error'}
				<div class="error-state">
					<div class="step-header">
						<div class="step-icon error-icon">❌</div>
						<h3>WebAuthn Error</h3>
						<p>{error}</p>
					</div>

					{#if availability?.warnings && availability.warnings.length > 0}
						<div class="error-warnings">
							<h4>Issues Detected:</h4>
							{#each availability.warnings as warning}
								<div class="warning-item">
									<span class="warning-icon">⚠️</span>
									<span class="warning-message">{warning.message}</span>
								</div>
							{/each}
						</div>
					{/if}

					<div class="error-actions">
						<Button variant="secondary" onclick={retryFlow}>Try Again</Button>
						{#if showCompatibilityCheck && currentStep === 'error'}
							<Button variant="ghost" onclick={skipCompatibilityCheck}>
								Skip Check & Continue
							</Button>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/snippet}
</Modal>

<style>
	.webauthn-flow {
		padding: 1rem;
		max-width: 500px;
		margin: 0 auto;
	}

	/* Step Header */
	.step-header {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.step-icon {
		font-size: 3rem;
		margin-bottom: 0.5rem;
		display: block;
	}

	.step-icon.animated-pulse {
		animation: pulse 2s infinite;
	}

	.success-icon {
		color: var(--color-success);
	}

	.error-icon {
		color: var(--color-error);
	}

	.step-header h3 {
		margin: 0 0 0.5rem 0;
		color: var(--color-text);
	}

	.step-header p {
		margin: 0;
		color: var(--color-text-secondary);
		line-height: 1.5;
	}

	/* Loading State */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
	}

	/* Compatibility Results */
	.compatibility-results {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		margin: 1.5rem 0;
	}

	.compatibility-item {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--color-bg-secondary);
		border: 1px solid var(--color-border);
		border-radius: 6px;
	}

	.compatibility-item.supported {
		background: var(--color-success-bg);
		border-color: var(--color-success);
	}

	.status-icon {
		font-size: 1.25rem;
	}

	.item-label {
		font-weight: 500;
		color: var(--color-text);
	}

	.item-details {
		font-size: 0.875rem;
		color: var(--color-text-secondary);
	}

	/* Recommendations */
	.recommendations {
		margin-top: 1.5rem;
		padding: 1rem;
		background: var(--color-info-bg);
		border: 1px solid var(--color-info);
		border-radius: 6px;
	}

	.recommendations h4 {
		margin: 0 0 0.75rem 0;
		color: var(--color-info);
		font-size: 1rem;
	}

	.recommendation {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.recommendation.high {
		color: var(--color-error);
	}

	.recommendation.medium {
		color: var(--color-warning);
	}

	.rec-icon {
		flex-shrink: 0;
	}

	/* Flow Instructions */
	.flow-instructions {
		margin: 1.5rem 0;
	}

	.instruction-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.instruction-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.instruction-number {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1.5rem;
		height: 1.5rem;
		background: var(--color-primary);
		color: var(--color-bg);
		border-radius: 50%;
		font-size: 0.875rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	.instruction-text {
		color: var(--color-text);
		line-height: 1.5;
	}

	/* Browser Tips */
	.browser-specific-tips {
		padding: 1rem;
		background: var(--color-info-bg);
		border: 1px solid var(--color-info);
		border-radius: 6px;
		margin-top: 1rem;
	}

	.tip {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--color-info);
		font-size: 0.875rem;
	}

	.tip-icon {
		flex-shrink: 0;
	}

	/* Action Buttons */
	.action-buttons {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	/* Auth Progress */
	.auth-progress {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		margin: 2rem 0;
	}

	.progress-steps {
		display: flex;
		gap: 2rem;
		align-items: center;
	}

	.progress-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		opacity: 0.5;
		transition: opacity 0.3s ease;
	}

	.progress-step.active {
		opacity: 1;
	}

	.step-dot {
		width: 0.75rem;
		height: 0.75rem;
		background: var(--color-border);
		border-radius: 50%;
		transition: background-color 0.3s ease;
	}

	.progress-step.active .step-dot {
		background: var(--color-primary);
	}

	.step-label {
		font-size: 0.75rem;
		color: var(--color-text-secondary);
		text-align: center;
	}

	/* Auth Tips */
	.auth-tips {
		padding: 1rem;
		background: var(--color-bg-secondary);
		border-radius: 6px;
		margin-top: 1.5rem;
	}

	.auth-tips p {
		margin: 0 0 0.5rem 0;
		font-weight: 500;
		color: var(--color-text);
	}

	.auth-tips ul {
		margin: 0;
		padding-left: 1.25rem;
		color: var(--color-text-secondary);
	}

	.auth-tips li {
		margin-bottom: 0.25rem;
		font-size: 0.875rem;
		line-height: 1.4;
	}

	/* Success Details */
	.success-details {
		text-align: center;
		padding: 1rem;
		background: var(--color-success-bg);
		border: 1px solid var(--color-success);
		border-radius: 6px;
		margin-top: 1rem;
	}

	.success-details p {
		margin: 0;
		color: var(--color-success);
		font-weight: 500;
	}

	/* Error State */
	.error-warnings {
		margin: 1.5rem 0;
		padding: 1rem;
		background: var(--color-warning-bg);
		border: 1px solid var(--color-warning);
		border-radius: 6px;
	}

	.error-warnings h4 {
		margin: 0 0 0.75rem 0;
		color: var(--color-warning);
	}

	.warning-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
	}

	.warning-icon {
		flex-shrink: 0;
	}

	.warning-message {
		color: var(--color-warning);
	}

	.error-actions {
		display: flex;
		justify-content: center;
		gap: 1rem;
		margin-top: 1.5rem;
	}

	/* Animations */
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.5;
		}
	}

	/* Mobile Responsiveness */
	@media (max-width: 480px) {
		.webauthn-flow {
			padding: 0.75rem;
		}

		.step-icon {
			font-size: 2.5rem;
		}

		.progress-steps {
			gap: 1rem;
		}

		.instruction-item {
			gap: 0.5rem;
		}

		.action-buttons {
			flex-direction: column;
		}

		.error-actions {
			flex-direction: column;
		}
	}

	/* High Contrast Mode */
	@media (prefers-contrast: high) {
		.compatibility-item,
		.recommendations,
		.browser-specific-tips,
		.auth-tips,
		.success-details,
		.error-warnings {
			border-width: 2px;
		}
	}

	/* Reduced Motion */
	@media (prefers-reduced-motion: reduce) {
		.step-icon.animated-pulse {
			animation: none;
		}

		.progress-step,
		.step-dot {
			transition: none;
		}
	}
</style>
