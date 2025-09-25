<script>
	import { createEventDispatcher } from 'svelte';
	import Button from './Button.svelte';
	import FormInput from './FormInput.svelte';
	import Spinner from './Spinner.svelte';
	import SecurityDashboard from './SecurityDashboard.svelte';
	import AuthMethodIndicator from './AuthMethodIndicator.svelte';

	const dispatch = createEventDispatcher();

	let {
		visible = $bindable(true),
		currentStep = $bindable('welcome'),
		userEmail = $bindable(''),
		terminalKey = $bindable('')
	} = $props();

	// Onboarding state
	let loading = $state(false);
	let error = $state(null);
	let migrationData = $state({
		hasExistingKey: false,
		keyValid: false,
		keyChecked: false,
		migrationComplete: false
	});

	let setupData = $state({
		adminUser: {
			email: '',
			displayName: '',
			password: '',
			confirmPassword: ''
		},
		authMethods: {
			local: true,
			webauthn: false,
			oauth: false
		},
		completedSteps: []
	});

	const steps = [
		{ id: 'welcome', title: 'Welcome', description: 'Get started with Dispatch authentication' },
		{
			id: 'migration',
			title: 'Migration',
			description: 'Migrate from TERMINAL_KEY authentication'
		},
		{ id: 'admin-setup', title: 'Admin Setup', description: 'Create your administrator account' },
		{
			id: 'auth-methods',
			title: 'Authentication',
			description: 'Configure authentication methods'
		},
		{ id: 'security-review', title: 'Security', description: 'Review your security configuration' },
		{ id: 'complete', title: 'Complete', description: 'Onboarding completed successfully' }
	];

	const stepIndex = $derived(() => steps.findIndex((s) => s.id === currentStep));
	const isFirstStep = $derived(() => stepIndex() === 0);
	const isLastStep = $derived(() => stepIndex() === steps.length - 1);

	// Check for existing TERMINAL_KEY on mount
	$effect(() => {
		if (currentStep === 'migration' && !migrationData.keyChecked) {
			checkExistingKey();
		}
	});

	async function checkExistingKey() {
		try {
			loading = true;
			const response = await fetch('/api/admin/migration/check');
			if (response.ok) {
				const data = await response.json();
				migrationData.hasExistingKey = data.hasExistingKey;
				migrationData.keyChecked = true;

				// If no existing key, skip migration step
				if (!data.hasExistingKey) {
					nextStep();
				}
			}
		} catch (err) {
			error = 'Failed to check for existing authentication configuration';
		} finally {
			loading = false;
		}
	}

	async function validateTerminalKey() {
		if (!terminalKey.trim()) {
			error = 'Please enter your TERMINAL_KEY';
			return;
		}

		try {
			loading = true;
			error = null;

			const response = await fetch('/api/admin/migration/validate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ terminalKey })
			});

			if (response.ok) {
				migrationData.keyValid = true;
				// Pre-populate admin email if available
				const data = await response.json();
				if (data.adminEmail) {
					setupData.adminUser.email = data.adminEmail;
					setupData.adminUser.displayName = data.adminDisplayName || 'Administrator';
				}
			} else {
				const data = await response.json();
				error = data.error || 'Invalid TERMINAL_KEY';
				migrationData.keyValid = false;
			}
		} catch (err) {
			error = 'Failed to validate TERMINAL_KEY';
			migrationData.keyValid = false;
		} finally {
			loading = false;
		}
	}

	async function createAdminUser() {
		// Validate admin user data
		if (!setupData.adminUser.email || !setupData.adminUser.password) {
			error = 'Please fill in all required fields';
			return;
		}

		if (setupData.adminUser.password !== setupData.adminUser.confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (setupData.adminUser.password.length < 12) {
			error = 'Password must be at least 12 characters long';
			return;
		}

		try {
			loading = true;
			error = null;

			const payload = {
				adminUser: setupData.adminUser,
				terminalKey: migrationData.keyValid ? terminalKey : null
			};

			const response = await fetch('/api/admin/setup/create-admin', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			if (response.ok) {
				setupData.completedSteps.push('admin-setup');
				nextStep();
			} else {
				const data = await response.json();
				error = data.error || 'Failed to create administrator account';
			}
		} catch (err) {
			error = 'Failed to create administrator account';
		} finally {
			loading = false;
		}
	}

	async function configureAuthMethods() {
		try {
			loading = true;
			error = null;

			const response = await fetch('/api/admin/setup/auth-methods', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					methods: setupData.authMethods
				})
			});

			if (response.ok) {
				setupData.completedSteps.push('auth-methods');
				nextStep();
			} else {
				const data = await response.json();
				error = data.error || 'Failed to configure authentication methods';
			}
		} catch (err) {
			error = 'Failed to configure authentication methods';
		} finally {
			loading = false;
		}
	}

	async function completeOnboarding() {
		try {
			loading = true;
			error = null;

			const response = await fetch('/api/admin/setup/complete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					migrationComplete: migrationData.keyValid,
					terminalKey: migrationData.keyValid ? terminalKey : null
				})
			});

			if (response.ok) {
				dispatch('complete', {
					adminUser: setupData.adminUser,
					authMethods: setupData.authMethods,
					migrationComplete: migrationData.keyValid
				});
				visible = false;
			} else {
				const data = await response.json();
				error = data.error || 'Failed to complete onboarding';
			}
		} catch (err) {
			error = 'Failed to complete onboarding';
		} finally {
			loading = false;
		}
	}

	function nextStep() {
		if (stepIndex() < steps.length - 1) {
			currentStep = steps[stepIndex() + 1].id;
			error = null;
		}
	}

	function prevStep() {
		if (stepIndex() > 0) {
			currentStep = steps[stepIndex() - 1].id;
			error = null;
		}
	}

	function skipStep() {
		nextStep();
	}

	function closeOnboarding() {
		dispatch('close');
		visible = false;
	}
</script>

{#if visible}
	<div class="onboarding-overlay" data-testid="onboarding-flow">
		<div class="onboarding-modal">
			<!-- Progress bar -->
			<div class="progress-bar">
				<div class="progress-steps">
					{#each steps as step, index}
						<div
							class="progress-step {currentStep === step.id
								? 'active'
								: ''} {setupData.completedSteps.includes(step.id) ? 'completed' : ''}"
						>
							<div class="step-indicator">
								{#if setupData.completedSteps.includes(step.id)}
									✓
								{:else}
									{index + 1}
								{/if}
							</div>
							<div class="step-info">
								<div class="step-title">{step.title}</div>
								<div class="step-description">{step.description}</div>
							</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- Content area -->
			<div class="onboarding-content">
				{#if error}
					<div class="error-message" role="alert">
						<span class="error-icon">⚠️</span>
						<span class="error-text">{error}</span>
					</div>
				{/if}

				{#if currentStep === 'welcome'}
					<div class="step-content welcome-step">
						<div class="welcome-header">
							<h1>🔐 Welcome to Dispatch Authentication</h1>
							<p>
								Let's set up modern authentication for your Dispatch instance. This will replace
								TERMINAL_KEY with secure user-based authentication.
							</p>
						</div>

						<div class="welcome-features">
							<div class="feature-item">
								<span class="feature-icon">👤</span>
								<div class="feature-info">
									<h3>User Management</h3>
									<p>Create and manage user accounts with role-based access</p>
								</div>
							</div>
							<div class="feature-item">
								<span class="feature-icon">🔐</span>
								<div class="feature-info">
									<h3>Modern Authentication</h3>
									<p>WebAuthn/Passkeys, OAuth providers, and secure sessions</p>
								</div>
							</div>
							<div class="feature-item">
								<span class="feature-icon">🛡️</span>
								<div class="feature-info">
									<h3>Enhanced Security</h3>
									<p>Audit logging, device management, and security policies</p>
								</div>
							</div>
						</div>
					</div>
				{:else if currentStep === 'migration'}
					<div class="step-content migration-step">
						<div class="step-header">
							<h2>🔄 Migration from TERMINAL_KEY</h2>
							<p>
								We'll help you migrate from your existing TERMINAL_KEY authentication to the new
								user-based system.
							</p>
						</div>

						{#if migrationData.hasExistingKey}
							<div class="migration-form">
								<p class="migration-note">
									<strong>Note:</strong> Your existing TERMINAL_KEY will be disabled once migration is
									complete. Make sure to save your new admin credentials securely.
								</p>

								<FormInput
									label="Current TERMINAL_KEY"
									type="password"
									bind:value={terminalKey}
									placeholder="Enter your current TERMINAL_KEY"
									required
									disabled={loading}
								/>

								{#if migrationData.keyValid}
									<div class="validation-success">
										<span class="success-icon">✅</span>
										<span>TERMINAL_KEY validated successfully</span>
									</div>
								{/if}

								{#if !migrationData.keyValid && terminalKey}
									<Button onclick={validateTerminalKey} disabled={loading || !terminalKey.trim()}>
										{#if loading}
											<Spinner size="small" inline /> Validating...
										{:else}
											Validate TERMINAL_KEY
										{/if}
									</Button>
								{/if}
							</div>
						{:else if migrationData.keyChecked}
							<div class="no-migration-needed">
								<div class="info-icon">ℹ️</div>
								<p>
									No existing TERMINAL_KEY found. We'll create a fresh authentication setup for you.
								</p>
							</div>
						{/if}
					</div>
				{:else if currentStep === 'admin-setup'}
					<div class="step-content admin-setup-step">
						<div class="step-header">
							<h2>👤 Create Administrator Account</h2>
							<p>This will be your primary administrator account with full system access.</p>
						</div>

						<div class="admin-form">
							<FormInput
								label="Email Address"
								type="email"
								bind:value={setupData.adminUser.email}
								placeholder="admin@example.com"
								required
								disabled={loading}
							/>

							<FormInput
								label="Display Name"
								type="text"
								bind:value={setupData.adminUser.displayName}
								placeholder="Administrator"
								disabled={loading}
							/>

							<FormInput
								label="Password"
								type="password"
								bind:value={setupData.adminUser.password}
								placeholder="Enter a strong password (min 12 characters)"
								required
								disabled={loading}
							/>

							<FormInput
								label="Confirm Password"
								type="password"
								bind:value={setupData.adminUser.confirmPassword}
								placeholder="Confirm your password"
								required
								disabled={loading}
							/>

							<div class="password-requirements">
								<h4>Password Requirements:</h4>
								<ul>
									<li class={setupData.adminUser.password.length >= 12 ? 'met' : ''}>
										At least 12 characters long
									</li>
									<li class={/[A-Z]/.test(setupData.adminUser.password) ? 'met' : ''}>
										Contains uppercase letters
									</li>
									<li class={/[a-z]/.test(setupData.adminUser.password) ? 'met' : ''}>
										Contains lowercase letters
									</li>
									<li class={/[0-9]/.test(setupData.adminUser.password) ? 'met' : ''}>
										Contains numbers
									</li>
									<li class={/[^A-Za-z0-9]/.test(setupData.adminUser.password) ? 'met' : ''}>
										Contains special characters
									</li>
								</ul>
							</div>
						</div>
					</div>
				{:else if currentStep === 'auth-methods'}
					<div class="step-content auth-methods-step">
						<div class="step-header">
							<h2>🔐 Configure Authentication Methods</h2>
							<p>Choose which authentication methods to enable for your users.</p>
						</div>

						<div class="auth-methods-config">
							<div class="method-config">
								<div class="method-header">
									<AuthMethodIndicator method="local" compact showStatus />
									<label class="method-toggle">
										<input
											type="checkbox"
											bind:checked={setupData.authMethods.local}
											disabled={true}
										/>
										<span class="toggle-slider"></span>
									</label>
								</div>
								<p class="method-description">
									Access code authentication (always enabled as fallback method)
								</p>
							</div>

							<div class="method-config">
								<div class="method-header">
									<AuthMethodIndicator method="webauthn" compact showStatus />
									<label class="method-toggle">
										<input
											type="checkbox"
											bind:checked={setupData.authMethods.webauthn}
											disabled={loading}
										/>
										<span class="toggle-slider"></span>
									</label>
								</div>
								<p class="method-description">
									WebAuthn/Passkeys for passwordless authentication (recommended)
								</p>
							</div>

							<div class="method-config">
								<div class="method-header">
									<AuthMethodIndicator method="oauth" compact showStatus />
									<label class="method-toggle">
										<input
											type="checkbox"
											bind:checked={setupData.authMethods.oauth}
											disabled={loading}
										/>
										<span class="toggle-slider"></span>
									</label>
								</div>
								<p class="method-description">
									OAuth providers (Google, GitHub) for convenient sign-in
								</p>
							</div>
						</div>

						<div class="auth-methods-note">
							<p>
								<strong>Note:</strong> You can always change these settings later in the admin panel.
							</p>
						</div>
					</div>
				{:else if currentStep === 'security-review'}
					<div class="step-content security-review-step">
						<div class="step-header">
							<h2>🛡️ Security Configuration Review</h2>
							<p>Review your security configuration before completing setup.</p>
						</div>

						<SecurityDashboard
							context="setup"
							showWarnings={true}
							showMethodStatus={true}
							showSecurityContext={true}
							compact={false}
						/>

						<div class="security-recommendations">
							<h3>Recommendations for Production:</h3>
							<ul>
								<li>Enable HTTPS with a valid SSL certificate</li>
								<li>Configure WebAuthn for passwordless authentication</li>
								<li>Set up OAuth providers for user convenience</li>
								<li>Regularly review user sessions and audit logs</li>
								<li>Keep Dispatch updated to the latest version</li>
							</ul>
						</div>
					</div>
				{:else if currentStep === 'complete'}
					<div class="step-content complete-step">
						<div class="completion-header">
							<div class="success-icon-large">🎉</div>
							<h1>Setup Complete!</h1>
							<p>Your Dispatch authentication system is now ready to use.</p>
						</div>

						<div class="completion-summary">
							<div class="summary-item">
								<span class="summary-icon">👤</span>
								<div class="summary-info">
									<h3>Administrator Account</h3>
									<p>Created for {setupData.adminUser.email}</p>
								</div>
							</div>

							<div class="summary-item">
								<span class="summary-icon">🔐</span>
								<div class="summary-info">
									<h3>Authentication Methods</h3>
									<p>
										{Object.entries(setupData.authMethods)
											.filter(([_, enabled]) => enabled)
											.map(([method, _]) => method)
											.join(', ')} enabled
									</p>
								</div>
							</div>

							{#if migrationData.keyValid}
								<div class="summary-item">
									<span class="summary-icon">🔄</span>
									<div class="summary-info">
										<h3>Migration Complete</h3>
										<p>Successfully migrated from TERMINAL_KEY</p>
									</div>
								</div>
							{/if}
						</div>

						<div class="next-steps">
							<h3>Next Steps:</h3>
							<ol>
								<li>Sign in with your new administrator account</li>
								<li>Configure additional authentication methods if needed</li>
								<li>Create user accounts for your team</li>
								<li>Review security settings in the admin panel</li>
							</ol>
						</div>
					</div>
				{/if}
			</div>

			<!-- Action buttons -->
			<div class="onboarding-actions">
				<div class="action-buttons-left">
					{#if !isFirstStep && currentStep !== 'complete'}
						<Button variant="secondary" onclick={prevStep} disabled={loading}>Previous</Button>
					{/if}
				</div>

				<div class="action-buttons-right">
					{#if currentStep === 'welcome'}
						<Button onclick={nextStep}>Get Started</Button>
					{:else if currentStep === 'migration'}
						{#if migrationData.keyValid || !migrationData.hasExistingKey}
							<Button onclick={nextStep}>Continue</Button>
						{:else if !migrationData.keyValid && migrationData.hasExistingKey}
							<Button variant="secondary" onclick={skipStep}>Skip Migration</Button>
						{/if}
					{:else if currentStep === 'admin-setup'}
						<Button
							onclick={createAdminUser}
							disabled={loading ||
								!setupData.adminUser.email ||
								!setupData.adminUser.password ||
								setupData.adminUser.password !== setupData.adminUser.confirmPassword}
						>
							{#if loading}
								<Spinner size="small" inline /> Creating...
							{:else}
								Create Admin Account
							{/if}
						</Button>
					{:else if currentStep === 'auth-methods'}
						<Button onclick={configureAuthMethods} disabled={loading}>
							{#if loading}
								<Spinner size="small" inline /> Configuring...
							{:else}
								Configure Methods
							{/if}
						</Button>
					{:else if currentStep === 'security-review'}
						<Button onclick={nextStep}>Continue to Complete</Button>
					{:else if currentStep === 'complete'}
						<Button onclick={completeOnboarding} disabled={loading}>
							{#if loading}
								<Spinner size="small" inline /> Finalizing...
							{:else}
								Finish Setup
							{/if}
						</Button>
					{/if}

					{#if currentStep !== 'complete'}
						<Button variant="ghost" onclick={closeOnboarding}>Cancel</Button>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.onboarding-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.onboarding-modal {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		width: 100%;
		max-width: 900px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.progress-bar {
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
		padding: 1rem;
	}

	.progress-steps {
		display: flex;
		gap: 1rem;
		overflow-x: auto;
		padding-bottom: 0.5rem;
	}

	.progress-step {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 120px;
		opacity: 0.6;
		transition: opacity 0.2s ease;
	}

	.progress-step.active {
		opacity: 1;
		color: #2563eb;
	}

	.progress-step.completed {
		opacity: 0.8;
		color: #059669;
	}

	.step-indicator {
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: #e5e7eb;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 600;
		font-size: 0.875rem;
		flex-shrink: 0;
	}

	.progress-step.active .step-indicator {
		background: #2563eb;
		color: white;
	}

	.progress-step.completed .step-indicator {
		background: #059669;
		color: white;
	}

	.step-info {
		min-width: 0;
	}

	.step-title {
		font-weight: 600;
		font-size: 0.875rem;
		line-height: 1.2;
	}

	.step-description {
		font-size: 0.75rem;
		color: #6b7280;
		line-height: 1.3;
		margin-top: 0.125rem;
	}

	.onboarding-content {
		flex: 1;
		padding: 2rem;
		overflow-y: auto;
	}

	.error-message {
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.375rem;
		padding: 0.75rem 1rem;
		margin-bottom: 1.5rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #dc2626;
	}

	.error-icon {
		flex-shrink: 0;
	}

	.error-text {
		font-size: 0.875rem;
	}

	.step-content {
		max-width: 600px;
		margin: 0 auto;
	}

	.step-header h1,
	.step-header h2 {
		margin: 0 0 0.5rem 0;
		color: #1f2937;
	}

	.step-header p {
		margin: 0 0 2rem 0;
		color: #6b7280;
		font-size: 1rem;
		line-height: 1.6;
	}

	.welcome-features {
		display: grid;
		gap: 1.5rem;
		margin-top: 2rem;
	}

	.feature-item {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1rem;
		background: #f8fafc;
		border-radius: 0.5rem;
		border: 1px solid #e2e8f0;
	}

	.feature-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.feature-info h3 {
		margin: 0 0 0.25rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #1f2937;
	}

	.feature-info p {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
		line-height: 1.5;
	}

	.migration-form,
	.admin-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.migration-note {
		background: #fffbeb;
		border: 1px solid #fed7aa;
		border-radius: 0.375rem;
		padding: 1rem;
		color: #92400e;
		font-size: 0.875rem;
		margin-bottom: 1.5rem;
	}

	.validation-success {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: #059669;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.no-migration-needed {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 2rem;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 0.5rem;
		color: #0369a1;
	}

	.info-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.password-requirements {
		margin-top: 1rem;
		padding: 1rem;
		background: #f8fafc;
		border-radius: 0.375rem;
		border: 1px solid #e2e8f0;
	}

	.password-requirements h4 {
		margin: 0 0 0.5rem 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #374151;
	}

	.password-requirements ul {
		margin: 0;
		padding-left: 1.25rem;
		list-style: none;
	}

	.password-requirements li {
		position: relative;
		font-size: 0.8125rem;
		color: #6b7280;
		margin-bottom: 0.25rem;
		padding-left: 1.5rem;
	}

	.password-requirements li:before {
		content: '○';
		position: absolute;
		left: 0;
		color: #d1d5db;
	}

	.password-requirements li.met {
		color: #059669;
	}

	.password-requirements li.met:before {
		content: '●';
		color: #059669;
	}

	.auth-methods-config {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.method-config {
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
		padding: 1rem;
		background: #f8fafc;
	}

	.method-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.method-toggle {
		position: relative;
		display: inline-block;
		width: 44px;
		height: 24px;
	}

	.method-toggle input {
		opacity: 0;
		width: 0;
		height: 0;
	}

	.toggle-slider {
		position: absolute;
		cursor: pointer;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: #ccc;
		transition: 0.4s;
		border-radius: 24px;
	}

	.toggle-slider:before {
		position: absolute;
		content: '';
		height: 18px;
		width: 18px;
		left: 3px;
		bottom: 3px;
		background-color: white;
		transition: 0.4s;
		border-radius: 50%;
	}

	.method-toggle input:checked + .toggle-slider {
		background-color: #2563eb;
	}

	.method-toggle input:checked + .toggle-slider:before {
		transform: translateX(20px);
	}

	.method-toggle input:disabled + .toggle-slider {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.method-description {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
		line-height: 1.5;
	}

	.auth-methods-note {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 0.375rem;
		color: #0369a1;
		font-size: 0.875rem;
	}

	.security-recommendations {
		margin-top: 2rem;
		padding: 1rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
	}

	.security-recommendations h3 {
		margin: 0 0 0.75rem 0;
		color: #1f2937;
		font-size: 1rem;
	}

	.security-recommendations ul {
		margin: 0;
		padding-left: 1.25rem;
		color: #6b7280;
	}

	.security-recommendations li {
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.completion-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.success-icon-large {
		font-size: 4rem;
		margin-bottom: 1rem;
	}

	.completion-header h1 {
		margin: 0 0 0.5rem 0;
		color: #1f2937;
		font-size: 2rem;
	}

	.completion-header p {
		margin: 0;
		color: #6b7280;
		font-size: 1.125rem;
	}

	.completion-summary {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.summary-item {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
	}

	.summary-icon {
		font-size: 1.5rem;
		flex-shrink: 0;
	}

	.summary-info h3 {
		margin: 0 0 0.25rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: #1f2937;
	}

	.summary-info p {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
	}

	.next-steps {
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 0.5rem;
		padding: 1.5rem;
		color: #0369a1;
	}

	.next-steps h3 {
		margin: 0 0 1rem 0;
		color: #0369a1;
		font-size: 1rem;
	}

	.next-steps ol {
		margin: 0;
		padding-left: 1.25rem;
	}

	.next-steps li {
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.onboarding-actions {
		background: #f8fafc;
		border-top: 1px solid #e2e8f0;
		padding: 1rem 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.action-buttons-left,
	.action-buttons-right {
		display: flex;
		gap: 0.5rem;
		align-items: center;
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.onboarding-modal {
			margin: 0.5rem;
			max-width: none;
		}

		.onboarding-content {
			padding: 1.5rem 1rem;
		}

		.progress-steps {
			gap: 0.5rem;
		}

		.progress-step {
			min-width: 100px;
		}

		.step-title {
			font-size: 0.8125rem;
		}

		.step-description {
			font-size: 0.6875rem;
		}

		.onboarding-actions {
			padding: 1rem;
			flex-direction: column;
			gap: 1rem;
		}

		.action-buttons-left,
		.action-buttons-right {
			width: 100%;
			justify-content: center;
		}
	}
</style>
