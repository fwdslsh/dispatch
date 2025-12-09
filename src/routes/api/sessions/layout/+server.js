/**
 * Session Layout API
 * Manages session-to-tile mappings for persistent window layouts
 */

import { json } from '@sveltejs/kit';
import { BadRequestError, handleApiError } from '$lib/server/shared/utils/api-errors.js';

export async function GET({ url, request: _request, locals }) {
	try {
		const clientId = url.searchParams.get('clientId') || 'default';
		const layout = await locals.services.workspaceRepository.getWorkspaceLayout(clientId);
		return json({ layout });
	} catch (err) {
		handleApiError(err, 'GET /api/sessions/layout');
	}
}

export async function POST({ request, locals }) {
	try {
		const { runId, sessionId, tileId, clientId = 'default' } = await request.json();

		// Accept both runId and sessionId for backward compatibility
		const actualRunId = runId || sessionId;

		if (!actualRunId || !tileId) {
			throw new BadRequestError(
				'Missing required parameters: runId, tileId',
				'MISSING_LAYOUT_PARAMS'
			);
		}

		await locals.services.workspaceRepository.setWorkspaceLayout(actualRunId, clientId, tileId);
		return json({ success: true });
	} catch (err) {
		handleApiError(err, 'POST /api/sessions/layout');
	}
}

export async function DELETE({ url, request: _request, locals }) {
	try {
		const runId = url.searchParams.get('runId');
		const sessionId = url.searchParams.get('sessionId');
		const _tileId = url.searchParams.get('tileId');

		// Accept both runId and sessionId for backward compatibility
		const actualRunId = runId || sessionId;
		const clientId = url.searchParams.get('clientId') || 'default';

		if (!actualRunId) {
			throw new BadRequestError('Missing runId parameter', 'MISSING_RUN_ID');
		}

		// Remove specific session from layout
		await locals.services.workspaceRepository.removeWorkspaceLayout(actualRunId, clientId);

		return json({ success: true });
	} catch (err) {
		handleApiError(err, 'DELETE /api/sessions/layout');
	}
}
