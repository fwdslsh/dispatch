# Dependency Injection Pattern in ViewModels

## Overview

The Dispatch application uses Dependency Injection (DI) to make ViewModels testable while maintaining backward compatibility with production code. This document explains the pattern implementation in `ClaudePaneViewModel`.

## Problem Statement

Before DI implementation:
- ViewModels directly imported singleton services (e.g., `runSessionClient`)
- Direct singleton imports prevented unit testing
- Impossible to mock dependencies for isolated testing
- Violated Dependency Inversion Principle (SOLID)

## Solution: Constructor Injection with Fallback

The solution implements constructor-based dependency injection with automatic fallback to singletons for backward compatibility.

### Implementation Pattern

```javascript
import { runSessionClient } from '../../shared/services/RunSessionClient.js';

export class ClaudePaneViewModel {
	// Dependency injection property
	sessionClient = null;

	constructor({ sessionId, sessionClient = null }) {
		// Use injected client or fallback to singleton
		this.sessionClient = sessionClient || runSessionClient;
	}

	// Use this.sessionClient throughout the class
	async submitInput() {
		this.sessionClient.sendInput(this.sessionId, userMessage);
	}
}
```

## Benefits

### 1. Testability
ViewModels can now be tested in isolation with mock dependencies:

```javascript
const mockClient = {
	getStatus: vi.fn().mockReturnValue({ connected: true }),
	sendInput: vi.fn()
};

const viewModel = new ClaudePaneViewModel({
	sessionId: 'test-id',
	sessionClient: mockClient
});

// Test with mocked behavior
await viewModel.submitInput();
expect(mockClient.sendInput).toHaveBeenCalled();
```

### 2. Backward Compatibility
Production code continues to work without changes:

```javascript
// Still works - uses singleton fallback
const viewModel = new ClaudePaneViewModel({ sessionId: 'abc123' });
```

### 3. SOLID Principles

**Dependency Inversion Principle**: High-level ViewModels depend on abstractions (injected dependencies) rather than concrete implementations (singletons).

**Open/Closed Principle**: ViewModels are open for extension (inject different implementations) but closed for modification.

## Usage Examples

### Production Usage (Component)

```svelte
<script>
	import { ClaudePaneViewModel } from './viewmodels/ClaudePaneViewModel.svelte.js';

	let { sessionId } = $props();

	// No sessionClient provided - uses singleton
	const viewModel = new ClaudePaneViewModel({ sessionId });
</script>
```

### Test Usage (Unit Tests)

```javascript
import { ClaudePaneViewModel } from './ClaudePaneViewModel.svelte.js';

describe('ClaudePaneViewModel', () => {
	let mockSessionClient;

	beforeEach(() => {
		mockSessionClient = {
			getStatus: vi.fn().mockReturnValue({ connected: true }),
			sendInput: vi.fn(),
			attachToRunSession: vi.fn(),
			detachFromRunSession: vi.fn()
		};
	});

	it('should send input through injected client', async () => {
		const vm = new ClaudePaneViewModel({
			sessionId: 'test-id',
			sessionClient: mockSessionClient
		});
		vm.isAttached = true;
		vm.input = 'Hello';

		await vm.submitInput();

		expect(mockSessionClient.sendInput).toHaveBeenCalledWith(
			'test-id',
			'Hello'
		);
	});
});
```

## Implementation Checklist

When adding DI to a ViewModel:

- [ ] Add dependency property (e.g., `sessionClient = null`)
- [ ] Update constructor to accept dependency in options object
- [ ] Add fallback to singleton: `this.dep = dep || singleton`
- [ ] Replace all direct singleton usage with `this.dep`
- [ ] Add JSDoc with examples for both production and testing
- [ ] Update component to accept and pass through dependency prop
- [ ] Create unit tests demonstrating mock injection

## Constructor Signature Pattern

Always use object destructuring with optional dependencies:

```javascript
/**
 * @param {Object} options - Constructor options
 * @param {string} options.requiredParam - Required parameter
 * @param {Object|null} [options.dependency=null] - Injectable dependency
 *
 * @example
 * // Production: uses singleton
 * new ViewModel({ requiredParam: 'value' });
 *
 * @example
 * // Testing: uses mock
 * new ViewModel({ requiredParam: 'value', dependency: mockDep });
 */
constructor({ requiredParam, dependency = null }) {
	this.dependency = dependency || singletonInstance;
}
```

## Related Patterns

- **Service Locator**: Alternative pattern, but DI is preferred for testability
- **Factory Pattern**: Can be combined with DI for complex object creation
- **Strategy Pattern**: Often injected via DI for behavior customization

## Files Modified for C5 Implementation

1. `/src/lib/client/claude/viewmodels/ClaudePaneViewModel.svelte.js`
   - Added `sessionClient` property
   - Updated constructor signature
   - Replaced all `runSessionClient` with `this.sessionClient`

2. `/src/lib/client/claude/ClaudePane.svelte`
   - Added `sessionClient` prop
   - Updated ViewModel instantiation

3. `/tests/client/claude/ClaudePaneViewModel.test.js`
   - New test file demonstrating DI pattern

## Best Practices

1. **Always provide fallback**: `this.dep = dep || singleton` ensures backward compatibility
2. **Use object destructuring**: Makes adding new parameters easier
3. **Document both usages**: Show production and testing examples in JSDoc
4. **Test the fallback**: Verify singleton is used when no dependency provided
5. **Mock minimal interface**: Only mock methods actually used by the ViewModel

## Anti-Patterns to Avoid

- **Direct singleton access**: Never use `runSessionClient.method()` after implementing DI
- **Property injection**: Don't set dependencies after construction
- **Incomplete mocks**: Mock all methods used in tests, use `vi.fn()` for unused methods
- **Breaking changes**: Always maintain backward compatibility with fallbacks

## Future Improvements

1. **Service Container**: Consider implementing a DI container for complex dependency graphs
2. **Interface Segregation**: Extract minimal interfaces for dependencies
3. **Automatic Injection**: Use decorators or metadata for automatic dependency resolution
4. **Lifecycle Management**: Handle dependency lifecycle (initialization, cleanup)

## References

- SOLID Principles: https://en.wikipedia.org/wiki/SOLID
- Dependency Injection: https://martinfowler.com/articles/injection.html
- Testing Patterns: https://vitest.dev/guide/mocking.html
- CLAUDE.md C5 Task: Dependency injection implementation requirements
