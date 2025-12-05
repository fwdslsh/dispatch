import { describe, expect, it, beforeEach } from 'vitest';
import { WebViewAdapter } from '../../src/lib/server/web-view/WebViewAdapter.js';

describe('WebViewAdapter', () => {
	let adapter;
	let capturedEvents;
	let instance;

	beforeEach(async () => {
		capturedEvents = [];
		adapter = new WebViewAdapter();
		instance = await adapter.create({
			cwd: '/tmp',
			onEvent: (event) => capturedEvents.push(event)
		});
	});

	describe('initialization', () => {
		it('should create an instance with correct kind', async () => {
			expect(instance.kind).toBe('web-view');
		});

		it('should emit initialization event', () => {
			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:system');
			expect(capturedEvents[0].type).toBe('initialized');
			expect(capturedEvents[0].payload).toHaveProperty('cwd');
			expect(capturedEvents[0].payload).toHaveProperty('timestamp');
		});

		it('should initialize with empty current URL', async () => {
			const proc = instance.getProcess();
			expect(proc.currentUrl).toBe('');
		});

		it('should be alive after creation', () => {
			expect(instance.isAlive()).toBe(true);
		});
	});

	describe('navigation via JSON command', () => {
		it('should handle valid HTTP URL navigation', () => {
			const url = 'http://localhost:5173';
			const command = JSON.stringify({ type: 'navigate', url });

			capturedEvents = []; // Clear init event
			instance.input.write(command);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:navigation');
			expect(capturedEvents[0].type).toBe('url-changed');
			expect(capturedEvents[0].payload.url).toBe(url);
		});

		it('should handle valid HTTPS URL navigation', () => {
			const url = 'https://example.com';
			const command = JSON.stringify({ type: 'navigate', url });

			capturedEvents = []; // Clear init event
			instance.input.write(command);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].payload.url).toBe(url);
		});

		it('should reject invalid protocols', () => {
			const url = 'javascript:alert("xss")';
			const command = JSON.stringify({ type: 'navigate', url });

			capturedEvents = []; // Clear init event
			instance.input.write(command);

			// Should emit error event instead of navigation
			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:error');
			expect(capturedEvents[0].type).toBe('error');
		});

		it('should reject file:// protocol', () => {
			const url = 'file:///etc/passwd';
			const command = JSON.stringify({ type: 'navigate', url });

			capturedEvents = []; // Clear init event
			instance.input.write(command);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:error');
		});

		it('should reject data: protocol', () => {
			const url = 'data:text/html,<script>alert("xss")</script>';
			const command = JSON.stringify({ type: 'navigate', url });

			capturedEvents = []; // Clear init event
			instance.input.write(command);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:error');
		});

		it('should handle navigation with query parameters', () => {
			const url = 'http://localhost:3000/path?param=value&foo=bar';
			const command = JSON.stringify({ type: 'navigate', url });

			capturedEvents = []; // Clear init event
			instance.input.write(command);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].payload.url).toBe(url);
		});

		it('should validate command structure', () => {
			const invalidCommand = JSON.stringify({ type: 'navigate' }); // Missing url

			capturedEvents = []; // Clear init event
			instance.input.write(invalidCommand);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:error');
		});

		it('should handle non-string URL in command', () => {
			const invalidCommand = JSON.stringify({ type: 'navigate', url: 123 });

			capturedEvents = []; // Clear init event
			instance.input.write(invalidCommand);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:error');
		});
	});

	describe('navigation via plain text', () => {
		it('should handle plain HTTP URL', () => {
			const url = 'http://localhost:8080';

			capturedEvents = []; // Clear init event
			instance.input.write(url);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:navigation');
			// URL should be preserved as-is when it already has protocol
			expect(capturedEvents[0].payload.url).toBe(url);
		});

		it('should auto-prepend http:// to plain URLs', () => {
			const url = 'localhost:5173';

			capturedEvents = []; // Clear init event
			instance.input.write(url);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:navigation');
			expect(capturedEvents[0].payload.url).toBe('http://localhost:5173/');
		});

		it('should validate plain text URLs', () => {
			const invalidUrl = 'not a valid url at all!!!';

			capturedEvents = []; // Clear init event
			instance.input.write(invalidUrl);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:error');
		});
	});

	describe('session lifecycle', () => {
		it('should close gracefully', () => {
			capturedEvents = []; // Clear init event
			instance.close();

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:system');
			expect(capturedEvents[0].type).toBe('closed');
			expect(instance.isAlive()).toBe(false);
		});

		it('should not emit events after close', () => {
			instance.close();
			capturedEvents = []; // Clear close event

			const command = JSON.stringify({ type: 'navigate', url: 'http://localhost' });
			instance.input.write(command);

			expect(capturedEvents).toHaveLength(0);
		});

		it('should return current working directory', () => {
			expect(instance.getCwd()).toBe('/tmp');
		});
	});

	describe('edge cases', () => {
		it('should handle empty string input', () => {
			capturedEvents = []; // Clear init event
			instance.input.write('');

			// Should not emit any event for empty input
			expect(capturedEvents).toHaveLength(0);
		});

		it('should handle whitespace-only input', () => {
			capturedEvents = []; // Clear init event
			instance.input.write('   \n\t   ');

			// Should not emit any event for whitespace
			expect(capturedEvents).toHaveLength(0);
		});

		it('should handle Buffer input', () => {
			const url = 'http://localhost:3000';
			const command = JSON.stringify({ type: 'navigate', url });
			const buffer = Buffer.from(command);

			capturedEvents = []; // Clear init event
			instance.input.write(buffer);

			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].payload.url).toBe(url);
		});

		it('should handle malformed JSON gracefully', () => {
			const malformedJson = '{ type: "navigate", url: "http://localhost" '; // Missing closing brace

			capturedEvents = []; // Clear init event
			instance.input.write(malformedJson);

			// Should try to treat as plain URL and fail validation
			expect(capturedEvents).toHaveLength(1);
			expect(capturedEvents[0].channel).toBe('web-view:error');
		});
	});

	describe('URL validation', () => {
		it('should allow localhost URLs', () => {
			const urls = [
				'http://localhost',
				'http://localhost:3000',
				'https://localhost:8443',
				'http://127.0.0.1',
				'http://127.0.0.1:5173'
			];

			urls.forEach((url) => {
				capturedEvents = [];
				const command = JSON.stringify({ type: 'navigate', url });
				instance.input.write(command);

				expect(capturedEvents[0].channel).toBe('web-view:navigation');
				expect(capturedEvents[0].payload.url).toBe(url);
			});
		});

		it('should allow standard domain names', () => {
			const urls = [
				'http://example.com',
				'https://www.example.com',
				'https://sub.domain.example.com',
				'http://example.com:8080'
			];

			urls.forEach((url) => {
				capturedEvents = [];
				const command = JSON.stringify({ type: 'navigate', url });
				instance.input.write(command);

				expect(capturedEvents[0].channel).toBe('web-view:navigation');
			});
		});

		it('should allow URLs with paths and fragments', () => {
			const url = 'http://example.com/path/to/page#section';
			const command = JSON.stringify({ type: 'navigate', url });

			capturedEvents = [];
			instance.input.write(command);

			expect(capturedEvents[0].channel).toBe('web-view:navigation');
			expect(capturedEvents[0].payload.url).toBe(url);
		});
	});
});
