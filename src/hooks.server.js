import { sequence } from '@sveltejs/kit/hooks';
import { WorkspaceManager } from './lib/server/core/WorkspaceManager.js';
import { SessionRouter } from './lib/server/core/SessionRouter.js';
import { SessionManager } from './lib/server/core/SessionManager.js';
import { TerminalManager } from './lib/server/terminals/TerminalManager.js';
import { ClaudeSessionManager } from './lib/server/claude/ClaudeSessionManager.js';
import { getDatabaseManager } from './lib/server/db/DatabaseManager.js';

// Initialize database and services for API endpoints (but not for Socket.IO which is handled separately)
if (!globalThis.__API_SERVICES) {
	try {
		// Initialize database first
		getDatabaseManager().init().catch((err) => {
			console.error('[APP] Failed to initialize database:', err);
		});

		const sessions = new SessionRouter();
		const workspaces = new WorkspaceManager({
			rootDir: process.env.WORKSPACES_ROOT || '.'
		});

		// Initialize workspaces asynchronously
		workspaces.init().catch((err) => {
			console.error('Failed to initialize workspaces:', err);
		});

		// Create managers without Socket.IO for API use
		const terminals = new TerminalManager({ io: null });
		const claude = new ClaudeSessionManager({ io: null });

		// Create unified session manager
		const sessionManager = new SessionManager({
			sessionRouter: sessions,
			workspaceManager: workspaces,
			terminalManager: terminals,
			claudeManager: claude
		});

		globalThis.__API_SERVICES = { sessions, workspaces, terminals, claude, sessionManager };
	} catch (error) {
		console.error('Failed to initialize API services:', error);
		globalThis.__API_SERVICES = {
			sessions: null,
			workspaces: null,
			terminals: null,
			claude: null,
			sessionManager: null
		};
	}
}

export const handle = sequence(async ({ event, resolve }) => {
	// Make services available to API endpoints
	event.locals.sessions = globalThis.__API_SERVICES?.sessions;
	event.locals.workspaces = globalThis.__API_SERVICES?.workspaces;
	event.locals.terminals = globalThis.__API_SERVICES?.terminals;
	event.locals.claude = globalThis.__API_SERVICES?.claude;
	event.locals.sessionManager = globalThis.__API_SERVICES?.sessionManager;

	return resolve(event);
});
