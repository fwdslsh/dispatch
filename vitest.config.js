import { defineConfig } from 'vitest';

export default defineConfig({
	test: {
		include: ['**/*.test.js'],
		globals: true,
		environment: 'node',
		setupFiles: ['./vitest-setup-server.js']
	}
});
