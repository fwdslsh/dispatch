#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const testFiles = [
	'e2e/auth.spec.js',
	'e2e/projects.spec.js',
	'e2e/sessions.spec.js',
	'e2e/mobile.spec.js',
	'e2e/command-palette.spec.js',
	'e2e/working-directory.spec.js',
	'e2e/error-cases.spec.js'
];

console.log('🎭 Running Dispatch E2E Test Suite');
console.log('=================================\n');

// Check if all test files exist
const missingFiles = testFiles.filter((file) => !fs.existsSync(file));
if (missingFiles.length > 0) {
	console.error('❌ Missing test files:');
	missingFiles.forEach((file) => console.error(`   - ${file}`));
	process.exit(1);
}

console.log('📁 Test Files Found:');
testFiles.forEach((file) => console.log(`   ✓ ${file}`));
console.log('');

// Run Playwright tests
const playwrightArgs = [
	'npx',
	'playwright',
	'test',
	'--config=playwright.config.js',
	...process.argv.slice(2) // Pass through any additional arguments
];

console.log('🚀 Starting Playwright tests...\n');

const playwrightProcess = spawn('npm', ['exec', '--', ...playwrightArgs.slice(1)], {
	stdio: 'inherit',
	shell: true
});

playwrightProcess.on('close', (code) => {
	console.log('\n' + '='.repeat(50));
	if (code === 0) {
		console.log('🎉 All E2E tests completed successfully!');
		console.log('\n📊 Test Coverage Summary:');
		console.log('   ✅ Authentication and authorization');
		console.log('   ✅ Project management workflow');
		console.log('   ✅ Terminal session creation and management');
		console.log('   ✅ Mobile UX and responsive design');
		console.log('   ✅ Command palette and keyboard shortcuts');
		console.log('   ✅ Working directory functionality');
		console.log('   ✅ Error conditions and edge cases');
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
