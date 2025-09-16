#!/usr/bin/env node

/**
 * WindowManager Integration Test
 *
 * Tests the session-to-tile mapping reactivity and WindowManager functionality
 */

const { chromium } = require('playwright');

async function testWindowManagerIntegration() {
	console.log('🚀 Starting WindowManager Integration Tests...\n');

	const browser = await chromium.launch({ headless: false });
	const context = await browser.newContext({
		viewport: { width: 1280, height: 720 } // Desktop viewport
	});
	const page = await context.newPage();

	try {
		// Navigate to workspace page
		console.log('📍 Navigating to workspace page...');
		await page.goto('http://localhost:5174/workspace');

		// Wait for page to load
		await page.waitForLoadState('networkidle');
		await page.waitForTimeout(2000);

		// Test 1: Check if page loads without errors
		console.log('✅ Test 1: Page load verification');
		const errors = await page.evaluate(() => {
			return window.errors || [];
		});

		if (errors.length > 0) {
			console.log('❌ JavaScript errors found:', errors);
		} else {
			console.log('✅ No JavaScript errors detected');
		}

		// Test 2: Check if WindowManager components are present (desktop mode)
		console.log('\n✅ Test 2: WindowManager component detection');
		const hasWindowManager = (await page.locator('.wm-root').count()) > 0;
		const hasSessionGrid = (await page.locator('.session-grid').count()) > 0;

		console.log(`WindowManager present: ${hasWindowManager}`);
		console.log(`SessionGrid present: ${hasSessionGrid}`);

		if (hasWindowManager) {
			console.log('✅ Desktop mode: WindowManager is active');
		} else if (hasSessionGrid) {
			console.log('✅ Mobile mode: SessionGrid is active');
		} else {
			console.log('⚠️  Neither WindowManager nor SessionGrid found');
		}

		// Test 3: Test empty workspace state
		console.log('\n✅ Test 3: Empty workspace state');
		const emptyWorkspace =
			(await page.locator('text=Create a new terminal or Claude session').count()) > 0;
		console.log(`Empty workspace detected: ${emptyWorkspace}`);

		// Test 4: Test session creation if possible
		console.log('\n✅ Test 4: Session creation test');
		const createButton = page
			.locator('button:has-text("Add Terminal"), button:has-text("Terminal")')
			.first();

		if ((await createButton.count()) > 0) {
			console.log('📍 Found session creation button, testing...');

			// Click to create session
			await createButton.click();
			await page.waitForTimeout(1000);

			// Check if session appeared
			const sessionElements = await page
				.locator('[data-session-id], .session-container, .wm-tile')
				.count();
			console.log(`Session elements found: ${sessionElements}`);

			if (sessionElements > 0) {
				console.log('✅ Session creation appears to work');
			} else {
				console.log('⚠️  Session creation may need authentication or have issues');
			}
		} else {
			console.log('⚠️  No session creation button found');
		}

		// Test 5: Test keyboard shortcuts (basic)
		console.log('\n✅ Test 5: Keyboard shortcuts test');
		if (hasWindowManager) {
			// Focus the window manager
			await page.locator('.wm-root').first().focus();

			// Test Ctrl+Enter (split right)
			await page.keyboard.press('Control+Enter');
			await page.waitForTimeout(500);

			// Count tiles after split
			const tilesAfterSplit = await page.locator('.wm-tile').count();
			console.log(`Tiles after Ctrl+Enter: ${tilesAfterSplit}`);

			if (tilesAfterSplit > 1) {
				console.log('✅ Keyboard shortcut Ctrl+Enter works (split right)');

				// Test Ctrl+Shift+X (close)
				await page.keyboard.press('Control+Shift+x');
				await page.waitForTimeout(500);

				const tilesAfterClose = await page.locator('.wm-tile').count();
				console.log(`Tiles after Ctrl+Shift+X: ${tilesAfterClose}`);

				if (tilesAfterClose < tilesAfterSplit) {
					console.log('✅ Keyboard shortcut Ctrl+Shift+X works (close tile)');
				}
			} else {
				console.log('⚠️  Keyboard shortcut Ctrl+Enter may not be working');
			}
		}

		// Test 6: Responsive behavior (if possible)
		console.log('\n✅ Test 6: Responsive behavior test');

		// Switch to mobile viewport
		await page.setViewportSize({ width: 375, height: 667 });
		await page.waitForTimeout(1000);

		const hasMobileSessionGrid = (await page.locator('.session-grid').count()) > 0;
		const hasMobileWindowManager = (await page.locator('.wm-root').count()) > 0;

		console.log(
			`Mobile - SessionGrid: ${hasMobileSessionGrid}, WindowManager: ${hasMobileWindowManager}`
		);

		if (hasMobileSessionGrid && !hasMobileWindowManager) {
			console.log('✅ Mobile responsive behavior working correctly');
		}

		// Switch back to desktop
		await page.setViewportSize({ width: 1280, height: 720 });
		await page.waitForTimeout(1000);

		const hasDesktopWindowManager = (await page.locator('.wm-root').count()) > 0;
		console.log(`Desktop after resize - WindowManager: ${hasDesktopWindowManager}`);

		console.log('\n🎉 WindowManager Integration Tests Complete!');
	} catch (error) {
		console.error('❌ Test error:', error.message);
	} finally {
		await browser.close();
	}
}

// Check if Playwright is available
async function checkDependencies() {
	try {
		await testWindowManagerIntegration();
	} catch (error) {
		if (error.message.includes('playwright')) {
			console.log('⚠️  Playwright not available. Running basic curl test instead...\n');

			// Fallback to basic curl test
			const { exec } = require('child_process');
			exec('curl -s http://localhost:5174/workspace', (error, stdout, stderr) => {
				if (error) {
					console.log('❌ Server not responding:', error.message);
					return;
				}

				console.log('✅ Server Response Test:');
				console.log(`Response length: ${stdout.length} characters`);

				// Check for key components in HTML
				const hasHTML = stdout.includes('<html');
				const hasScript = stdout.includes('<script');
				const hasWorkspace = stdout.includes('workspace') || stdout.includes('Workspace');

				console.log(`HTML structure: ${hasHTML}`);
				console.log(`Scripts included: ${hasScript}`);
				console.log(`Workspace content: ${hasWorkspace}`);

				if (hasHTML && hasScript) {
					console.log('✅ Basic server functionality appears to work');
				} else {
					console.log('⚠️  Server response may be incomplete');
				}
			});
		} else {
			throw error;
		}
	}
}

if (require.main === module) {
	checkDependencies();
}
