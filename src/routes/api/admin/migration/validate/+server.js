/**
 * Validate TERMINAL_KEY for migration
 */

import { json } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ request }) {
	try {
		const { terminalKey } = await request.json();

		if (!terminalKey) {
			return json({ success: false, error: 'TERMINAL_KEY is required' }, { status: 400 });
		}

		// Validate against current TERMINAL_KEY
		const currentKey = process.env.TERMINAL_KEY;
		if (!currentKey || currentKey === 'change-me') {
			return json(
				{ success: false, error: 'No TERMINAL_KEY configured on server' },
				{ status: 400 }
			);
		}

		if (terminalKey !== currentKey) {
			return json({ success: false, error: 'Invalid TERMINAL_KEY' }, { status: 401 });
		}

		// TERMINAL_KEY is valid, prepare migration data
		return json({
			success: true,
			message: 'TERMINAL_KEY validated successfully',
			adminEmail: 'admin@dispatch.local', // Default admin email
			adminDisplayName: 'Administrator'
		});
	} catch (error) {
		console.error('Error validating TERMINAL_KEY:', error);
		return json(
			{
				success: false,
				error: 'Failed to validate TERMINAL_KEY'
			},
			{ status: 500 }
		);
	}
}
