// tests/debug-orphan.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getByNamePath } from '../src/lib/server/symlink-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PTY_ROOT = path.join(__dirname, 'debug-orphan');
process.env.PTY_ROOT = TEST_PTY_ROOT;

// Clean up and setup
if (fs.existsSync(TEST_PTY_ROOT)) {
  fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });
}

fs.mkdirSync(TEST_PTY_ROOT, { recursive: true });

const byNamePath = getByNamePath();
fs.mkdirSync(byNamePath, { recursive: true });

console.log('Creating orphaned symlink...');

// Create symlink pointing to non-existent directory
const orphanSymlinkPath = path.join(byNamePath, 'orphaned-session');
const orphanTarget = path.join('..', 'non-existent-session');

console.log('Symlink path:', orphanSymlinkPath);
console.log('Target:', orphanTarget);

try {
  fs.symlinkSync(orphanTarget, orphanSymlinkPath);
  console.log('Symlink created successfully');
} catch (err) {
  console.error('Failed to create symlink:', err.message);
}

console.log('Checking if symlink exists:', fs.existsSync(orphanSymlinkPath));

if (fs.existsSync(orphanSymlinkPath)) {
  const stats = fs.lstatSync(orphanSymlinkPath);
  console.log('Is symlink:', stats.isSymbolicLink());
  console.log('Link target:', fs.readlinkSync(orphanSymlinkPath));
  
  // Check if target exists
  console.log('Target exists:', fs.existsSync(orphanSymlinkPath));
}

// Cleanup
fs.rmSync(TEST_PTY_ROOT, { recursive: true, force: true });