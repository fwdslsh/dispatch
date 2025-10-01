# Svelte Component Props Contracts

**Feature**: Code Review Refactor (005)
**Purpose**: Define props interfaces for Svelte 4 → Svelte 5 migration (FR-002)

## Overview

Three components will have props syntax updated from legacy `export let` to Svelte 5 `$props()`:
- AuthenticationStep.svelte
- WorkspaceCreationStep.svelte
- testing/+page.svelte

## Component Contracts

### AuthenticationStep.svelte

**Purpose**: Handle user authentication during onboarding

**Current Props** (Svelte 4):
```svelte
<script>
  export let onComplete = () => {};
  export let error = '';
</script>
```

**Target Props** (Svelte 5):
```svelte
<script>
  let { onComplete = () => {}, error = '' } = $props();
</script>
```

**Props Interface**:
```typescript
interface AuthenticationStepProps {
  onComplete?: () => void       // Callback when authentication succeeds
  error?: string                 // Error message to display
}
```

**Default Values**:
- `onComplete`: `() => {}` (no-op function)
- `error`: `''` (empty string)

**Validation**:
- `onComplete` must be callable function
- `error` must be string type
- No runtime validation changes

**Usage**:
```svelte
<AuthenticationStep
  onComplete={handleAuthComplete}
  error={authError}
/>
```

**Backward Compatibility**:
- Prop interface unchanged
- Default behavior identical
- Parent components require no updates

---

### WorkspaceCreationStep.svelte

**Purpose**: Handle workspace creation during onboarding

**Current Props** (Svelte 4):
```svelte
<script>
  export let onComplete = () => {};
  export let initialPath = '';
</script>
```

**Target Props** (Svelte 5):
```svelte
<script>
  let { onComplete = () => {}, initialPath = '' } = $props();
</script>
```

**Props Interface**:
```typescript
interface WorkspaceCreationStepProps {
  onComplete?: () => void       // Callback when workspace created
  initialPath?: string           // Initial workspace path suggestion
}
```

**Default Values**:
- `onComplete`: `() => {}` (no-op function)
- `initialPath`: `''` (empty string)

**Validation**:
- `onComplete` must be callable function
- `initialPath` must be string type
- No runtime validation changes

**Usage**:
```svelte
<WorkspaceCreationStep
  onComplete={handleWorkspaceCreated}
  initialPath="/workspace/my-project"
/>
```

**Backward Compatibility**:
- Prop interface unchanged
- Default behavior identical
- Parent components require no updates

---

### testing/+page.svelte

**Purpose**: Test page for development/debugging

**Current Props** (Svelte 4):
```svelte
<script>
  export let data;
</script>
```

**Target Props** (Svelte 5):
```svelte
<script>
  let { data } = $props();
</script>
```

**Props Interface**:
```typescript
interface TestingPageProps {
  data: PageData  // SvelteKit page data (required)
}
```

**Default Values**:
- None (data is required prop from SvelteKit)

**Validation**:
- `data` must exist (SvelteKit guarantees this)
- Type depends on `+page.server.js` or `+page.js` load function

**Usage**:
```svelte
<!-- Automatic from SvelteKit routing -->
<!-- data prop injected by framework -->
```

**Backward Compatibility**:
- Prop interface unchanged
- SvelteKit behavior identical
- No changes to route structure

---

## Migration Strategy

### Syntax Conversion Pattern

**Before** (Svelte 4):
```svelte
<script>
  export let propName = defaultValue;
  export let requiredProp;
</script>
```

**After** (Svelte 5):
```svelte
<script>
  let { propName = defaultValue, requiredProp } = $props();
</script>
```

### Edge Cases Handling

#### 1. Props with Same Name as Local Variables

**Problem**:
```svelte
<script>
  export let data;
  let data = processData(data);  // Name conflict!
</script>
```

**Solution** (renaming):
```svelte
<script>
  let { data: rawData } = $props();
  let data = processData(rawData);
</script>
```

#### 2. Props Used in Reactive Statements

**Before**:
```svelte
<script>
  export let count = 0;
  $: doubled = count * 2;
</script>
```

**After** (using $derived):
```svelte
<script>
  let { count = 0 } = $props();
  let doubled = $derived(count * 2);
</script>
```

#### 3. Props with Complex Defaults

**Before**:
```svelte
<script>
  export let config = { theme: 'dark', fontSize: 14 };
</script>
```

**After**:
```svelte
<script>
  let { config = { theme: 'dark', fontSize: 14 } } = $props();
</script>
```

**Note**: Default objects are re-created on each instantiation (same as before)

---

## Testing Strategy

### Contract Validation Tests

Each component will have tests ensuring:
1. Props can be passed and accessed correctly
2. Default values work as expected
3. Type validation matches contract
4. No regression in behavior

**Example Test** (AuthenticationStep):
```javascript
import { render } from '@testing-library/svelte'
import AuthenticationStep from './AuthenticationStep.svelte'

test('accepts onComplete callback prop', () => {
  const mockCallback = vi.fn()
  const { component } = render(AuthenticationStep, {
    props: { onComplete: mockCallback }
  })

  // Trigger authentication success
  component.$set({ error: '' })
  // Verify callback called
  expect(mockCallback).toHaveBeenCalled()
})

test('uses default onComplete if not provided', () => {
  // Should not throw even without onComplete prop
  const { component } = render(AuthenticationStep)
  expect(component).toBeTruthy()
})

test('displays error prop', () => {
  const { getByText } = render(AuthenticationStep, {
    props: { error: 'Authentication failed' }
  })
  expect(getByText('Authentication failed')).toBeInTheDocument()
})
```

### Visual Regression Tests

Ensure UI rendering identical before/after migration:
- Component snapshots match
- No CSS/layout changes
- Interactive behavior preserved

---

## Implementation Notes

### Svelte 5 Runes Documentation

From official Svelte 5 docs:

> The `$props` rune is used to access component props passed by the parent. It must be destructured immediately, and can include default values.

**Best Practices**:
- Always destructure at top of `<script>` block
- Provide defaults for optional props
- Use TypeScript types (if available) for better DX

**Example from Svelte Docs**:
```svelte
<script>
  let { name = 'Anonymous', age = 0 } = $props();
</script>

<p>{name} is {age} years old</p>
```

### Common Pitfalls to Avoid

1. **Don't access $props() multiple times**:
   ```svelte
   <!-- ❌ Wrong -->
   <script>
     let { name } = $props();
     let { age } = $props();  // Error: $props() can only be called once
   </script>

   <!-- ✅ Correct -->
   <script>
     let { name, age } = $props();
   </script>
   ```

2. **Don't destructure outside script tag**:
   ```svelte
   <!-- ❌ Wrong -->
   {#each $props().items as item}  <!-- Error -->

   <!-- ✅ Correct -->
   <script>
     let { items } = $props();
   </script>
   {#each items as item}
   ```

3. **Don't mutate props directly** (same as before):
   ```svelte
   <!-- ❌ Wrong -->
   <script>
     let { count } = $props();
     count++;  // Props are immutable
   </script>

   <!-- ✅ Correct -->
   <script>
     let { count } = $props();
     let localCount = $state(count);
     localCount++;
   </script>
   ```

---

## Validation Checklist

Per component migration:

- [ ] All `export let` statements converted to `$props()` destructuring
- [ ] Default values preserved exactly
- [ ] No name conflicts with local variables
- [ ] Props used in reactive statements updated to $derived
- [ ] Component tests pass without modification
- [ ] Visual regression test passes
- [ ] Parent components require no changes
- [ ] ESLint/type checking passes

---

## References

- [Svelte 5 Migration Guide - $props()](https://svelte.dev/docs/svelte/v5-migration-guide#Components-are-no-longer-classes)
- [Svelte 5 Runes Documentation](https://svelte.dev/docs/svelte/runes)
- Code Review Document: `specs/.pending/code-review/code-review.md` (Section 3)
