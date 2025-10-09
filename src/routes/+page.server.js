import { redirect } from '@sveltejs/kit';

/**
 * Root page load function
 * Handles authentication redirect before page loads
 *
 * This fixes the issue where users with valid session cookies
 * get stuck on the login page waiting for client-side redirect
 */
export async function load({ locals }) {
	// If already authenticated via session cookie, redirect to workspace
	// This happens server-side BEFORE the page loads, avoiding the delay
	if (locals.auth?.authenticated) {
		throw redirect(303, '/workspace');
	}

	// Not authenticated - show login page
	return {};
}
