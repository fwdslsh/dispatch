// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { DatabaseManager } from '$lib/server/db/DatabaseManager';
import type { WorkspaceManager } from '$lib/server/core/WorkspaceManager';
import type { SessionRegistry } from '$lib/server/core/SessionRegistry';
import type { TerminalManager } from '$lib/server/terminals/TerminalManager';
import type { ClaudeSessionManager } from '$lib/server/claude/ClaudeSessionManager';
import type { ClaudeAuthManager } from '$lib/server/claude/ClaudeAuthManager';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			services: {
				database: DatabaseManager;
				workspaceManager: WorkspaceManager;
				sessionRegistry: SessionRegistry;
				terminalManager: TerminalManager;
				claudeSessionManager: ClaudeSessionManager;
				claudeAuthManager: ClaudeAuthManager;
			};
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
