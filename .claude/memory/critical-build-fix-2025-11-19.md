# CRITICAL BUILD FIX: $lib Import Issue (2025-11-19)

## Summary
**FIXED**: Build was completely broken due to improper use of `$lib` alias in server-side authentication code.

## What Was Broken
- **Symptom**: Build failed with `Cannot find package '$lib'` error
- **Impact**: Sessions crashed, development server failed, tests couldn't run
- **Root Cause**: Three files in `src/lib/server/auth/strategies/` used `$lib` imports

## The Problem

### Files with $lib imports (BROKEN):
```javascript
// src/lib/server/auth/strategies/AuthStrategy.js:14
import { logger } from '$lib/server/shared/utils/logger.js';  // ❌ BROKEN

// src/lib/server/auth/strategies/SessionCookieStrategy.js:16
import { logger } from '$lib/server/shared/utils/logger.js';  // ❌ BROKEN

// src/lib/server/auth/strategies/AuthenticationCoordinator.js:14
import { logger } from '$lib/server/shared/utils/logger.js';  // ❌ BROKEN
```

### Why It Failed
1. `vite.config.js` imports server code during configuration phase
2. `$lib` alias is defined by SvelteKit AFTER config loads
3. Server code imported before `$lib` is available = crash

**Import chain that failed:**
```
vite.config.js
  → hooks.server.js
    → auth/strategies/index.js
      → AuthStrategy.js (tried to use $lib)
        → ERROR: $lib doesn't exist yet!
```

## The Fix (Commit: db7250c)

Changed all three files to use **relative imports**:

```javascript
// ✅ FIXED: Use relative paths
import { logger } from '../../shared/utils/logger.js';
```

## Verification

### Build Now Works:
```bash
$ npm run build
✓ built in 14.84s
✓ Using @sveltejs/adapter-node
```

### Tests Now Work:
```bash
$ npm run test:unit
✓ |server| tests/server/api/themes.test.js (12 tests) 6ms
✓ |server| tests/server/api/preferences.test.js (11 tests) 9ms
✓ |server| tests/server/socket-session-status-unit.test.js (18 tests) 19ms
# ... all server tests pass
```

## Prevention Rules

### ✅ ALWAYS Use Relative Imports in Server Code
```javascript
// In src/lib/server/**/*.js files
import { X } from '../relative/path.js';     // ✅ CORRECT
import { X } from '../../other/path.js';     // ✅ CORRECT
```

### ❌ NEVER Use $lib Alias in Server Code
```javascript
// In src/lib/server/**/*.js files
import { X } from '$lib/server/...';         // ❌ BROKEN
```

### When Each Style Works

| Location | Use | Why |
|----------|-----|-----|
| `src/lib/server/` | **Relative imports only** | `$lib` not available during config |
| `src/routes/` | Either (prefer `$lib`) | Both work, `$lib` cleaner |
| `src/lib/client/` | **$lib alias** | Cleaner, always works |

## Automated Check

Add this to prevent future issues:

```bash
# In pre-commit hook or CI
if grep -r "from '\$lib" src/lib/server --include="*.js"; then
  echo "❌ ERROR: Found $lib imports in server code"
  echo "Server code MUST use relative imports"
  exit 1
fi
```

## Key Takeaway

**Server-side code MUST use relative imports, never `$lib` alias.**

The `$lib` alias is a SvelteKit build-time feature. Code loaded during Vite's configuration phase doesn't have access to it. This is not a complexity issue - it's about using the right tool for the context.

## Commits
- **db7250c**: Fixed all three auth strategy files
- **3d6abe7**: Previous commit (H7 migration completion)

## Status
✅ **RESOLVED** - Build and tests working normally now.
