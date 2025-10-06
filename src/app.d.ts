// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
import type { Services } from '$lib/server/shared/services';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			services: Services;
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
