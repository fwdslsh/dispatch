#!/usr/bin/env node
/**
 * Test script to debug command loading issue
 * Opens browser to create a Claude session and observe debug logs
 */

const { execSync } = require('child_process');
const { platform } = require('os');

const url = 'http://localhost:5174';

console.log('Opening browser to test command loading...');
console.log('1. Go to:', url);
console.log('2. Create a new Claude Code session');
console.log('3. Watch the server logs for debug output');
console.log('4. Check if commands appear in the UI');

try {
    let command;
    if (platform() === 'darwin') {
        command = `open "${url}"`;
    } else if (platform() === 'win32') {
        command = `start "${url}"`;
    } else {
        command = `xdg-open "${url}"`;
    }

    console.log(`Running: ${command}`);
    execSync(command);
} catch (error) {
    console.error('Failed to open browser:', error.message);
    console.log(`Please manually visit: ${url}`);
}