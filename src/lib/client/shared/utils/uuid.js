/**
 * UUID generation utilities with browser compatibility
 */

/**
 * Generate a UUID v4 with fallback for older browsers
 * @returns {string} A valid UUID v4 string
 */
export function generateUUID() {
	// Use crypto.randomUUID() if available (modern browsers)
	if (typeof crypto !== 'undefined' && crypto.randomUUID) {
		return crypto.randomUUID();
	}
	
	// Fallback UUID v4 generation for older browsers
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		const r = Math.random() * 16 | 0;
		const v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}

/**
 * Get or create a client ID from localStorage
 * @returns {string} A stable client ID
 */
export function getClientId() {
	let id = localStorage.getItem('clientId');
	if (!id) {
		id = generateUUID();
		localStorage.setItem('clientId', id);
	}
	return id;
}