/**
 * Namespace Socket Handler
 * 
 * Creates and manages all namespace-based socket handlers following the simplified architecture.
 * Each feature gets its own namespace with 1:1 server-client mapping.
 */

import { ClaudeHandler } from '../../session-types/claude/io/ClaudeHandler.server.js';
import { ShellHandler } from '../../session-types/shell/io/ShellHandler.server.js';
import { AuthHandler } from '../../auth/io/AuthHandler.js';
import { ProjectHandler } from '../../projects/io/ProjectHandler.js';
import { SessionHandler } from '../../sessions/io/SessionHandler.js';
import { TerminalHandler } from '../../session-types/shell/io/TerminalHandler.server.js';

export function createNamespaceSocketHandlers(io) {
    console.log('[NAMESPACE] Initializing namespace-based socket handlers...');

    // Create auth handler first (other handlers depend on it)
    const authHandler = new AuthHandler(io);
    console.log('[NAMESPACE] ✅ Auth handler initialized (/auth)');

    // Create project handler
    const projectHandler = new ProjectHandler(io, authHandler);
    console.log('[NAMESPACE] ✅ Project handler initialized (/projects)');

    // Create session handler
    const sessionHandler = new SessionHandler(io, authHandler);
    console.log('[NAMESPACE] ✅ Session handler initialized (/sessions)');

    // Create terminal handler (depends on session handler for socket mapping)
    const terminalHandler = new TerminalHandler(io, authHandler, sessionHandler);
    console.log('[NAMESPACE] ✅ Terminal handler initialized (/terminals)');

    // Create Claude handler
    const claudeHandler = new ClaudeHandler(io, authHandler);
    console.log('[NAMESPACE] ✅ Claude handler initialized (/claude)');

    // Create shell handler
    const shellHandler = new ShellHandler(io, authHandler);
    console.log('[NAMESPACE] ✅ Shell handler initialized (/shell)');

    console.log('[NAMESPACE] All namespace handlers initialized successfully');

    return {
        authHandler,
        projectHandler,
        sessionHandler,
        terminalHandler,
        claudeHandler,
        shellHandler
    };
}

/**
 * Legacy compatibility handler for the main namespace
 * This provides basic functionality for clients that haven't migrated to namespaces yet
 */
export function createMainNamespaceHandler(io, handlers) {
    return (socket) => {
        console.log(`[MAIN] Client connected to main namespace: ${socket.id}`);

        // Provide basic auth endpoint for compatibility
        socket.on('auth', (key, callback) => {
            // Forward to auth namespace handler
            const authSocket = io.of('/auth').sockets.get(socket.id);
            if (authSocket) {
                handlers.authHandler.handleLogin(authSocket, key, callback);
            } else {
                // Direct auth check for compatibility
                const success = !handlers.authHandler.config.required || key === handlers.authHandler.config.key;
                if (success) {
                    handlers.authHandler.authenticatedSockets.add(socket.id);
                }
                if (callback) callback({ success, ok: success });
            }
        });

        // Redirect other events to appropriate namespaces
        socket.on('list-projects', (callback) => {
            if (callback) {
                callback({
                    success: false,
                    error: 'Please connect to /projects namespace for project operations'
                });
            }
        });

        socket.on('create', (options, callback) => {
            if (callback) {
                callback({
                    success: false,
                    error: 'Please connect to /sessions namespace for session operations'
                });
            }
        });

        socket.on('disconnect', () => {
            console.log(`[MAIN] Client disconnected from main namespace: ${socket.id}`);
            // Clean up auth state
            handlers.authHandler.authenticatedSockets.delete(socket.id);
        });
    };
}