/**
 * CommandMenuViewModel Unit Tests
 * Tests command processing, search functionality, keyboard navigation, and state management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CommandMenuViewModel } from '../../src/lib/session-types/claude/components/CommandMenuViewModel.svelte.js';

describe('CommandMenuViewModel', () => {
	let mockModel;
	let mockCommandService;
	let mockServices;
	let viewModel;

	beforeEach(() => {
		// Mock model with command menu state
		mockModel = {
			state: {
				visible: false,
				searchQuery: '',
				selectedIndex: 0,
				filteredCommands: [],
				commands: [],
				sessionId: 'test-session',
				cacheEnabled: true
			},
			onChange: null,
			dispose: vi.fn()
		};

		// Mock command service
		mockCommandService = {
			searchCommands: vi.fn().mockReturnValue([]),
			executeCommand: vi.fn().mockResolvedValue(true),
			registerCommand: vi.fn(),
			unregisterCommand: vi.fn(),
			getCommands: vi.fn().mockReturnValue([]),
			clearCache: vi.fn(),
			loadCache: vi.fn().mockReturnValue([]),
			saveCache: vi.fn()
		};

		// Mock services
		mockServices = {
			commandService: mockCommandService,
			validationService: { validate: vi.fn() }
		};

		// Create ViewModel instance
		viewModel = new CommandMenuViewModel(mockModel, mockServices);
	});

	afterEach(() => {
		if (viewModel && !viewModel.isDisposed) {
			viewModel.dispose();
		}
	});

	describe('Constructor and Initialization', () => {
		it('should initialize with model and command service', () => {
			expect(viewModel.model).toBe(mockModel);
			expect(viewModel.services.commandService).toBe(mockCommandService);
			expect(viewModel.isDisposed).toBe(false);
		});

		it('should initialize reactive state from model', () => {
			expect(viewModel.state.visible).toBe(false);
			expect(viewModel.state.searchQuery).toBe('');
			expect(viewModel.state.selectedIndex).toBe(0);
			expect(viewModel.state.commands).toEqual([]);
		});

		it('should initialize derived state', () => {
			expect(viewModel.hasCommands).toBe(false);
			expect(viewModel.commandCount).toBe(0);
			expect(viewModel.selectedCommand).toBe(null);
		});

		it('should load cached commands on initialization', () => {
			expect(mockCommandService.loadCache).toHaveBeenCalledWith('test-session');
		});
	});

	describe('Search Functionality', () => {
		beforeEach(() => {
			const testCommands = [
				{ name: 'open file', description: 'Open a file', category: 'File' },
				{ name: 'save file', description: 'Save current file', category: 'File' },
				{ name: 'find text', description: 'Find text in file', category: 'Search' }
			];
			mockCommandService.searchCommands.mockReturnValue(testCommands.slice(0, 2));
			viewModel.state.commands = testCommands;
		});

		it('should update search query and trigger search', async () => {
			await viewModel.updateSearchQuery('file');
			
			expect(viewModel.state.searchQuery).toBe('file');
			expect(mockCommandService.searchCommands).toHaveBeenCalledWith('file', viewModel.state.commands);
			expect(viewModel.state.selectedIndex).toBe(0); // Reset to first result
		});

		it('should filter commands based on search query', async () => {
			await viewModel.updateSearchQuery('save');
			
			expect(viewModel.state.filteredCommands).toHaveLength(2);
			expect(viewModel.commandCount).toBe(2);
		});

		it('should reset search when query is empty', async () => {
			viewModel.state.searchQuery = 'test';
			await viewModel.updateSearchQuery('');
			
			expect(viewModel.state.searchQuery).toBe('');
			expect(mockCommandService.searchCommands).toHaveBeenCalledWith('', viewModel.state.commands);
		});

		it('should handle search with no results', async () => {
			mockCommandService.searchCommands.mockReturnValue([]);
			await viewModel.updateSearchQuery('nonexistent');
			
			expect(viewModel.state.filteredCommands).toHaveLength(0);
			expect(viewModel.commandCount).toBe(0);
			expect(viewModel.selectedCommand).toBe(null);
		});
	});

	describe('Keyboard Navigation', () => {
		beforeEach(() => {
			const testCommands = [
				{ name: 'command1', description: 'First command' },
				{ name: 'command2', description: 'Second command' },
				{ name: 'command3', description: 'Third command' }
			];
			viewModel.state.commands = testCommands;
			viewModel.state.filteredCommands = testCommands;
		});

		it('should select next command with selectNext', () => {
			expect(viewModel.state.selectedIndex).toBe(0);
			
			viewModel.selectNext();
			expect(viewModel.state.selectedIndex).toBe(1);
			
			viewModel.selectNext();
			expect(viewModel.state.selectedIndex).toBe(2);
		});

		it('should wrap around to first command when at end', () => {
			viewModel.state.selectedIndex = 2; // Last command
			viewModel.selectNext();
			expect(viewModel.state.selectedIndex).toBe(0);
		});

		it('should select previous command with selectPrevious', () => {
			viewModel.state.selectedIndex = 2;
			
			viewModel.selectPrevious();
			expect(viewModel.state.selectedIndex).toBe(1);
			
			viewModel.selectPrevious();
			expect(viewModel.state.selectedIndex).toBe(0);
		});

		it('should wrap around to last command when at beginning', () => {
			viewModel.state.selectedIndex = 0; // First command
			viewModel.selectPrevious();
			expect(viewModel.state.selectedIndex).toBe(2);
		});

		it('should select command by index', () => {
			viewModel.selectCommand(1);
			expect(viewModel.state.selectedIndex).toBe(1);
		});

		it('should not select invalid index', () => {
			viewModel.selectCommand(-1);
			expect(viewModel.state.selectedIndex).toBe(0);
			
			viewModel.selectCommand(10);
			expect(viewModel.state.selectedIndex).toBe(0);
		});

		it('should return correct selected command', () => {
			const testCommands = [
				{ name: 'command1', description: 'First command' },
				{ name: 'command2', description: 'Second command' }
			];
			viewModel.state.filteredCommands = testCommands;
			viewModel.state.selectedIndex = 1;
			
			expect(viewModel.selectedCommand).toEqual(testCommands[1]);
		});
	});

	describe('Command Execution', () => {
		const testCommand = { name: 'test-command', action: 'test-action' };

		it('should execute selected command', async () => {
			viewModel.state.filteredCommands = [testCommand];
			viewModel.state.selectedIndex = 0;
			
			await viewModel.executeSelected();
			
			expect(mockCommandService.executeCommand).toHaveBeenCalledWith(testCommand);
			expect(viewModel.state.visible).toBe(false); // Should hide after execution
		});

		it('should execute specific command', async () => {
			await viewModel.executeCommand(testCommand);
			
			expect(mockCommandService.executeCommand).toHaveBeenCalledWith(testCommand);
			expect(viewModel.state.visible).toBe(false);
		});

		it('should handle command execution errors', async () => {
			const error = new Error('Command execution failed');
			mockCommandService.executeCommand.mockRejectedValue(error);
			
			await viewModel.executeCommand(testCommand);
			
			expect(viewModel.error).toBe('Command execution failed');
		});

		it('should not execute if no selected command', async () => {
			viewModel.state.filteredCommands = [];
			viewModel.state.selectedIndex = 0;
			
			await viewModel.executeSelected();
			
			expect(mockCommandService.executeCommand).not.toHaveBeenCalled();
		});
	});

	describe('Menu Visibility Management', () => {
		it('should show menu and reset state', () => {
			viewModel.state.searchQuery = 'old query';
			viewModel.state.selectedIndex = 2;
			
			viewModel.show();
			
			expect(viewModel.state.visible).toBe(true);
			expect(viewModel.state.searchQuery).toBe('');
			expect(viewModel.state.selectedIndex).toBe(0);
		});

		it('should hide menu', () => {
			viewModel.state.visible = true;
			viewModel.hide();
			expect(viewModel.state.visible).toBe(false);
		});

		it('should toggle menu visibility', () => {
			expect(viewModel.state.visible).toBe(false);
			
			viewModel.toggle();
			expect(viewModel.state.visible).toBe(true);
			
			viewModel.toggle();
			expect(viewModel.state.visible).toBe(false);
		});
	});

	describe('Command Management', () => {
		const newCommands = [
			{ name: 'new-command1', description: 'New command 1' },
			{ name: 'new-command2', description: 'New command 2' }
		];

		it('should set commands and update cache', () => {
			viewModel.setCommands(newCommands);
			
			expect(viewModel.state.commands).toEqual(newCommands);
			expect(mockCommandService.saveCache).toHaveBeenCalledWith('test-session', newCommands);
		});

		it('should add individual command', () => {
			const command = { name: 'single-command', description: 'Single command' };
			viewModel.addCommand(command);
			
			expect(mockCommandService.registerCommand).toHaveBeenCalledWith(command);
			expect(viewModel.state.commands).toContain(command);
		});

		it('should remove command', () => {
			viewModel.state.commands = newCommands;
			viewModel.removeCommand('new-command1');
			
			expect(mockCommandService.unregisterCommand).toHaveBeenCalledWith('new-command1');
			expect(viewModel.state.commands).toHaveLength(1);
			expect(viewModel.state.commands[0].name).toBe('new-command2');
		});

		it('should clear all commands', () => {
			viewModel.state.commands = newCommands;
			viewModel.clearCommands();
			
			expect(viewModel.state.commands).toEqual([]);
			expect(viewModel.state.filteredCommands).toEqual([]);
		});
	});

	describe('Cache Management', () => {
		it('should load commands from cache', async () => {
			const cachedCommands = [{ name: 'cached-command' }];
			mockCommandService.loadCache.mockReturnValue(cachedCommands);
			
			await viewModel.loadFromCache();
			
			expect(viewModel.state.commands).toEqual(cachedCommands);
			expect(mockCommandService.loadCache).toHaveBeenCalledWith('test-session');
		});

		it('should save commands to cache', async () => {
			const commands = [{ name: 'save-command' }];
			viewModel.state.commands = commands;
			
			await viewModel.saveToCache();
			
			expect(mockCommandService.saveCache).toHaveBeenCalledWith('test-session', commands);
		});

		it('should clear cache', async () => {
			await viewModel.clearCache();
			
			expect(mockCommandService.clearCache).toHaveBeenCalledWith('test-session');
			expect(viewModel.state.commands).toEqual([]);
		});
	});

	describe('Derived State', () => {
		it('should correctly compute hasCommands', () => {
			expect(viewModel.hasCommands).toBe(false);
			
			// Use proper ViewModel method to update state
			viewModel.updateField('filteredCommands', [{ name: 'test' }]);
			expect(viewModel.hasCommands).toBe(true);
		});

		it('should correctly compute commandCount', () => {
			expect(viewModel.commandCount).toBe(0);
			
			// Use proper ViewModel method to update state
			viewModel.updateField('filteredCommands', [{ name: 'test1' }, { name: 'test2' }]);
			expect(viewModel.commandCount).toBe(2);
		});

		it('should correctly compute selectedCommand', () => {
			const commands = [
				{ name: 'cmd1', description: 'Command 1' },
				{ name: 'cmd2', description: 'Command 2' }
			];
			viewModel.updateField('filteredCommands', commands);
			viewModel.updateField('selectedIndex', 1);
			
			expect(viewModel.selectedCommand).toEqual(commands[1]);
		});

		it('should return null for selectedCommand when no commands', () => {
			viewModel.updateField('filteredCommands', []);
			expect(viewModel.selectedCommand).toBe(null);
		});
	});

	describe('State Management', () => {
		it('should handle loading state during command execution', async () => {
			const command = { name: 'slow-command', action: 'slow-action' };
			mockCommandService.executeCommand.mockImplementation(() => 
				new Promise(resolve => setTimeout(resolve, 100))
			);
			
			const executionPromise = viewModel.executeCommand(command);
			expect(viewModel.loading).toBe(true);
			
			await executionPromise;
			expect(viewModel.loading).toBe(false);
		});

		it('should handle errors and set error state', async () => {
			const error = new Error('Test error');
			mockCommandService.executeCommand.mockRejectedValue(error);
			
			await viewModel.executeCommand({ name: 'failing-command' });
			
			expect(viewModel.error).toBe('Test error');
			expect(viewModel.hasErrors).toBe(true);
		});

		it('should clear errors when executing successful command', async () => {
			// First set an error
			viewModel.setError('Previous error');
			expect(viewModel.error).toBe('Previous error');
			
			// Execute successful command
			await viewModel.executeCommand({ name: 'success-command' });
			
			expect(viewModel.error).toBe(null);
		});
	});

	describe('Disposal and Cleanup', () => {
		it('should dispose properly', () => {
			expect(viewModel.isDisposed).toBe(false);
			
			viewModel.dispose();
			
			expect(viewModel.isDisposed).toBe(true);
			expect(mockModel.dispose).toHaveBeenCalled();
		});

		it('should handle operations after disposal', () => {
			viewModel.dispose();
			
			// These should not throw or cause issues
			expect(() => {
				viewModel.show();
				viewModel.updateSearchQuery('test');
				viewModel.selectNext();
			}).not.toThrow();
			
			// Verify disposed state
			expect(viewModel.isDisposed).toBe(true);
		});
	});

	describe('Integration with BaseViewModel', () => {
		it('should inherit BaseViewModel functionality', () => {
			expect(viewModel.isValid).toBe(true);
			expect(viewModel.isDirty).toBe(false);
			expect(viewModel.hasErrors).toBe(false);
		});

		it('should use withLoading for async operations', async () => {
			const command = { name: 'async-command' };
			
			await viewModel.withLoading(async () => {
				return mockCommandService.executeCommand(command);
			});
			
			expect(mockCommandService.executeCommand).toHaveBeenCalledWith(command);
		});
	});
});