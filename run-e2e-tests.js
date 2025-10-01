#!/usr/bin/env node

/**
 * E2E Test Runner for Dispatch
 * Runs Playwright tests with proper setup
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);

// Default to chromium browser for faster testing
let playwrightArgs = ['npx', 'playwright', 'test'];

// Add browser selection (default to chromium for speed)
if (!args.some((arg) => arg.includes('--project'))) {
	playwrightArgs.push('--project=chromium');
}

// Add passed arguments
playwrightArgs.push(...args);

console.log('🎭 Running E2E Tests');
console.log('Command:', playwrightArgs.join(' '));

// Set environment variables for testing
const env = {
	...process.env,
	TERMINAL_KEY: process.env.TERMINAL_KEY || 'test-automation-key-12345',
	NODE_ENV: 'test',
	// Default to test server (no SSL) unless USE_SSL is set
	USE_SSL: process.env.USE_SSL || 'false'
};

// Spawn the Playwright process
const playwright = spawn(playwrightArgs[0], playwrightArgs.slice(1), {
	cwd: __dirname,
	stdio: 'inherit',
	env
});

// Handle process events
playwright.on('error', (error) => {
	console.error('❌ Failed to start E2E tests:', error);
	process.exit(1);
});

playwright.on('close', (code) => {
	if (code === 0) {
		console.log('✅ E2E tests completed successfully');
	} else {
		console.log(`❌ E2E tests failed with exit code ${code}`);
	}
	process.exit(code);
});

// Handle interruption
process.on('SIGINT', () => {
	console.log('🛑 Interrupting E2E tests...');
	playwright.kill('SIGINT');
});

process.on('SIGTERM', () => {
	console.log('🛑 Terminating E2E tests...');
	playwright.kill('SIGTERM');
});
