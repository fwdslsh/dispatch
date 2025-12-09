# Import Pattern Rules - Session Crash Prevention

## The Rule: Server Code MUST Use Relative Imports

**Location**: `src/lib/server/**/*.js`
**Rule**: ❌ NEVER use `$lib` alias - ✅ ALWAYS use relative paths

### Why This Matters

When Vite loads `vite.config.js`, it imports server code **before** the SvelteKit build pipeline initializes. The `$lib` alias doesn't exist yet, causing:

- Build failures: `Cannot find package '$lib'`
- Session crashes during development
- Test runner failures

### Import Chain That Breaks

```
vite.config.js (loaded first, $lib doesn't exist yet)
  → hooks.server.js (imported by vite plugin)
    → auth/strategies/*.js (tries to use $lib)
      → ❌ ERROR: $lib is undefined!
```

## Correct Import Patterns

### ✅ Server Code (src/lib/server/)

```javascript
// CORRECT - Use relative imports
import { logger } from '../../shared/utils/logger.js';
import { SomeService } from '../services/SomeService.js';
import { db } from './database/index.js';
```

### ✅ Routes (src/routes/)

```javascript
// BOTH WORK - Prefer $lib for clarity
import { logger } from '$lib/server/shared/utils/logger.js'; // ✅ Preferred
import { logger } from '../lib/server/shared/utils/logger.js'; // ✅ Also works
```

### ✅ Client Code (src/lib/client/)

```javascript
// CORRECT - Use $lib alias
import { SocketService } from '$lib/client/shared/services/SocketService.svelte.js';
```

## Quick Reference Table

| File Location     | Import Style           | Example                 |
| ----------------- | ---------------------- | ----------------------- |
| `src/lib/server/` | **Relative only**      | `'../../utils/file.js'` |
| `src/routes/`     | Either (prefer `$lib`) | `'$lib/server/...'`     |
| `src/lib/client/` | **$lib alias**         | `'$lib/client/...'`     |
| `src/lib/shared/` | Depends on caller      | Match caller's pattern  |

## Automated Detection

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

if grep -r "from '\$lib" src/lib/server --include="*.js" --include="*.ts"; then
  echo ""
  echo "❌ ERROR: $lib imports found in server code"
  echo ""
  echo "Server files MUST use relative imports."
  echo "Example: import { X } from '../../path/to/module.js'"
  echo ""
  exit 1
fi
```

### Manual Check Command

```bash
# Check for violations
grep -r "from '\$lib" src/lib/server --include="*.js"

# Should return nothing if all correct
```

## Common Mistakes

### ❌ WRONG: Copying from routes

```javascript
// In src/lib/server/auth/SomeService.js
import { logger } from '$lib/server/shared/utils/logger.js'; // BREAKS BUILD
```

### ✅ CORRECT: Count directory levels

```javascript
// In src/lib/server/auth/SomeService.js
// From:  src/lib/server/auth/
// To:    src/lib/server/shared/utils/
// Up 1:  src/lib/server/
// Down:  shared/utils/logger.js
import { logger } from '../shared/utils/logger.js'; // ✅ WORKS
```

## Historical Context

**Incident**: 2025-11-19
**Files Affected**:

- `src/lib/server/auth/strategies/AuthStrategy.js`
- `src/lib/server/auth/strategies/SessionCookieStrategy.js`
- `src/lib/server/auth/strategies/AuthenticationCoordinator.js`

**Symptom**: Build completely broken, sessions crashed
**Root Cause**: Used `$lib` imports in server code
**Fix**: Changed to relative imports
**Commit**: ab86619

## Key Takeaway

The `$lib` alias is a **build-time convenience**, not a runtime feature. Code loaded during Vite's configuration phase runs **before** SvelteKit's build pipeline creates the `$lib` alias.

**Remember**: If it's in `src/lib/server/`, use relative paths. No exceptions.
