export async function GET({ url, locals }) {
	const includeInactive = url.searchParams.get('include') === 'all';

	// Get persisted sessions with layout info from database
	const persistedSessions = await locals.services.database.getSessionsWithLayout();

	// Get active terminal sessions
	const activeTerminals = locals.services.terminalManager.listSessions();

	// Get active Claude sessions
	const activeClaude = locals.services.claudeSessionManager.list();

	// Merge all sessions
	const sessionMap = new Map();

	// First add persisted sessions
	persistedSessions.forEach((session) => {
		sessionMap.set(session.id, {
			...session,
			isActive: false,
			inLayout: !!session.tile_id
		});
	});

	// Add active terminal sessions
	activeTerminals.forEach((terminal) => {
		const existing = sessionMap.get(terminal.id);
		sessionMap.set(terminal.id, {
			...existing,
			id: terminal.id,
			typeSpecificId: terminal.id,
			type: 'pty',
			sessionType: 'pty',
			title: terminal.title || 'Terminal',
			workingDirectory: terminal.workspacePath,
			isActive: true,
			inLayout: existing ? existing.inLayout : false
		});
	});

	// Add active Claude sessions
	activeClaude.forEach((claude) => {
		const existing = sessionMap.get(claude.id);
		sessionMap.set(claude.id, {
			...existing,
			id: claude.id,
			typeSpecificId: claude.id,
			type: 'claude',
			sessionType: 'claude',
			title: claude.title || 'Claude',
			workingDirectory: claude.workspacePath,
			isActive: true,
			inLayout: existing ? existing.inLayout : false
		});
	});

	let allSessions = Array.from(sessionMap.values());

	// Filter by layout status unless 'include=all' specified
	if (!includeInactive) {
		allSessions = allSessions.filter(session => session.isActive || session.inLayout);
	}

	return new Response(JSON.stringify({ sessions: allSessions }), {
		headers: { 'content-type': 'application/json' }
	});
}

// Generate unique session ID
function generateSessionId() {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export async function POST({ request, locals }) {
	const { type, workspacePath, options, resume, sessionId } = await request.json();

	try {
		let result;
		const appSessionId = sessionId || generateSessionId();

		if (type === 'pty' || type === 'terminal') {
			// Create terminal session
			result = await locals.services.terminalManager.start({
				workspacePath: workspacePath || '/tmp',
				shell: options?.shell,
				env: options?.env,
				resume: resume || false,
				terminalId: options?.terminalId,
				appSessionId
			});

			// Save to database
			await locals.services.database.addSession(
				appSessionId,
				'pty',
				result.id,
				options?.title || 'Terminal',
				workspacePath || '/tmp'
			);

			return new Response(
				JSON.stringify({
					id: appSessionId,
					typeSpecificId: result.id
				})
			);
		} else if (type === 'claude') {
			// Create Claude session
			result = await locals.services.claudeSessionManager.create({
				workspacePath: workspacePath || '/tmp',
				options,
				sessionId: options?.claudeSessionId,
				appSessionId
			});

			// Save to database
			await locals.services.database.addSession(
				appSessionId,
				'claude',
				result?.typeSpecificId || appSessionId,
				result?.title || options?.projectName || 'Claude',
				workspacePath || '/tmp'
			);

			return new Response(
				JSON.stringify({
					id: appSessionId,
					typeSpecificId: result?.typeSpecificId || null
				})
			);
		} else {
			return new Response(JSON.stringify({ error: 'Invalid session type' }), { status: 400 });
		}
	} catch (error) {
		console.error('[API] Session creation failed:', error);

		// Provide more specific error messages for common issues
		let errorMessage = error.message;
		let statusCode = 500;

		if (error.message?.includes('node-pty failed to load')) {
			errorMessage =
				'Terminal functionality is temporarily unavailable. Please try again in a moment.';
			statusCode = 503; // Service Unavailable
		} else if (error.message?.includes('Vite module runner has been closed')) {
			errorMessage = 'Development server is restarting. Please try again in a moment.';
			statusCode = 503; // Service Unavailable
		}

		return new Response(JSON.stringify({ error: errorMessage }), { status: statusCode });
	}
}

export async function PUT({ request, locals }) {
	const { action, sessionId, newTitle, tileId, position } = await request.json();

	if (action === 'rename') {
		await locals.services.database.renameSession(sessionId, newTitle);
		return new Response(JSON.stringify({ success: true }));
	}

	if (action === 'setLayout') {
		await locals.services.database.setSessionLayout(sessionId, tileId, position || 0);
		return new Response(JSON.stringify({ success: true }));
	}

	if (action === 'removeLayout') {
		await locals.services.database.removeSessionLayout(sessionId);
		return new Response(JSON.stringify({ success: true }));
	}

	return new Response('Bad Request', { status: 400 });
}

export async function DELETE({ url, locals }) {
	const sessionId = url.searchParams.get('sessionId');

	if (!sessionId) {
		return new Response('Missing sessionId', { status: 400 });
	}

	try {
		// Get session info from database to know which manager to call
		const session = await locals.services.database.getAppSession(sessionId);

		// Remove session from layout so it doesn't reappear in tiles
		await locals.services.database.removeSessionLayout(sessionId);

		// Terminate the active session based on type
		if (session) {
			if (session.session_type === 'pty') {
				locals.services.terminalManager.stop(session.type_specific_id);
			} else if (session.session_type === 'claude') {
				await locals.services.claudeSessionManager.terminate(session.type_specific_id);
			}
		}

		// Remove from database
		await locals.services.database.deleteSession(sessionId);

		return new Response(JSON.stringify({ success: true }));
	} catch (error) {
		console.error('[API] Session deletion failed:', error);
		return new Response(JSON.stringify({ error: error.message }), { status: 500 });
	}
}
