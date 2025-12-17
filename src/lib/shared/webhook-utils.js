/**
 * Webhook utilities - Shared between client and server
 */

/**
 * HTTP method display colors/classes
 */
export const HTTP_METHOD_STYLES = {
	GET: { color: '#61affe', bg: 'rgba(97, 175, 254, 0.1)', label: 'GET' },
	POST: { color: '#49cc90', bg: 'rgba(73, 204, 144, 0.1)', label: 'POST' },
	PUT: { color: '#fca130', bg: 'rgba(252, 161, 48, 0.1)', label: 'PUT' },
	DELETE: { color: '#f93e3e', bg: 'rgba(249, 62, 62, 0.1)', label: 'DELETE' },
	PATCH: { color: '#50e3c2', bg: 'rgba(80, 227, 194, 0.1)', label: 'PATCH' }
};

/**
 * Valid HTTP methods for webhooks
 */
export const VALID_HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Validate URI path format
 * @param {string} path - URI path to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateUriPath(path) {
	if (!path) {
		return { valid: false, error: 'URI path is required' };
	}

	if (!path.startsWith('/hooks/')) {
		return { valid: false, error: 'URI path must start with /hooks/' };
	}

	if (!/^\/hooks\/[a-zA-Z0-9\-_/]+$/.test(path)) {
		return {
			valid: false,
			error:
				'URI path contains invalid characters. Use only letters, numbers, hyphens, underscores, and forward slashes.'
		};
	}

	if (path.length < 8) {
		return { valid: false, error: 'URI path is too short. Must be at least /hooks/x' };
	}

	// Check for double slashes
	if (path.includes('//')) {
		return { valid: false, error: 'URI path cannot contain double slashes' };
	}

	// Check that it doesn't end with a slash
	if (path.endsWith('/')) {
		return { valid: false, error: 'URI path should not end with a slash' };
	}

	return { valid: true };
}

/**
 * Validate HTTP method
 * @param {string} method - HTTP method to validate
 * @returns {{ valid: boolean, method?: string, error?: string }}
 */
export function validateHttpMethod(method) {
	if (!method) {
		return { valid: false, error: 'HTTP method is required' };
	}

	const upperMethod = method.toUpperCase();
	if (!VALID_HTTP_METHODS.includes(upperMethod)) {
		return {
			valid: false,
			error: `Invalid HTTP method. Must be one of: ${VALID_HTTP_METHODS.join(', ')}`
		};
	}

	return { valid: true, method: upperMethod };
}

/**
 * Get the full webhook URL
 * @param {string} baseUrl - Base URL of the server
 * @param {string} uriPath - URI path of the webhook
 * @returns {string}
 */
export function getWebhookUrl(baseUrl, uriPath) {
	// Remove trailing slash from base URL
	const base = baseUrl.replace(/\/$/, '');
	return `${base}${uriPath}`;
}

/**
 * Format duration in milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string}
 */
export function formatDuration(ms) {
	if (ms === null || ms === undefined) return '-';
	if (ms < 1000) return `${ms}ms`;
	if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
	const minutes = Math.floor(ms / 60000);
	const seconds = ((ms % 60000) / 1000).toFixed(1);
	return `${minutes}m ${seconds}s`;
}

/**
 * Format timestamp to relative time string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string}
 */
export function formatRelativeTime(timestamp) {
	if (!timestamp) return 'Never';

	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 0) {
		// Future time
		const absDiff = Math.abs(diff);
		if (absDiff < 60000) return 'in less than a minute';
		if (absDiff < 3600000) return `in ${Math.floor(absDiff / 60000)} minutes`;
		if (absDiff < 86400000) return `in ${Math.floor(absDiff / 3600000)} hours`;
		return `in ${Math.floor(absDiff / 86400000)} days`;
	}

	if (diff < 60000) return 'just now';
	if (diff < 3600000) {
		const mins = Math.floor(diff / 60000);
		return `${mins} minute${mins === 1 ? '' : 's'} ago`;
	}
	if (diff < 86400000) {
		const hours = Math.floor(diff / 3600000);
		return `${hours} hour${hours === 1 ? '' : 's'} ago`;
	}
	const days = Math.floor(diff / 86400000);
	return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * Format timestamp to ISO date string
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string}
 */
export function formatDateTime(timestamp) {
	if (!timestamp) return '-';
	return new Date(timestamp).toLocaleString();
}

/**
 * Generate example curl command for webhook
 * @param {string} url - Full webhook URL
 * @param {string} method - HTTP method
 * @param {string} apiKey - API key for authentication
 * @returns {string}
 */
export function generateCurlExample(url, method, apiKey = 'YOUR_API_KEY') {
	const methodFlag = method === 'GET' ? '' : `-X ${method} `;
	const dataFlag = ['POST', 'PUT', 'PATCH'].includes(method)
		? `-d '{"key": "value"}' -H "Content-Type: application/json" `
		: '';

	return `curl ${methodFlag}${dataFlag}-H "Authorization: Bearer ${apiKey}" "${url}"`;
}

/**
 * Status badge styles
 */
export const STATUS_STYLES = {
	active: { color: 'var(--color-success)', bg: 'var(--color-success-light)', label: 'Active' },
	disabled: { color: 'var(--color-info)', bg: 'var(--color-info-light)', label: 'Disabled' },
	success: { color: 'var(--color-success)', bg: 'var(--color-success-light)', label: 'Success' },
	failed: { color: 'var(--color-error)', bg: 'var(--color-error-light)', label: 'Failed' },
	running: { color: 'var(--color-warning)', bg: 'var(--color-warning-light)', label: 'Running' }
};
