
import { sequence } from '@sveltejs/kit/hooks';
import { SocketIOServer } from './lib/server/io/SocketIOServer';
import { WorkspaceManager } from './lib/server/core/WorkspaceManager';
import { SessionRouter } from './lib/server/core/SessionRouter';
import { TerminalManager } from './lib/server/terminals/TerminalManager';
import { ClaudeSessionManager } from './lib/server/claude/ClaudeSessionManager';

// Initialize instances (but don't wire up Socket.IO handlers yet)
if (!globalThis.__HOOKS_INSTANCES) {
  const ioServer = new SocketIOServer();
  
  const sessions = new SessionRouter();
  const workspaces = new WorkspaceManager({
    rootDir: process.env.WORKSPACES_ROOT || './.workspaces',
    indexFile: (process.env.WORKSPACES_ROOT || './.workspaces') + '/.dispatch/hub-index.json'
  });
  
  // Initialize workspaces asynchronously
  workspaces.init().catch(err => {
    console.error('Failed to initialize workspaces:', err);
  });
  
  const terminals = new TerminalManager({ io: ioServer });
  const claude = new ClaudeSessionManager({ io: ioServer });

  globalThis.__HOOKS_INSTANCES = { ioServer, sessions, workspaces, terminals, claude };
}

export const ioServer = globalThis.__HOOKS_INSTANCES?.ioServer;
export const sessions = globalThis.__HOOKS_INSTANCES?.sessions;
export const workspaces = globalThis.__HOOKS_INSTANCES?.workspaces;
export const terminals = globalThis.__HOOKS_INSTANCES?.terminals;
export const claude = globalThis.__HOOKS_INSTANCES?.claude;

export const handle = sequence(async ({ event, resolve }) => {
  event.locals.ioServer = ioServer;
  event.locals.workspaces = workspaces;
  event.locals.sessions = sessions;
  event.locals.terminals = terminals;
  event.locals.claude = claude;
  return resolve(event);
});
