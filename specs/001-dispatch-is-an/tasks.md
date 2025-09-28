# Tasks: Enhanced Workspace Management for Dispatch

**Input**: Design documents from `/specs/001-dispatch-is-an/`
**Prerequisites**: plan.md (✓), data-model.md (✓), contracts/ (✓), quickstart.md (✓)

## Implementation Context

The Dispatch application already has a mature, production-ready implementation with:
- ✅ Complete event-sourced session management (RunSessionManager)
- ✅ Database schema with sessions, events, and workspaces tables
- ✅ Socket.IO real-time communication with all handlers
- ✅ Session API endpoints (/api/sessions/)
- ✅ Three working session adapters (Terminal, Claude, File Editor)
- ✅ Svelte 5 frontend with ViewModels and state management
- ✅ Authentication system (key-based)
- ✅ VS Code Remote Tunnel integration

This task list focuses ONLY on genuine gaps identified through codebase analysis.

## Phase 1: Workspace Management API (Priority: HIGH)

### T001 GET /api/workspaces endpoint
**File**: `src/routes/api/workspaces/+server.js`
**Description**: Create endpoint to list all workspaces with metadata (name, path, last accessed, session count).
**Context**: Database table exists, need REST API layer.

### T002 POST /api/workspaces endpoint
**File**: `src/routes/api/workspaces/+server.js` (extend T001)
**Description**: Create new workspace with validation (path exists, within allowed root, unique name).
**Context**: Leverage existing DatabaseManager for persistence.

### T003 GET /api/workspaces/[workspaceId] endpoint
**File**: `src/routes/api/workspaces/[workspaceId]/+server.js`
**Description**: Get single workspace details with active session information.
**Context**: Join with sessions table for session counts.

### T004 PUT /api/workspaces/[workspaceId] endpoint
**File**: `src/routes/api/workspaces/[workspaceId]/+server.js` (extend T003)
**Description**: Update workspace metadata (name, archived status). Prevent deletion if active sessions.
**Context**: Use existing database schema.

### T005 DELETE /api/workspaces/[workspaceId] endpoint
**File**: `src/routes/api/workspaces/[workspaceId]/+server.js` (extend T003)
**Description**: Archive or delete workspace (soft delete recommended). Check for active sessions first.

## Phase 2: Service Layer Refactoring (Priority: MEDIUM)

### T006 WorkspaceService implementation
**File**: `src/lib/server/shared/services/WorkspaceService.js`
**Description**: Extract workspace logic from DatabaseManager into dedicated service. Include path validation, status management.
**Context**: Optional but improves code organization. DatabaseManager currently handles this inline.

### T007 EventSourcingService extraction
**File**: `src/lib/server/shared/services/EventSourcingService.js`
**Description**: Extract event sourcing logic from RunSessionManager for reusability.
**Context**: Optional refactoring. Current implementation works but is tightly coupled.

### T008 MaintenanceService for cleanup
**File**: `src/lib/server/shared/services/MaintenanceService.js`
**Description**: Service for cleaning old events, orphaned sessions, implementing retention policies.
**Context**: Not critical for single-user system but good practice.

## Phase 3: Testing Infrastructure (Priority: HIGH)

### T009 Workspace API integration tests
**File**: `tests/e2e/workspace-api.spec.js`
**Description**: Test workspace CRUD operations, validation, error cases.
**Testing**: Create, list, update, delete workspaces. Verify path validation.

### T010 Session persistence E2E tests
**File**: `tests/e2e/session-persistence.spec.js`
**Description**: Test existing session resumption across server restarts.
**Testing**: Create session, restart server, resume session, verify history.

### T011 Multi-device synchronization tests
**File**: `tests/e2e/multi-device.spec.js`
**Description**: Test existing multi-client session attachment.
**Testing**: Multiple browsers, same session, verify event synchronization.

### T012 Performance benchmarks
**File**: `tests/performance/event-replay.bench.js`
**Description**: Benchmark event replay performance with large histories.
**Testing**: Create 10K+ events, measure replay time, should be <100ms.

## Phase 4: Enhancement Features (Priority: LOW)

### T013 Database migration system
**File**: `src/lib/server/shared/db/migrate.js`
**Description**: Formal migration runner for schema versioning.
**Context**: Currently auto-creates tables. Migration system better for production.

### T014 Multi-auth methods support
**File**: `src/lib/server/shared/auth/oauth.js`
**Description**: Add OAuth, device pairing, WebAuthn beyond current key auth.
**Context**: Only if moving beyond single-user deployment.

### T015 Retention policy enforcement
**File**: `src/lib/server/shared/services/RetentionService.js`
**Description**: Automated cleanup based on user-defined retention quotas.
**Context**: Low priority for single-user system.

### T016 Workspace templates
**File**: `src/lib/server/shared/services/WorkspaceTemplateService.js`
**Description**: Pre-configured workspace templates with boilerplate files.
**Context**: Nice-to-have feature for quick project starts.

## Phase 5: Documentation Updates (Priority: MEDIUM)

### T017 Update API documentation
**File**: `docs/api/workspace-api.md`
**Description**: Document new workspace endpoints with examples.
**Content**: Request/response schemas, error codes, usage examples.

### T018 Update CLAUDE.md with workspace patterns
**File**: `CLAUDE.md`
**Description**: Add workspace management patterns to the existing documentation.
**Content**: How to create, manage, and switch workspaces.

### T019 Architecture documentation
**File**: `docs/architecture.md`
**Description**: Document the existing event-sourced architecture for contributors.
**Content**: RunSessionManager, adapter pattern, Socket.IO protocol.

### T020 Testing guide
**File**: `docs/testing.md`
**Description**: Document how to run tests, add new tests, performance benchmarks.
**Content**: Test structure, E2E setup, benchmark guidelines.

## Dependencies & Execution Order

**Phase Sequencing**:
1. Phase 1 (T001-T005): Workspace API - **Start immediately**, core gap
2. Phase 3 (T009-T012): Testing - Can run parallel with Phase 1
3. Phase 2 (T006-T008): Service refactoring - After Phase 1 complete
4. Phase 5 (T017-T020): Documentation - Parallel with any phase
5. Phase 4 (T013-T016): Enhancements - Optional, low priority

**Parallel Execution**:
```bash
# Workspace endpoints can be developed in parallel
T001 & T002 & T003 & T004 & T005

# All tests can run in parallel
T009 & T010 & T011 & T012

# Documentation updates in parallel
T017 & T018 & T019 & T020
```

## Validation Checklist

**Leverages Existing Code**: ✓
- Uses existing DatabaseManager
- Extends existing session infrastructure
- No duplication of existing functionality

**Constitutional Compliance**: ✓
- Security: Maintains container isolation
- Event sourcing: Uses existing implementation
- Adapter pattern: No changes to adapter architecture
- TDD: Tests for new features only
- Progressive enhancement: Workspace API is optional enhancement

**Focus on Gaps**: ✓
- Only implements missing workspace API
- Optional refactoring for code organization
- Tests for existing + new functionality
- Documentation updates

## Summary

**Total Tasks**: 20 (down from 55)
**High Priority**: 5 workspace endpoints + 4 tests = 9 tasks
**Medium Priority**: 3 service refactoring + 4 docs = 7 tasks
**Low Priority**: 4 enhancement features
**Estimated Duration**: 1-2 weeks for high priority, 2-3 weeks for all

This focused implementation adds only what's missing while leveraging the robust existing architecture. The workspace management API is the primary gap that needs addressing.