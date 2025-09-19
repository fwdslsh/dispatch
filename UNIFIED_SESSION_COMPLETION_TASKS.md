# Unified Session Architecture - Completion Tasks

## Executive Summary

Based on codebase analysis, the unified session architecture is **85% complete**. Core infrastructure is implemented but requires cleanup and modernization of remaining legacy components.

## Architecture Status

### ✅ **IMPLEMENTED (Complete)**
1. **Database Schema** - Unified sessions table, session_events, workspace_layout (`src/lib/server/db/DatabaseManager.js`)
2. **RunSessionManager** - Event-sourced session management (`src/lib/server/runtime/RunSessionManager.js`)
3. **Adapters** - PtyAdapter and ClaudeAdapter with comprehensive options support
4. **Socket.IO Setup** - Unified run:* events (`src/lib/server/socket-setup.js`)
5. **Services Initialization** - Proper DI with adapters (`src/lib/server/services/index.js`)
6. **API Routes** - Using unified session API (`src/routes/api/sessions/+server.js`)
7. **RunSessionClient** - Client-side unified session management

### 🔄 **PARTIALLY COMPLETE (Needs Updates)**
1. **Client Components** - Some still reference legacy socket events
2. **Test Suite** - Many tests still use old socket events and patterns
3. **Socket Events Constants** - Contains deprecated events marked but still in use

### ❌ **TODO (Remaining Tasks)**
1. **Legacy Component Migration** - Update components to use RunSessionClient
2. **Test Modernization** - Update all tests to use unified architecture
3. **Documentation Updates** - Cleanup and modernize docs
4. **Dead Code Removal** - Remove unused files and legacy patterns

---

## Task Breakdown

### **TASK 1: Update Client Components to Use Unified Architecture**
**Priority: HIGH** | **Estimated Time: 2-3 hours**

**Files to Update:**
- `src/lib/client/claude/ClaudeCommands.svelte` - Replace legacy socket events with RunSessionClient
- `src/lib/client/claude/ClaudePane.svelte` - Modernize to use run:* events
- `src/lib/client/terminal/TerminalPane.svelte` - Update to use RunSessionClient
- `src/lib/client/shared/session-modules/terminal.js` - Replace with run session integration
- `src/lib/client/shared/session-modules/claude.js` - Replace with run session integration

**Implementation Details:**
- Replace `socket.emit('claude.send')` with `runSessionClient.sendInput(runId, data)`
- Replace `socket.on('terminal.output')` with `runSessionClient.attachToRunSession()` event handlers
- Update session creation to use `runSessionClient.createRunSession(kind, cwd, options)`
- Remove direct socket imports and use singleton `runSessionClient` instance

**Success Criteria:**
- All client components use RunSessionClient exclusively
- No direct socket.io imports in component files
- Event handling goes through unified run:event pattern

---

### **TASK 2: Modernize Test Suite for Unified Architecture**
**Priority: HIGH** | **Estimated Time: 3-4 hours**

**Files to Update:**
- `tests/server/socket-session-status-unit.test.js` - Update to test run:* events
- `e2e/claude-session-resumption.spec.js` - Test unified session resumption
- `tests/client/claude-commands-session-matching.test.js` - Update to use RunSessionClient
- All E2E tests in `e2e/` directory - Update event expectations

**Implementation Details:**
- Replace `socket.emit('terminal.start')` with `runSessionManager.createRunSession()`
- Update test expectations from `'terminal.output'` to `'run:event'` with `channel: 'pty:stdout'`
- Test adapter functionality rather than old manager classes
- Verify event-sourced history and sequence numbers
- Test multi-client session attachment

**Success Criteria:**
- All tests pass with unified architecture
- No tests use deprecated socket events
- E2E tests verify run session functionality end-to-end

---

### **TASK 3: Remove Legacy Socket Events and Dead Code**
**Priority: MEDIUM** | **Estimated Time: 1-2 hours**

**Files to Clean:**
- `src/lib/shared/socket-events.js` - Remove deprecated events, keep only unified ones
- Remove unused session management files (if any exist)
- Clean up imports across codebase

**Implementation Details:**
- Remove `CLAUDE_SEND`, `TERMINAL_WRITE`, and other deprecated events from constants
- Search and remove all references to old events
- Remove any remaining SessionManager/TerminalManager imports
- Clean up commented-out code blocks in socket-events.js

**Success Criteria:**
- Socket events file only contains currently-used events
- No deprecated event references in codebase
- Reduced bundle size and code complexity

---

### **TASK 4: Update Documentation and Examples**
**Priority: LOW** | **Estimated Time: 1 hour**

**Files to Update:**
- Update any API documentation to reflect unified session patterns
- Update development guides to show RunSessionClient usage
- Update testing guides to show unified test patterns

**Implementation Details:**
- Document RunSessionClient API and patterns
- Provide examples of run session creation and management
- Document event-sourced architecture benefits
- Update troubleshooting guides

**Success Criteria:**
- Documentation reflects current unified architecture
- Clear examples for developers
- Migration guide for any future changes

---

### **TASK 5: Performance Testing and Optimization**
**Priority: LOW** | **Estimated Time: 1-2 hours**

**Implementation Details:**
- Test session creation/attachment performance
- Verify event-sourced history doesn't cause memory leaks
- Test multi-client session attachment scalability
- Optimize database queries if needed

**Success Criteria:**
- Session operations complete within acceptable time limits
- Memory usage remains stable under load
- Database queries are optimized with proper indexes

---

### **TASK 6: Error Handling and Resilience Improvements**
**Priority: MEDIUM** | **Estimated Time: 2 hours**

**Implementation Details:**
- Add comprehensive error handling to RunSessionManager
- Improve adapter error recovery (e.g., if node-pty fails to load)
- Add client-side reconnection logic to RunSessionClient
- Test failure scenarios and graceful degradation

**Success Criteria:**
- Robust error handling throughout the stack
- Graceful failure modes when adapters unavailable
- Client automatically reconnects and resumes sessions
- Clear error messages for users and developers

---

## Implementation Order

1. **TASK 1** - Client Components (blocking for full functionality)
2. **TASK 2** - Test Suite (ensures quality)
3. **TASK 6** - Error Handling (critical for production)
4. **TASK 3** - Legacy Cleanup (code quality)
5. **TASK 4** - Documentation (developer experience)
6. **TASK 5** - Performance Testing (optimization)

## Success Metrics

- [ ] All client components use RunSessionClient
- [ ] All tests pass with unified architecture
- [ ] No legacy socket events in use
- [ ] Session creation/attachment works reliably
- [ ] Multi-client session sharing works
- [ ] Event-sourced history enables reliable resume
- [ ] Performance meets acceptable thresholds
- [ ] Documentation is up-to-date and accurate

## Risk Assessment

**LOW RISK**: Core infrastructure is solid. Remaining work is primarily cleanup and modernization.

**POTENTIAL ISSUES**:
- Test suite updates may reveal edge cases in unified architecture
- Client component updates might temporarily break UI until complete
- Need to ensure backward compatibility during transition

**MITIGATION**:
- Run tests frequently during implementation
- Test in development environment before deploying
- Keep git commits atomic for easy rollback if needed

---

## Conclusion

The unified session architecture is very close to completion. The remaining tasks are primarily focused on:

1. **Modernizing client components** to use the unified RunSessionClient
2. **Updating tests** to match the new architecture
3. **Cleaning up legacy code** for maintainability

These changes will result in a much cleaner, more maintainable codebase with a single consistent pattern for session management across terminal and Claude sessions.

**Total Estimated Time: 8-12 hours**
**Recommended Implementation Timeframe: 1-2 development sessions**