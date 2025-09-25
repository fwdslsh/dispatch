<script>
	import { createEventDispatcher } from 'svelte';
	import Button from './Button.svelte';
	import Spinner from './Spinner.svelte';

	const dispatch = createEventDispatcher();

	let {
		visible = $bindable(true),
		minutesRemaining = 5,
		autoExtend = true,
		showCountdown = true
	} = $props();

	let extending = $state(false);
	let countdown = $state(minutesRemaining * 60); // Convert to seconds
	let countdownInterval;

	$effect(() => {
		if (visible && showCountdown) {
			countdown = minutesRemaining * 60;
			startCountdown();
		} else {
			stopCountdown();
		}

		return () => stopCountdown();
	});

	function startCountdown() {
		stopCountdown();
		countdownInterval = setInterval(() => {
			countdown--;

			if (countdown <= 0) {
				stopCountdown();
				dispatch('session-expired');
				visible = false;
			} else if (countdown <= 60 && autoExtend) {
				// Auto-extend when 1 minute remaining
				extendSession();
			}
		}, 1000);
	}

	function stopCountdown() {
		if (countdownInterval) {
			clearInterval(countdownInterval);
			countdownInterval = null;
		}
	}

	function formatCountdown(seconds) {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	}

	function getUrgencyLevel() {
		if (countdown <= 60) return 'critical';
		if (countdown <= 180) return 'high';
		return 'medium';
	}

	async function extendSession() {
		if (extending) return;

		try {
			extending = true;
			const response = await fetch('/api/auth/extend-session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			if (response.ok) {
				const data = await response.json();
				dispatch('session-extended', data);
				visible = false;
			} else {
				const data = await response.json();
				dispatch('extend-failed', { error: data.error || 'Failed to extend session' });
			}
		} catch (error) {
			console.error('Failed to extend session:', error);
			dispatch('extend-failed', { error: 'Network error' });
		} finally {
			extending = false;
		}
	}

	function dismissWarning() {
		dispatch('dismissed');
		visible = false;
	}

	function logout() {
		dispatch('logout');
		visible = false;
	}
</script>

{#if visible}
	<div class="session-warning-overlay" data-testid="session-expiry-warning">
		<div class="session-warning-modal urgency-{getUrgencyLevel()}">
			<div class="warning-header">
				<div class="warning-icon">
					{#if getUrgencyLevel() === 'critical'}
						🚨
					{:else if getUrgencyLevel() === 'high'}
						⚠️
					{:else}
						⏰
					{/if}
				</div>
				<div class="warning-title-section">
					<h3 class="warning-title">
						{#if countdown <= 60}
							Session Expiring Soon!
						{:else if countdown <= 180}
							Session Expiring
						{:else}
							Session Expiry Notice
						{/if}
					</h3>
					<p class="warning-subtitle">
						Your session will expire automatically to protect your account.
					</p>
				</div>
			</div>

			<div class="warning-content">
				{#if showCountdown}
					<div class="countdown-display">
						<div class="countdown-timer urgency-{getUrgencyLevel()}">
							{formatCountdown(countdown)}
						</div>
						<div class="countdown-label">
							{countdown <= 60 ? 'seconds' : 'minutes'} remaining
						</div>
					</div>
				{:else}
					<div class="expiry-info">
						<p>Your session expires in approximately {minutesRemaining} minutes.</p>
					</div>
				{/if}

				<div class="warning-details">
					<ul>
						<li>Click "Extend Session" to continue working</li>
						<li>Your work will be saved automatically</li>
						<li>You'll need to sign in again if the session expires</li>
					</ul>
				</div>

				{#if autoExtend && countdown <= 120}
					<div class="auto-extend-notice">
						<div class="notice-icon">ℹ️</div>
						<div class="notice-text">
							Your session will be extended automatically when 1 minute remains.
						</div>
					</div>
				{/if}
			</div>

			<div class="warning-actions">
				<div class="primary-actions">
					<Button onclick={extendSession} disabled={extending} variant="primary">
						{#if extending}
							<Spinner size="small" inline /> Extending...
						{:else}
							🔄 Extend Session
						{/if}
					</Button>
				</div>

				<div class="secondary-actions">
					<Button onclick={dismissWarning} variant="secondary" disabled={extending}>
						Dismiss
					</Button>
					<Button onclick={logout} variant="ghost" disabled={extending}>
						Sign Out
					</Button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.session-warning-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.6);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 2000;
		padding: 1rem;
		animation: fadeIn 0.3s ease-out;
	}

	.session-warning-modal {
		background: white;
		border-radius: 0.75rem;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		width: 100%;
		max-width: 480px;
		overflow: hidden;
		animation: slideIn 0.3s ease-out;
	}

	.session-warning-modal.urgency-critical {
		border-top: 4px solid #dc2626;
		animation: slideIn 0.3s ease-out, pulse 2s infinite;
	}

	.session-warning-modal.urgency-high {
		border-top: 4px solid #f59e0b;
	}

	.session-warning-modal.urgency-medium {
		border-top: 4px solid #3b82f6;
	}

	.warning-header {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
		padding: 1.5rem 1.5rem 1rem;
		background: #f8fafc;
		border-bottom: 1px solid #e2e8f0;
	}

	.warning-icon {
		font-size: 2rem;
		line-height: 1;
		flex-shrink: 0;
		margin-top: 0.25rem;
	}

	.warning-title-section {
		flex: 1;
		min-width: 0;
	}

	.warning-title {
		margin: 0 0 0.25rem 0;
		font-size: 1.25rem;
		font-weight: 700;
		color: #1f2937;
		line-height: 1.3;
	}

	.warning-subtitle {
		margin: 0;
		font-size: 0.875rem;
		color: #6b7280;
		line-height: 1.4;
	}

	.warning-content {
		padding: 1.5rem;
	}

	.countdown-display {
		text-align: center;
		margin-bottom: 1.5rem;
	}

	.countdown-timer {
		font-size: 2.5rem;
		font-weight: 800;
		font-family: 'Courier New', monospace;
		line-height: 1;
		margin-bottom: 0.5rem;
		border-radius: 0.5rem;
		padding: 0.75rem 1rem;
		background: #f3f4f6;
		display: inline-block;
	}

	.countdown-timer.urgency-critical {
		color: #dc2626;
		background: #fef2f2;
		border: 2px solid #fecaca;
		animation: pulse 1s infinite;
	}

	.countdown-timer.urgency-high {
		color: #f59e0b;
		background: #fffbeb;
		border: 2px solid #fed7aa;
	}

	.countdown-timer.urgency-medium {
		color: #3b82f6;
		background: #eff6ff;
		border: 2px solid #bfdbfe;
	}

	.countdown-label {
		font-size: 0.875rem;
		color: #6b7280;
		font-weight: 500;
	}

	.expiry-info {
		text-align: center;
		margin-bottom: 1.5rem;
		color: #6b7280;
		font-size: 1rem;
	}

	.warning-details {
		background: #f8fafc;
		border: 1px solid #e2e8f0;
		border-radius: 0.5rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.warning-details ul {
		margin: 0;
		padding-left: 1.25rem;
		color: #6b7280;
	}

	.warning-details li {
		margin-bottom: 0.5rem;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.auto-extend-notice {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		padding: 0.75rem;
		background: #f0f9ff;
		border: 1px solid #bae6fd;
		border-radius: 0.375rem;
		margin-top: 1rem;
	}

	.notice-icon {
		font-size: 1rem;
		flex-shrink: 0;
		margin-top: 0.125rem;
	}

	.notice-text {
		font-size: 0.8125rem;
		color: #0369a1;
		line-height: 1.4;
	}

	.warning-actions {
		background: #f8fafc;
		border-top: 1px solid #e2e8f0;
		padding: 1rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.primary-actions {
		display: flex;
		justify-content: center;
	}

	.secondary-actions {
		display: flex;
		justify-content: center;
		gap: 0.5rem;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideIn {
		from {
			opacity: 0;
			transform: translateY(-1rem) scale(0.95);
		}
		to {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes pulse {
		0%, 100% {
			box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
		}
		50% {
			box-shadow: 0 0 0 8px rgba(220, 38, 38, 0);
		}
	}

	/* Mobile responsive */
	@media (max-width: 640px) {
		.session-warning-modal {
			margin: 0.5rem;
			max-width: none;
		}

		.warning-header {
			padding: 1rem;
			gap: 0.75rem;
		}

		.warning-icon {
			font-size: 1.5rem;
		}

		.warning-title {
			font-size: 1.125rem;
		}

		.warning-content {
			padding: 1rem;
		}

		.countdown-timer {
			font-size: 2rem;
			padding: 0.5rem 0.75rem;
		}

		.warning-actions {
			padding: 1rem;
		}

		.secondary-actions {
			flex-direction: column;
		}
	}
</style>