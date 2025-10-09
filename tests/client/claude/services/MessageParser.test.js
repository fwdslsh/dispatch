/**
 * MessageParser.test.js
 *
 * Unit tests for MessageParser service functions
 */

import { describe, it, expect } from 'vitest';
import * as MessageParser from '../../../../src/lib/client/claude/services/MessageParser.js';

describe('MessageParser', () => {
	describe('extractTextFromEvents', () => {
		it('should extract text from structured events', () => {
			const events = [
				{
					message: {
						content: [
							{ type: 'text', text: 'Hello ' },
							{ type: 'text', text: 'world' }
						]
					}
				}
			];

			const result = MessageParser.extractTextFromEvents(events);
			expect(result).toBe('Hello world');
		});

		it('should handle events without content', () => {
			const events = [{ message: {} }, { message: { content: [] } }];

			const result = MessageParser.extractTextFromEvents(events);
			expect(result).toBe('');
		});

		it('should filter out non-text blocks', () => {
			const events = [
				{
					message: {
						content: [
							{ type: 'text', text: 'Keep this' },
							{ type: 'image', data: 'ignore' },
							{ type: 'text', text: ' and this' }
						]
					}
				}
			];

			const result = MessageParser.extractTextFromEvents(events);
			expect(result).toBe('Keep this and this');
		});

		it('should return empty string for non-array input', () => {
			expect(MessageParser.extractTextFromEvents(null)).toBe('');
			expect(MessageParser.extractTextFromEvents(undefined)).toBe('');
			// @ts-expect-error - Testing invalid input type
			expect(MessageParser.extractTextFromEvents('not an array')).toBe('');
		});
	});

	describe('extractMessageText', () => {
		it('should extract text from structured payload with events', () => {
			const payload = {
				events: [
					{
						message: {
							content: [{ type: 'text', text: 'Test message' }]
						}
					}
				]
			};

			const result = MessageParser.extractMessageText(payload);
			expect(result).toBe('Test message');
		});

		it('should fallback to direct text property', () => {
			const payload = { text: 'Fallback text' };

			const result = MessageParser.extractMessageText(payload);
			expect(result).toBe('Fallback text');
		});

		it('should fallback to content property', () => {
			const payload = { content: 'Content text' };

			const result = MessageParser.extractMessageText(payload);
			expect(result).toBe('Content text');
		});

		it('should prefer events over fallback properties', () => {
			const payload = {
				events: [
					{
						message: {
							content: [{ type: 'text', text: 'Events text' }]
						}
					}
				],
				text: 'Fallback text'
			};

			const result = MessageParser.extractMessageText(payload);
			expect(result).toBe('Events text');
		});

		it('should return empty string for invalid payload', () => {
			expect(MessageParser.extractMessageText(null)).toBe('');
			expect(MessageParser.extractMessageText(undefined)).toBe('');
			expect(MessageParser.extractMessageText({})).toBe('');
		});
	});

	describe('createMessage', () => {
		const mockIdGenerator = () => 'test-id-123';

		it('should create a valid user message', () => {
			const message = MessageParser.createMessage('Hello', 'user', mockIdGenerator);

			expect(message).toMatchObject({
				role: 'user',
				text: 'Hello',
				id: 'test-id-123'
			});
			expect(message.timestamp).toBeInstanceOf(Date);
		});

		it('should create a valid assistant message', () => {
			const message = MessageParser.createMessage('Response', 'assistant', mockIdGenerator);

			expect(message).toMatchObject({
				role: 'assistant',
				text: 'Response',
				id: 'test-id-123'
			});
		});

		it('should use provided timestamp', () => {
			const customTimestamp = new Date('2024-01-01');
			const message = MessageParser.createMessage('Text', 'user', mockIdGenerator, customTimestamp);

			expect(message.timestamp).toBe(customTimestamp);
		});

		it('should return null for empty text', () => {
			expect(MessageParser.createMessage('', 'user', mockIdGenerator)).toBeNull();
			expect(MessageParser.createMessage(null, 'user', mockIdGenerator)).toBeNull();
		});

		it('should return null for invalid role', () => {
			expect(MessageParser.createMessage('Text', 'invalid', mockIdGenerator)).toBeNull();
			expect(MessageParser.createMessage('Text', null, mockIdGenerator)).toBeNull();
		});

		it('should use fallback ID generator if not provided', () => {
			// @ts-expect-error - Testing fallback behavior with missing optional parameter
			const message = MessageParser.createMessage('Text', 'user');
			expect(message.id).toBeDefined();
			expect(typeof message.id).toBe('string');
		});
	});

	describe('parseUserInput', () => {
		it('should extract from data property', () => {
			const payload = { data: 'User typed this' };
			expect(MessageParser.parseUserInput(payload)).toBe('User typed this');
		});

		it('should fallback to text property', () => {
			const payload = { text: 'User text' };
			expect(MessageParser.parseUserInput(payload)).toBe('User text');
		});

		it('should prefer data over text', () => {
			const payload = { data: 'Data value', text: 'Text value' };
			expect(MessageParser.parseUserInput(payload)).toBe('Data value');
		});

		it('should return empty string for invalid payload', () => {
			expect(MessageParser.parseUserInput(null)).toBe('');
			expect(MessageParser.parseUserInput(undefined)).toBe('');
			expect(MessageParser.parseUserInput({})).toBe('');
		});
	});

	describe('parseErrorMessage', () => {
		it('should extract from error property', () => {
			const payload = { error: 'Something failed' };
			expect(MessageParser.parseErrorMessage(payload)).toBe('Something failed');
		});

		it('should extract from message property', () => {
			const payload = { message: 'Error message' };
			expect(MessageParser.parseErrorMessage(payload)).toBe('Error message');
		});

		it('should extract from nested events array', () => {
			const payload = {
				events: [{ error: 'Nested error' }]
			};
			expect(MessageParser.parseErrorMessage(payload)).toBe('Nested error');
		});

		it('should prefer error property over message', () => {
			const payload = { error: 'Error prop', message: 'Message prop' };
			expect(MessageParser.parseErrorMessage(payload)).toBe('Error prop');
		});

		it('should return default message for invalid payload', () => {
			expect(MessageParser.parseErrorMessage(null)).toBe('An error occurred');
			expect(MessageParser.parseErrorMessage(undefined)).toBe('An error occurred');
			expect(MessageParser.parseErrorMessage({})).toBe('An error occurred');
		});
	});

	describe('normalizeMessage', () => {
		const mockIdGenerator = () => 'normalized-id';

		it('should normalize a valid message', () => {
			const raw = {
				text: 'Message text',
				timestamp: Date.now()
			};

			const normalized = MessageParser.normalizeMessage(raw, 'user', mockIdGenerator);

			expect(normalized).toMatchObject({
				role: 'user',
				text: 'Message text',
				id: 'normalized-id'
			});
			expect(normalized.timestamp).toBeInstanceOf(Date);
		});

		it('should create timestamp if not provided', () => {
			const raw = { text: 'Text' };
			const normalized = MessageParser.normalizeMessage(raw, 'assistant', mockIdGenerator);

			expect(normalized.timestamp).toBeInstanceOf(Date);
		});

		it('should return null for invalid input', () => {
			expect(MessageParser.normalizeMessage(null, 'user', mockIdGenerator)).toBeNull();
			expect(MessageParser.normalizeMessage({ text: '' }, 'user', mockIdGenerator)).toBeNull();
			expect(
				MessageParser.normalizeMessage({ text: 'Valid' }, 'invalid', mockIdGenerator)
			).toBeNull();
		});

		it('should use fallback ID generator', () => {
			const raw = { text: 'Text' };
			// @ts-expect-error - Testing fallback behavior with missing optional parameter
			const normalized = MessageParser.normalizeMessage(raw, 'user');

			expect(normalized.id).toBeDefined();
			expect(typeof normalized.id).toBe('string');
		});
	});
});
