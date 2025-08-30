// tests/debug-symlink.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createSymlink, removeSymlink, getByNamePath } from '../src/lib/server/symlink-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PTY_ROOT = path.join(__dirname, 'debug-symlinks');
process.env.PTY_ROOT = TEST_PTY_ROOT;

// Clean up and setup
if (fs.existsSync(TEST_PTY_ROOT)) {
  fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
}

fs.mkdirSync(TEST_PTY_ROOT, { recursive: true });

// Create test session directories
fs.mkdirSync(path.join(TEST_PTY_ROOT, 'session-uuid-1'), { recursive: true });
fs.mkdirSync(path.join(TEST_PTY_ROOT, 'session-uuid-2'), { recursive: true });

console.log('Creating symlinks...');

// Create first symlink
const symlink1 = createSymlink('session-uuid-1', 'My Test Session');
console.log('Created symlink1:', symlink1);

// Create second symlink with same name (should get suffix)
const symlink2 = createSymlink('session-uuid-2', 'My Test Session');
console.log('Created symlink2:', symlink2);

const byNamePath = getByNamePath();
console.log('\nSymlinks after creation:');
console.log(fs.readdirSync(byNamePath));

console.log('\nRemoving first session...');
removeSymlink('My Test Session');

console.log('\nSymlinks after removal:');
console.log(fs.readdirSync(byNamePath));

// Cleanup
fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });