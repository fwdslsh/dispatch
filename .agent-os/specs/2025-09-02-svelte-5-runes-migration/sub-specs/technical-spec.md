# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-09-02-svelte-5-runes-migration/spec.md

> Svelte 5 Syntax Reference: @.agent-os/svelte-complete-distilled.txt

> Created: 2025-09-02
> Version: 1.0.0

## Technical Requirements

### Runes Migration Patterns

- **State Management**: Replace all reactive declarations ($:) with $state and $derived runes
- **Store Replacement**: Convert writable/readable stores to $state runes with getter/setter patterns
- **Effect Management**: Replace onMount/onDestroy with $effect runes and cleanup functions
- **Props Handling**: Update component props to use $props() rune instead of export let
- **Event Dispatching**: Migrate createEventDispatcher to callback props pattern
- **Binding Updates**: Ensure all bind: directives work with new runes state

### Component-Specific Updates

- **Terminal.svelte**: Convert terminal state, socket management, and resize observers to runes
- **Chat.svelte**: Update message state and event handling to runes patterns
- **HeaderToolbar.svelte**: Migrate navigation state and project selection to runes
- **Icon Components**: Update any reactive props to use $props() rune

### Page Updates

- **+page.svelte (root)**: Convert session management and Socket.IO integration to runes
- **sessions/+page.svelte**: Update project and session listing with runes state
- **sessions/[id]/+page.svelte**: Migrate individual session view to runes

### Testing Requirements

- **Functional Testing**: Verify all terminal operations (create, attach, input, resize, detach)
- **UI Testing**: Ensure all user interactions work identically (clicks, keyboard input, resizing)
- **Socket Testing**: Confirm Socket.IO events fire correctly with new state management
- **Mobile Testing**: Test touch interactions and virtual keyboard handling
- **State Persistence**: Verify localStorage and session persistence still functions

### Performance Considerations

- **Reactivity Optimization**: Leverage runes' fine-grained reactivity for better performance
- **Memory Management**: Ensure proper cleanup in $effect return functions
- **Bundle Size**: Monitor any changes to the compiled output size

### Code Style Guidelines

- **Consistent Patterns**: Use the same runes patterns across all components
- **TypeScript Support**: Maintain or improve type safety with runes
- **Comments**: Add brief comments explaining non-obvious runes patterns
- **Naming Conventions**: Keep existing variable names where possible for easier review

## Approach

### Migration Strategy

1. **Dependency Updates**: Upgrade to Svelte 5 and update related dependencies
2. **Component-by-Component**: Migrate components individually, starting with leaf components
3. **State Patterns**: Establish consistent patterns for $state, $derived, and $effect usage
4. **Testing at Each Step**: Verify functionality after each component migration
5. **Performance Validation**: Monitor bundle size and runtime performance changes

### Implementation Order

1. **Icon Components**: Simple components with minimal state
2. **Chat.svelte**: Moderate complexity with message handling
3. **HeaderToolbar.svelte**: Navigation and project state management
4. **Terminal.svelte**: Most complex with socket management and terminal state
5. **Page Components**: Root pages that orchestrate component interactions

### Runes Patterns

#### State Management

```javascript
// Before (Svelte 4)
let count = 0;
$: doubled = count * 2;

// After (Svelte 5)
let count = $state(0);
let doubled = $derived(count * 2);
```

#### Component Props

```javascript
// Before (Svelte 4)
export let title;
export let onClose;

// After (Svelte 5)
let { title, onClose } = $props();
```

#### Effects

```javascript
// Before (Svelte 4)
onMount(() => {
	const cleanup = setupSocket();
	return cleanup;
});

// After (Svelte 5)
$effect(() => {
	const cleanup = setupSocket();
	return cleanup;
});
```

## External Dependencies

### Migration Tools

- **Svelte Migration Assistant**: Use official migration tools if available
- **ESLint Rules**: Update linting rules for Svelte 5 patterns
