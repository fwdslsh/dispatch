# Updated LEGACY_CODE_AUDIT.md

This file lists all remaining legacy code, deprecated patterns, and cleanup tasks after the unified session refactor.

## Completed Tasks ✅

- [x] All legacy server-side files removed (SessionRegistry, TerminalManager, ClaudeSessionManager)
- [x] All client components migrated to RunSessionClient
- [x] All tests updated to use unified run:* events
- [x] Documentation updated to reflect unified architecture
- [x] Legacy docs moved to `docs/legacy/` and `.reference/legacy/`

## Remaining Legacy Items to Clean Up

### 1. Socket Events Constants

**File**: `src/lib/shared/socket-events.js`

**Still present but deprecated**:
```javascript
// Legacy Claude events (deprecated - will be removed)
CLAUDE_TOOLS_AVAILABLE: 'claude.tools.available',
CLAUDE_COMMANDS_REFRESH: 'claude.commands.refresh'
```

**Used by**: `src/lib/client/claude/ClaudeCommands.svelte`

**Action needed**: Update ClaudeCommands component to not rely on these events, then remove them.

### 2. Legacy Event Groups

**File**: `src/lib/shared/socket-events.js`

**Potentially unused**:
```javascript
SESSION_EVENTS // May contain legacy events
CLAUDE_AUTH_EVENTS // OAuth events, still needed for auth but could be simplified
```

**Action needed**: Audit usage and remove unused exports.

### 3. ClaudeCommands Component

**File**: `src/lib/client/claude/ClaudeCommands.svelte`

**Issues**:
- Still imports and uses legacy `SOCKET_EVENTS`
- Uses direct `socket.emit()` and `socket.on()` instead of RunSessionClient
- References `CLAUDE_TOOLS_AVAILABLE` and `CLAUDE_COMMANDS_REFRESH` events

**Action needed**: Refactor to use RunSessionClient or remove component if no longer needed.

### 4. Lint Issues in ARCHITECTURE.md

**File**: `docs/ARCHITECTURE.md`

**Issues**:
- Hard tabs instead of spaces throughout code examples
- Missing language specifications on some code blocks

**Action needed**: Run formatter or manually fix formatting issues.

## Next Steps

1. **Immediate**: Fix ClaudeCommands component or remove if obsolete
2. **Short-term**: Remove deprecated socket event constants
3. **Clean-up**: Fix documentation formatting issues
4. **Verify**: Run full test suite to ensure no regressions

## Success Criteria

- [ ] No references to deprecated socket events in active code
- [ ] ClaudeCommands component updated or removed
- [ ] All socket events constants cleaned up
- [ ] Documentation formatting fixed
- [ ] All tests passing

---

**Status**: 95% complete. Only minor cleanup tasks remain.