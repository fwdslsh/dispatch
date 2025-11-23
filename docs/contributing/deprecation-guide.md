# Deprecation Guide

This guide explains how to properly deprecate code and handle obsolete patterns in the Dispatch codebase.

## Why Deprecate Code?

Deprecation allows us to:
- **Signal intent** to remove or replace code
- **Give users time** to migrate to new APIs
- **Track technical debt** systematically
- **Maintain backward compatibility** during transitions

## How to Deprecate Code

### 1. Runtime Deprecation Warnings

Use the `deprecationWarning` utility for runtime warnings:

```javascript
import { deprecationWarning } from '$lib/server/shared/utils/deprecation.js';

export function oldFunction() {
    deprecationWarning({
        name: 'oldFunction()',
        alternative: 'newFunction()',
        version: '0.2.0',
        removalVersion: '0.3.0',
        reason: 'Replaced with more efficient implementation'
    });

    // Old implementation...
}
```

### 2. JSDoc @deprecated Tags

Mark deprecated code in JSDoc comments:

```javascript
/**
 * Process user data
 * @deprecated since v0.2.0 - Use processUserDataV2() instead
 * @param {Object} data - User data
 * @returns {Object} Processed data
 */
export function processUserData(data) {
    // Implementation...
}
```

### 3. Wrapper Functions

For gradual migrations, wrap deprecated functions:

```javascript
import { deprecated } from '$lib/server/shared/utils/deprecation.js';

// Old function
function legacyImplementation(arg) {
    // Old code...
}

// Export wrapped version that shows deprecation warning
export const oldFunction = deprecated(legacyImplementation, {
    name: 'oldFunction',
    alternative: 'newFunction',
    version: '0.2.0'
});

// New function
export function newFunction(arg) {
    // New implementation...
}
```

## Deprecation Lifecycle

### Phase 1: Mark as Deprecated
- Add `@deprecated` JSDoc tag
- Add runtime deprecation warning
- Document the alternative in comments and docs
- Update tests to use new API (but keep old API tests for compatibility)

### Phase 2: Migration Period
- Give users **at least 2 minor versions** to migrate
- Monitor usage (deprecation warnings logged)
- Assist users with migration if needed

### Phase 3: Removal
- Remove deprecated code in next major version
- Update CHANGELOG with breaking changes
- Ensure all internal code has migrated

## ESLint Warnings

The project ESLint configuration warns about deprecated code markers:

```javascript
// ESLint will warn about these comments:
// @deprecated Use newMethod instead
// TODO: Remove this obsolete code
// LEGACY: Old implementation
```

Configure in `eslint.config.js`:
```javascript
{
    rules: {
        'no-warning-comments': ['warn', {
            terms: ['deprecated', 'obsolete', 'legacy'],
            location: 'anywhere'
        }]
    }
}
```

## Development vs Production

Use `devOnlyDeprecationWarning` for development-only warnings:

```javascript
import { devOnlyDeprecationWarning } from '$lib/server/shared/utils/deprecation.js';

export function experimentalFeature() {
    devOnlyDeprecationWarning({
        name: 'experimentalFeature()',
        alternative: 'stableFeature()',
        reason: 'This API is still experimental'
    });
    // Implementation...
}
```

## Example: Complete Deprecation Process

### Step 1: Initial Implementation
```javascript
// v0.1.0
export function calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.price, 0);
}
```

### Step 2: Add Improved Version
```javascript
// v0.2.0 - Add new implementation
export function calculateTotalV2(items, options = {}) {
    const { includeTax = false, taxRate = 0 } = options;
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    return includeTax ? subtotal * (1 + taxRate) : subtotal;
}

// Mark old version as deprecated
/**
 * @deprecated since v0.2.0 - Use calculateTotalV2() for more options
 */
export function calculateTotal(items) {
    deprecationWarning({
        name: 'calculateTotal()',
        alternative: 'calculateTotalV2()',
        version: '0.2.0',
        removalVersion: '0.4.0'
    });
    return calculateTotalV2(items);
}
```

### Step 3: Migration Period
```javascript
// v0.2.0 - v0.3.0
// Users receive warnings but code still works
// Monitor usage in logs
// Assist users with migration
```

### Step 4: Remove Deprecated Code
```javascript
// v0.4.0 - Remove old implementation
export function calculateTotalV2(items, options = {}) {
    const { includeTax = false, taxRate = 0 } = options;
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    return includeTax ? subtotal * (1 + taxRate) : subtotal;
}

// Optional: Export as calculateTotal for better naming
export { calculateTotalV2 as calculateTotal };
```

## Testing Deprecated Code

### Keep Compatibility Tests
```javascript
describe('calculateTotal (deprecated)', () => {
    it('still works for backward compatibility', () => {
        const items = [{ price: 10 }, { price: 20 }];
        expect(calculateTotal(items)).toBe(30);
    });
});

describe('calculateTotalV2', () => {
    it('calculates subtotal', () => {
        const items = [{ price: 10 }, { price: 20 }];
        expect(calculateTotalV2(items)).toBe(30);
    });

    it('includes tax when requested', () => {
        const items = [{ price: 100 }];
        expect(calculateTotalV2(items, { includeTax: true, taxRate: 0.1 })).toBe(110);
    });
});
```

### Clear Warnings in Tests
```javascript
import { clearDeprecationWarnings } from '$lib/server/shared/utils/deprecation.js';

beforeEach(() => {
    clearDeprecationWarnings();
});
```

## CHANGELOG Documentation

Document deprecations in CHANGELOG.md:

```markdown
## [0.2.0] - 2024-01-15

### Deprecated
- `calculateTotal()` - Use `calculateTotalV2()` instead for tax calculation support
  - Will be removed in v0.4.0

### Added
- `calculateTotalV2()` - Enhanced total calculation with tax support

## [0.4.0] - 2024-04-15

### Breaking Changes
- Removed `calculateTotal()` (deprecated in v0.2.0)
  - Use `calculateTotalV2()` or `calculateTotal` (re-exported from V2)
```

## Deprecation Utility API Reference

### deprecationWarning(options)

Show deprecation warning with context.

**Parameters:**
- `name` (string) - Name of deprecated feature
- `alternative` (string) - Recommended alternative
- `version` (string, optional) - Version when deprecated
- `removalVersion` (string, optional) - Version when feature will be removed
- `reason` (string, optional) - Reason for deprecation
- `once` (boolean, default: true) - Show warning only once per process

### deprecated(fn, options)

Wrap function to show deprecation warning on first call.

**Parameters:**
- `fn` (Function) - Function to wrap
- `options` (Object) - Deprecation options (same as deprecationWarning)

**Returns:** Wrapped function

### devOnlyDeprecationWarning(options)

Show deprecation warning only in development mode.

**Parameters:**
- Same as `deprecationWarning`

### clearDeprecationWarnings()

Clear all shown warnings (useful for testing).

## Best Practices

1. **Always provide alternatives** - Don't just say "deprecated", tell users what to use instead
2. **Version your deprecations** - Specify when feature was deprecated and when it will be removed
3. **Give reasonable migration time** - At least 2 minor versions before removal
4. **Update documentation** - Mark deprecated features in API docs and guides
5. **Monitor usage** - Check logs to see if deprecated features are still being used
6. **Test both old and new** - Maintain tests for deprecated features until removal
7. **Communicate clearly** - Use CHANGELOG, migration guides, and release notes

## Summary

Deprecation is a tool for **graceful transitions**, not abrupt removals. Use it to:
- Signal intent to remove code
- Give users time to migrate
- Maintain backward compatibility during transitions
- Track and reduce technical debt systematically

For questions or guidance, consult the development team or open a GitHub discussion.
