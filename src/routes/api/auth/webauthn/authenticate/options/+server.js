import { json } from '@sveltejs/kit';

/**
 * Generate WebAuthn authentication options
 */
export async function POST({ request, locals }) {
	try {
		const { userHandle } = await request.json();

		const options = await locals.services.authManager.webauthn.generateAuthenticationOptions(
			userHandle
		);

		return json(options);
	} catch (error) {
		console.error('WebAuthn authentication options error:', error);
		return json({ error: 'Failed to generate authentication options' }, { status: 500 });
	}
}