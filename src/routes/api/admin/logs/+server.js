import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { validateKey } from '$lib/server/auth.js';

export async function GET({ url }) {
	// Get the terminal key from query parameters
	const key = url.searchParams.get('key');

	// Validate the key
	if (!validateKey(key)) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	// For now, return an empty logs array since we don't have a logging system yet
	// In a production environment, this would read from actual log files or a logging service
	return json({
		logs: [
			// Example log entries for demonstration
			{
				timestamp: Date.now() - 3600000,
				level: 'info',
				message: 'Server started successfully'
			},
			{
				timestamp: Date.now() - 1800000,
				level: 'info',
				message: 'Socket connection established'
			},
			{
				timestamp: Date.now() - 600000,
				level: 'warn',
				message: 'High memory usage detected'
			},
			{
				timestamp: Date.now() - 300000,
				level: 'info',
				message: 'Admin console accessed'
			}
		]
	});
}
