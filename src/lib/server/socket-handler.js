/**
 * Working Socket Handler - Simple, clean, and functional
 * No over-engineering, just what's needed to make everything work
 */

import { TerminalManager } from '../session-types/shell/server/terminal.server.js';
import DirectoryManager from './directory-manager.js';
import storageManager from './storage-manager.js';
import fs from 'fs';

const TERMINAL_KEY = process.env.TERMINAL_KEY || 'change-me';
const AUTH_REQUIRED = TERMINAL_KEY.length >= 8;

// Simple state tracking
const authenticatedSockets = new Set();
const socketSessions = new Map(); // socketId -> sessionId

// Initialize services
const terminalManager = new TerminalManager();
const directoryManager = new DirectoryManager();

// Initialize storage manager on startup
(async () => {
	try {
		await storageManager.initialize();
		console.log('Storage manager initialized');
	} catch (err) {
		console.error('Failed to initialize storage manager:', err);
	}
})();

function createSocketHandler(io) {
	return (socket) => {
		console.log('Socket connected:', socket.id);

		// Simple authentication
		socket.on('auth', (key, callback) => {
			const success = !AUTH_REQUIRED || key === TERMINAL_KEY;

			if (success) {
				authenticatedSockets.add(socket.id);
				console.log(`[AUTH] Socket ${socket.id} authenticated`);
			} else {
				console.log(`[AUTH] Socket ${socket.id} authentication failed`);
			}

			if (callback && typeof callback === 'function') {
				callback({ success, ok: success });
			}
		});

		// Check auth for protected operations
		function requireAuth() {
			return !AUTH_REQUIRED || authenticatedSockets.has(socket.id);
		}

		// Project operations
		socket.on('list-projects', (callback) => {
			if (!requireAuth()) {
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

			try {
				const projectData = storageManager.getProjects();
				const projects = projectData?.projects || [];
				console.log(`Listing projects for socket ${socket.id}:`, projects.length);
				if (callback && typeof callback === 'function') {
					callback({ success: true, projects });
				}
				socket.emit('projects-updated', { projects: projects });
			} catch (error) {
				console.error('Error listing projects:', error);
				if (callback && typeof callback === 'function') {
					callback({ success: false, error: error.message });
				}
			}
		});

		socket.on('create-project', async (data, callback) => {
			if (!requireAuth()) {
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

			try {
				console.log('Creating project:', data);
				const project = await storageManager.createProject({
					name: data.name || 'Untitled Project',
					description: data.description || ''
				});

				console.log('Project created:', project);

				// Broadcast to all sockets including current one
				const projectData = storageManager.getProjects();
				const allProjects = projectData?.projects || [];
				socket.emit('projects-updated', { projects: allProjects });
				socket.broadcast.emit('projects-updated', { projects: allProjects });

				if (callback) callback({ success: true, project });
			} catch (error) {
				console.error('Error creating project:', error);
				if (callback) callback({ success: false, error: error.message });
			}
		});

		socket.on('get-project', (data, callback) => {
			if (!requireAuth()) {
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

			try {
				const project = storageManager.getProject(data.projectId);
				if (!project) {
					if (callback) callback({ success: false, error: 'Project not found' });
					return;
				}
				if (callback) callback({ success: true, project });
			} catch (error) {
				console.error('Error getting project:', error);
				if (callback) callback({ success: false, error: error.message });
			}
		});

		socket.on('update-project', async (data, callback) => {
			if (!requireAuth()) {
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

			try {
				console.log('Updating project:', data);
				const updated = await storageManager.updateProject(data.projectId, data.updates);

				// Broadcast to all sockets
				const allProjects = storageManager.getProjects() || [];
				socket.broadcast.emit('projects-updated', { projects: allProjects });

				if (callback) callback({ success: true, project: updated });
			} catch (error) {
				console.error('Error updating project:', error);
				if (callback) callback({ success: false, error: error.message });
			}
		});

		socket.on('delete-project', async (data, callback) => {
			if (!requireAuth()) {
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

			try {
				await storageManager.deleteProject(data.projectId);

				// Try to delete the directory too
				try {
					await directoryManager.deleteProject(data.projectId);
				} catch (err) {
					console.warn('Could not delete project directory:', err.message);
				}

				// Broadcast to all sockets
				const allProjects = storageManager.getProjects() || [];
				socket.broadcast.emit('projects-updated', { projects: allProjects });

				if (callback) callback({ success: true });
			} catch (error) {
				console.error('Error deleting project:', error);
				if (callback) callback({ success: false, error: error.message });
			}
		});

		// Session operations
		socket.on('create', async (options, callback) => {
			if (!requireAuth()) {
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

			try {
				console.log('Creating session:', options);
				const sessionData = await terminalManager.createSessionInProject(options.project, {
					cols: options.cols,
					rows: options.rows,
					mode: options.mode,
					name: options.name,
					workingDirectory: options.workingDirectory
				});
				socketSessions.set(socket.id, sessionData.sessionId);

				// Update project if provided
				if (options.project) {
					try {
						await storageManager.addSessionToProject(options.project, {
							id: sessionData.sessionId,
							name: options.meta?.name || sessionData.sessionId,
							mode: options.mode || 'shell',
							status: 'active',
							createdAt: new Date().toISOString()
						});
					} catch (err) {
						console.warn('Could not add session to project:', err.message);
					}
				}

				if (callback)
					callback({
						success: true,
						session: sessionData,
						sessionId: sessionData.sessionId
					});

				// Broadcast session updates
				socket.broadcast.emit('sessions-updated', terminalManager.listSessions());
			} catch (error) {
				console.error('Error creating session:', error);
				if (callback) callback({ success: false, error: error.message });
			}
		});

		socket.on('attach', async (options, callback) => {
			if (!requireAuth()) {
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

			try {
				const success = await terminalManager.attachToSession(socket, options);
				if (success) {
					socketSessions.set(socket.id, options.sessionId);
					if (callback) callback({ success: true });
				} else {
					if (callback) callback({ success: false, error: 'Failed to attach to session' });
				}
			} catch (error) {
				console.error('Error attaching to session:', error);
				if (callback) callback({ success: false, error: error.message });
			}
		});

		socket.on('list', (callback) => {
			if (!requireAuth()) {
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

			try {
				// Get all sessions - both active (in memory) and stored (in projects)
				const allSessions = [];
				const seenSessionIds = new Set();

				// First, add active sessions from memory
				for (const [sessionId, metadata] of terminalManager.sessionMetadata.entries()) {
					allSessions.push({
						id: sessionId,
						sessionId,
						name: metadata.name,
						projectId: metadata.projectId,
						active: terminalManager.sessions.has(sessionId),
						status: terminalManager.sessions.has(sessionId) ? 'active' : 'inactive',
						type: 'shell' // Default type, could be enhanced
					});
					seenSessionIds.add(sessionId);
				}

				// Then, add stored sessions from projects (if not already in active list)
				const projectData = storageManager.getProjects();
				if (projectData && projectData.projects) {
					for (const project of projectData.projects) {
						if (project.sessions && Array.isArray(project.sessions)) {
							for (const session of project.sessions) {
								if (!seenSessionIds.has(session.id)) {
									allSessions.push({
										id: session.id,
										sessionId: session.id,
										name: session.name || session.id,
										projectId: project.id,
										active: false, // Not in active memory
										status: session.status || 'inactive',
										type: session.type || session.mode || 'shell'
									});
									seenSessionIds.add(session.id);
								}
							}
						}
					}
				}

				if (callback) callback({ success: true, sessions: allSessions });
			} catch (error) {
				console.error('Error listing sessions:', error);
				if (callback) callback({ success: false, error: error.message });
			}
		});

		socket.on('end', async (sessionId, callback) => {
			if (!requireAuth()) {
				if (callback) callback({ success: false, error: 'Authentication required' });
				return;
			}

			try {
				const targetSessionId = sessionId || socketSessions.get(socket.id);
				if (targetSessionId) {
					await terminalManager.endSession(targetSessionId);

					// Remove from socket mapping
					for (const [sockId, sessId] of socketSessions.entries()) {
						if (sessId === targetSessionId) {
							socketSessions.delete(sockId);
						}
					}

					// Broadcast session updates
					socket.broadcast.emit('sessions-updated', terminalManager.listSessions());
					socket.broadcast.emit('session-ended', { sessionId: targetSessionId });
				}
				if (callback) callback({ success: true });
			} catch (error) {
				console.error('Error ending session:', error);
				if (callback) callback({ success: false, error: error.message });
			}
		});

		socket.on('detach', (callback) => {
			const sessionId = socketSessions.get(socket.id);
			if (sessionId) {
				socketSessions.delete(socket.id);
			}
			if (callback) callback({ success: true });
		});

		// Terminal I/O
		socket.on('input', (data) => {
			if (!requireAuth()) return;

			const sessionId = socketSessions.get(socket.id);
			if (sessionId) {
				terminalManager.sendInput(sessionId, data);
			}
		});

		socket.on('resize', (dims) => {
			if (!requireAuth()) return;

			const sessionId = socketSessions.get(socket.id);
			if (sessionId && dims && dims.cols && dims.rows) {
				terminalManager.resize(sessionId, dims.cols, dims.rows);
			}
		});

		// Public URL (no auth required)
		socket.on('get-public-url', (callback) => {
			try {
				let publicUrl = null;
				if (fs.existsSync('/tmp/tunnel-url.txt')) {
					publicUrl = fs.readFileSync('/tmp/tunnel-url.txt', 'utf8').trim();
				}
				if (callback)
					callback({
						success: true,
						ok: true,
						url: publicUrl,
						publicUrl
					});
			} catch (error) {
				if (callback)
					callback({
						success: false,
						ok: false,
						error: error.message
					});
			}
		});

		// Cleanup on disconnect
		socket.on('disconnect', () => {
			console.log('Socket disconnected:', socket.id);
			authenticatedSockets.delete(socket.id);

			const sessionId = socketSessions.get(socket.id);
			if (sessionId) {
				// Don't end the session, just detach the socket
				socketSessions.delete(socket.id);
			}
		});
	};
}

// Export the createSocketHandler function so it can be called with io
export { createSocketHandler };

// Legacy export for compatibility (if needed)
export function handleConnection(io) {
	return createSocketHandler(io);
}
