import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve:{
		alias: {
			'$lib': './src/lib'
		}
	},
	test: {
		include: ['**/*.test.js'],
		globals: true,
		environment: 'node',
		setupFiles: ['./vitest-setup-server.js']
	}
});
