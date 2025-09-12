import { env } from '$env/dynamic/private';
import { validateKey } from '$lib/server/auth.js';
import { redirect } from '@sveltejs/kit';

export async function load({ url }) {
	// Check if TERMINAL_KEY is set and not empty
	const hasTerminalKey = !!(env.TERMINAL_KEY && env.TERMINAL_KEY.trim() !== '');
	
	// Get key from URL params (for authentication)
	const key = url.searchParams.get('key');
	
	// If no key provided or invalid key, redirect to auth
	if (!key || !validateKey(key)) {
		// If we're not already on the auth page, redirect to root for authentication
		if (!url.pathname.includes('auth')) {
			throw redirect(302, '/');
		}
	}
	
	return {
		hasTerminalKey,
		terminalKey: hasTerminalKey ? env.TERMINAL_KEY : '',
		isAuthenticated: key && validateKey(key)
	};
}

export const ssr = false;
export const prerender = false;