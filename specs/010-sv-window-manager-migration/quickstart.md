# Quickstart: sv-window-manager Migration

**Feature**: sv-window-manager Migration
**Date**: 2025-10-20
**Audience**: Developers implementing the migration

## Overview

This guide provides a quick-start path for migrating from the custom window manager to sv-window-manager library, following the hybrid approach (library foundation + custom features).

---

## Installation

```bash
npm install sv-window-manager
```

**Version**: Use latest from npm (internally maintained)

---

## Architecture Approach

**Minimal Integration**:

- **sv-window-manager**: Handles pane layout, binary tree management, resizing, window state tracking
- **Application Layer**: Bare minimum to get sessions into panes, use existing `workspaceState.windowManager`

---

## Implementation Steps

### Step 1: Update Existing WorkspaceState

Use existing `workspaceState.windowManager` - no need to create new ViewModel:

```javascript
// workspaceState already has windowManager
// Just add sv-window-manager BwinHost reference
workspaceState.windowManager.bwinHostRef = $state(null);
```

### Step 2: Integrate BwinHost Component

In workspace route (`src/routes/workspace/+page.svelte`):

```svelte
<script>
  import BwinHost from 'sv-window-manager';
  import { getContext } from 'svelte';

  const workspaceState = getContext('workspaceState');

  $effect(() => {
    if (workspaceState.windowManager.bwinHostRef) {
      // BwinHost is ready, can add panes
    }
  });
</script>

<BwinHost bind:this={workspaceState.windowManager.bwinHostRef} config={{ fitContainer: true }} />
```

### Step 3: Add Sessions as Panes

When creating a new session, add it to sv-window-manager:

```javascript
async function createTerminalSession() {
  // 1. Create session (existing code)
  const sessionId = await sessionApi.createSession({ type: 'pty' });

  // 2. Add pane to sv-window-manager
  const bwinHost = workspaceState.windowManager.bwinHostRef;
  bwinHost.addPane(
    sessionId,  // Use sessionId as pane ID
    {},         // Empty config (use library defaults)
    TerminalComponent,
    { sessionId }
  );
}
```

---

## Testing Strategy

### E2E Tests (Playwright)

```javascript
import { test, expect } from '@playwright/test';
import { resetToOnboarded } from './e2e/helpers';

test.describe('sv-window-manager Integration', () => {
  test.beforeEach(async ({ page }) => {
    await resetToOnboarded();
    await page.goto('/workspace');
  });

  test('creates terminal session in pane', async ({ page }) => {
    // Create terminal session
    await page.click('[data-test="new-terminal"]');

    // Verify pane rendered by sv-window-manager
    await expect(page.locator('[data-test="terminal-pane"]')).toBeVisible();
  });

  test('creates multiple sessions', async ({ page }) => {
    // Create multiple sessions
    await page.click('[data-test="new-terminal"]');
    await page.click('[data-test="new-file-editor"]');

    // Verify both panes visible
    await expect(page.locator('[data-test="terminal-pane"]')).toBeVisible();
    await expect(page.locator('[data-test="file-editor-pane"]')).toBeVisible();
  });
});
```

---

## Common Patterns

### Adding a Session to BwinHost

```javascript
async function createTerminalSession() {
  // 1. Create session (existing code)
  const sessionId = await sessionApi.createSession({ type: 'pty' });

  // 2. Add pane to sv-window-manager
  const bwinHost = workspaceState.windowManager.bwinHostRef;
  bwinHost.addPane(
    sessionId,  // Use sessionId as pane ID
    {},         // Empty config (use library defaults)
    TerminalComponent,
    { sessionId }
  );
}
```

### Getting Component for Session Type

```javascript
function getComponentForSessionType(sessionType) {
  const components = {
    'pty': TerminalComponent,
    'claude': ClaudeComponent,
    'file-editor': FileEditorComponent
  };
  return components[sessionType];
}
```

---

## Troubleshooting

### Issue: sv-window-manager not loading

**Check**:

1. Package installed: `npm list sv-window-manager`
2. Import path correct: `import BwinHost from 'sv-window-manager'`
3. Browser console for errors

**Solution**:

```bash
npm install sv-window-manager
```

### Issue: BwinHost ref is undefined

**Check**:

1. BwinHost component has mounted before calling addPane()
2. Using `bind:this` correctly in component

**Solution**:

```javascript
$effect(() => {
  if (workspaceState.windowManager.bwinHostRef) {
    // Now safe to add panes
  }
});
```

---

## Next Steps

After implementing basic integration:

1. Test with multiple session types (terminal, Claude, file-editor)
2. Verify layout persistence across browser refresh
3. Add session cleanup when panes are closed
4. Customize BwinHost configuration if needed (see library docs)
5. Explore sv-window-manager features (minimize, maximize, etc.) if provided by library

---

## Resources

- **sv-window-manager GitHub**: <https://github.com/itlackey/sv-window-manager>
- **npm Package**: <https://www.npmjs.com/package/sv-window-manager>
- **Data Model**: [data-model.md](./data-model.md)
- **Research Findings**: [research.md](./research.md)
- **Implementation Plan**: [plan.md](./plan.md)

---

## Support

For questions or issues with sv-window-manager:

- Internal maintenance team (confirmed)
- Can contribute features back to library as needed
