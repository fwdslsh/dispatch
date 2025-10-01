# Session Adapters & Registration

Dispatch uses an adapter pattern for all session types (terminal, Claude, file editor). Adapters encapsulate runtime logic and communicate via a unified Socket.IO protocol and event-sourcing.

## Adapter contract

- Implement `create({ onEvent, sessionId, workspacePath, options })`
- Return an object exposing:
  - `input.write(data: string | Uint8Array)`
  - Optional `resize({ cols, rows })`
  - Optional `close()` cleanup
- Emit events by calling `onEvent({ channel, payload })`

## Server-side registration

- Core runtime: `src/lib/server/runtime/RunSessionManager.js`
- Adapters: `src/lib/server/adapters/` (e.g., `PtyAdapter.js`, `ClaudeAdapter.js`, `FileEditorAdapter.js`)
- Register at server startup using `RunSessionManager.registerAdapter(type, adapter)`

### Example

```js
// src/lib/server/adapters/WebPreviewAdapter.js
export class WebPreviewAdapter {
  static type = 'webpreview';
  #sessions = new Map();

  async create({ onEvent, sessionId, workspacePath, options }) {
    const server = await startPreviewServer(workspacePath, options?.port);
    server.on('request', (req) => {
      onEvent({ channel: 'webpreview:request', payload: { url: req.url, method: req.method } });
    });

    this.#sessions.set(sessionId, { server });
    return {
      input: {
        write: (data) => {
          // handle commands (e.g., reload)
        }
      },
      close: async () => {
        await server.close();
        this.#sessions.delete(sessionId);
      }
    };
  }
}
```

```js
// src/lib/server/runtime/RunSessionManager.js
import { WebPreviewAdapter } from '$lib/server/adapters/WebPreviewAdapter.js';

runSessionManager.registerAdapter('webpreview', new WebPreviewAdapter());
```

## Client wiring

- Client API: `src/lib/client/shared/services/RunSessionClient.js`
- UI panes live in `src/lib/client/<type>/<Type>Pane.svelte`
- Dynamic module map (example):

```js
export const sessionModules = {
  pty: () => import('$lib/client/terminal/TerminalPane.svelte'),
  claude: () => import('$lib/client/claude/ClaudePane.svelte'),
  'file-editor': () => import('$lib/client/file-editor/FileEditorPane.svelte'),
  // 'webpreview': () => import('$lib/client/webpreview/WebPreviewPane.svelte'),
};
```

## Event flow checklist

- Server emits events to the run room: `io.to('run:ID').emit('run:event', event)`
- Server persists events: `appendSessionEvent(runId, seq, event)`
- Client attaches and streams `run:input`, listens to `run:event`
- Sequence numbers must be monotonic for replay/resume

## Quick checklist to add a session type

- [ ] Create adapter in `src/lib/server/adapters/` implementing the contract
- [ ] Register adapter in server startup (`RunSessionManager.registerAdapter`)
- [ ] Add a client pane and include it in the session modules map
- [ ] Ensure events are both emitted and persisted
- [ ] Add an icon/label and show it in the create-session UI

## References

- Runtime: `src/lib/server/runtime/RunSessionManager.js`
- Socket: `src/lib/server/socket-setup.js`
- Adapters: `src/lib/server/adapters/`
- Client attach API: `src/lib/client/shared/services/RunSessionClient.js`
