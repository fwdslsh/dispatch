import { json } from '@sveltejs/kit';
import { ServiceUnavailableError, BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

/**
 * VS Code Remote Tunnel API
 * GET: Get tunnel status
 * POST: Start/stop tunnel
 */

export async function GET({ url: _url, locals }) {
	try {
		const vscodeManager = locals.services?.vscodeManager;
		if (!vscodeManager) {
			throw new ServiceUnavailableError('VS Code tunnel manager not available');
		}

		const status = vscodeManager.getStatus();
		return json(status);
	} catch (err) {
		handleApiError(err, 'GET /api/admin/vscode-tunnel');
	}
}

export async function POST({ request, url: _url, locals }) {
	try {
		const body = await request.json();
		const { action, name, folder, extra } = body;

		const vscodeManager = locals.services?.vscodeManager;
		if (!vscodeManager) {
			throw new ServiceUnavailableError('VS Code tunnel manager not available');
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
				throw new BadRequestError(error.message, 'TUNNEL_START_FAILED');
			}
		} else if (action === 'stop') {
			const success = await vscodeManager.stopTunnel();
			return json({ ok: success });
		} else {
			throw new BadRequestError('Invalid action', 'INVALID_ACTION');
		}
	} catch (err) {
		handleApiError(err, 'POST /api/admin/vscode-tunnel');
	}
}
