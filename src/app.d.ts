// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { DatabaseManager } from '$lib/server/db/DatabaseManager';
import type { WorkspaceManager } from '$lib/server/core/WorkspaceManager';
import type { SessionRegistry } from '$lib/server/core/SessionRegistry';
import type { TerminalManager } from '$lib/server/terminals/TerminalManager';
import type { ClaudeSessionManager } from '$lib/server/claude/ClaudeSessionManager';
import type { ClaudeAuthManager } from '$lib/server/claude/ClaudeAuthManager';
import type { MessageBuffer } from '$lib/server/core/MessageBuffer';
import type { ServerServiceContainer } from '$lib/server/core/ServerServiceContainer';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			database: DatabaseManager;
			workspaceManager: WorkspaceManager;
			sessionRegistry: SessionRegistry;
			terminalManager: TerminalManager;
			claudeSessionManager: ClaudeSessionManager;
			claudeAuthManager: ClaudeAuthManager;
			messageBuffer: MessageBuffer;
			serviceContainer: ServerServiceContainer;
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
