import { redirect } from '@sveltejs/kit';

export async function load({ locals, cookies }) {
	const authManager = locals.services?.authManager;

	if (!authManager) {
		throw redirect(302, '/setup');
	}

	try {
		// Check if user is authenticated via cookie
		const authCookie = cookies.get('dispatch-auth-token');

		if (!authCookie) {
			// No authentication cookie, redirect to login
			throw redirect(302, '/');
		}

		// Verify the JWT token from cookie
		const decoded = authManager.verifyJWT(authCookie);
		const user = await authManager.getUserById(decoded.userId);

		if (!user || !user.is_admin) {
			// User not found or not admin, redirect to login
			throw redirect(302, '/');
		}

		// User is authenticated and is admin
		return {
			user: {
				...user,
				isAdmin: !!user.is_admin
			}
		};
	} catch (error) {
		// Invalid token or other auth error, redirect to login
		throw redirect(302, '/');
	}
}
