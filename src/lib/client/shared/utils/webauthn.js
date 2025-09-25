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
	const isSecure =
		window.location.protocol === 'https:' ||
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
			message:
				'HTTPS required for WebAuthn (except localhost). Enable HTTPS or use localhost for development.',
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
	return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
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
		excludeCredentials:
			serverOptions.excludeCredentials?.map((cred) => ({
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
		allowCredentials:
			serverOptions.allowCredentials?.map((cred) => ({
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
		return 'Operation cancelled by user or not allowed. Please try again and follow the browser prompts.';
	} else if (error.name === 'InvalidStateError') {
		return 'Authenticator is in an invalid state. This may happen if a passkey is already registered. Try again or use a different authentication method.';
	} else if (error.name === 'NotSupportedError') {
		return 'WebAuthn not supported on this device. Please try using a different browser or device.';
	} else if (error.name === 'SecurityError') {
		return 'Security error. Ensure you are on a secure connection (HTTPS) and the website is trusted.';
	} else if (error.name === 'AbortError') {
		return 'Operation aborted or timed out. Please try again.';
	} else if (error.name === 'ConstraintError') {
		return 'The authenticator cannot fulfill this request. Try using a different authenticator or contact support.';
	} else if (error.name === 'UnknownError') {
		return 'An unexpected error occurred. Please try again or contact support if the problem persists.';
	} else if (error.name === 'NetworkError') {
		return 'Network error occurred. Please check your connection and try again.';
	} else if (error.name === 'TimeoutError') {
		return 'The operation timed out. Please try again.';
	}

	// Handle common error messages
	const message = error.message || '';
	if (message.includes('timeout')) {
		return 'The operation timed out. Please try again.';
	} else if (message.includes('user cancelled') || message.includes('user canceled')) {
		return 'Authentication was cancelled. Please try again and complete the prompts.';
	} else if (message.includes('no credentials')) {
		return 'No registered passkeys found for this account. Please register a passkey first.';
	}

	return error.message || 'WebAuthn operation failed. Please try again.';
}

/**
 * Check if the current environment supports WebAuthn conditional UI
 */
export async function supportsConditionalUI() {
	try {
		if (!isWebAuthnSupported()) return false;

		if (window.PublicKeyCredential?.isConditionalMediationAvailable) {
			return await window.PublicKeyCredential.isConditionalMediationAvailable();
		}

		return false;
	} catch (error) {
		console.warn('Failed to check conditional UI support:', error);
		return false;
	}
}

/**
 * Get browser-specific WebAuthn capabilities
 */
export function getBrowserCapabilities() {
	const userAgent = navigator.userAgent;
	const capabilities = {
		browser: 'unknown',
		version: 'unknown',
		supportsResidentKeys: false,
		supportsUserVerification: false,
		supportedTransports: [],
		recommendations: []
	};

	// Detect browser
	if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
		capabilities.browser = 'Chrome';
		const match = userAgent.match(/Chrome\/(\d+)/);
		capabilities.version = match ? parseInt(match[1]) : 0;

		if (capabilities.version >= 85) {
			capabilities.supportsResidentKeys = true;
			capabilities.supportsUserVerification = true;
			capabilities.supportedTransports = ['internal', 'usb', 'nfc', 'ble'];
		}

		if (capabilities.version < 85) {
			capabilities.recommendations.push('Update Chrome to version 85+ for full WebAuthn support');
		}
	} else if (userAgent.includes('Firefox')) {
		capabilities.browser = 'Firefox';
		const match = userAgent.match(/Firefox\/(\d+)/);
		capabilities.version = match ? parseInt(match[1]) : 0;

		if (capabilities.version >= 90) {
			capabilities.supportsResidentKeys = true;
			capabilities.supportsUserVerification = true;
			capabilities.supportedTransports = ['internal', 'usb', 'nfc'];
		}

		if (capabilities.version < 90) {
			capabilities.recommendations.push('Update Firefox to version 90+ for full WebAuthn support');
		}
	} else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
		capabilities.browser = 'Safari';
		const match = userAgent.match(/Version\/(\d+)/);
		capabilities.version = match ? parseInt(match[1]) : 0;

		if (capabilities.version >= 14) {
			capabilities.supportsResidentKeys = true;
			capabilities.supportsUserVerification = true;
			capabilities.supportedTransports = ['internal'];
		}

		if (capabilities.version < 14) {
			capabilities.recommendations.push('Update Safari to version 14+ for WebAuthn support');
		}
	} else if (userAgent.includes('Edg')) {
		capabilities.browser = 'Edge';
		const match = userAgent.match(/Edg\/(\d+)/);
		capabilities.version = match ? parseInt(match[1]) : 0;

		if (capabilities.version >= 85) {
			capabilities.supportsResidentKeys = true;
			capabilities.supportsUserVerification = true;
			capabilities.supportedTransports = ['internal', 'usb', 'nfc', 'ble'];
		}
	}

	return capabilities;
}

/**
 * Validate WebAuthn environment and provide detailed feedback
 */
export async function validateWebAuthnEnvironment() {
	const validation = {
		isValid: false,
		issues: [],
		warnings: [],
		recommendations: []
	};

	// Check basic support
	if (!isWebAuthnSupported()) {
		validation.issues.push({
			type: 'browser_support',
			message: 'WebAuthn API is not supported in this browser',
			severity: 'critical'
		});
		return validation;
	}

	// Check HTTPS
	const isSecure =
		window.location.protocol === 'https:' ||
		window.location.hostname === 'localhost' ||
		window.location.hostname === '127.0.0.1';

	if (!isSecure) {
		validation.issues.push({
			type: 'security',
			message: 'WebAuthn requires a secure context (HTTPS)',
			severity: 'critical'
		});
	}

	// Check platform authenticator
	try {
		const platformAvailable = await isPlatformAuthenticatorAvailable();
		if (!platformAvailable) {
			validation.warnings.push({
				type: 'platform_authenticator',
				message: 'Platform authenticator not detected. External security keys will still work.',
				severity: 'low'
			});
		}
	} catch (error) {
		validation.warnings.push({
			type: 'platform_check',
			message: 'Could not verify platform authenticator availability',
			severity: 'low'
		});
	}

	// Browser-specific checks
	const capabilities = getBrowserCapabilities();
	if (capabilities.recommendations.length > 0) {
		validation.recommendations.push(
			...capabilities.recommendations.map((rec) => ({
				type: 'browser_update',
				message: rec,
				severity: 'medium'
			}))
		);
	}

	// Check for common issues
	if (
		window.location.hostname.includes('localtunnel.me') ||
		window.location.hostname.includes('ngrok.io')
	) {
		validation.warnings.push({
			type: 'tunnel_url',
			message: 'Tunnel URLs may cause issues with WebAuthn. Consider using a stable domain.',
			severity: 'medium'
		});
	}

	validation.isValid = validation.issues.length === 0;
	return validation;
}
