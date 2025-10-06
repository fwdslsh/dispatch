# Code Review Fix Task List
**Branch**: `007-design-pattern-refactor`
**Date**: 2025-10-06
**Reviews By**: Refactoring Specialist & Svelte MVVM Architect

## Summary

Two comprehensive code reviews identified critical issues, improvements, and enhancements. This document organizes all feedback into actionable tasks prioritized by severity and impact.

---

## Priority 1: Critical Fixes (Must Fix Before Production)

### Server-Side Critical Issues

#### FIX-001: EventStore Sequence Race Condition
**Severity**: CRITICAL
**Impact**: Data integrity - duplicate sequence numbers cause event replay failures
**File**: `src/lib/server/database/EventStore.js` (Lines 27-58)

**Problem**: Race condition in sequence initialization allows multiple threads to initialize same sequence counter

**Task**:
```javascript
// Implement mutex pattern for sequence initialization
#initializingSequences = new Set();

async append(sessionId, event) {
    if (!this.#sequences.has(sessionId)) {
        if (this.#initializingSequences.has(sessionId)) {
            // Wait for initialization to complete
            await new Promise(resolve => setTimeout(resolve, 10));
            return this.append(sessionId, event);  // Retry
        }

        this.#initializingSequences.add(sessionId);
        const lastSeq = await this.getLatestSeq(sessionId);
        this.#sequences.set(sessionId, lastSeq + 1);
        this.#initializingSequences.delete(sessionId);
    }

    const seq = this.#sequences.get(sessionId);
    this.#sequences.set(sessionId, seq + 1);
    // ... rest of method
}
```

**Acceptance Criteria**:
- [ ] Race condition test added
- [ ] No duplicate sequences under concurrent load
- [ ] Existing tests still pass

---

#### FIX-002: Remove Transaction Middleware Anti-Pattern
**Severity**: CRITICAL
**Impact**: Performance degradation, potential deadlocks, connection pool exhaustion
**File**: `src/hooks.server.js` (Lines 112-129)

**Problem**: Wrapping entire HTTP request cycles in database transactions is an anti-pattern

**Task**:
1. Remove transaction middleware from `hooks.server.js`
2. Implement transactions at repository method level for atomic operations
3. Add transaction helper methods to DatabaseManager

**Example**:
```javascript
// In DatabaseManager
async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
        const result = await callback();
        await this.run('COMMIT');
        return result;
    } catch (error) {
        await this.run('ROLLBACK');
        throw error;
    }
}

// In SessionRepository
async createWithEvents(sessionData, initialEvents) {
    return await this.#db.transaction(async () => {
        const session = await this.create(sessionData);
        for (const event of initialEvents) {
            await this.#eventStore.append(session.id, event);
        }
        return session;
    })();
}
```

**Acceptance Criteria**:
- [ ] Transaction middleware removed from hooks.server.js
- [ ] DatabaseManager.transaction() method implemented
- [ ] Repository-level transactions added for atomic operations
- [ ] Performance test shows improved throughput

---

#### FIX-003: Fix Socket Middleware Chain
**Severity**: CRITICAL
**Impact**: Auth middleware and error handling bypassed for registered handlers
**File**: `src/lib/server/socket/SocketEventMediator.js` (Lines 52-67)

**Problem**: Handlers bypass middleware chain

**Task**:
```javascript
// Compose middleware chain manually
#composeMiddleware(handler) {
    return this.#middleware.reduceRight((next, mw) => {
        return (...args) => mw(args, () => next(...args));
    }, handler);
}

initialize() {
    this.#io.on('connection', (socket) => {
        this.#middleware.forEach((mw) => socket.use(mw));

        this.#handlers.forEach((handler, eventName) => {
            // Apply composed middleware
            const composedHandler = this.#composeMiddleware(handler);
            socket.on(eventName, (...args) => composedHandler(socket, ...args));
        });
    });
}
```

**Acceptance Criteria**:
- [ ] Auth middleware applies to all handlers
- [ ] Error handling middleware catches handler errors
- [ ] Integration test verifies middleware chain

---

### Client-Side Critical Issues

#### FIX-004: Extract Business Logic from TerminalPane
**Severity**: HIGH
**Impact**: MVVM violation, untestable logic, tight coupling
**File**: `src/lib/client/terminal/TerminalPane.svelte` (Lines 112-230)

**Problem**: Extensive business logic in component `onMount`

**Task**:
1. Create `TerminalPaneViewModel.svelte.js`
2. Move authentication, attachment, and event handling to ViewModel
3. Update component to use ViewModel

```javascript
// terminal/viewmodels/TerminalPaneViewModel.svelte.js
export class TerminalPaneViewModel {
    isAttached = $state(false);
    isCatchingUp = $state(false);
    connectionError = $state(null);

    async initialize(sessionId, authKey, handleEvent) {
        // All onMount logic here
        if (!runSessionClient.getStatus().authenticated) {
            await runSessionClient.authenticate(authKey);
        }
        const result = await runSessionClient.attachToRunSession(sessionId, handleEvent, 0);
        this.isAttached = result.success;
    }
}

// TerminalPane.svelte
const viewModel = new TerminalPaneViewModel();
onMount(() => viewModel.initialize(sessionId, authKey, handleRunEvent));
```

**Acceptance Criteria**:
- [ ] ViewModel created with all business logic
- [ ] Component only contains UI/presentation logic
- [ ] Unit tests added for ViewModel

---

#### FIX-005: Extract Business Logic from ClaudePane
**Severity**: HIGH
**Impact**: MVVM violation, code duplication with TerminalPane
**File**: `src/lib/client/claude/ClaudePane.svelte` (Lines 104-148)

**Problem**: Authentication and attachment logic duplicated in component

**Task**: Same pattern as FIX-004
1. Move onMount logic to `ClaudePaneViewModel`
2. Extract initialization method
3. Update component

**Acceptance Criteria**:
- [ ] No business logic in ClaudePane.svelte
- [ ] ClaudePaneViewModel handles initialization
- [ ] Unit tests added

---

#### FIX-006: Create AuthViewModel for Login Page
**Severity**: HIGH
**Impact**: Business logic in view, untestable
**File**: `src/routes/+page.svelte` (Lines 60-89)

**Problem**: Authentication logic directly in component

**Task**:
```javascript
// shared/state/AuthViewModel.svelte.js
export class AuthViewModel {
    loading = $state(false);
    error = $state(null);

    async login(key) {
        this.loading = true;
        this.error = null;
        try {
            const response = await this.authApi.check(key);
            if (response.ok) {
                this.storeToken(key);
                return true;
            }
            this.error = 'Invalid key';
            return false;
        } finally {
            this.loading = false;
        }
    }
}
```

**Acceptance Criteria**:
- [ ] AuthViewModel created
- [ ] Login page uses ViewModel
- [ ] Error handling centralized

---

## Priority 2: Important Improvements

### Server-Side Improvements

#### FIX-007: Fix SQL Injection Risk in SessionRepository
**Severity**: MEDIUM
**Impact**: Query errors, potential security issue
**File**: `src/lib/server/database/SessionRepository.js` (Line 76)

**Task**: Use JSON extraction instead of string interpolation
```javascript
async findByWorkspace(workspacePath) {
    const rows = await this.#db.all(
        `SELECT * FROM sessions
         WHERE json_extract(meta_json, '$.workspacePath') = ?
         ORDER BY updated_at DESC`,
        [workspacePath]
    );
    return rows.map((row) => this.#parseSession(row));
}
```

**Acceptance Criteria**:
- [ ] No string interpolation in SQL queries
- [ ] Test with special characters in workspacePath
- [ ] Query performance maintained

---

#### FIX-008: Add Settings Schema Validation
**Severity**: MEDIUM
**Impact**: Data integrity, runtime errors
**File**: `src/lib/server/database/SettingsRepository.js`

**Task**: Add Zod validation for settings
```javascript
import { z } from 'zod';

const globalSettingsSchema = z.object({
    theme: z.enum(['light', 'dark', 'retro']),
    // ... other settings
});

async set(key, value) {
    const settings = await this.getByCategory('global');
    settings[key] = value;

    const validated = globalSettingsSchema.parse(settings);
    await this.setByCategory('global', validated);
}
```

**Acceptance Criteria**:
- [ ] Schema validation added for all setting categories
- [ ] Validation errors return meaningful messages
- [ ] Tests cover invalid settings

---

#### FIX-009: Fix EventRecorder Memory Leak
**Severity**: MEDIUM
**Impact**: Memory growth over time
**File**: `src/lib/server/sessions/EventRecorder.js` (Line 14)

**Task**: Add TTL-based buffer cleanup
```javascript
#buffers = new Map();
#bufferTimestamps = new Map();

startBuffering(sessionId) {
    this.#buffers.set(sessionId, {...});
    this.#bufferTimestamps.set(sessionId, Date.now());

    // Auto-cleanup after 5 minutes
    setTimeout(() => this.#autoCleanBuffer(sessionId), 5 * 60 * 1000);
}

#autoCleanBuffer(sessionId) {
    const timestamp = this.#bufferTimestamps.get(sessionId);
    if (timestamp && Date.now() - timestamp > 5 * 60 * 1000) {
        this.clearBuffer(sessionId);
        logger.warn('EVENT_RECORDER', `Auto-cleaned stale buffer for ${sessionId}`);
    }
}
```

**Acceptance Criteria**:
- [ ] Stale buffers auto-cleaned
- [ ] Memory test shows no growth
- [ ] Cleanup doesn't affect active sessions

---

#### FIX-010: Clear EventStore Sequences on Session Close
**Severity**: MEDIUM
**Impact**: Memory growth proportional to total sessions
**File**: `src/lib/server/sessions/SessionOrchestrator.js`

**Task**:
```javascript
async closeSession(sessionId) {
    // ... existing code
    this.#eventRecorder.clearBuffer(sessionId);
    this.#eventRecorder.eventStore.clearSequence(sessionId);  // Add this
}
```

**Acceptance Criteria**:
- [ ] Sequences cleared on session close
- [ ] Memory usage doesn't grow with closed sessions
- [ ] Can still query historical events

---

### Client-Side Improvements

#### FIX-011: Remove Config Reactivity in ServiceContainer
**Severity**: LOW
**Impact**: Unnecessary reactivity overhead
**File**: `src/lib/client/shared/services/ServiceContainer.svelte.js` (Line 28)

**Task**: Change config from $state to plain object
```javascript
this.config = {
    apiBaseUrl: '',
    socketUrl: '',
    authTokenKey: 'dispatch-auth-token',
    debug: false
};
```

**Acceptance Criteria**:
- [ ] Config is plain object
- [ ] No reactivity warnings
- [ ] Tests still pass

---

#### FIX-012: Standardize Service Instantiation Pattern
**Severity**: MEDIUM
**Impact**: Inconsistent architecture, confusion
**Files**: Multiple service files

**Task**: Choose one pattern:

**Option A - Context-based (Recommended)**:
```javascript
// Register all services in ServiceContainer
this.registerFactory('runSessionClient', async () => {
    return new RunSessionClient(this.config);
});

// Remove singleton exports
```

**Option B - Singleton-based**:
```javascript
// Keep singleton exports, remove from ServiceContainer
export const runSessionClient = new RunSessionClient();
```

**Acceptance Criteria**:
- [ ] Single pattern used consistently
- [ ] Documentation updated
- [ ] All services accessible via chosen pattern

---

#### FIX-013: Decouple SessionViewModel from AppState
**Severity**: MEDIUM
**Impact**: Tight coupling between ViewModels
**File**: `src/lib/client/shared/state/SessionViewModel.svelte.js` (Line 112)

**Task**: Use event emitter pattern
```javascript
// SessionViewModel.svelte.js
this.emit('sessions:loaded', validatedSessions);

// AppState.svelte.js
sessionViewModel.on('sessions:loaded', (sessions) => {
    this.sessions.loadSessions(sessions);
});
```

**Acceptance Criteria**:
- [ ] SessionViewModel doesn't directly manipulate AppState
- [ ] Event-based communication implemented
- [ ] ViewModels can be tested independently

---

## Priority 3: Enhancements & Refactoring

#### FIX-014: Extract Session State Machine
**Severity**: LOW
**Impact**: Code quality, maintainability

**Task**: Create explicit state machine
```javascript
// src/lib/server/sessions/SessionStateMachine.js
export class SessionStateMachine {
    #validTransitions = {
        'starting': ['running', 'error', 'stopped'],
        'running': ['stopped', 'error'],
        'stopped': ['starting'],
        'error': ['starting']
    };

    validateTransition(fromStatus, toStatus) {
        if (!this.canTransition(fromStatus, toStatus)) {
            throw new Error(`Invalid transition: ${fromStatus} -> ${toStatus}`);
        }
    }
}
```

**Acceptance Criteria**:
- [ ] State machine created
- [ ] Used in SessionOrchestrator
- [ ] Tests cover invalid transitions

---

#### FIX-015: Extract Event Channel Constants
**Severity**: LOW
**Impact**: Code quality, type safety

**Task**:
```javascript
// src/lib/shared/event-channels.js
export const EVENT_CHANNELS = {
    PTY: {
        STDOUT: 'pty:stdout',
        STDERR: 'pty:stderr',
        EXIT: 'pty:exit'
    },
    CLAUDE: {
        DELTA: 'claude:delta',
        USAGE: 'claude:usage',
        COMPLETE: 'claude:complete'
    }
};
```

**Acceptance Criteria**:
- [ ] Constants module created
- [ ] All magic strings replaced
- [ ] Tests verify constants

---

#### FIX-016: Add Circuit Breaker for Database
**Severity**: LOW
**Impact**: Resilience, error handling

**Task**: Implement circuit breaker pattern

**Acceptance Criteria**:
- [ ] Circuit breaker wraps db operations
- [ ] Opens after threshold failures
- [ ] Closes after reset timeout

---

#### FIX-017: Add Request Correlation IDs
**Severity**: LOW
**Impact**: Debugging, observability

**Task**: Add correlation ID middleware

**Acceptance Criteria**:
- [ ] UUID correlation ID per request
- [ ] Logged in all layers
- [ ] Trace requests across services

---

#### FIX-018: Add Adapter Lifecycle Hooks
**Severity**: LOW
**Impact**: Extensibility

**Task**: Add `onBeforeCreate`, `onAfterClose` hooks to adapter interface

**Acceptance Criteria**:
- [ ] Hooks added to adapter interface
- [ ] Called in SessionOrchestrator
- [ ] Example adapter uses hooks

---

#### FIX-019: Add Service Health Checks
**Severity**: LOW
**Impact**: Monitoring, operations

**Task**: Add health check to services
```javascript
services.health = {
    async check() {
        return {
            database: await services.db.isInitialized,
            repositories: services.sessionRepository ? 'ok' : 'error',
            adapters: services.adapterRegistry.getRegisteredKinds().length
        };
    }
};
```

**Acceptance Criteria**:
- [ ] Health check added to services
- [ ] `/api/health` endpoint created
- [ ] Returns status of all services

---

#### FIX-020: Improve Process Existence Check
**Severity**: LOW
**Impact**: Reliability
**File**: `src/lib/server/tunnels/BaseTunnelManager.js` (Lines 143-151)

**Task**: Store process creation timestamp and validate
```javascript
_processExists(pid, startTime) {
    try {
        process.kill(pid, 0);
        // Additional validation if needed
        return true;
    } catch {
        return false;
    }
}
```

**Acceptance Criteria**:
- [ ] PID wraparound handled
- [ ] Zombie processes detected
- [ ] Tests cover edge cases

---

## Priority 4: Testing Tasks

#### FIX-021: Complete Repository Unit Tests
**Related Tasks**: T037-T040

**Files to Test**:
- `tests/server/database/session-repository.test.js`
- `tests/server/database/event-store.test.js`
- `tests/server/database/settings-repository.test.js`
- `tests/server/database/workspace-repository.test.js`

**Acceptance Criteria**:
- [ ] 90%+ test coverage for repositories
- [ ] Edge cases covered
- [ ] Error handling tested

---

#### FIX-022: Complete Session Component Unit Tests
**Related Tasks**: T041-T043

**Files to Test**:
- `tests/server/sessions/adapter-registry.test.js`
- `tests/server/sessions/event-recorder.test.js`
- `tests/server/sessions/session-orchestrator.test.js`

**Acceptance Criteria**:
- [ ] 85%+ test coverage
- [ ] Async operations tested
- [ ] Race conditions verified

---

#### FIX-023: Complete Socket Component Unit Tests
**Related Tasks**: T044-T046

**Files to Test**:
- `tests/server/socket/socket-event-mediator.test.js`
- `tests/server/socket/middleware/auth.test.js`
- `tests/server/socket/middleware/error-handling.test.js`

**Acceptance Criteria**:
- [ ] Middleware chain tested
- [ ] Auth flow verified
- [ ] Error handling validated

---

#### FIX-024: Complete Integration Tests
**Related Tasks**: T048-T052

**Files to Test**:
- `tests/integration/services-initialization.test.js`
- `tests/integration/repository-transactions.test.js`
- `tests/integration/auth-flow.test.js`
- `tests/integration/socket-middleware.test.js`
- `tests/integration/session-creation.test.js`

**Acceptance Criteria**:
- [ ] Full stack tested
- [ ] Real database used
- [ ] Socket.IO integration verified

---

#### FIX-025: Complete E2E & Performance Tests
**Related Tasks**: T053-T059

**Files to Test**:
- `e2e/terminal-session.spec.js`
- `e2e/claude-session.spec.js`
- `e2e/file-editor-session.spec.js`
- `e2e/workspace-management.spec.js`
- `tests/performance/session-creation.test.js`
- `tests/performance/event-throughput.test.js`
- `tests/performance/memory-footprint.test.js`

**Acceptance Criteria**:
- [ ] User workflows verified
- [ ] Session creation < 100ms
- [ ] Memory < 10% increase

---

## Implementation Plan

### Week 1: Critical Fixes
- [ ] FIX-001: EventStore race condition
- [ ] FIX-002: Remove transaction middleware
- [ ] FIX-003: Fix socket middleware chain
- [ ] FIX-004: Extract TerminalPane logic
- [ ] FIX-005: Extract ClaudePane logic
- [ ] FIX-006: Create AuthViewModel

### Week 2: Important Improvements
- [ ] FIX-007: SQL injection fix
- [ ] FIX-008: Settings validation
- [ ] FIX-009: EventRecorder cleanup
- [ ] FIX-010: Clear sequences
- [ ] FIX-011: Config reactivity
- [ ] FIX-012: Service pattern
- [ ] FIX-013: Decouple ViewModels

### Week 3: Testing
- [ ] FIX-021: Repository tests
- [ ] FIX-022: Session component tests
- [ ] FIX-023: Socket tests
- [ ] FIX-024: Integration tests
- [ ] FIX-025: E2E & performance tests

### Week 4: Enhancements
- [ ] FIX-014: State machine
- [ ] FIX-015: Event constants
- [ ] FIX-016: Circuit breaker
- [ ] FIX-017: Correlation IDs
- [ ] FIX-018: Adapter hooks
- [ ] FIX-019: Health checks
- [ ] FIX-020: Process check

---

## Summary Statistics

**Total Fixes**: 25
**Critical (P1)**: 6
**Important (P2)**: 7
**Enhancements (P3)**: 7
**Testing (P4)**: 5

**Estimated Effort**: 4 weeks
**Must-Fix Before Production**: 6 items (Week 1)

---

## Review Sign-Off

**Refactoring Specialist Review**: Complete
**Svelte MVVM Architect Review**: Complete
**Fix Task List**: Ready for implementation

**Next Steps**:
1. Prioritize and assign tasks
2. Create tracking issues/tickets
3. Begin Week 1 critical fixes
4. Update tasks.md as fixes are completed
