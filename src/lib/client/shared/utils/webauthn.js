/**
 * WebAuthn utility functions for client-side availability detection
 * and browser compatibility checks
 */

/**
 * Check if WebAuthn is supported in the current browser
 */
export function isWebAuthnSupported() {
	return (
		typeof window !== 'undefined' &&
		'PublicKeyCredential' in window &&
		typeof window.PublicKeyCredential === 'function'
	);
}

/**
 * Check if platform authenticator (like Touch ID, Face ID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable() {
	if (!isWebAuthnSupported()) {
		return false;
	}

	try {
		return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
	} catch (error) {
		console.warn('Failed to check platform authenticator availability:', error);
		return false;
	}
}

/**
 * Check if conditional UI (autofill) is supported
 */
export async function isConditionalUISupported() {
	if (!isWebAuthnSupported()) {
		return false;
	}

	try {
		// Check if the browser supports conditional UI
		const result = await window.PublicKeyCredential.isConditionalMediationAvailable?.();
		return result === true;
	} catch (error) {
		console.warn('Failed to check conditional UI support:', error);
		return false;
	}
}

/**
 * Get WebAuthn configuration from the server
 */
export async function getWebAuthnConfig() {
	try {
		const response = await fetch('/api/webauthn/config');
		const data = await response.json();

		if (!data.success) {
			throw new Error(data.details || 'Failed to get WebAuthn config');
		}

		return data;
	} catch (error) {
		console.error('Failed to get WebAuthn config:', error);
		return {
			success: false,
			config: { isAvailable: false },
			error: error.message
		};
	}
}

/**
 * Check comprehensive WebAuthn availability
 */
export async function checkWebAuthnAvailability() {
	const browserSupported = isWebAuthnSupported();
	const platformAvailable = await isPlatformAuthenticatorAvailable();
	const conditionalUI = await isConditionalUISupported();
	const serverConfig = await getWebAuthnConfig();

	// Check HTTPS requirement
	const isSecure = window.location.protocol === 'https:' ||
		window.location.hostname === 'localhost' ||
		window.location.hostname === '127.0.0.1';

	return {
		browserSupported,
		platformAvailable,
		conditionalUI,
		serverAvailable: serverConfig.config?.isAvailable || false,
		isSecure,
		overall: browserSupported && isSecure && serverConfig.config?.isAvailable,
		config: serverConfig.config,
		warnings: getAvailabilityWarnings(browserSupported, isSecure, serverConfig.config)
	};
}

/**
 * Get warnings about WebAuthn availability issues
 */
function getAvailabilityWarnings(browserSupported, isSecure, config) {
	const warnings = [];

	if (!browserSupported) {
		warnings.push({
			type: 'browser',
			message: 'WebAuthn not supported in this browser. Consider updating to a modern browser.',
			severity: 'error'
		});
	}

	if (!isSecure) {
		warnings.push({
			type: 'security',
			message: 'HTTPS required for WebAuthn (except localhost). Enable HTTPS or use localhost for development.',
			severity: 'error'
		});
	}

	if (config && !config.isAvailable) {
		warnings.push({
			type: 'server',
			message: config.error || 'WebAuthn not available on server',
			severity: 'error'
		});
	}

	// Check hostname stability warning
	const hostname = window.location.hostname;
	if (hostname.includes('.localtunnel.me') || hostname.includes('.ngrok.io')) {
		warnings.push({
			type: 'hostname',
			message: 'Tunnel URLs may change. WebAuthn credentials are tied to specific hostnames.',
			severity: 'warning'
		});
	}

	return warnings;
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function bufferToBase64(buffer) {
	return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

/**
 * Convert base64 string to ArrayBuffer
 */
export function base64ToBuffer(base64) {
	return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

/**
 * Format WebAuthn credential for transmission
 */
export function formatCredentialForTransmission(credential) {
	return {
		id: credential.id,
		rawId: bufferToBase64(credential.rawId),
		type: credential.type,
		response: formatResponseForTransmission(credential.response)
	};
}

/**
 * Format credential response based on type
 */
function formatResponseForTransmission(response) {
	const formatted = {
		clientDataJSON: bufferToBase64(response.clientDataJSON)
	};

	// Registration response
	if (response.attestationObject) {
		formatted.attestationObject = bufferToBase64(response.attestationObject);
	}

	// Authentication response
	if (response.authenticatorData) {
		formatted.authenticatorData = bufferToBase64(response.authenticatorData);
		formatted.signature = bufferToBase64(response.signature);
		if (response.userHandle) {
			formatted.userHandle = bufferToBase64(response.userHandle);
		}
	}

	return formatted;
}

/**
 * Prepare public key credential creation options for browser API
 */
export function prepareCreationOptions(serverOptions) {
	return {
		...serverOptions,
		challenge: base64ToBuffer(serverOptions.challenge),
		user: {
			...serverOptions.user,
			id: base64ToBuffer(serverOptions.user.id)
		},
		excludeCredentials: serverOptions.excludeCredentials?.map(cred => ({
			...cred,
			id: base64ToBuffer(cred.id)
		})) || []
	};
}

/**
 * Prepare public key credential request options for browser API
 */
export function prepareRequestOptions(serverOptions) {
	return {
		...serverOptions,
		challenge: base64ToBuffer(serverOptions.challenge),
		allowCredentials: serverOptions.allowCredentials?.map(cred => ({
			...cred,
			id: typeof cred.id === 'string' ? base64ToBuffer(cred.id) : new Uint8Array(cred.id)
		})) || []
	};
}

/**
 * Get user-friendly error message for WebAuthn errors
 */
export function getWebAuthnErrorMessage(error) {
	if (error.name === 'NotAllowedError') {
		return 'Operation cancelled by user or not allowed';
	} else if (error.name === 'InvalidStateError') {
		return 'Authenticator is in an invalid state. Try again.';
	} else if (error.name === 'NotSupportedError') {
		return 'WebAuthn not supported on this device';
	} else if (error.name === 'SecurityError') {
		return 'Security error. Ensure you are on a secure connection (HTTPS)';
	} else if (error.name === 'AbortError') {
		return 'Operation aborted. Please try again.';
	} else if (error.name === 'ConstraintError') {
		return 'Constraint error. The authenticator cannot fulfill the request.';
	} else if (error.name === 'UnknownError') {
		return 'Unknown error occurred. Please try again.';
	}

	return error.message || 'WebAuthn operation failed';
}