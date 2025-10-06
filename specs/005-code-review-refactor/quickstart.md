# Quickstart: Code Review Refactor Validation

**Feature**: Code Review Refactor (005)
**Purpose**: Step-by-step validation checklist for refactoring completion

## Overview

This guide provides manual validation steps to verify the code review refactor has been completed successfully without functional regressions.

## Prerequisites

- Code changes complete (all tasks in tasks.md finished)
- Development environment running (`npm run dev`)
- Test database seeded (if applicable)

## Automated Validation

### 1. Run Full Test Suite

```bash
# Run all unit tests
npm run test

# Expected: 100% pass rate (FR-001 requirement)
# If any failures: STOP and fix before continuing
```

**Success Criteria**:

- ✅ All unit tests pass
- ✅ No new test failures introduced
- ✅ Test coverage maintained or improved

### 2. Run E2E Tests

```bash
# Run Playwright end-to-end tests
npm run test:e2e

# Expected: All E2E tests pass
# If any failures: STOP and fix before continuing
```

**Success Criteria**:

- ✅ All E2E tests pass
- ✅ No timeout errors
- ✅ No visual regressions

### 3. Run Type Checking

```bash
# Check TypeScript/JSDoc types
npm run check

# Expected: No type errors
```

**Success Criteria**:

- ✅ No type errors
- ✅ No new warnings introduced

### 4. Run Linting

```bash
# Check code formatting and linting
npm run lint

# Expected: No linting errors
```

**Success Criteria**:

- ✅ No ESLint errors
- ✅ Code formatting consistent

---

## Manual Validation Steps

### Phase 1: Props Syntax Validation (FR-002)

**Objective**: Verify Svelte 5 `$props()` syntax works correctly

#### Test 1.1: AuthenticationStep Component

0. npm run dev:test
1. Navigate to onboarding flow: `http://localhost:7173/onboarding`
2. Observe AuthenticationStep renders correctly
3. Enter invalid key → Verify error displays
4. Enter valid key → Verify onComplete callback fires
5. Check browser console → No errors or warnings

**Expected**:

- ✅ Component renders without errors
- ✅ Props (onComplete, error) function correctly
- ✅ No console errors about props

#### Test 1.2: WorkspaceCreationStep Component

1. Complete authentication step (from Test 1.1)
2. Observe WorkspaceCreationStep renders
3. Enter workspace path → Verify validation works
4. Submit form → Verify onComplete callback fires
5. Check browser console → No errors

**Expected**:

- ✅ Component renders without errors
- ✅ Props (onComplete, initialPath) function correctly
- ✅ Form submission works as before

#### Test 1.3: Testing Page

0. npm run dev:test
1. Navigate to: `http://localhost:7173/testing`
2. Observe page renders
3. Check that page data displays correctly
4. No console errors

**Expected**:

- ✅ Page renders without errors
- ✅ `data` prop from SvelteKit works correctly

---

### Phase 2: SessionApiClient Modularization (FR-004)

**Objective**: Verify SessionApiClient split into modules works correctly

#### Test 2.1: Query Operations

1. Open browser DevTools → Network tab
2. Navigate to sessions page (shows session list)
3. Observe API call to `/api/sessions` succeeds
4. Verify sessions display in UI
5. Click on a session → Verify session details load

**Expected**:

- ✅ getAllSessions() function works (network request succeeds)
- ✅ getSession() function works (session details load)
- ✅ No console errors about missing imports

#### Test 2.2: Mutation Operations

1. Click "New Session" button
2. Fill out session creation form (type: pty, workspace: /workspace/test)
3. Submit form → Verify session created
4. Observe new session in session list
5. Select session → Send input ("echo hello")
6. Verify input sent successfully
7. Close session → Verify session stops

**Expected**:

- ✅ createSession() works (new session appears)
- ✅ sendInput() works (input sent to session)
- ✅ closeSession() works (session stops gracefully)

#### Test 2.3: Validation

1. Attempt to create session with invalid data (empty workspace path)
2. Verify validation error displays
3. Attempt to send empty input to session
4. Verify sanitization works

**Expected**:

- ✅ Validation catches invalid inputs
- ✅ Error messages display correctly
- ✅ Input sanitization prevents dangerous characters

---

### Phase 3: ClaudePane Component Extraction (FR-005)

**Objective**: Verify ClaudePane subcomponents work correctly

#### Test 3.1: ToolPanel Subcomponent

1. Create new Claude session
2. Observe ToolPanel renders in ClaudePane
3. Click on different tools → Verify selection highlights
4. Verify tool descriptions show on hover
5. No console errors

**Expected**:

- ✅ ToolPanel renders separately
- ✅ Tool selection works
- ✅ Visual indicators correct

#### Test 3.2: TracePanel Subcomponent

1. In active Claude session, expand Trace Panel
2. Observe traces display
3. Verify syntax highlighting works
4. Collapse panel → Verify panel hides
5. No console errors

**Expected**:

- ✅ TracePanel renders separately
- ✅ Expand/collapse works
- ✅ Trace data displays correctly

#### Test 3.3: MessageList Subcomponent

1. In Claude session, send message: "Hello, Claude"
2. Observe message appears in MessageList
3. Verify user message displays correctly
4. Wait for Claude response → Verify assistant message displays
5. Click message action buttons (copy, retry)
6. Verify actions work

**Expected**:

- ✅ MessageList renders separately
- ✅ Messages display correctly (user vs. assistant)
- ✅ Message actions functional

#### Test 3.4: InputArea Subcomponent

1. In Claude session, type in InputArea
2. Verify auto-resize works as you type
3. Press Enter → Verify message submits
4. Press Shift+Enter → Verify new line added
5. While processing, press Escape → Verify cancel works
6. No console errors

**Expected**:

- ✅ InputArea renders separately
- ✅ Auto-resize works
- ✅ Keyboard shortcuts functional
- ✅ Submit/cancel work correctly

#### Test 3.5: ClaudePaneViewModel Integration

1. Perform actions across all subcomponents (select tool, send message, expand trace)
2. Verify state updates propagate correctly
3. Open browser DevTools → Check for memory leaks (no retained detached nodes)
4. No console errors about state mutations

**Expected**:

- ✅ ViewModel state syncs across all subcomponents
- ✅ No reactivity issues
- ✅ No memory leaks

---

### Phase 4: Critical User Workflows (FR-001)

**Objective**: Verify core functionality unchanged

#### Workflow 1: Terminal Session

1. Click "New Session" → Select "Terminal (PTY)"
2. Enter workspace path: `/workspace/test`
3. Submit → Observe terminal session starts
4. Type command: `ls -la`
5. Press Enter → Verify command executes
6. Observe output displays in terminal
7. Type: `echo "Hello from refactored Dispatch"`
8. Verify echo works
9. Close terminal session

**Expected**:

- ✅ Terminal session creates successfully
- ✅ Commands execute correctly
- ✅ Output displays in real-time
- ✅ Session closes gracefully

#### Workflow 2: Claude Session

1. Click "New Session" → Select "Claude Code"
2. Enter workspace path: `/workspace/test`
3. Submit → Observe Claude session starts
4. Send message: "What files are in this workspace?"
5. Verify Claude responds
6. Verify response displays in MessageList
7. Close Claude session

**Expected**:

- ✅ Claude session creates successfully
- ✅ Messages send/receive correctly
- ✅ UI updates in real-time
- ✅ Session closes gracefully

#### Workflow 3: Workspace Management

1. Click "Workspaces" in navigation
2. Observe workspace list displays
3. Click "New Workspace"
4. Enter workspace name and path
5. Submit → Verify workspace created
6. Switch between workspaces → Verify switching works
7. Delete test workspace

**Expected**:

- ✅ Workspace list displays correctly
- ✅ Workspace creation works
- ✅ Workspace switching updates sessions
- ✅ Deletion works (if no active sessions)

---

## Performance Validation

### Session Replay Performance (FR-001 constraint)

**Objective**: Verify session replay remains <100ms

**Test Procedure**:

1. Create terminal session
2. Execute 50+ commands to build event history
3. Close session
4. Reopen session (triggers replay)
5. Measure replay time using browser DevTools Performance tab

**Success Criteria**:

- ✅ Replay completes in <100ms
- ✅ No noticeable UI lag during replay
- ✅ All events applied correctly

### Module Load Times

**Objective**: Verify refactored modules load quickly

**Test Procedure**:

1. Open browser DevTools → Network tab
2. Reload page (Cmd/Ctrl + Shift + R for hard reload)
3. Observe module load times for refactored files:
   - session-api/queries.js
   - session-api/mutations.js
   - session-api/validation.js
   - claude/components/ToolPanel.svelte
   - claude/components/TracePanel.svelte
   - etc.

**Success Criteria**:

- ✅ Individual modules load faster than original monolithic files
- ✅ Total page load time unchanged or improved
- ✅ No waterfall delays from module splitting

---

## Documentation Validation (FR-003, FR-006, FR-007)

**Objective**: Verify documentation is accurate and helpful

**Note**: Documentation review occurs AFTER all code changes (per clarification #2)

### Check 1: MVVM Patterns Documentation

1. Read `src/docs/architecture/mvvm-patterns.md`
2. Verify "runes-in-classes" pattern explained clearly
3. Check examples match actual codebase usage
4. Confirm "why/when/how" questions answered

**Expected**:

- ✅ Documentation accurate
- ✅ Code examples runnable
- ✅ Rationale explained
- ✅ No outdated information

### Check 2: Adapter Guide

1. Read `src/docs/architecture/adapter-guide.md`
2. Verify adapter registration steps correct
3. Check file paths match actual structure
4. Confirm minimal example is complete

**Expected**:

- ✅ Guide accurate and up-to-date
- ✅ File paths correct
- ✅ Example code functional

### Check 3: Error Handling Guide

1. Read `src/docs/contributing/error-handling.md`
2. Verify async error pattern documented
3. Check examples match refactored code
4. Confirm pattern applied consistently

**Expected**:

- ✅ Pattern clearly documented
- ✅ Examples match real usage
- ✅ Consistency across codebase

---

## Regression Checklist

### Visual Regression

- [ ] UI appearance unchanged (no CSS/layout changes)
- [ ] All icons/images display correctly
- [ ] Responsive design works on mobile/tablet
- [ ] Dark mode/light mode both work (if applicable)

### Functional Regression

- [ ] All user interactions work (clicks, typing, keyboard shortcuts)
- [ ] Navigation between pages works
- [ ] Session state persists across page reloads
- [ ] WebSocket reconnection works after disconnect
- [ ] Error messages display correctly

### Performance Regression

- [ ] Page load time unchanged or improved
- [ ] Session creation time <1 second
- [ ] No memory leaks (check DevTools Memory profiler)
- [ ] No excessive re-renders (check React DevTools or Svelte DevTools)

---

## Completion Criteria

✅ **All manual validation steps complete** (Phases 1-4)
✅ **Performance targets met** (session replay <100ms)
✅ **Documentation accurate** (post-refactor review)
✅ **No regressions found** (visual, functional, performance)

If ALL criteria met → **Feature complete and ready for merge!**

If ANY criteria fail → **Return to implementation and fix issues**

---

## Troubleshooting

### Common Issues

**Issue**: Tests fail after refactoring

- **Solution**: Check import paths updated to new module structure

**Issue**: Props not working in migrated components

- **Solution**: Verify `$props()` destructuring syntax correct (no `export let` remaining)

**Issue**: ViewModel state not syncing to subcomponents

- **Solution**: Ensure ViewModel instance passed as prop, not recreated in each child

**Issue**: Performance degraded after split

- **Solution**: Check for unnecessary reactive statements; use `$derived` instead of `$effect` where possible

---

## Sign-Off

**Tester**: **\*\*\*\***\_**\*\*\*\***
**Date**: **\*\*\*\***\_**\*\*\*\***
**Result**: ☐ Pass ☐ Fail (with notes attached)

**Notes**:

---

---

---
