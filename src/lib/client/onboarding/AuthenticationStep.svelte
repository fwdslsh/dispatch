<script>
	/**
	 * AuthenticationStep - First step in onboarding workflow
	 * Handles terminal key authentication and validation
	 * Part of progressive onboarding system
	 */

	import { getContext } from 'svelte';

	// Props
	export let onComplete = () => {};
	export let onSkip = () => {};

	// Get services from context
	const serviceContainer = getContext('services');
	const apiClient = serviceContainer?.get('apiClient');

	// Local state
	let terminalKey = '';
	let isValidating = false;
	let error = null;
	let isAuthenticated = false;

	// Handle authentication
	async function handleAuthenticate() {
		if (!terminalKey.trim()) {
			error = 'Please enter a terminal key';
			return;
		}

		isValidating = true;
		error = null;

		try {
			// Check if API client is available
			if (!apiClient) {
				throw new Error('API client not available');
			}

			// Validate terminal key with auth API
			const response = await fetch('/api/auth/check', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ key: terminalKey })
			});

			const result = await response.json();

			if (result.success) {
				// Store terminal key for future use
				localStorage.setItem('terminalKey', terminalKey);
				isAuthenticated = true;

				// Mark step complete and proceed
				onComplete({ terminalKey });
			} else {
				error = result.error || 'Invalid terminal key';
			}
		} catch (err) {
			error = err.message || 'Authentication failed';
		} finally {
			isValidating = false;
		}
	}

	// Handle key press for better UX
	function handleKeyPress(event) {
		if (event.key === 'Enter' && !isValidating) {
			handleAuthenticate();
		}
	}

	// Skip authentication (for development)
	function handleSkipAuth() {
		onSkip();
	}
</script>

<div class="auth-step" role="main" aria-label="Authentication">
	<div class="step-header">
		<h2>🔐 Welcome to Dispatch</h2>
		<p>Enter your terminal key to get started</p>
	</div>

	{#if !isAuthenticated}
		<div class="auth-form">
			<div class="form-group">
				<label for="terminal-key" class="form-label">
					Terminal Key
					<span class="form-help">This key was provided when Dispatch was set up</span>
				</label>
				<input
					id="terminal-key"
					type="password"
					class="form-input"
					class:error={error}
					bind:value={terminalKey}
					onkeypress={handleKeyPress}
					placeholder="Enter your terminal key"
					disabled={isValidating}
				/>
				{#if error}
					<div class="error-text" role="alert">{error}</div>
				{/if}
			</div>

			<div class="form-actions">
				<button
					class="btn btn-primary"
					onclick={handleAuthenticate}
					disabled={isValidating || !terminalKey.trim()}
				>
					{#if isValidating}
						Validating...
					{:else}
						Continue
					{/if}
				</button>

				<button
					class="btn btn-secondary"
					onclick={handleSkipAuth}
					disabled={isValidating}
				>
					Skip for Now
				</button>
			</div>
		</div>
	{:else}
		<div class="success-state">
			<div class="success-icon">✅</div>
			<h3>Authentication Successful</h3>
			<p>You're now logged in and ready to use Dispatch</p>
		</div>
	{/if}

	{#if isValidating}
		<div class="loading-overlay">
			<div class="spinner"></div>
			<span>Verifying credentials...</span>
		</div>
	{/if}
</div>

<style>
	.auth-step {
		max-width: 500px;
		margin: 0 auto;
		padding: 2rem;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.step-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.step-header h2 {
		margin: 0 0 0.5rem 0;
		color: #1f2937;
		font-size: 1.75rem;
	}

	.step-header p {
		margin: 0;
		color: #6b7280;
		font-size: 1.125rem;
	}

	.auth-form {
		background: white;
		border-radius: 8px;
		padding: 2rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	.form-label {
		display: block;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
	}

	.form-help {
		display: block;
		font-size: 0.875rem;
		font-weight: normal;
		color: #6b7280;
		margin-top: 0.25rem;
	}

	.form-input {
		width: 100%;
		padding: 0.75rem;
		border: 2px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
		transition: border-color 0.2s;
		box-sizing: border-box;
	}

	.form-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.form-input.error {
		border-color: #dc2626;
	}

	.form-input:disabled {
		background-color: #f9fafb;
		cursor: not-allowed;
	}

	.error-text {
		color: #dc2626;
		font-size: 0.875rem;
		margin-top: 0.5rem;
	}

	.form-actions {
		display: flex;
		gap: 1rem;
		justify-content: flex-end;
		margin-top: 2rem;
	}

	.btn {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		min-width: 120px;
	}

	.btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #2563eb;
	}

	.btn-secondary {
		background-color: #e5e7eb;
		color: #374151;
	}

	.btn-secondary:hover:not(:disabled) {
		background-color: #d1d5db;
	}

	.success-state {
		background: white;
		border-radius: 8px;
		padding: 3rem 2rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		border: 1px solid #e5e7eb;
		text-align: center;
	}

	.success-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
	}

	.success-state h3 {
		margin: 0 0 0.5rem 0;
		color: #16a34a;
		font-size: 1.5rem;
	}

	.success-state p {
		margin: 0;
		color: #6b7280;
		font-size: 1.125rem;
	}

	.loading-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		color: white;
		font-size: 1.125rem;
		z-index: 1000;
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid rgba(255, 255, 255, 0.3);
		border-top: 3px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	/* Responsive design */
	@media (max-width: 640px) {
		.auth-step {
			padding: 1rem;
		}

		.auth-form {
			padding: 1.5rem;
		}

		.form-actions {
			flex-direction: column;
		}

		.btn {
			width: 100%;
		}
	}
</style>