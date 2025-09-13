// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { TerminalManager } from '$lib/server/terminals/TerminalManager';
import type { ClaudeSessionManager } from '$lib/server/claude/ClaudeSessionManager';
import type { SessionRouter } from '$lib/server/core/SessionRouter';
import type { WorkspaceManager } from '$lib/server/core/WorkspaceManager';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			terminals: TerminalManager;
			claude: ClaudeSessionManager;
			sessions: SessionRouter;
			workspaces: WorkspaceManager;
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
