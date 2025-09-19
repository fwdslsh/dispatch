import { describe, it, expect } from 'vitest';
import { createTestContainer } from '../src/lib/client/shared/services/ServiceContainer.svelte.js';

describe('ServiceContainer', () => {
	it('resolves windowViewModel with required dependencies', async () => {
		const container = createTestContainer();

		const windowViewModel = await container.get('windowViewModel');
		const sessionViewModel = await container.get('sessionViewModel');

		expect(windowViewModel).toBeTruthy();
		expect(sessionViewModel).toBeTruthy();
	});
});
