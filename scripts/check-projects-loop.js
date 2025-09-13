// Headless check script using Playwright to detect repeating console logs on /projects
import { chromium } from 'playwright';

(async function main() {
	const browser = await chromium.launch();
	const page = await browser.newPage();
	const logs = [];

	page.on('console', (msg) => {
		const text = `[${msg.type()}] ${msg.text()}`;
		console.log(text);
		logs.push({ type: msg.type(), text, ts: Date.now() });
	});

	// Navigate to projects page (allow overriding via TARGET_URL env var)
	const target = process.env.TARGET_URL || 'http://localhost:5173/projects';
	console.log('Navigating to', target);
	await page.goto(target, { waitUntil: 'domcontentloaded' });

	// Wait 6 seconds while collecting console logs
	await page.waitForTimeout(6000);

	// Analyze logs for repeating "DEBUG visible derivation" entries
	const debugLogs = logs.filter((l) => l.text.includes('DEBUG visible derivation'));
	console.log('\nSUMMARY: total console logs:', logs.length);
	console.log('DEBUG visible derivation count:', debugLogs.length);

	if (debugLogs.length > 20) {
		console.log('POSSIBLE LOOP: many DEBUG entries detected');
	} else {
		console.log('No obvious loop detected from DEBUG entries');
	}

	await browser.close();
	// Exit with non-zero if loop found
	process.exit(debugLogs.length > 20 ? 2 : 0);
})();
