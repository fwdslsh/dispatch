# Refactoring Verification Quickstart (Simplified Approach)

**Feature**: 007-design-pattern-refactor
**Purpose**: Verify simplified architecture using ES6 modules and Svelte context (NO DI framework)
**Prerequisites**: Refactored code deployed, `npm run dev:test` server running

## Quick Verification Steps

### 1. Service Initialization Verification

**Objective**: Confirm `createServices()` factory function wires dependencies correctly

**Steps**:

```bash
# Start application
npm run dev:test

# Expected log output:
# ✓ Initializing services...
# ✓ DatabaseManager: Connected to workspace.db
# ✓ SessionRepository: Initialized with 4 prepared statements
# ✓ EventStore: Initialized with event log access
# ✓ SessionOrchestrator: Initialized with 3 dependencies
# ✓ Services initialized successfully
```

**Validation**:
- No "DependencyContainer" references in logs (that was the old complex approach)
- Services initialized via factory function
- Dependencies explicitly wired (visible in logs)

**Code Check**:

```javascript
// src/lib/server/shared/services.js should contain:
export function createServices(config) {
  const db = new DatabaseManager(config);
  const sessionRepo = new SessionRepository(db); // Explicit dependency
  // ... more explicit wiring
  return { db, sessionRepo, eventStore, ... };
}

export let services;
export function initializeServices(config) {
  services = createServices(config);
}
```

**Failure Indicators**:
- References to "DependencyContainer.resolve()"
- Hidden service initialization
- Circular import errors (JavaScript throws naturally)

---

### 2. Repository Separation Verification

**Objective**: Confirm database operations use focused repositories

**Steps**:

```bash
# Create session via API
curl -X POST http://localhost:7173/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "type": "pty",
    "workspacePath": "/workspace/test",
    "authKey": "test-automation-key-12345"
  }'

# Expected log output:
# ✓ SessionRepository.create(): Creating session abc123
# ✓ EventStore.append(): Appending event seq=1 for session abc123
# ✓ Transaction committed successfully
```

**Code Check**:

```javascript
// API route should look like:
import { services } from '$lib/server/shared/services';

export async function POST({ request }) {
  const session = await services.sessionRepository.create(data);
  await services.eventStore.append(session.id, event);
  return json(session);
}
```

**Validation**:
- Import from `services` module (simple ES6 import)
- No global singleton pattern (`globalServicesInstance`)
- Repository methods called directly

---

### 3. Svelte Context Verification (Client-Side)

**Objective**: Confirm client services shared via Svelte context API

**Steps**:

```bash
# Open browser DevTools console
# Navigate to application
# Check console logs

# Expected log output:
# ✓ Root layout: Setting services context
# ✓ SocketService: Initialized
# ✓ SessionViewModel: Initialized with SocketService dependency
```

**Code Check**:

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { setContext } from 'svelte';
  import { SocketService } from '$lib/client/shared/services/SocketService.svelte.js';

  const socketService = new SocketService();
  setContext('services', { socket: socketService });
</script>

<!-- Child component -->
<script>
  import { getContext } from 'svelte';
  const { socket } = getContext('services');
</script>
```

**Validation**:
- Using native Svelte `setContext`/`getContext` (not custom framework)
- Services shared from root layout
- Child components retrieve via `getContext`

**Failure Indicators**:
- Custom context provider classes
- Global stores instead of context
- Props drilling

---

### 4. Socket.IO Organization Verification

**Objective**: Confirm socket events routed through mediator

**Steps**:

```bash
# Attach to session via WebSocket
# Send event: run:attach with sessionId

# Expected log output:
# ✓ SocketEventMediator: Routing event 'run:attach'
# ✓ authMiddleware: Validating JWT token...
# ✓ sessionHandlers.attach: Attaching to session abc123
```

**Code Check**:

```javascript
// Socket setup should use mediator pattern
import { services } from '$lib/server/shared/services';

const mediator = new SocketEventMediator(io);
mediator.use(createAuthMiddleware(services.jwtService)); // Middleware factory
mediator.on('run:attach', sessionHandlers.attach);
mediator.initialize();
```

**Validation**:
- Middleware as factory functions (closures over services)
- Domain handlers in separate modules
- No monolithic socket-setup.js

---

### 5. JWT Authentication Verification

**Objective**: Confirm JWT tokens used via simple JWTService class

**Steps**:

```bash
# Request with TERMINAL_KEY → receive JWT
curl -X POST http://localhost:7173/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"key": "test-automation-key-12345"}'

# Response:
# {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", "expiresIn": "30d"}

# Use JWT for subsequent request
curl -X GET "http://localhost:7173/api/sessions" \
  -H "Authorization: Bearer <token>"
```

**Code Check**:

```javascript
// Simple JWTService class (no framework)
class JWTService {
  #secret;

  constructor(terminalKey) {
    this.#secret = terminalKey;
  }

  generateToken(payload) {
    return jwt.sign(payload, this.#secret, { expiresIn: '30d' });
  }

  validateToken(token) {
    return jwt.verify(token, this.#secret);
  }
}

// Used in services
import { services } from '$lib/server/shared/services';
const claims = services.jwtService.validateToken(token);
```

**Validation**:
- Simple ES6 class with private fields
- Constructor receives dependencies (explicit)
- No complex auth framework

---

### 6. Module Mocking in Tests

**Objective**: Verify tests use simple Vitest module mocking (no DI framework test mode)

**Steps**:

```bash
npm run test:unit
```

**Code Check**:

```javascript
// tests/server/api/sessions.test.js
import { vi } from 'vitest';

// Simple module mock (native Vitest)
vi.mock('$lib/server/shared/services', () => ({
  services: {
    sessionRepository: { create: vi.fn() },
    sessionOrchestrator: { createSession: vi.fn() }
  }
}));

test('creates session', async () => {
  services.sessionOrchestrator.createSession.mockResolvedValue({ id: '123' });
  // Test API route
});
```

**Validation**:
- Using Vitest `vi.mock()` (native, not custom framework)
- Mocking entire `services` export
- No DI container test mode

**Failure Indicators**:
- Custom mock container classes
- Complex test setup
- Framework-specific test patterns

---

### 7. Performance Verification

**Objective**: Confirm simplified approach doesn't degrade performance

**Steps**:

```bash
# Benchmark session creation (10 sessions)
for i in {1..10}; do
  time curl -X POST http://localhost:7173/api/sessions \
    -H "Content-Type: application/json" \
    -d "{\"type\": \"pty\", \"workspacePath\": \"/workspace/test-$i\", \"authKey\": \"test-automation-key-12345\"}"
done

# Expected: < 100ms per session (same as before refactoring)
```

**Validation**:
- Session creation < 100ms (NFR-007)
- Event throughput maintained (NFR-008)
- Memory < 10% increase (NFR-009)

**Why Simplified Approach is Fast**:
- No DI container overhead (direct function calls)
- Native ES6 modules (optimized by V8)
- Svelte context (minimal runtime cost)

---

## Integration Test Suite

```bash
# Unit tests (repositories, services, orchestrators)
npm run test:unit

# Integration tests (service wiring, transactions, auth flow)
npm run test:integration

# E2E tests (full stack validation)
npm run test:e2e

# Performance benchmarks
npm run test:perf
```

**Expected Results**:
- ✅ All unit tests pass (simple mocks via `vi.mock()`)
- ✅ All integration tests pass (factory function creates valid services)
- ✅ All E2E tests pass (no regressions)
- ✅ Performance within targets

---

## Troubleshooting

### Service Initialization Errors

**Circular Import Detected**:

```
ReferenceError: Cannot access 'SessionRepository' before initialization
```

**Solution**: JavaScript naturally prevents circular imports. Review import order in `services.js`, ensure dependencies imported before use.

**Missing Dependency**:

```
TypeError: Cannot read properties of undefined (reading 'create')
```

**Solution**: Check `createServices()` returns all required services in object.

### Svelte Context Errors

**Context Not Found**:

```
Error: Context 'services' not found
```

**Solution**: Ensure `setContext('services', ...)` called in root `+layout.svelte` before child components render.

### Module Mocking Issues

**Mock Not Applied**:

```
Test called real service instead of mock
```

**Solution**: Ensure `vi.mock()` called before any imports that use the module. Move mock to top of test file.

---

## Success Criteria

✅ All 7 verification steps pass
✅ **NO DI framework code** (no DependencyContainer class, no Awilix, no InversifyJS)
✅ **Simple ES6 patterns only** (factory function, module exports, Svelte context)
✅ Services initialized explicitly in ~50 lines (readable, testable)
✅ Client services shared via native Svelte context API
✅ Tests use native Vitest mocking (no custom framework)
✅ Performance targets met (< 100ms sessions, throughput maintained, < 10% memory)

**Simplicity Check**:
- Can a new developer understand dependency graph in 5 minutes? ✅ (just read `createServices()`)
- Is testing straightforward? ✅ (standard `vi.mock()` patterns)
- Zero framework magic? ✅ (native JavaScript/Svelte only)

**Next Step**: If all verifications pass → Ready for Big Bang deployment!

---

## Comparison to Complex Approach (What We Avoided)

**❌ What We Did NOT Do** (complex approach):
- Create DependencyContainer class (~200 lines)
- Implement service registration API
- Build circular dependency detection framework
- Create test container mode
- Learn DI framework DSL

**✅ What We DID Do** (simple approach):
- Write `createServices()` factory function (~50 lines)
- Use ES6 imports (native JavaScript)
- Use Svelte context API (native Svelte)
- Use `vi.mock()` for tests (native Vitest)

**Lines of Framework Code**: 0 (vs ~200 in complex approach)
**New Dependencies**: 1 (jsonwebtoken only)
**Learning Curve**: Minimal (just ES6 + Svelte basics)
