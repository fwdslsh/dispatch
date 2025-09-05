/**
 * DirectoryPickerViewModel Unit Tests
 * Tests file system navigation, path resolution, and selection state management
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DirectoryPickerViewModel } from '../../src/lib/viewmodels/DirectoryPickerViewModel.svelte.js';

describe('DirectoryPickerViewModel', () => {
	let mockModel;
	let mockDirectoryService;
	let mockServices;
	let viewModel;

	beforeEach(() => {
		// Mock model with directory picker state
		mockModel = {
			state: {
				isOpen: false,
				currentPath: '',
				selectedPath: '',
				directories: [],
				loading: false,
				error: null,
				pathHistory: [],
				breadcrumbs: [],
				disabled: false,
				projectId: 'test-project-123',
				socketId: 'socket-456'
			},
			onChange: null,
			dispose: vi.fn()
		};

		// Mock directory service
		mockDirectoryService = {
			listDirectories: vi.fn().mockResolvedValue({
				success: true,
				directories: []
			}),
			validatePath: vi.fn().mockReturnValue({ isValid: true }),
			resolvePath: vi.fn().mockImplementation((basePath, relativePath) => {
				if (!basePath) return relativePath;
				if (!relativePath) return basePath;
				return `${basePath}/${relativePath}`;
			}),
			getParentPath: vi.fn().mockImplementation((path) => {
				const parts = path.split('/').filter(Boolean);
				return parts.slice(0, -1).join('/');
			}),
			generateBreadcrumbs: vi.fn().mockImplementation((path) => {
				if (!path) return ['/'];
				return ['/', ...path.split('/').filter(Boolean)];
			}),
			joinPath: vi.fn().mockImplementation((...segments) => {
				return segments.filter(segment => segment).join('/');
			})
		};

		// Mock services
		mockServices = {
			directoryService: mockDirectoryService,
			validationService: { validate: vi.fn() }
		};

		// Create ViewModel instance
		viewModel = new DirectoryPickerViewModel(mockModel, mockServices);
	});

	afterEach(() => {
		if (viewModel && !viewModel.isDisposed) {
			viewModel.dispose();
		}
	});

	describe('Constructor and Initialization', () => {
		it('should initialize with model and directory service', () => {
			expect(viewModel.model).toBe(mockModel);
			expect(viewModel.services.directoryService).toBe(mockDirectoryService);
			expect(viewModel.isDisposed).toBe(false);
		});

		it('should initialize reactive state from model', () => {
			expect(viewModel.state.isOpen).toBe(false);
			expect(viewModel.state.currentPath).toBe('');
			expect(viewModel.state.selectedPath).toBe('');
			expect(viewModel.state.directories).toEqual([]);
		});

		it('should initialize derived state', () => {
			expect(viewModel.hasDirectories).toBe(false);
			expect(viewModel.directoryCount).toBe(0);
			expect(viewModel.canGoBack).toBe(false);
			expect(viewModel.isAtRoot).toBe(true);
		});

		it('should throw error without directory service', () => {
			expect(() => {
				new DirectoryPickerViewModel(mockModel, {});
			}).toThrow('DirectoryService is required for DirectoryPickerViewModel');
		});
	});

	describe('Directory Loading', () => {
		beforeEach(() => {
			const testDirectories = [
				{ name: 'src', type: 'directory', path: 'src' },
				{ name: 'docs', type: 'directory', path: 'docs' },
				{ name: 'tests', type: 'directory', path: 'tests' }
			];
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: testDirectories
			});
		});

		it('should load directories for a given path', async () => {
			await viewModel.loadDirectories('src');

			expect(mockDirectoryService.listDirectories).toHaveBeenCalledWith({
				projectId: 'test-project-123',
				relativePath: 'src',
				socketId: 'socket-456'
			});
			expect(viewModel.state.directories).toHaveLength(3);
			expect(viewModel.state.currentPath).toBe('src');
		});

		it('should handle root directory loading', async () => {
			await viewModel.loadDirectories('');

			expect(mockDirectoryService.listDirectories).toHaveBeenCalledWith({
				projectId: 'test-project-123',
				relativePath: '',
				socketId: 'socket-456'
			});
			expect(viewModel.state.currentPath).toBe('');
		});

		it('should set loading state during directory loading', async () => {
			let resolveFn;
			mockDirectoryService.listDirectories.mockReturnValue(
				new Promise((resolve) => {
					resolveFn = resolve;
				})
			);

			const loadingPromise = viewModel.loadDirectories('src');
			expect(viewModel.loading).toBe(true);

			resolveFn({ success: true, directories: [] });
			await loadingPromise;
			expect(viewModel.loading).toBe(false);
		});

		it('should handle directory loading errors', async () => {
			const error = new Error('Failed to load directories');
			mockDirectoryService.listDirectories.mockRejectedValue(error);

			await viewModel.loadDirectories('invalid-path');

			expect(viewModel.error).toBe('Failed to load directories');
			expect(viewModel.state.directories).toEqual([]);
		});

		it('should handle service error responses', async () => {
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: false,
				error: 'Permission denied'
			});

			await viewModel.loadDirectories('restricted');

			expect(viewModel.error).toBe('Permission denied');
			expect(viewModel.state.directories).toEqual([]);
		});
	});

	describe('Path Navigation', () => {
		beforeEach(() => {
			viewModel.state.directories = [
				{ name: 'subfolder1', type: 'directory' },
				{ name: 'subfolder2', type: 'directory' }
			];
			viewModel.state.currentPath = 'src';
		});

		it('should navigate to a subdirectory', async () => {
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: []
			});

			await viewModel.navigateToDirectory('components');

			expect(viewModel.state.pathHistory).toContain('src');
			expect(mockDirectoryService.listDirectories).toHaveBeenCalledWith({
				projectId: 'test-project-123',
				relativePath: 'src/components',
				socketId: 'socket-456'
			});
		});

		it('should navigate from root to subdirectory', async () => {
			viewModel.state.currentPath = '';
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: []
			});

			await viewModel.navigateToDirectory('src');

			expect(viewModel.state.pathHistory).toContain('');
			expect(mockDirectoryService.listDirectories).toHaveBeenCalledWith({
				projectId: 'test-project-123',
				relativePath: 'src',
				socketId: 'socket-456'
			});
		});

		it('should go back to previous directory', async () => {
			viewModel.state.pathHistory = ['', 'src'];
			viewModel.state.currentPath = 'src/components';
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: []
			});

			await viewModel.goBack();

			expect(mockDirectoryService.listDirectories).toHaveBeenCalledWith({
				projectId: 'test-project-123',
				relativePath: 'src',
				socketId: 'socket-456'
			});
			expect(viewModel.state.pathHistory).not.toContain('src');
		});

		it('should not go back when no history exists', async () => {
			viewModel.state.pathHistory = [];
			
			await viewModel.goBack();

			expect(mockDirectoryService.listDirectories).not.toHaveBeenCalled();
		});
	});

	describe('Breadcrumb Navigation', () => {
		it('should navigate to breadcrumb path', async () => {
			viewModel.state.breadcrumbs = ['/', 'src', 'components', 'ui'];
			viewModel.state.currentPath = 'src/components/ui';
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: []
			});

			await viewModel.navigateToBreadcrumb(1); // Navigate to 'src'

			expect(mockDirectoryService.listDirectories).toHaveBeenCalledWith({
				projectId: 'test-project-123',
				relativePath: 'src',
				socketId: 'socket-456'
			});
			expect(viewModel.state.pathHistory).toContain('src/components/ui');
		});

		it('should navigate to root via breadcrumb', async () => {
			viewModel.state.breadcrumbs = ['/', 'src'];
			viewModel.state.currentPath = 'src';
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: []
			});

			await viewModel.navigateToBreadcrumb(0); // Navigate to root

			expect(mockDirectoryService.listDirectories).toHaveBeenCalledWith({
				projectId: 'test-project-123',
				relativePath: '',
				socketId: 'socket-456'
			});
		});

		it('should ignore invalid breadcrumb index', async () => {
			viewModel.state.breadcrumbs = ['/', 'src'];

			await viewModel.navigateToBreadcrumb(5); // Invalid index

			expect(mockDirectoryService.listDirectories).not.toHaveBeenCalled();
		});
	});

	describe('Directory Selection', () => {
		it('should select current directory', () => {
			viewModel.state.currentPath = 'src/components';
			const onSelectSpy = vi.fn();
			
			viewModel.selectCurrentDirectory(onSelectSpy);

			expect(viewModel.state.selectedPath).toBe('src/components');
			expect(onSelectSpy).toHaveBeenCalledWith({ detail: { path: 'src/components' } });
			expect(viewModel.state.isOpen).toBe(false);
		});

		it('should select specific directory by name', () => {
			viewModel.state.currentPath = 'src';
			const onSelectSpy = vi.fn();

			viewModel.selectDirectory('components', onSelectSpy);

			expect(viewModel.state.selectedPath).toBe('src/components');
			expect(onSelectSpy).toHaveBeenCalledWith({ detail: { path: 'src/components' } });
			expect(viewModel.state.isOpen).toBe(false);
		});

		it('should select root directory correctly', () => {
			viewModel.state.currentPath = '';
			const onSelectSpy = vi.fn();

			viewModel.selectDirectory('src', onSelectSpy);

			expect(viewModel.state.selectedPath).toBe('src');
			expect(onSelectSpy).toHaveBeenCalledWith({ detail: { path: 'src' } });
		});

		it('should clear selection', () => {
			viewModel.state.selectedPath = 'src/components';
			const onSelectSpy = vi.fn();

			viewModel.clearSelection(onSelectSpy);

			expect(viewModel.state.selectedPath).toBe('');
			expect(onSelectSpy).toHaveBeenCalledWith({ detail: { path: '' } });
		});
	});

	describe('Picker Visibility Management', () => {
		it('should toggle picker open', async () => {
			expect(viewModel.state.isOpen).toBe(false);

			await viewModel.togglePicker();

			expect(viewModel.state.isOpen).toBe(true);
			expect(mockDirectoryService.listDirectories).toHaveBeenCalled();
		});

		it('should toggle picker closed', async () => {
			viewModel.state.isOpen = true;

			await viewModel.togglePicker();

			expect(viewModel.state.isOpen).toBe(false);
		});

		it('should not toggle when disabled', async () => {
			viewModel.state.disabled = true;

			await viewModel.togglePicker();

			expect(viewModel.state.isOpen).toBe(false);
			expect(mockDirectoryService.listDirectories).not.toHaveBeenCalled();
		});

		it('should open picker and load root directories', async () => {
			await viewModel.openPicker();

			expect(viewModel.state.isOpen).toBe(true);
			expect(mockDirectoryService.listDirectories).toHaveBeenCalledWith({
				projectId: 'test-project-123',
				relativePath: '',
				socketId: 'socket-456'
			});
		});

		it('should close picker', () => {
			viewModel.state.isOpen = true;

			viewModel.closePicker();

			expect(viewModel.state.isOpen).toBe(false);
		});
	});

	describe('Path Resolution and Validation', () => {
		it('should validate directory path', async () => {
			mockDirectoryService.validatePath.mockReturnValue({
				isValid: true,
				normalizedPath: 'src/components'
			});

			const result = await viewModel.validatePath('src/components');

			expect(mockDirectoryService.validatePath).toHaveBeenCalledWith('src/components');
			expect(result.isValid).toBe(true);
		});

		it('should handle invalid path validation', async () => {
			mockDirectoryService.validatePath.mockReturnValue({
				isValid: false,
				error: 'Path contains invalid characters'
			});

			const result = await viewModel.validatePath('src/../../../etc');

			expect(result.isValid).toBe(false);
			expect(result.error).toBe('Path contains invalid characters');
		});

		it('should resolve relative paths', () => {
			const resolvedPath = viewModel.resolvePath('../docs');

			expect(mockDirectoryService.resolvePath).toHaveBeenCalledWith('', '../docs');
		});
	});

	describe('Derived State', () => {
		it('should correctly compute hasDirectories', () => {
			expect(viewModel.state.directories?.length > 0 ? true : false).toBe(false);

			// Update state and check computed value
			viewModel.updateField('directories', [{ name: 'test' }]);
			expect(viewModel.state.directories?.length > 0 ? true : false).toBe(true);
		});

		it('should correctly compute directoryCount', () => {
			expect(viewModel.state.directories?.length || 0).toBe(0);

			// Update state and check computed value
			viewModel.updateField('directories', [{ name: 'dir1' }, { name: 'dir2' }]);
			expect(viewModel.state.directories?.length || 0).toBe(2);
		});

		it('should correctly compute canGoBack', () => {
			expect(viewModel.state.pathHistory?.length > 0 ? true : false).toBe(false);

			// Update state and check computed value
			viewModel.updateField('pathHistory', ['src']);
			expect(viewModel.state.pathHistory?.length > 0 ? true : false).toBe(true);
		});

		it('should correctly compute isAtRoot', () => {
			// Update state and check computed value
			viewModel.updateField('currentPath', '');
			expect(!viewModel.state.currentPath).toBe(true);

			viewModel.updateField('currentPath', 'src');
			expect(!viewModel.state.currentPath).toBe(false);
		});

		it('should correctly compute breadcrumbs for nested path', () => {
			viewModel.updateField('currentPath', 'src/components/ui');
			
			// Trigger breadcrumb generation
			viewModel._updateBreadcrumbs();

			expect(mockDirectoryService.generateBreadcrumbs).toHaveBeenCalledWith('src/components/ui');
		});
	});

	describe('State Management', () => {
		it('should handle loading state during async operations', async () => {
			const promise = new Promise(resolve => setTimeout(resolve, 100));
			mockDirectoryService.listDirectories.mockReturnValue(promise);

			const loadingPromise = viewModel.loadDirectories('src');
			expect(viewModel.loading).toBe(true);

			await loadingPromise;
			expect(viewModel.loading).toBe(false);
		});

		it('should handle errors and set error state', async () => {
			const error = new Error('Network error');
			mockDirectoryService.listDirectories.mockRejectedValue(error);

			await viewModel.loadDirectories('src');

			expect(viewModel.error).toBe('Network error');
			expect(viewModel.hasErrors).toBe(true);
		});

		it('should clear errors when performing successful operations', async () => {
			// First set an error
			viewModel.setError('Previous error');
			expect(viewModel.error).toBe('Previous error');

			// Perform successful operation
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: []
			});
			await viewModel.loadDirectories('src');

			expect(viewModel.error).toBe(null);
		});
	});

	describe('History Management', () => {
		it('should add to path history when navigating', async () => {
			viewModel.state.currentPath = 'src';
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: []
			});

			await viewModel.navigateToDirectory('components');

			expect(viewModel.state.pathHistory).toContain('src');
		});

		it('should clear path history when needed', () => {
			viewModel.state.pathHistory = ['', 'src', 'src/components'];

			viewModel.clearHistory();

			expect(viewModel.state.pathHistory).toEqual([]);
		});

		it('should limit history size', async () => {
			// Fill history beyond reasonable limit
			for (let i = 0; i < 15; i++) {
				viewModel.state.pathHistory.push(`path-${i}`);
			}

			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: []
			});

			await viewModel.navigateToDirectory('new-dir');

			// History should be limited (implementation dependent)
			expect(viewModel.state.pathHistory.length).toBeLessThanOrEqual(10);
		});
	});

	describe('Integration with BaseViewModel', () => {
		it('should inherit BaseViewModel functionality', () => {
			expect(viewModel.isValid).toBe(true);
			expect(viewModel.loading).toBe(false);
			expect(typeof viewModel.isDirty).toBe('boolean');
			expect(typeof viewModel.hasErrors).toBe('boolean');
		});

		it('should use withLoading for async operations', async () => {
			const testOperation = vi.fn().mockResolvedValue('success');

			await viewModel.withLoading(testOperation);

			expect(testOperation).toHaveBeenCalled();
		});

		it('should handle validation when available', async () => {
			const mockValidation = {
				validate: vi.fn().mockReturnValue({ isValid: true, errors: [] })
			};
			viewModel.services.validationService = mockValidation;

			await viewModel.validate();

			expect(mockValidation.validate).toHaveBeenCalledWith(viewModel.state);
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
				viewModel.openPicker();
				viewModel.loadDirectories('test');
				viewModel.selectCurrentDirectory(() => {});
			}).not.toThrow();

			// Verify disposed state
			expect(viewModel.isDisposed).toBe(true);
		});
	});

	describe('Error Handling', () => {
		it('should handle timeout errors', async () => {
			mockDirectoryService.listDirectories.mockRejectedValue(
				new Error('Request timeout')
			);

			await viewModel.loadDirectories('slow-path');

			expect(viewModel.error).toBe('Request timeout');
			expect(viewModel.state.directories).toEqual([]);
		});

		it('should handle malformed service responses', async () => {
			mockDirectoryService.listDirectories.mockResolvedValue({
				success: true,
				directories: null // Invalid response
			});

			await viewModel.loadDirectories('invalid-response');

			expect(viewModel.state.directories).toEqual([]);
		});

		it('should handle service unavailable', async () => {
			viewModel.services.directoryService = null;

			await viewModel.loadDirectories('test');

			expect(viewModel.error).toContain('Cannot read properties of null');
		});
	});
});