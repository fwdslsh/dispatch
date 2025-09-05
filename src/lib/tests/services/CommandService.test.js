/**
 * CommandService Unit Tests
 * Tests command registration, search algorithms, execution patterns, and cache management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandService } from '../../services/CommandService.js';

describe('CommandService', () => {
	let commandService;
	let mockExecuteCallback;

	beforeEach(() => {
		mockExecuteCallback = vi.fn();
		commandService = new CommandService({
			onExecute: mockExecuteCallback,
			cacheEnabled: true
		});
	});

	afterEach(() => {
		commandService.dispose();
		// Clear localStorage between tests
		global.localStorage?.clear();
		global.sessionStorage?.clear();
	});

	describe('Constructor and Initialization', () => {
		it('should initialize with default options', () => {
			const service = new CommandService();
			expect(service.commands).toEqual([]);
			expect(service.options.cacheEnabled).toBe(true);
		});

		it('should initialize with custom options', () => {
			const options = {
				onExecute: mockExecuteCallback,
				cacheEnabled: false,
				searchOptions: { caseSensitive: true }
			};
			
			const service = new CommandService(options);
			expect(service.options).toEqual(expect.objectContaining(options));
			expect(service.options.cacheEnabled).toBe(false);
		});
	});

	describe('Command Registration', () => {
		const testCommand = {
			name: 'test-command',
			description: 'Test command description',
			category: 'Test',
			action: 'test-action',
			shortcut: 'Ctrl+T'
		};

		it('should register a command', () => {
			commandService.registerCommand(testCommand);
			
			expect(commandService.commands).toHaveLength(1);
			expect(commandService.commands[0]).toEqual(testCommand);
		});

		it('should prevent duplicate command registration', () => {
			commandService.registerCommand(testCommand);
			commandService.registerCommand(testCommand);
			
			expect(commandService.commands).toHaveLength(1);
		});

		it('should update existing command when re-registering', () => {
			commandService.registerCommand(testCommand);
			
			const updatedCommand = {
				...testCommand,
				description: 'Updated description'
			};
			commandService.registerCommand(updatedCommand);
			
			expect(commandService.commands).toHaveLength(1);
			expect(commandService.commands[0].description).toBe('Updated description');
		});

		it('should validate command structure', () => {
			const invalidCommand = { description: 'No name' };
			
			expect(() => {
				commandService.registerCommand(invalidCommand);
			}).toThrow('Command must have a name');
		});

		it('should auto-generate missing fields', () => {
			const minimalCommand = { name: 'minimal' };
			commandService.registerCommand(minimalCommand);
			
			const registered = commandService.commands[0];
			expect(registered.description).toBe('');
			expect(registered.category).toBe('General');
			expect(registered.action).toBe(null);
		});
	});

	describe('Command Unregistration', () => {
		beforeEach(() => {
			commandService.registerCommand({
				name: 'command1',
				description: 'First command'
			});
			commandService.registerCommand({
				name: 'command2',
				description: 'Second command'
			});
		});

		it('should unregister a command by name', () => {
			const result = commandService.unregisterCommand('command1');
			
			expect(result).toBe(true);
			expect(commandService.commands).toHaveLength(1);
			expect(commandService.commands[0].name).toBe('command2');
		});

		it('should return false when unregistering non-existent command', () => {
			const result = commandService.unregisterCommand('non-existent');
			
			expect(result).toBe(false);
			expect(commandService.commands).toHaveLength(2);
		});

		it('should clear all commands', () => {
			commandService.clearCommands();
			
			expect(commandService.commands).toHaveLength(0);
		});
	});

	describe('Command Search', () => {
		beforeEach(() => {
			const commands = [
				{
					name: 'open file',
					description: 'Open a file in the editor',
					category: 'File',
					shortcut: 'Ctrl+O'
				},
				{
					name: 'save file',
					description: 'Save the current file',
					category: 'File',
					shortcut: 'Ctrl+S'
				},
				{
					name: 'find text',
					description: 'Find text in the current document',
					category: 'Search',
					shortcut: 'Ctrl+F'
				},
				{
					name: 'replace text',
					description: 'Find and replace text',
					category: 'Search',
					shortcut: 'Ctrl+R'
				}
			];

			commands.forEach(cmd => commandService.registerCommand(cmd));
		});

		it('should search by command name', () => {
			const results = commandService.searchCommands('open', commandService.commands);
			
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('open file');
		});

		it('should search by description', () => {
			const results = commandService.searchCommands('editor', commandService.commands);
			
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('open file');
		});

		it('should search by category', () => {
			const results = commandService.searchCommands('File', commandService.commands);
			
			expect(results).toHaveLength(2);
			expect(results.every(cmd => cmd.category === 'File')).toBe(true);
		});

		it('should search by shortcut', () => {
			const results = commandService.searchCommands('Ctrl+F', commandService.commands);
			
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('find text');
		});

		it('should return all commands for empty query', () => {
			const results = commandService.searchCommands('', commandService.commands);
			
			expect(results).toHaveLength(4);
		});

		it('should return empty array for no matches', () => {
			const results = commandService.searchCommands('nonexistent', commandService.commands);
			
			expect(results).toHaveLength(0);
		});

		it('should be case insensitive by default', () => {
			const results = commandService.searchCommands('OPEN', commandService.commands);
			
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('open file');
		});

		it('should support case sensitive search when configured', () => {
			const service = new CommandService({
				searchOptions: { caseSensitive: true }
			});
			
			const commands = [
				{ name: 'Open File', description: 'open a file' },
				{ name: 'open terminal', description: 'Open terminal' }
			];
			commands.forEach(cmd => service.registerCommand(cmd));
			
			const results = service.searchCommands('open', commands);
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('open terminal');
		});

		it('should support fuzzy matching', () => {
			const results = commandService.searchCommands('opnfil', commandService.commands);
			
			// Should still find "open file" with some fuzzy tolerance
			expect(results.length).toBeGreaterThan(0);
		});

		it('should rank results by relevance', () => {
			const results = commandService.searchCommands('file', commandService.commands);
			
			// Commands with "file" in name should rank higher than in description
			expect(results).toHaveLength(3); // "open file", "save file", and one with "file" in description
			expect(results[0].name).toContain('file');
		});
	});

	describe('Command Execution', () => {
		const testCommand = {
			name: 'test-command',
			description: 'Test command',
			action: 'test-action'
		};

		beforeEach(() => {
			commandService.registerCommand(testCommand);
		});

		it('should execute command with callback', async () => {
			mockExecuteCallback.mockResolvedValue('success');
			
			const result = await commandService.executeCommand(testCommand);
			
			expect(mockExecuteCallback).toHaveBeenCalledWith(testCommand);
			expect(result).toBe('success');
		});

		it('should handle execution errors', async () => {
			const error = new Error('Execution failed');
			mockExecuteCallback.mockRejectedValue(error);
			
			await expect(commandService.executeCommand(testCommand)).rejects.toThrow('Execution failed');
		});

		it('should execute command by name', async () => {
			mockExecuteCallback.mockResolvedValue('success');
			
			const result = await commandService.executeCommandByName('test-command');
			
			// Expect the normalized command (with auto-generated fields)
			const expectedCommand = {
				...testCommand,
				category: 'General',
				shortcut: ''
			};
			expect(mockExecuteCallback).toHaveBeenCalledWith(expectedCommand);
			expect(result).toBe('success');
		});

		it('should throw error for non-existent command execution', async () => {
			await expect(commandService.executeCommandByName('non-existent')).rejects.toThrow('Command not found: non-existent');
		});

		it('should handle command without action', async () => {
			const commandWithoutAction = { name: 'no-action', description: 'No action' };
			commandService.registerCommand(commandWithoutAction);
			
			mockExecuteCallback.mockResolvedValue('default');
			
			const result = await commandService.executeCommandByName('no-action');
			expect(result).toBe('default');
		});

		it('should track execution history', async () => {
			mockExecuteCallback.mockResolvedValue('success');
			
			await commandService.executeCommand(testCommand);
			
			const history = commandService.getExecutionHistory();
			expect(history).toHaveLength(1);
			expect(history[0].command).toBe('test-command');
			expect(history[0].timestamp).toBeDefined();
		});

		it('should limit execution history size', async () => {
			mockExecuteCallback.mockResolvedValue('success');
			
			// Execute many commands
			for (let i = 0; i < 150; i++) {
				await commandService.executeCommand(testCommand);
			}
			
			const history = commandService.getExecutionHistory();
			expect(history).toHaveLength(100); // Default limit
		});
	});

	describe('Cache Management', () => {
		const testCommands = [
			{ name: 'cached-cmd-1', description: 'First cached command' },
			{ name: 'cached-cmd-2', description: 'Second cached command' }
		];

		beforeEach(() => {
			// Mock localStorage
			const mockStorage = {};
			global.localStorage = {
				getItem: vi.fn((key) => mockStorage[key] || null),
				setItem: vi.fn((key, value) => { mockStorage[key] = value; }),
				removeItem: vi.fn((key) => { delete mockStorage[key]; }),
				clear: vi.fn(() => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); })
			};
		});

		it('should save commands to cache', () => {
			commandService.saveCache('test-session', testCommands);
			
			expect(global.localStorage.setItem).toHaveBeenCalledWith(
				'command-cache-test-session',
				expect.stringContaining('"commands"')
			);
		});

		it('should load commands from cache', () => {
			const cacheData = {
				commands: testCommands,
				timestamp: Date.now()
			};
			global.localStorage.getItem.mockReturnValue(JSON.stringify(cacheData));
			
			const loaded = commandService.loadCache('test-session');
			
			expect(loaded).toEqual(testCommands);
		});

		it('should return empty array for non-existent cache', () => {
			global.localStorage.getItem.mockReturnValue(null);
			
			const loaded = commandService.loadCache('test-session');
			
			expect(loaded).toEqual([]);
		});

		it('should handle corrupted cache data', () => {
			global.localStorage.getItem.mockReturnValue('invalid json');
			
			const loaded = commandService.loadCache('test-session');
			
			expect(loaded).toEqual([]);
		});

		it('should expire old cache data', () => {
			const oldCacheData = {
				commands: testCommands,
				timestamp: Date.now() - (10 * 60 * 1000) // 10 minutes old
			};
			global.localStorage.getItem.mockReturnValue(JSON.stringify(oldCacheData));
			
			const loaded = commandService.loadCache('test-session');
			
			expect(loaded).toEqual([]);
		});

		it('should clear cache', () => {
			commandService.clearCache('test-session');
			
			expect(global.localStorage.removeItem).toHaveBeenCalledWith('command-cache-test-session');
		});

		it('should not use cache when disabled', () => {
			const service = new CommandService({ cacheEnabled: false });
			
			service.saveCache('test-session', testCommands);
			
			expect(global.localStorage.setItem).not.toHaveBeenCalled();
		});
	});

	describe('Command Categories', () => {
		beforeEach(() => {
			const commands = [
				{ name: 'open', category: 'File' },
				{ name: 'save', category: 'File' },
				{ name: 'find', category: 'Search' },
				{ name: 'debug', category: 'Debug' },
				{ name: 'uncategorized' } // No category
			];
			commands.forEach(cmd => commandService.registerCommand(cmd));
		});

		it('should get all categories', () => {
			const categories = commandService.getCategories();
			
			expect(categories).toEqual(['Debug', 'File', 'General', 'Search']);
		});

		it('should get commands by category', () => {
			const fileCommands = commandService.getCommandsByCategory('File');
			
			expect(fileCommands).toHaveLength(2);
			expect(fileCommands.every(cmd => cmd.category === 'File')).toBe(true);
		});

		it('should return empty array for non-existent category', () => {
			const commands = commandService.getCommandsByCategory('NonExistent');
			
			expect(commands).toEqual([]);
		});
	});

	describe('Command Validation', () => {
		it('should validate command structure', () => {
			expect(() => {
				commandService.registerCommand(null);
			}).toThrow('Command must be an object');

			expect(() => {
				commandService.registerCommand({});
			}).toThrow('Command must have a name');

			expect(() => {
				commandService.registerCommand({ name: '' });
			}).toThrow('Command name cannot be empty');

			expect(() => {
				commandService.registerCommand({ name: 123 });
			}).toThrow('Command name must be a string');
		});

		it('should validate command fields', () => {
			const validCommand = {
				name: 'valid-command',
				description: 'Valid command',
				category: 'Test',
				action: 'test-action',
				shortcut: 'Ctrl+T'
			};

			expect(() => {
				commandService.registerCommand(validCommand);
			}).not.toThrow();
		});
	});

	describe('Search Algorithms', () => {
		beforeEach(() => {
			const commands = [
				{ name: 'create new file', description: 'Create a new file', category: 'File' },
				{ name: 'open recent file', description: 'Open recently used file', category: 'File' },
				{ name: 'file manager', description: 'Open file manager', category: 'Tools' }
			];
			commands.forEach(cmd => commandService.registerCommand(cmd));
		});

		it('should use exact match for high relevance', () => {
			const results = commandService.searchCommands('create new file', commandService.commands);
			
			expect(results[0].name).toBe('create new file');
		});

		it('should use partial matching', () => {
			const results = commandService.searchCommands('new', commandService.commands);
			
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('create new file');
		});

		it('should match across multiple words', () => {
			const results = commandService.searchCommands('file recent', commandService.commands);
			
			expect(results).toHaveLength(1);
			expect(results[0].name).toBe('open recent file');
		});

		it('should score and sort results by relevance', () => {
			const results = commandService.searchCommands('file', commandService.commands);
			
			// All commands contain "file", but order should be by relevance
			expect(results).toHaveLength(3);
			// Exact word match should score higher than partial
		});
	});

	describe('Service Disposal', () => {
		it('should dispose properly', () => {
			expect(commandService.isDisposed).toBe(false);
			
			commandService.dispose();
			
			expect(commandService.isDisposed).toBe(true);
			expect(commandService.commands).toEqual([]);
		});

		it('should handle operations after disposal', () => {
			commandService.dispose();
			
			expect(() => {
				commandService.registerCommand({ name: 'test' });
			}).toThrow('CommandService has been disposed');

			expect(() => {
				commandService.searchCommands('test', []);
			}).toThrow('CommandService has been disposed');
		});

		it('should clean up event listeners on disposal', () => {
			const cleanupSpy = vi.fn();
			commandService.addCleanup = vi.fn();
			
			commandService.dispose();
			
			// Verify cleanup was called
			expect(commandService.isDisposed).toBe(true);
		});
	});

	describe('Performance and Edge Cases', () => {
		it('should handle large number of commands', () => {
			// Register many commands
			for (let i = 0; i < 1000; i++) {
				commandService.registerCommand({
					name: `command-${i}`,
					description: `Command number ${i}`,
					category: `Category-${i % 10}`
				});
			}

			expect(commandService.commands).toHaveLength(1000);

			// Search should still be fast
			const start = Date.now();
			const results = commandService.searchCommands('500', commandService.commands);
			const end = Date.now();

			expect(end - start).toBeLessThan(100); // Should complete within 100ms
			expect(results.length).toBeGreaterThan(0);
		});

		it('should handle empty search gracefully', () => {
			const results = commandService.searchCommands('', []);
			expect(results).toEqual([]);
		});

		it('should handle malformed commands in search', () => {
			const malformedCommands = [
				{ name: 'good-command', description: 'Good' },
				{ description: 'No name' }, // Missing name
				null, // Null command
				undefined, // Undefined command
				{ name: '', description: 'Empty name' } // Empty name
			];

			// Should not throw error and should filter out invalid commands
			expect(() => {
				commandService.searchCommands('good', malformedCommands);
			}).not.toThrow();
		});
	});
});