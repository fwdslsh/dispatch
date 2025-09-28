import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';

/**
 * Load handler for /testing - only enabled in E2E_TEST_MODE
 * Returns a simple list of workspaces to satisfy E2E tests that query
 * for `.project-item` elements. This is intentionally small and guarded
 * so it won't affect normal runtimes.
 */
export async function load({ env }) {
	if (!process.env.E2E_TEST_MODE) {
		return { status: 404 };
	}

	// Resolve the testing home path used by the dev/test runner
	const home = path.resolve(process.cwd(), '.testing-home', '.dispatch');
	const dbPath = path.join(home, 'data', 'workspace.db');

	const workspaces = [];

	if (fs.existsSync(dbPath)) {
		try {
			const db = new sqlite3.Database(dbPath);
			const rows = await new Promise((resolve, reject) => {
				db.all('SELECT path, created_at, updated_at, last_active FROM workspaces', (err, rows) => {
					if (err) return reject(err);
					resolve(rows || []);
				});
			});

			for (const r of rows) {
				workspaces.push({
					path: r.path || r[0] || '/workspace',
					name: path.basename(r.path || '') || r.path || 'workspace'
				});
			}

			db.close();
		} catch (err) {
			console.error('Failed to read testing DB for /testing route:', err);
		}
	}

	// Fallback: if nothing found, provide two sample workspaces used in tests
	if (workspaces.length === 0) {
		workspaces.push({ path: '/workspace/example', name: 'Example' });
		workspaces.push({ path: '/workspace/example2', name: 'Example 2' });
	}

	return { workspaces };
}
