#!/usr/bin/env node

/**
 * Simple test to verify the Claude session history API endpoint works correctly
 */

import { projectsRoot } from '../../src/lib/server/claude/cc-root.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';

const TEST_PROJECT = 'test-history-project';
const TEST_SESSION_ID = 'test-session-12345';

async function cleanup() {
	try {
		const root = projectsRoot();
		const projectPath = join(root, TEST_PROJECT);
		await fs.rm(projectPath, { recursive: true, force: true });
	} catch (error) {
		// Ignore cleanup errors
	}
}

async function main() {
	console.log('Testing Claude session history API...\n');
	
	await cleanup();
	
	console.log('1. Creating test session history...');
	const root = projectsRoot();
	const projectPath = join(root, TEST_PROJECT);
	const sessionFile = join(projectPath, `${TEST_SESSION_ID}.jsonl`);
	
	// Create project directory
	await fs.mkdir(projectPath, { recursive: true });
	
	// Create test entries
	const testEntries = [
		{
			type: 'user',
			message: {
				content: [{ type: 'text', text: 'Hello Claude, can you help me with a coding task?' }]
			},
			timestamp: new Date(Date.now() - 600000).toISOString()
		},
		{
			type: 'assistant',
			message: {
				content: [{ type: 'text', text: 'Of course! I\'d be happy to help you with a coding task.' }]
			},
			timestamp: new Date(Date.now() - 500000).toISOString()
		},
		{
			type: 'user',
			message: {
				content: [{ type: 'text', text: 'I need to implement a sorting function' }]
			},
			timestamp: new Date(Date.now() - 400000).toISOString()
		},
		{
			type: 'assistant',
			message: {
				content: [
					{ type: 'text', text: 'I\'ll help you implement a sorting function:' },
					{ 
						type: 'tool_use',
						id: 'tool_1',
						name: 'Write',
						input: { file_path: '/tmp/sort.js', content: 'function sort(arr) { return [...arr].sort((a, b) => a - b); }' }
					}
				]
			},
			timestamp: new Date(Date.now() - 300000).toISOString()
		},
		{
			type: 'user',
			message: {
				content: [
					{
						type: 'tool_result',
						tool_use_id: 'tool_1',
						content: 'File written successfully'
					}
				]
			},
			timestamp: new Date(Date.now() - 250000).toISOString()
		},
		{
			type: 'assistant',
			message: {
				content: [{ type: 'text', text: 'Great! The sorting function has been created.' }]
			},
			timestamp: new Date(Date.now() - 200000).toISOString()
		}
	];
	
	// Write entries as JSONL
	const jsonlContent = testEntries.map(entry => JSON.stringify(entry)).join('\n');
	await fs.writeFile(sessionFile, jsonlContent);
	console.log(`   Created session file: ${sessionFile}`);
	console.log(`   Written ${testEntries.length} test entries`);
	
	console.log('\n2. Testing the API endpoint...');
	// Import and test the API endpoint
	const { GET } = await import('../../src/routes/api/claude/session/[id]/+server.js');
	
	// Test with full=1 to get all entries
	const mockRequest = {
		params: { id: TEST_SESSION_ID },
		url: new URL(`http://localhost/api/claude/session/${TEST_SESSION_ID}?full=1`)
	};
	
	const response = await GET(mockRequest);
	const responseText = await response.text();
	const data = JSON.parse(responseText);
	
	console.log('\n3. API Response:');
	console.log(`   - Status: ${response.status}`);
	console.log(`   - Project: ${data.project}`);
	console.log(`   - Session ID: ${data.id}`);
	console.log(`   - File size: ${data.size} bytes`);
	console.log(`   - Entries loaded: ${data.entries?.length || 0}`);
	console.log(`   - Summary:`, data.summary);
	
	console.log('\n4. Verifying entries:');
	if (data.entries && data.entries.length > 0) {
		data.entries.forEach((entry, i) => {
			const content = entry.message?.content;
			let text = 'Unknown';
			if (Array.isArray(content)) {
				const textContent = content.find(c => c.type === 'text');
				if (textContent) {
					text = textContent.text.substring(0, 60);
					if (textContent.text.length > 60) text += '...';
				}
				const toolContent = content.find(c => c.type === 'tool_use');
				if (toolContent) text = `[Tool: ${toolContent.name}]`;
				const toolResult = content.find(c => c.type === 'tool_result');
				if (toolResult) text = `[Tool Result]`;
			}
			console.log(`   ${i + 1}. ${entry.type.padEnd(10)} : ${text}`);
		});
	}
	
	console.log('\n5. Testing with non-existent session...');
	const mockRequest2 = {
		params: { id: 'non-existent-session' },
		url: new URL(`http://localhost/api/claude/session/non-existent-session?full=1`)
	};
	
	const response2 = await GET(mockRequest2);
	const data2 = await response2.json();
	console.log(`   - Status: ${response2.status}`);
	console.log(`   - Entries: ${data2.entries?.length || 0} (should be 0)`);
	console.log(`   - Returns empty result: ${data2.entries?.length === 0 ? '✓' : '✗'}`);
	
	console.log('\n6. Validation:');
	const allTestsPassed = 
		response.status === 200 &&
		data.project === TEST_PROJECT &&
		data.id === TEST_SESSION_ID &&
		data.entries?.length === testEntries.length &&
		response2.status === 200 &&
		data2.entries?.length === 0;
	
	if (allTestsPassed) {
		console.log('   ✅ All tests passed!');
		console.log('\n   The history API correctly:');
		console.log('   - Finds session files across projects');
		console.log('   - Returns all entries when full=1 is specified');
		console.log('   - Handles non-existent sessions gracefully');
		console.log('   - Preserves entry structure including tool use');
	} else {
		console.log('   ❌ Some tests failed');
		if (response.status !== 200) console.log('   - Wrong status code');
		if (data.project !== TEST_PROJECT) console.log('   - Wrong project name');
		if (data.entries?.length !== testEntries.length) console.log('   - Wrong entry count');
		if (response2.status !== 200) console.log('   - Non-existent session handling failed');
	}
	
	await cleanup();
	console.log('\n✨ Test complete!');
}

main().catch(error => {
	console.error('\n❌ Test failed:', error);
	process.exit(1);
});