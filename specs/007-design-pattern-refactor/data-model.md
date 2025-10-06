# Architecture Component Data Model (Simplified)

**Feature**: 007-design-pattern-refactor
**Date**: 2025-10-05
**Purpose**: Component specifications using simple ES6 modules and Svelte context (NO complex DI framework)

## Core Architectural Pattern

**Simplified Dependency Management**:
- Server: Factory function in `services.js` that creates and wires services
- Client: Svelte `setContext`/`getContext` for sharing services
- Testing: Module mocking (Vitest `vi.mock()`) and context overrides

**No DependencyContainer class** - just organized exports and factory functions.

---

## Component Specifications

### 1. ServiceRegistry Module (services.js)

**Purpose**: Centralize service initialization with explicit dependency wiring

**File**: `src/lib/server/shared/services.js`

**Pattern**:
```javascript
// Factory function for initialization
export function createServices(config) {
  // Layer 1: Database connection
  const db = new DatabaseManager(config);

  // Layer 2: Repositories (depend on db)
  const sessionRepository = new SessionRepository(db);
  const eventStore = new EventStore(db);
  const settingsRepository = new SettingsRepository(db);
  const workspaceRepository = new WorkspaceRepository(db);

  // Layer 3: Services (depend on repositories)
  const jwtService = new JWTService(config.TERMINAL_KEY);
  const adapterRegistry = new AdapterRegistry();
  const eventRecorder = new EventRecorder(eventStore);

  // Layer 4: Orchestrators (depend on services)
  const sessionOrchestrator = new SessionOrchestrator(
    sessionRepository,
    eventRecorder,
    adapterRegistry
  );

  // Register adapters
  adapterRegistry.register('pty', new PtyAdapter());
  adapterRegistry.register('claude', new ClaudeAdapter());
  adapterRegistry.register('file-editor', new FileEditorAdapter());

  return {
    db,
    sessionRepository,
    eventStore,
    settingsRepository,
    workspaceRepository,
    jwtService,
    adapterRegistry,
    eventRecorder,
    sessionOrchestrator
  };
}

// Singleton for app lifecycle
export let services;

export function initializeServices(config) {
  services = createServices(config);
  return services;
}
```

**Responsibility**: Wire dependencies explicitly in correct order

**Testing**:
```javascript
// tests/server/services.test.js
import { createServices } from '$lib/server/shared/services';

test('services initialized correctly', () => {
  const testConfig = { TERMINAL_KEY: 'test' };
  const services = createServices(testConfig);

  expect(services.sessionOrchestrator).toBeDefined();
  expect(services.sessionRepository).toBeInstanceOf(SessionRepository);
});

// tests/server/api.test.js
import { vi } from 'vitest';

vi.mock('$lib/server/shared/services', () => ({
  services: {
    sessionRepository: { create: vi.fn() },
    sessionOrchestrator: { createSession: vi.fn() }
  }
}));
```

**Validation**: Circular dependencies fail naturally (JavaScript throws at import time)

---

### 2. SessionRepository

**Purpose**: Session metadata CRUD

**State**:
```javascript
class SessionRepository {
  #db; // Private field

  constructor(db) {
    this.#db = db;
    this.#prepareStatements();
  }

  #prepareStatements() {
    this.#createStmt = this.#db.prepare('INSERT INTO sessions...');
    // ...
  }

  create(sessionData) { /* ... */ }
  findById(id) { /* ... */ }
  // ...
}
```

**Dependencies**: Receives `db` in constructor (explicit)

---

### 3. EventStore

**Purpose**: Append-only event log with sequence numbers

**State**: Same pattern as SessionRepository

**Dependencies**: Receives `db` in constructor

---

### 4-5. SettingsRepository & WorkspaceRepository

**Pattern**: Same as SessionRepository (CRUD, prepared statements, single table focus)

---

### 6. AdapterRegistry

**Purpose**: Register and retrieve session type adapters

**State**:
```javascript
class AdapterRegistry {
  #adapters = new Map(); // kind → adapter

  register(kind, adapter) {
    this.#adapters.set(kind, adapter);
  }

  getAdapter(kind) {
    const adapter = this.#adapters.get(kind);
    if (!adapter) throw new Error(`Adapter not found: ${kind}`);
    return adapter;
  }
}
```

**Dependencies**: None (adapters registered after construction)

---

### 7. EventRecorder

**Purpose**: Serialize and persist session events

**State**:
```javascript
class EventRecorder {
  #eventStore;
  #eventEmitter = new EventEmitter(); // Decoupled from Socket.IO
  #buffers = new Map(); // sessionId → Event[]

  constructor(eventStore) {
    this.#eventStore = eventStore;
  }

  record(sessionId, event) {
    const { seq } = this.#eventStore.append(sessionId, event);
    this.#eventEmitter.emit('event', { sessionId, seq, event });
  }

  subscribe(listener) {
    this.#eventEmitter.on('event', listener);
  }
}
```

**Dependencies**: Receives `eventStore` in constructor

---

### 8. SessionOrchestrator

**Purpose**: Coordinate session lifecycle

**State**:
```javascript
class SessionOrchestrator {
  #sessionRepository;
  #eventRecorder;
  #adapterRegistry;
  #activeSessions = new Map();

  constructor(sessionRepository, eventRecorder, adapterRegistry) {
    this.#sessionRepository = sessionRepository;
    this.#eventRecorder = eventRecorder;
    this.#adapterRegistry = adapterRegistry;
  }

  async createSession(kind, options) {
    const adapter = this.#adapterRegistry.getAdapter(kind);
    const session = await this.#sessionRepository.create({ kind, ...options });
    const process = adapter.create(options);

    this.#activeSessions.set(session.id, { adapter, process });
    this.#eventRecorder.record(session.id, { type: 'created' });

    return session;
  }
}
```

**Dependencies**: Receives 3 dependencies in constructor (explicit)

---

### 9. SocketEventMediator

**Purpose**: Route socket events with middleware

**State**:
```javascript
class SocketEventMediator {
  #io;
  #middleware = [];
  #handlers = new Map();

  constructor(io) {
    this.#io = io;
  }

  use(middlewareFn) {
    this.#middleware.push(middlewareFn);
  }

  on(eventName, handler) {
    this.#handlers.set(eventName, handler);
  }

  initialize() {
    this.#io.on('connection', (socket) => {
      this.#middleware.forEach(mw => socket.use(mw));

      this.#handlers.forEach((handler, eventName) => {
        socket.on(eventName, (data, callback) => {
          handler(socket, data, callback);
        });
      });
    });
  }
}
```

**Dependencies**: Receives Socket.IO instance in constructor

**Integration**:
```javascript
// In services.js or socket setup
import { services } from '$lib/server/shared/services';

const mediator = new SocketEventMediator(io);

// Middleware
mediator.use(createAuthMiddleware(services.jwtService));
mediator.use(createErrorHandlingMiddleware());

// Handlers
mediator.on('run:attach', (socket, data, cb) => {
  services.sessionOrchestrator.attach(data.sessionId);
  cb({ success: true });
});

mediator.initialize();
```

---

### 10. BaseTunnelManager (Abstract Class)

**Purpose**: Shared tunnel logic

**State** & **Operations**: Same as before (unchanged)

---

### 11. ConfigurationService

**Purpose**: Centralize env var reading

**State**:
```javascript
class ConfigurationService {
  #config;

  constructor(env = process.env) {
    this.#config = {
      TERMINAL_KEY: env.TERMINAL_KEY || 'change-me',
      PORT: parseInt(env.PORT) || 3030,
      WORKSPACES_ROOT: env.WORKSPACES_ROOT || '/workspace',
      // ...
    };
    this.#validate();
  }

  #validate() {
    if (!this.#config.TERMINAL_KEY) {
      throw new Error('TERMINAL_KEY required');
    }
  }

  get(key) {
    return this.#config[key];
  }
}
```

**Dependencies**: None (reads process.env)

---

### 12-13. AuthenticationMiddleware & ErrorHandlingMiddleware

**Pattern**: Stateless functions or simple classes

```javascript
// Middleware factory function
export function createAuthMiddleware(jwtService) {
  return ([event, ...args], next) => {
    const token = args[0]?.authKey;
    try {
      const claims = jwtService.validateToken(token);
      args[0].userId = claims.userId;
      next();
    } catch (err) {
      next(new AuthError(err.message));
    }
  };
}
```

**Dependencies**: Receives `jwtService` via factory (closure)

---

## Client-Side Pattern (Svelte Context)

**Root Layout** (`src/routes/+layout.svelte`):
```svelte
<script>
  import { setContext } from 'svelte';
  import { SocketService } from '$lib/client/shared/services/SocketService.svelte.js';
  import { SessionViewModel } from '$lib/client/shared/state/SessionViewModel.svelte.js';

  // Initialize services
  const socketService = new SocketService();
  const sessionViewModel = new SessionViewModel(socketService);

  // Share via context
  setContext('services', {
    socket: socketService,
    sessionVM: sessionViewModel
  });
</script>
```

**Child Components**:
```svelte
<script>
  import { getContext } from 'svelte';

  const { sessionVM } = getContext('services');

  async function createSession() {
    await sessionVM.createSession('pty');
  }
</script>
```

**Testing**:
```javascript
import { setContext } from 'svelte';
import { render } from '@testing-library/svelte';

test('component uses services', () => {
  const mockServices = {
    sessionVM: { createSession: vi.fn() }
  };

  render(MyComponent, {
    context: new Map([['services', mockServices]])
  });
});
```

---

## Dependency Graph (Simplified)

```
Configuration → DatabaseManager
                    ↓
        ┌──────────────────────────┐
        ↓                          ↓
    Repositories              JWTService
  (Session, Event, etc.)
        ↓
    EventRecorder → SessionOrchestrator
                         ↓
                  SocketEventMediator (uses JWT middleware)
```

**Key Insight**: Dependency graph is **explicit** in `createServices()` function - no hidden magic, no framework, just function calls.

---

## Transaction Scope

**Per-Request Transaction** (unchanged):

```
HTTP/Socket Request
  └─ Middleware: db.transaction(() => {
      ├─ SessionRepository.create()
      ├─ EventStore.append()
      └─ Commit (auto)
     })()
```

---

## Testing Strategy

**Server-Side**:
- **Unit Tests**: Mock dependencies via constructor injection
  ```javascript
  const mockDb = { prepare: vi.fn() };
  const repo = new SessionRepository(mockDb);
  ```

- **Integration Tests**: Use `createServices()` with test config
  ```javascript
  const services = createServices({ TERMINAL_KEY: 'test' });
  ```

- **API Tests**: Mock entire `services` export
  ```javascript
  vi.mock('$lib/server/shared/services', () => ({
    services: { sessionOrchestrator: { createSession: vi.fn() } }
  }));
  ```

**Client-Side**:
- **Component Tests**: Override Svelte context
  ```javascript
  render(Component, {
    context: new Map([['services', mockServices]])
  });
  ```

---

## Next Phase

Generate contracts/ with JSDoc interfaces (no complex DI types, just service interfaces)
