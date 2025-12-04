/**
 * Verification script to check all event types are handled
 */

import { ClaudeEventHandlers } from '../src/lib/client/claude/services/EventHandlers.js';

// Mock ViewModel for testing
class MockViewModel {
	messages = [];
	nextMessageId() {
		return 'test-' + Date.now() + '-' + Math.random();
	}
}

const vm = new MockViewModel();
const handlers = new ClaudeEventHandlers(vm);

// Event types to test
const eventTypes = [
	// Modern channel-based
	{
		channel: 'claude:message',
		type: 'assistant',
		payload: { events: [{ message: { content: [{ type: 'text', text: 'Test' }] } }] }
	},
	{ channel: 'claude:message', type: 'system', payload: {} },
	{ channel: 'claude:message', type: 'result', payload: {} },
	{ channel: 'claude:error', type: 'error', payload: { error: 'Test error' } },
	{ channel: 'system:input', type: 'input', payload: { data: 'User input' } },

	// Legacy type-based
	{ type: 'claude:message', payload: { text: 'Legacy message' } },
	{ type: 'claude:auth_start', payload: { url: 'https://auth.example.com' } },
	{ type: 'claude:auth_awaiting_code', payload: {} },
	{ type: 'claude:auth_success', payload: {} },
	{ type: 'claude:auth_error', payload: { error: 'Auth failed' } },
	{ type: 'claude:tool_use', payload: {} },
	{ type: 'claude:tool_result', payload: {} },
	{ type: 'claude:thinking', payload: {} },
	{ type: 'claude:error', payload: { error: 'Legacy error' } }
];

console.log('Testing event handlers...\n');

let passCount = 0;
let failCount = 0;

for (const event of eventTypes) {
	const eventDesc = event.channel ? event.channel + ':' + event.type : event.type;
	try {
		const action = handlers.handleEvent(event);
		if (action) {
			console.log('✓ ' + eventDesc.padEnd(35) + ' -> ' + action.type);
			passCount++;
		} else {
			console.log('✗ ' + eventDesc.padEnd(35) + ' -> no action returned');
			failCount++;
		}
	} catch (error) {
		console.log('✗ ' + eventDesc.padEnd(35) + ' -> ERROR: ' + error.message);
		failCount++;
	}
}

console.log('\n' + passCount + ' passed, ' + failCount + ' failed');
process.exit(failCount > 0 ? 1 : 0);
