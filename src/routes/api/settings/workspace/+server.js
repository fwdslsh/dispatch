/**
 * API endpoint for workspace environment variables management
 */

export async function GET({ locals }) {
	try {
		const workspaceSettings = await locals.services.database.getSettingsByCategory('workspace');

		return new Response(
			JSON.stringify({
				envVariables: workspaceSettings?.envVariables || {}
			}),
			{
				headers: { 'content-type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('[API] Failed to get workspace environment variables:', error);
		return new Response(JSON.stringify({ error: 'Failed to retrieve environment variables' }), {
			status: 500
		});
	}
}

export async function POST({ request, locals }) {
	try {
		const { envVariables } = await request.json();

		// Validate the input
		if (!envVariables || typeof envVariables !== 'object') {
			return new Response(JSON.stringify({ error: 'Invalid environment variables format' }), {
				status: 400
			});
		}

		// Validate environment variable names
		for (const [key, value] of Object.entries(envVariables)) {
			if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
				return new Response(
					JSON.stringify({ error: `Invalid environment variable name: ${key}` }),
					{ status: 400 }
				);
			}
			if (typeof value !== 'string') {
				return new Response(
					JSON.stringify({ error: `Environment variable values must be strings: ${key}` }),
					{ status: 400 }
				);
			}
		}

		// Get current workspace settings
		const currentSettings = await locals.services.database.getSettingsByCategory('workspace');

		// Update environment variables
		const updatedSettings = {
			...currentSettings,
			envVariables
		};

		// Save to database
		await locals.services.database.setSettingsForCategory(
			'workspace',
			updatedSettings,
			'Workspace-level environment variables for all sessions'
		);

		return new Response(
			JSON.stringify({
				success: true,
				envVariables
			}),
			{
				headers: { 'content-type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('[API] Failed to save workspace environment variables:', error);
		return new Response(JSON.stringify({ error: 'Failed to save environment variables' }), {
			status: 500
		});
	}
}

export async function DELETE({ locals }) {
	try {
		// Get current workspace settings
		const currentSettings = await locals.services.database.getSettingsByCategory('workspace');

		// Clear environment variables
		const updatedSettings = {
			...currentSettings,
			envVariables: {}
		};

		// Save to database
		await locals.services.database.setSettingsForCategory(
			'workspace',
			updatedSettings,
			'Workspace-level environment variables for all sessions'
		);

		return new Response(
			JSON.stringify({
				success: true,
				envVariables: {}
			}),
			{
				headers: { 'content-type': 'application/json' }
			}
		);
	} catch (error) {
		console.error('[API] Failed to clear workspace environment variables:', error);
		return new Response(JSON.stringify({ error: 'Failed to clear environment variables' }), {
			status: 500
		});
	}
}
