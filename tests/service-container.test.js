import { describe, it, expect } from 'vitest';
import { createTestContainer } from '../src/lib/client/shared/services/ServiceContainer.svelte.js';

describe('ServiceContainer', () => {
	it('resolves sessionViewModel with required dependencies', async () => {
		const container = createTestContainer();

		const sessionViewModel = await container.get('sessionViewModel');

		expect(sessionViewModel).toBeTruthy();
	});
});
