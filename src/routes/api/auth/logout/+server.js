import { json } from '@sveltejs/kit';

export async function POST({ cookies, locals }) {
	const authManager = locals.services?.authManager;

	try {
		// Clear the httpOnly cookie
		cookies.delete('dispatch-auth-token', { path: '/' });

		// If authManager is available, we could invalidate the session in the database
		// But for now, just rely on JWT expiration

		return json({ success: true, message: 'Logged out successfully' });
	} catch (error) {
		console.error('Logout error:', error);
		return json({ success: false, error: 'Logout failed' }, { status: 500 });
	}
}