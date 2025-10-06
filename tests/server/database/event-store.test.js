/**
 * Unit tests for EventStore
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventStore } from '$lib/server/database/EventStore.js';
import { DatabaseManager } from '$lib/server/database/DatabaseManager.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('EventStore', () => {
	let tempDir;
	let db;
	let eventStore;

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), 'dispatch-test-'));
		const dbPath = join(tempDir, 'test.db');
		db = new DatabaseManager({ dbPath });
		await db.init();
		eventStore = new EventStore(db);
	});

	afterEach(async () => {
		if (db) {
			await db.close();
		}
		if (tempDir) {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	describe('append', () => {
		it('should append event with sequence number 0 for new session', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'Hello World' }
			};

			const result = await eventStore.append('session-1', event);

			expect(result.seq).toBe(0);
			expect(result.channel).toBe('pty:stdout');
			expect(result.type).toBe('chunk');
			expect(result.payload).toEqual({ data: 'Hello World' });
			expect(result.timestamp).toBeDefined();
		});

		it('should increment sequence number for subsequent events', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			const result1 = await eventStore.append('session-1', event);
			const result2 = await eventStore.append('session-1', event);
			const result3 = await eventStore.append('session-1', event);

			expect(result1.seq).toBe(0);
			expect(result2.seq).toBe(1);
			expect(result3.seq).toBe(2);
		});

		it('should handle binary payload (Uint8Array)', async () => {
			const binaryData = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: binaryData
			};

			const result = await eventStore.append('session-1', event);

			expect(result.seq).toBe(0);
			expect(result.payload).toBeInstanceOf(Uint8Array);
		});

		it('should handle JSON payload', async () => {
			const event = {
				channel: 'claude:delta',
				type: 'text',
				payload: { text: 'Hello', model: 'claude-3-5-sonnet-20241022' }
			};

			const result = await eventStore.append('session-1', event);

			expect(result.payload).toEqual({ text: 'Hello', model: 'claude-3-5-sonnet-20241022' });
		});

		it('should support concurrent appends to different sessions', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			const [result1, result2, result3] = await Promise.all([
				eventStore.append('session-1', event),
				eventStore.append('session-2', event),
				eventStore.append('session-3', event)
			]);

			expect(result1.seq).toBe(0);
			expect(result2.seq).toBe(0);
			expect(result3.seq).toBe(0);
		});

		it('should throw error if sequence counter cleared during append', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			// First append to initialize sequence
			await eventStore.append('session-1', event);

			// Spy on get to simulate clearSequence being called
			const originalGet = eventStore['#sequences'].get.bind(eventStore['#sequences']);
			vi.spyOn(eventStore['#sequences'], 'get').mockImplementation((sessionId) => {
				// Simulate clearSequence being called during append
				eventStore.clearSequence(sessionId);
				return undefined;
			});

			await expect(eventStore.append('session-1', event)).rejects.toThrow(
				'Sequence counter was cleared during append'
			);

			vi.restoreAllMocks();
		});
	});

	describe('sequence initialization with concurrent appends', () => {
		it('should handle concurrent initialization gracefully', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			// Simulate multiple concurrent appends to a new session
			const promises = Array.from({ length: 10 }, () => eventStore.append('session-1', event));

			const results = await Promise.all(promises);

			// All should succeed with sequential sequence numbers
			const seqs = results.map((r) => r.seq);
			expect(seqs.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
		});
	});

	describe('getEvents', () => {
		beforeEach(async () => {
			// Seed some events
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);
		});

		it('should retrieve all events when fromSeq is 0', async () => {
			const events = await eventStore.getEvents('session-1', 0);

			expect(events).toHaveLength(3);
			expect(events[0].seq).toBe(0);
			expect(events[1].seq).toBe(1);
			expect(events[2].seq).toBe(2);
		});

		it('should retrieve events after specified sequence', async () => {
			const events = await eventStore.getEvents('session-1', 1);

			expect(events).toHaveLength(2);
			expect(events[0].seq).toBe(1);
			expect(events[1].seq).toBe(2);
		});

		it('should return empty array when no events after sequence', async () => {
			const events = await eventStore.getEvents('session-1', 10);

			expect(events).toEqual([]);
		});

		it('should return empty array for non-existent session', async () => {
			const events = await eventStore.getEvents('non-existent', 0);

			expect(events).toEqual([]);
		});

		it('should parse event payload correctly', async () => {
			const events = await eventStore.getEvents('session-1', 0);

			expect(events[0].payload).toEqual({ data: 'test' });
			expect(events[0].channel).toBe('pty:stdout');
			expect(events[0].type).toBe('chunk');
		});

		it('should include sessionId and runId in returned events', async () => {
			const events = await eventStore.getEvents('session-1', 0);

			expect(events[0].sessionId).toBe('session-1');
			expect(events[0].runId).toBe('session-1');
		});
	});

	describe('getAllEvents', () => {
		it('should retrieve all events for session', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);

			const events = await eventStore.getAllEvents('session-1');

			expect(events).toHaveLength(3);
			expect(events[0].seq).toBe(0);
			expect(events[2].seq).toBe(2);
		});

		it('should return empty array for session with no events', async () => {
			const events = await eventStore.getAllEvents('session-1');

			expect(events).toEqual([]);
		});
	});

	describe('getLatestSeq', () => {
		it('should return 0 for new session with no events', async () => {
			const latestSeq = await eventStore.getLatestSeq('session-1');

			expect(latestSeq).toBe(0);
		});

		it('should return highest sequence number for session with events', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);

			const latestSeq = await eventStore.getLatestSeq('session-1');

			expect(latestSeq).toBe(2);
		});
	});

	describe('getEventCount', () => {
		it('should return 0 for new session', async () => {
			const count = await eventStore.getEventCount('session-1');

			expect(count).toBe(0);
		});

		it('should return correct count for session with events', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);

			const count = await eventStore.getEventCount('session-1');

			expect(count).toBe(3);
		});
	});

	describe('deleteEvents', () => {
		it('should delete all events for session', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);

			await eventStore.deleteEvents('session-1');

			const events = await eventStore.getAllEvents('session-1');
			expect(events).toEqual([]);
		});

		it('should not affect other sessions', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			await eventStore.append('session-1', event);
			await eventStore.append('session-2', event);

			await eventStore.deleteEvents('session-1');

			const events1 = await eventStore.getAllEvents('session-1');
			const events2 = await eventStore.getAllEvents('session-2');

			expect(events1).toEqual([]);
			expect(events2).toHaveLength(1);
		});

		it('should not throw when deleting events for non-existent session', async () => {
			await expect(eventStore.deleteEvents('non-existent')).resolves.not.toThrow();
		});
	});

	describe('clearSequence', () => {
		it('should clear sequence counter for session', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			await eventStore.append('session-1', event);
			await eventStore.append('session-1', event);

			eventStore.clearSequence('session-1');

			// Next append should re-initialize from database (seq should be 2)
			const result = await eventStore.append('session-1', event);
			expect(result.seq).toBe(2);
		});

		it('should not affect other sessions', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			await eventStore.append('session-1', event);
			await eventStore.append('session-2', event);

			eventStore.clearSequence('session-1');

			const result2 = await eventStore.append('session-2', event);
			expect(result2.seq).toBe(1); // Should continue from 1, not reset
		});

		it('should not throw for non-existent session', () => {
			expect(() => eventStore.clearSequence('non-existent')).not.toThrow();
		});
	});

	describe('error handling', () => {
		it('should throw error with clear message on database failure', async () => {
			// Close database to simulate failure
			await db.close();

			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			await expect(eventStore.append('session-1', event)).rejects.toThrow();
		});
	});

	describe('payload encoding', () => {
		it('should handle complex nested JSON payloads', async () => {
			const event = {
				channel: 'claude:delta',
				type: 'text',
				payload: {
					text: 'Hello',
					metadata: {
						model: 'claude-3-5-sonnet-20241022',
						nested: {
							deep: { value: 'test' }
						}
					},
					array: [1, 2, 3]
				}
			};

			await eventStore.append('session-1', event);

			const events = await eventStore.getAllEvents('session-1');
			expect(events[0].payload).toEqual(event.payload);
		});

		it('should handle empty payload', async () => {
			const event = {
				channel: 'system',
				type: 'marker',
				payload: {}
			};

			await eventStore.append('session-1', event);

			const events = await eventStore.getAllEvents('session-1');
			expect(events[0].payload).toEqual({});
		});

		it('should handle null values in payload', async () => {
			const event = {
				channel: 'test',
				type: 'data',
				payload: { value: null, nested: { key: null } }
			};

			await eventStore.append('session-1', event);

			const events = await eventStore.getAllEvents('session-1');
			expect(events[0].payload.value).toBeNull();
			expect(events[0].payload.nested.key).toBeNull();
		});
	});

	describe('concurrent operations', () => {
		it('should handle rapid sequential appends correctly', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			// Sequential appends as fast as possible
			const results = [];
			for (let i = 0; i < 100; i++) {
				results.push(await eventStore.append('session-1', event));
			}

			// Verify all sequence numbers are unique and sequential
			const seqs = results.map((r) => r.seq);
			expect(seqs).toEqual(Array.from({ length: 100 }, (_, i) => i));
		});

		it('should handle concurrent appends to same session', async () => {
			const event = {
				channel: 'pty:stdout',
				type: 'chunk',
				payload: { data: 'test' }
			};

			// Concurrent appends to same session
			const promises = Array.from({ length: 50 }, () => eventStore.append('session-1', event));

			const results = await Promise.all(promises);

			// All sequence numbers should be unique
			const seqs = results.map((r) => r.seq);
			const uniqueSeqs = [...new Set(seqs)];
			expect(uniqueSeqs.length).toBe(50);
			expect(seqs.sort((a, b) => a - b)).toEqual(Array.from({ length: 50 }, (_, i) => i));
		});
	});
});
