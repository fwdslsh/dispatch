<script>
	import { createEventDispatcher } from 'svelte';
	import Button from './Button.svelte';
	import LoadingSpinner from './LoadingSpinner.svelte';

	export let mode = 'authenticate'; // 'authenticate' or 'register'
	export let username = '';
	export let userId = null;
	export let deviceName = '';
	export let disabled = false;
	export let variant = 'primary';

	const dispatch = createEventDispatcher();

	let loading = false;
	let error = null;
	let webauthnSupported = false;

	// Check WebAuthn browser support
	$: webauthnSupported = typeof window !== 'undefined' &&
		window.PublicKeyCredential &&
		typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';

	async function handleWebAuthn() {
		if (!webauthnSupported) {
			error = 'WebAuthn not supported in this browser';
			return;
		}

		loading = true;
		error = null;

		try {
			if (mode === 'register') {
				await handleRegistration();
			} else {
				await handleAuthentication();
			}
		} catch (err) {
			console.error('WebAuthn error:', err);
			error = err.message || 'WebAuthn operation failed';
			dispatch('error', { error });
		} finally {
			loading = false;
		}
	}

	async function handleRegistration() {
		if (!userId) {
			throw new Error('User ID required for registration');
		}

		// Begin registration
		const beginResponse = await fetch('/api/webauthn/register/begin', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				userId,
				deviceName: deviceName || 'WebAuthn Device'
			})
		});

		const beginData = await beginResponse.json();
		if (!beginData.success) {
			throw new Error(beginData.details || beginData.error);
		}

		// Create credential
		const publicKeyCredentialCreationOptions = {
			...beginData.challenge,
			challenge: Uint8Array.from(atob(beginData.challenge.challenge), c => c.charCodeAt(0)),
			user: {
				...beginData.challenge.user,
				id: Uint8Array.from(atob(beginData.challenge.user.id), c => c.charCodeAt(0))
			},
			excludeCredentials: beginData.challenge.excludeCredentials?.map(cred => ({
				...cred,
				id: Uint8Array.from(atob(cred.id), c => c.charCodeAt(0))
			})) || []
		};

		const credential = await navigator.credentials.create({
			publicKey: publicKeyCredentialCreationOptions
		});

		if (!credential) {
			throw new Error('Failed to create credential');
		}

		// Convert credential for transmission
		const credentialData = {
			id: credential.id,
			rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
			type: credential.type,
			response: {
				clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
				attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject)))
			}
		};

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
			message: completeData.message,
			credentialId: completeData.credentialId
		});
	}

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

		// Get credential
		const publicKeyCredentialRequestOptions = {
			...beginData.challenge,
			challenge: Uint8Array.from(atob(beginData.challenge.challenge), c => c.charCodeAt(0)),
			allowCredentials: beginData.challenge.allowCredentials?.map(cred => ({
				...cred,
				id: typeof cred.id === 'string' ?
					Uint8Array.from(atob(cred.id), c => c.charCodeAt(0)) :
					new Uint8Array(cred.id)
			})) || []
		};

		const credential = await navigator.credentials.get({
			publicKey: publicKeyCredentialRequestOptions
		});

		if (!credential) {
			throw new Error('Failed to get credential');
		}

		// Convert credential for transmission
		const credentialData = {
			id: credential.id,
			rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
			type: credential.type,
			response: {
				clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
				authenticatorData: btoa(String.fromCharCode(...new Uint8Array(credential.response.authenticatorData))),
				signature: btoa(String.fromCharCode(...new Uint8Array(credential.response.signature))),
				userHandle: credential.response.userHandle ?
					btoa(String.fromCharCode(...new Uint8Array(credential.response.userHandle))) : null
			}
		};

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
</script>

<div class="webauthn-button">
	<Button
		{variant}
		disabled={disabled || loading || !webauthnSupported}
		on:click={handleWebAuthn}
	>
		{#if loading}
			<LoadingSpinner size="sm" />
		{:else}
			🔐
		{/if}

		{#if mode === 'register'}
			Register Passkey
		{:else}
			Sign in with Passkey
		{/if}
	</Button>

	{#if error}
		<div class="error">
			{error}
		</div>
	{/if}

	{#if !webauthnSupported}
		<div class="warning">
			WebAuthn not supported in this browser
		</div>
	{/if}
</div>

<style>
	.webauthn-button {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.error {
		color: var(--color-error);
		font-size: 0.875rem;
		padding: 0.5rem;
		background: var(--color-error-bg);
		border: 1px solid var(--color-error);
		border-radius: 4px;
	}

	.warning {
		color: var(--color-warning);
		font-size: 0.875rem;
		padding: 0.5rem;
		background: var(--color-warning-bg);
		border: 1px solid var(--color-warning);
		border-radius: 4px;
	}
</style>