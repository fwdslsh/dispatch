/**
 * API test helper - wraps handlers to convert SvelteKit errors to testable responses
 * When handlers throw SvelteKit errors, we catch them and convert to Response objects
 * that tests can call .json() on
 */

/**
 * Wrap an API handler to convert SvelteKit errors to Response objects
 * @param {Function} handler - The route handler (GET, POST, etc.)
 * @returns {Function} Wrapped handler that catches and converts errors
 */
export function wrapHandler(handler) {
	return async (event) => {
		try {
			const response = await handler(event);
			// If successful, response is already a Response object from json()
			return response;
		} catch (err) {
			// Convert SvelteKit error to Response
			// SvelteKit errors have status and body properties
			if (err?.status !== undefined && err?.body !== undefined) {
				// Map 'message' to 'error' for test compatibility
				const body = err.body;
				const mappedBody = {
					...body,
					error: body.error || body.message
				};
				return new Response(JSON.stringify(mappedBody), {
					status: err.status,
					headers: { 'content-type': 'application/json' }
				});
			}
			// If not a SvelteKit error, convert to Response
			return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
				status: 500,
				headers: { 'content-type': 'application/json' }
			});
		}
	};
}

/**
 * Create a mock Response with status and json() method
 * Used when handlers return responses directly
 */
export function createMockResponse(data, status = 200) {
	return {
		status,
		json: async () => data
	};
}
