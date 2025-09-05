/**
 * ProjectService Unit Tests
 * Tests Socket.IO integration and project management operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProjectService } from '../../services/ProjectService.js';

// Mock the socket.io-client import
vi.mock('socket.io-client', () => {
	const mockSocket = {
		connect: vi.fn(),
		disconnect: vi.fn(),
		emit: vi.fn(),
		on: vi.fn(),
		off: vi.fn(),
		once: vi.fn(),
		removeAllListeners: vi.fn(),
		connected: false,
		id: 'mock-socket-id'
	};

	const mockIo = vi.fn(() => mockSocket);

	return {
		default: mockIo,
		io: mockIo
	};
});

describe('ProjectService', () => {
	let projectService;
	let mockSocket;
	let mockIo;

	beforeEach(async () => {
		vi.clearAllMocks();
		
		// Mock localStorage for Node environment
		global.localStorage = {
			getItem: vi.fn(() => 'test-token'),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn()
		};
		
		// Get mock references
		const socketModule = await import('socket.io-client');
		mockIo = socketModule.io;
		
		// Reset mock socket
		mockSocket = {
			connect: vi.fn(),
			disconnect: vi.fn(),
			emit: vi.fn(),
			on: vi.fn(),
			off: vi.fn(),
			once: vi.fn(),
			removeAllListeners: vi.fn(),
			connected: false,
			id: 'mock-socket-id'
		};
		
		mockIo.mockReturnValue(mockSocket);
		
		// Create service instance
		projectService = new ProjectService();
	});

	afterEach(() => {
		if (projectService) {
			projectService.dispose();
		}
		// Clean up global localStorage mock
		delete global.localStorage;
	});

	describe('Constructor and Initialization', () => {
		it('should initialize without socket connection', () => {
			expect(projectService.socket).toBe(null);
			expect(projectService.authenticated).toBe(false);
		});

		it('should initialize socket connection', async () => {
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') {
					setTimeout(() => callback(), 10);
				}
			});

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth' && callback) {
					setTimeout(() => callback({ success: true }), 10);
				}
			});

			const result = await projectService.initialize();

			expect(result).toBe(true);
			expect(projectService.socket).toBe(mockSocket);
			expect(projectService.authenticated).toBe(true);
		});

		it('should handle authentication failure during initialization', async () => {
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') {
					setTimeout(() => callback(), 10);
				}
			});

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth' && callback) {
					setTimeout(() => callback({ success: false, error: 'Invalid key' }), 10);
				}
			});

			const result = await projectService.initialize();

			expect(result).toBe(false);
			expect(projectService.authenticated).toBe(false);
		});
	});

	describe('Project Retrieval', () => {
		beforeEach(async () => {
			// Initialize service for tests
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth' && callback) callback({ success: true });
			});
			await projectService.initialize();
			vi.clearAllMocks();
		});

		it('should get projects successfully', async () => {
			const mockProjects = [
				{ id: '1', name: 'Project 1', description: 'Test project 1', sessions: [] },
				{ id: '2', name: 'Project 2', description: 'Test project 2', sessions: ['s1'] }
			];

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'list-projects' && callback) {
					callback({
						success: true,
						projects: mockProjects,
						activeProject: '1'
					});
				}
			});

			const result = await projectService.getProjects();

			expect(result.success).toBe(true);
			expect(result.projects).toEqual(mockProjects);
			expect(result.activeProject).toBe('1');
			expect(mockSocket.emit).toHaveBeenCalledWith('list-projects', {}, expect.any(Function));
		});

		it('should handle get projects failure', async () => {
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'list-projects' && callback) {
					callback({
						success: false,
						error: 'Failed to load projects'
					});
				}
			});

			const result = await projectService.getProjects();

			expect(result.success).toBe(false);
			expect(result.error).toBe('Failed to load projects');
		});

		it('should throw when not authenticated', async () => {
			projectService.authenticated = false;

			await expect(projectService.getProjects()).rejects.toThrow('Service not authenticated');
		});
	});

	describe('Project Creation', () => {
		beforeEach(async () => {
			// Initialize service for tests
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth' && callback) callback({ success: true });
			});
			await projectService.initialize();
			vi.clearAllMocks();
		});

		it('should create project successfully', async () => {
			const projectData = {
				name: 'New Project',
				description: 'New project description'
			};

			const mockResponse = {
				success: true,
				project: { id: '123', ...projectData }
			};

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'create-project' && callback) {
					callback(mockResponse);
				}
			});

			const result = await projectService.createProject(projectData);

			expect(result).toEqual(mockResponse);
			expect(mockSocket.emit).toHaveBeenCalledWith('create-project', projectData, expect.any(Function));
		});

		it('should handle create project failure', async () => {
			const projectData = {
				name: 'New Project',
				description: 'New project description'
			};

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'create-project' && callback) {
					callback({
						success: false,
						error: 'Project name already exists'
					});
				}
			});

			const result = await projectService.createProject(projectData);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Project name already exists');
		});

		it('should validate project data before creation', async () => {
			const invalidData = { name: '', description: '' };

			await expect(projectService.createProject(invalidData)).rejects.toThrow('Project name is required');
		});

		it('should throw when not authenticated', async () => {
			projectService.authenticated = false;

			await expect(projectService.createProject({ name: 'Test' })).rejects.toThrow('Service not authenticated');
		});
	});

	describe('Project Updates', () => {
		beforeEach(async () => {
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth' && callback) callback({ success: true });
			});
			await projectService.initialize();
			vi.clearAllMocks();
		});

		it('should update project successfully', async () => {
			const projectId = 'project-123';
			const updates = { name: 'Updated Project Name' };

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'update-project' && callback) {
					callback({ success: true });
				}
			});

			const result = await projectService.updateProject(projectId, updates);

			expect(result.success).toBe(true);
			expect(mockSocket.emit).toHaveBeenCalledWith('update-project', {
				projectId,
				updates
			}, expect.any(Function));
		});

		it('should handle update project failure', async () => {
			const projectId = 'project-123';
			const updates = { name: 'Updated Name' };

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'update-project' && callback) {
					callback({
						success: false,
						error: 'Project not found'
					});
				}
			});

			const result = await projectService.updateProject(projectId, updates);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Project not found');
		});

		it('should validate updates before sending', async () => {
			const projectId = 'project-123';
			const invalidUpdates = { name: '' };

			await expect(projectService.updateProject(projectId, invalidUpdates)).rejects.toThrow('Project name is required');
		});
	});

	describe('Project Deletion', () => {
		beforeEach(async () => {
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth' && callback) callback({ success: true });
			});
			await projectService.initialize();
			vi.clearAllMocks();
		});

		it('should delete project successfully', async () => {
			const projectId = 'project-123';

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'delete-project' && callback) {
					callback({ success: true });
				}
			});

			const result = await projectService.deleteProject(projectId);

			expect(result.success).toBe(true);
			expect(mockSocket.emit).toHaveBeenCalledWith('delete-project', {
				projectId
			}, expect.any(Function));
		});

		it('should handle delete project failure', async () => {
			const projectId = 'project-123';

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'delete-project' && callback) {
					callback({
						success: false,
						error: 'Project has active sessions'
					});
				}
			});

			const result = await projectService.deleteProject(projectId);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Project has active sessions');
		});

		it('should throw when project ID is missing', async () => {
			await expect(projectService.deleteProject('')).rejects.toThrow('Project ID is required');
		});
	});

	describe('Active Project Management', () => {
		beforeEach(async () => {
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth' && callback) callback({ success: true });
			});
			await projectService.initialize();
			vi.clearAllMocks();
		});

		it('should set active project successfully', async () => {
			const projectId = 'project-123';

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'set-active-project' && callback) {
					callback({ success: true });
				}
			});

			const result = await projectService.setActiveProject(projectId);

			expect(result.success).toBe(true);
			expect(mockSocket.emit).toHaveBeenCalledWith('set-active-project', {
				projectId
			}, expect.any(Function));
		});

		it('should handle set active project failure', async () => {
			const projectId = 'invalid-project';

			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'set-active-project' && callback) {
					callback({
						success: false,
						error: 'Project not found'
					});
				}
			});

			const result = await projectService.setActiveProject(projectId);

			expect(result.success).toBe(false);
			expect(result.error).toBe('Project not found');
		});
	});

	describe('Project Validation', () => {
		it('should validate project name - required field', () => {
			const result = projectService.validateProject('');
			
			expect(result.isValid).toBe(false);
			expect(result.message).toBe('Project name is required');
			expect(result.severity).toBe('error');
		});

		it('should validate project name - whitespace only', () => {
			const result = projectService.validateProject('   ');
			
			expect(result.isValid).toBe(false);
			expect(result.message).toBe('Project name is required');
		});

		it('should validate project name - too long', () => {
			const longName = 'A'.repeat(51);
			const result = projectService.validateProject(longName);
			
			expect(result.isValid).toBe(false);
			expect(result.message).toBe('Project name must be 50 characters or less');
			expect(result.severity).toBe('error');
		});

		it('should validate project name - invalid characters', () => {
			const result = projectService.validateProject('Invalid@Name!');
			
			expect(result.isValid).toBe(false);
			expect(result.message).toBe('Project name can only contain letters, numbers, spaces, hyphens, and underscores');
			expect(result.severity).toBe('error');
		});

		it('should validate project name - very short name warning', () => {
			const result = projectService.validateProject('AB');
			
			expect(result.isValid).toBe(true);
			expect(result.message).toBe('Very short name');
			expect(result.severity).toBe('warning');
		});

		it('should validate project name - long name warning', () => {
			const longName = 'A'.repeat(35);
			const result = projectService.validateProject(longName);
			
			expect(result.isValid).toBe(true);
			expect(result.message).toBe('Long name (max 50)');
			expect(result.severity).toBe('warning');
		});

		it('should validate project name - valid name', () => {
			const result = projectService.validateProject('Valid Project Name');
			
			expect(result.isValid).toBe(true);
			expect(result.message).toBe('');
			expect(result.severity).toBe('info');
		});
	});

	describe('Socket Event Handling', () => {
		it('should set up event listeners', async () => {
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth' && callback) callback({ success: true });
			});

			await projectService.initialize();

			expect(mockSocket.on).toHaveBeenCalledWith('connect', expect.any(Function));
			expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
			expect(mockSocket.on).toHaveBeenCalledWith('projects-updated', expect.any(Function));
		});

		it('should handle disconnect event', async () => {
			let disconnectHandler;
			
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
				if (event === 'disconnect') disconnectHandler = callback;
			});
			
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth' && callback) callback({ success: true });
			});

			await projectService.initialize();
			
			// Simulate disconnect
			disconnectHandler();
			
			expect(projectService.authenticated).toBe(false);
		});
	});

	describe('Service Lifecycle', () => {
		it('should dispose properly', () => {
			projectService.socket = mockSocket;
			projectService.authenticated = true;

			projectService.dispose();

			expect(mockSocket.removeAllListeners).toHaveBeenCalled();
			expect(mockSocket.disconnect).toHaveBeenCalled();
			expect(projectService.socket).toBe(null);
			expect(projectService.authenticated).toBe(false);
		});

		it('should handle dispose when no socket', () => {
			projectService.socket = null;
			
			expect(() => projectService.dispose()).not.toThrow();
		});

		it('should be safe to dispose multiple times', () => {
			projectService.socket = mockSocket;
			
			projectService.dispose();
			projectService.dispose();

			expect(mockSocket.disconnect).toHaveBeenCalledTimes(1);
		});
	});

	describe('Error Handling', () => {
		it('should handle socket timeout errors', async () => {
			mockSocket.on.mockImplementation((event, callback) => {
				if (event === 'connect') callback();
			});

			// Mock a timeout scenario
			mockSocket.emit.mockImplementation((event, data, callback) => {
				if (event === 'auth') {
					// Don't call callback to simulate timeout
				}
			});

			// The service should have timeout handling
			const result = await projectService.initialize(1000); // Short timeout for test
			
			expect(result).toBe(false);
		});

		it('should handle network errors gracefully', async () => {
			// Mock network error
			mockIo.mockImplementation(() => {
				throw new Error('Network error');
			});

			const result = await projectService.initialize();
			
			expect(result).toBe(false);
		});
	});
});