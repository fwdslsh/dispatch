/**
 * API Helper Functions
 *
 * Centralized utilities for making authenticated API requests.
 * Automatically adds Authorization headers from localStorage.
 */

import { STORAGE_CONFIG } from './constants.js';

/**
 * Get authentication headers for API requests
 * @param {Object} additionalHeaders - Optional additional headers to merge
 * @returns {Object} Headers object with Authorization token
 */
export function getAuthHeaders(additionalHeaders = {}) {
	const headers = {
		'Content-Type': 'application/json',
		...additionalHeaders
	};

	// Add Authorization header if token exists in localStorage
	if (typeof localStorage !== 'undefined') {
		const token = localStorage.getItem(STORAGE_CONFIG.AUTH_TOKEN_KEY);
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}
	}

	return headers;
}

/**
 * Make an authenticated GET request
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options (will merge with auth headers)
 * @returns {Promise<Response>} Fetch response
 */
export async function authenticatedFetch(url, options = {}) {
	const { headers = {}, ...restOptions } = options;

	return fetch(url, {
		...restOptions,
		headers: getAuthHeaders(headers)
	});
}

/**
 * Make an authenticated GET request and return JSON
 * @param {string} url - API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If request fails or returns non-OK status
 */
export async function authenticatedGet(url, options = {}) {
	const response = await authenticatedFetch(url, options);

	if (!response.ok) {
		const errorText = await response.text();
		let errorMessage;
		try {
			const errorData = JSON.parse(errorText);
			errorMessage = errorData.error || errorData.message || response.statusText;
		} catch {
			errorMessage = errorText || response.statusText;
		}
		throw new Error(errorMessage);
	}

	return response.json();
}

/**
 * Make an authenticated POST request
 * @param {string} url - API endpoint URL
 * @param {Object} body - Request body (will be JSON.stringify'd)
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If request fails or returns non-OK status
 */
export async function authenticatedPost(url, body = {}, options = {}) {
	const response = await authenticatedFetch(url, {
		method: 'POST',
		body: JSON.stringify(body),
		...options
	});

	if (!response.ok) {
		const errorText = await response.text();
		let errorMessage;
		try {
			const errorData = JSON.parse(errorText);
			errorMessage = errorData.error || errorData.message || response.statusText;
		} catch {
			errorMessage = errorText || response.statusText;
		}
		throw new Error(errorMessage);
	}

	return response.json();
}

/**
 * Make an authenticated PUT request
 * @param {string} url - API endpoint URL
 * @param {Object} body - Request body (will be JSON.stringify'd)
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If request fails or returns non-OK status
 */
export async function authenticatedPut(url, body = {}, options = {}) {
	const response = await authenticatedFetch(url, {
		method: 'PUT',
		body: JSON.stringify(body),
		...options
	});

	if (!response.ok) {
		const errorText = await response.text();
		let errorMessage;
		try {
			const errorData = JSON.parse(errorText);
			errorMessage = errorData.error || errorData.message || response.statusText;
		} catch {
			errorMessage = errorText || response.statusText;
		}
		throw new Error(errorMessage);
	}

	return response.json();
}

/**
 * Make an authenticated DELETE request
 * @param {string} url - API endpoint URL
 * @param {Object} options - Additional fetch options
 * @returns {Promise<any>} Parsed JSON response
 * @throws {Error} If request fails or returns non-OK status
 */
export async function authenticatedDelete(url, options = {}) {
	const response = await authenticatedFetch(url, {
		method: 'DELETE',
		...options
	});

	if (!response.ok) {
		const errorText = await response.text();
		let errorMessage;
		try {
			const errorData = JSON.parse(errorText);
			errorMessage = errorData.error || errorData.message || response.statusText;
		} catch {
			errorMessage = errorText || response.statusText;
		}
		throw new Error(errorMessage);
	}

	return response.json();
}

/**
 * Check if user is authenticated (has valid token in localStorage)
 * @returns {boolean} True if auth token exists
 */
export function isAuthenticated() {
	if (typeof localStorage === 'undefined') return false;
	const token = localStorage.getItem(STORAGE_CONFIG.AUTH_TOKEN_KEY);
	return !!token;
}

/**
 * Get the current auth token from localStorage
 * @returns {string|null} Auth token or null if not found
 */
export function getAuthToken() {
	if (typeof localStorage === 'undefined') return null;
	return localStorage.getItem(STORAGE_CONFIG.AUTH_TOKEN_KEY);
}