#!/usr/bin/env node

/**
 * Dispatch UI Test Suite Runner
 * 
 * Runs the comprehensive e2e UI test suite focusing on non-Claude functionality.
 * This ensures reliable CI execution without external API dependencies.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// Core UI test files (non-Claude functionality)
const coreTestFiles = [
	'e2e/comprehensive-ui.spec.js',
	'e2e/command-palette.spec.js',
	'e2e/working-directory.spec.js',
	'e2e/working-directory-validation.spec.js',
	'e2e/socket-reconnection.spec.js',
	'e2e/workspace-terminal-interactions.spec.js',
	'e2e/terminal-session-resumption.spec.js'
];

// Server-side integration tests
const integrationTestFiles = [
	'tests/e2e/socket-integration.spec.js'
];

console.log('🎭 Dispatch UI Test Suite (Non-Claude)');
console.log('=====================================\n');

// Check if core test files exist
const missingCoreFiles = coreTestFiles.filter((file) => !fs.existsSync(file));
if (missingCoreFiles.length > 0) {
	console.error('❌ Missing core test files:');
	missingCoreFiles.forEach((file) => console.error(`   - ${file}`));
	process.exit(1);
}

// Check integration files
const availableIntegrationFiles = integrationTestFiles.filter((file) => fs.existsSync(file));

console.log('📁 Core Test Files:');
coreTestFiles.forEach((file) => console.log(`   ✓ ${file}`));

if (availableIntegrationFiles.length > 0) {
	console.log('\n📁 Integration Test Files:');
	availableIntegrationFiles.forEach((file) => console.log(`   ✓ ${file}`));
}

console.log('\n🚫 Excluded (Claude-dependent):');
console.log('   ⊗ e2e/claude-*.spec.js');
console.log('   ⊗ e2e/activity-summaries.spec.js');
console.log('   ⊗ e2e/project-page-claude-sessions.spec.js');
console.log('');

// Determine which config to use
const hasCustomConfig = fs.existsSync('playwright-ui.config.js');
const configFile = hasCustomConfig ? 'playwright-ui.config.js' : 'playwright.config.js';

console.log(`📋 Using config: ${configFile}`);

// Parse command line arguments
const args = process.argv.slice(2);
const isHeaded = args.includes('--headed');
const isDebug = args.includes('--debug');
const isUI = args.includes('--ui');

// Build Playwright command
const playwrightArgs = [
	'npx',
	'playwright',
	'test',
	`--config=${configFile}`
];

// Add specific test files if using default config
if (!hasCustomConfig) {
	playwrightArgs.push(...coreTestFiles, ...availableIntegrationFiles);
}

// Add additional arguments
if (isHeaded) playwrightArgs.push('--headed');
if (isDebug) playwrightArgs.push('--debug');
if (isUI) playwrightArgs.push('--ui');

// Add other passed arguments (excluding our custom ones)
const otherArgs = args.filter(arg => !['--headed', '--debug', '--ui'].includes(arg));
playwrightArgs.push(...otherArgs);

console.log('🚀 Starting UI tests...\n');

if (isDebug) {
	console.log('🐛 Debug mode: Tests will run with debugging enabled');
} else if (isUI) {
	console.log('🖥️  UI mode: Opening Playwright test interface');
} else if (isHeaded) {
	console.log('👁️  Headed mode: Browser windows will be visible');
}

console.log('');

const playwrightProcess = spawn('npm', ['exec', '--', ...playwrightArgs.slice(1)], {
	stdio: 'inherit',
	shell: true,
	env: {
		...process.env,
		// Ensure test environment
		TERMINAL_KEY: 'testkey12345',
		PTY_MODE: 'shell',
		NODE_ENV: 'test'
	}
});

playwrightProcess.on('close', (code) => {
	console.log('\n' + '='.repeat(50));
	if (code === 0) {
		console.log('🎉 All UI tests completed successfully!');
		console.log('\n📊 Test Coverage Summary:');
		console.log('   ✅ Authentication and authorization flows');
		console.log('   ✅ Project management and navigation');
		console.log('   ✅ Terminal session creation and management');
		console.log('   ✅ Console/admin page functionality');
		console.log('   ✅ Mobile and responsive design');
		console.log('   ✅ Visual regression and layout validation');
		console.log('   ✅ Error handling and edge cases');
		console.log('   ✅ Command palette and keyboard shortcuts');
		console.log('   ✅ Working directory functionality');
		
		console.log('\n🚫 Intentionally Excluded:');
		console.log('   ⊗ Claude session functionality (external API dependency)');
		console.log('   ⊗ Claude-specific UI components');
		console.log('   ⊗ Activity summaries requiring Claude API');
		
		console.log('\n💡 View detailed results:');
		console.log('   • npx playwright show-report');
		console.log('   • Check test-results/ directory');
		console.log('   • Screenshots in test-results/*.png');
	} else {
		console.log('❌ Some UI tests failed.');
		console.log('\n🔍 To debug failures:');
		console.log('   • npx playwright show-report');
		console.log('   • npm run test:ui:debug (for interactive debugging)');
		console.log('   • Check test-results/ directory for artifacts');
		console.log('   • View screenshots of failed tests');
	}
	process.exit(code);
});

playwrightProcess.on('error', (error) => {
	console.error('❌ Failed to start Playwright:', error.message);
	console.error('\n💡 Try:');
	console.error('   • npm run playwright:install');
	console.error('   • npm install');
	console.error('   • Check that the dev server can start with npm run dev');
	process.exit(1);
});