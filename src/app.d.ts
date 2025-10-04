// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { DatabaseManager } from '$lib/server/shared/db/DatabaseManager';
import type { RunSessionManager } from '$lib/server/shared/runtime/RunSessionManager';
import type { ClaudeAuthManager } from '$lib/server/claude/ClaudeAuthManager';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			services: {
				database: DatabaseManager;
				runSessionManager: RunSessionManager;
				claudeAuthManager: ClaudeAuthManager;
			};
			auth?: {
				provider: string;
				userId: string;
				authenticated: boolean;
			};
		}
		// interface PageData {}
		// interface Platform {}
	}
}

export {};
