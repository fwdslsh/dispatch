import prettier from 'eslint-config-prettier';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import { fileURLToPath } from 'node:url';
import svelteConfig from './svelte.config.js';

const gitignorePath = fileURLToPath(new URL('./.gitignore', import.meta.url));

/** @type {import('eslint').Linter.Config[]} */
export default [
	includeIgnoreFile(gitignorePath),
	js.configs.recommended,
	...svelte.configs.recommended,
	prettier,
	...svelte.configs.prettier,
	{
		languageOptions: {
			globals: { ...globals.browser, ...globals.node }
		},
		rules: {
			'no-console': 'off'
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.js'],
		languageOptions: { parserOptions: { svelteConfig } }
	},
	{
		files: [
			'src/lib/client/shared/components/workspace/**/*',
			'src/lib/client/shared/viewmodels/**/*',
			'src/lib/server/claude/**/*'
		],
		rules: {
			'no-console': 'error'
		}
	},
	{
		files: [
			'src/lib/client/shared/utils/logger.js',
			'src/lib/server/utils/logger.js',
			'src/lib/client/shared/viewmodels/SessionViewModel.backup.svelte.js'
		],
		rules: {
			'no-console': 'off'
		}
	}
];
