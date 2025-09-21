import { describe, it, expect } from 'vitest';
import { createTestContainer } from '../../src/lib/client/shared/services/ServiceContainer.svelte.js';

describe('diagnostics - import', () => {
	it('can import ServiceContainer via relative path', () => {
		const c = createTestContainer();
		expect(c).toBeTruthy();
	});
});
