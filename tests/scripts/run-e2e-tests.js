#!/usr/bin/env node

import { spawn } from 'child_process';

console.log('🎭 Running Dispatch E2E Test Suite');
console.log('=================================\n');

// Prefer the UI-focused config (excludes Claude-dependent specs) unless overridden
const argv = process.argv.slice(2);
const hasConfigArg = argv.some((a) => a.startsWith('--config') || a === '-c');
const defaultConfig = '--config=playwright-ui.config.js';
const passArgs = hasConfigArg ? argv : [defaultConfig, ...argv];

console.log('🚀 Starting Playwright tests...\n');

const playwrightProcess = spawn('npm', ['exec', '--', 'playwright', 'test', ...passArgs], {
	stdio: 'inherit',
	shell: true,
	env: {
		...process.env,
		TERMINAL_KEY: process.env.TERMINAL_KEY || 'testkey12345',
		NODE_ENV: process.env.NODE_ENV || 'test'
	}
});

playwrightProcess.on('close', (code) => {
	console.log('\n' + '='.repeat(50));
	if (code === 0) {
		console.log('🎉 E2E tests completed successfully!');
		console.log('\n💡 To view detailed results: npx playwright show-report');
	} else {
		console.log('❌ Some E2E tests failed.');
		console.log('\n🔍 To debug failures:');
		console.log('   • npx playwright show-report');
		console.log('   • npx playwright test --debug');
		console.log('   • Check test-results/ directory for artifacts');
	}
	process.exit(code);
});

playwrightProcess.on('error', (error) => {
	console.error('❌ Failed to start Playwright:', error.message);
	process.exit(1);
});
