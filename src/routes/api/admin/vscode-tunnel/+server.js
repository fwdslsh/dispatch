import { json } from '@sveltejs/kit';

/**
 * VS Code Remote Tunnel API
 * GET: Get tunnel status
 * POST: Start/stop tunnel
 */

export async function GET({ url, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const vscodeManager = locals.services?.vscodeManager;
		if (!vscodeManager) {
			return json({ error: 'VS Code tunnel manager not available' }, { status: 503 });
		}

		const status = vscodeManager.getStatus();
		return json(status);
	} catch (error) {
		console.error('Failed to get VS Code tunnel status:', error);
		return json({ error: 'Failed to get tunnel status' }, { status: 500 });
	}
}

export async function POST({ request, url, locals }) {
	// Auth already validated by hooks middleware
	if (!locals.auth?.authenticated) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();
		const { action, name, folder, extra } = body;

		const vscodeManager = locals.services?.vscodeManager;
		if (!vscodeManager) {
			return json({ error: 'VS Code tunnel manager not available' }, { status: 503 });
		}

		if (action === 'start') {
			try {
				const state = await vscodeManager.startTunnel({
					name,
					folder,
					extra
				});
				return json({ ok: true, state });
			} catch (error) {
				return json({ ok: false, error: error.message }, { status: 400 });
			}
		} else if (action === 'stop') {
			const success = await vscodeManager.stopTunnel();
			return json({ ok: success });
		} else {
			return json({ ok: false, error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		console.error('VS Code tunnel API error:', error);
		return json({ ok: false, error: 'Internal server error' }, { status: 500 });
	}
}
