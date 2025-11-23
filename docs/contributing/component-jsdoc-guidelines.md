# Component JSDoc Documentation Guidelines

This guide provides templates and best practices for documenting Svelte 5 components with comprehensive JSDoc annotations.

## Table of Contents

- [Why Document Components](#why-document-components)
- [JSDoc Template](#jsdoc-template)
- [Component Types](#component-types)
- [Examples by Category](#examples-by-category)
- [Best Practices](#best-practices)
- [Tools and Validation](#tools-and-validation)

## Why Document Components

Comprehensive component documentation provides:

- **IDE Support**: IntelliSense and autocomplete for props
- **Type Safety**: Type checking for component usage
- **Developer Experience**: Quick reference without reading implementation
- **Maintainability**: Clear understanding of component API and behavior
- **Onboarding**: Faster ramp-up for new developers

## JSDoc Template

### Basic Component Template

```svelte
<script>
/**
 * @component ComponentName
 * @description
 * Brief description of what the component does and when to use it.
 * Additional details about behavior, features, and purpose.
 *
 * @typedef {Object} ComponentNameProps
 * @property {Type} propName - Description of the prop
 * @property {Type} [optionalProp='default'] - Optional prop with default value
 * @property {(param: Type) => ReturnType} [eventHandler] - Event handler callback
 * @property {import('svelte').Snippet} [children] - Child content snippet
 *
 * @example
 * ```svelte
 * <!-- Basic usage -->
 * <ComponentName propName={value} />
 *
 * <!-- With optional props -->
 * <ComponentName
 *   propName={value}
 *   optionalProp="custom"
 *   eventHandler={handleEvent}
 * >
 *   Content here
 * </ComponentName>
 * ```
 *
 * @fires {Type} eventName - Description of when/why event is fired
 */

let {
	propName,
	optionalProp = 'default',
	eventHandler = undefined,
	children = undefined,
	...restProps
} = $props();
</script>
```

## Component Types

### 1. Foundation Components

Basic reusable UI components (buttons, inputs, modals).

**Template:**

```javascript
/**
 * @component Button
 * @description
 * Reusable button component with multiple variants and states.
 * Supports loading states, icons, and full accessibility.
 *
 * @typedef {Object} ButtonProps
 * @property {string} [text=''] - Button text content
 * @property {'primary'|'ghost'|'warn'|'danger'} [variant='primary'] - Visual variant
 * @property {boolean} [disabled=false] - Disabled state
 * @property {(event: MouseEvent) => void} [onclick] - Click handler
 *
 * @example
 * ```svelte
 * <Button text="Click me" onclick={handleClick} />
 * ```
 */
```

### 2. Layout Components

Containers and structural components (headers, sections, grids).

**Template:**

```javascript
/**
 * @component FormSection
 * @description
 * Container for grouping related form fields with optional title and description.
 * Provides consistent spacing and semantic structure.
 *
 * @typedef {Object} FormSectionProps
 * @property {string} [title=''] - Section title
 * @property {string} [description=''] - Optional description
 * @property {import('svelte').Snippet} [children] - Form fields content
 *
 * @example
 * ```svelte
 * <FormSection title="User Settings">
 *   <Input label="Name" bind:value={name} />
 * </FormSection>
 * ```
 */
```

### 3. Feature Components

Complex domain-specific components (workspace selectors, session cards).

**Template:**

```javascript
/**
 * @component SessionCard
 * @description
 * Interactive card for displaying session information.
 * Shows session type, title, workspace path, and action buttons.
 *
 * @typedef {Object} SessionCardProps
 * @property {Object} session - Session data object
 * @property {string} session.id - Unique session ID
 * @property {string} session.type - Session type ('claude'|'terminal')
 * @property {(session: Object) => void} [onSelect] - Selection handler
 * @property {boolean} [isActive=false] - Active state indicator
 *
 * @example
 * ```svelte
 * <SessionCard
 *   {session}
 *   onSelect={handleSelect}
 *   isActive={session.status === 'running'}
 * />
 * ```
 */
```

### 4. Utility Components

Presentational components with minimal logic (badges, spinners, icons).

**Template:**

```javascript
/**
 * @component StatusBadge
 * @description
 * Displays status indicators with semantic color variants.
 * Used for showing state, health, and availability.
 *
 * @typedef {Object} StatusBadgeProps
 * @property {'active'|'inactive'|'error'|'success'} [variant='default'] - Status type
 *
 * @example
 * ```svelte
 * <StatusBadge variant="active">Active</StatusBadge>
 * ```
 */
```

## Examples by Category

### Input Components

```javascript
/**
 * @component Input
 * @description
 * Foundation input with validation, help text, and character limits.
 * Supports all HTML5 input types plus textarea.
 *
 * @typedef {Object} InputProps
 * @property {string} value - Bindable input value
 * @property {'text'|'email'|'password'|'textarea'} [type='text'] - Input type
 * @property {string} [label=''] - Label text
 * @property {string} [error=''] - Error message
 * @property {number} [maxLength] - Character limit (shows counter)
 * @property {(event: Event) => void} [oninput] - Input handler
 *
 * @example
 * ```svelte
 * <Input
 *   bind:value={email}
 *   type="email"
 *   label="Email"
 *   error={errorMsg}
 * />
 * ```
 *
 * @fires {Event} input - Fired on every input change
 * @fires {Event} change - Fired when value changes and input loses focus
 */
```

### Modal/Dialog Components

```javascript
/**
 * @component Modal
 * @description
 * Foundation modal with backdrop, keyboard handling, and focus trapping.
 * Manages body scroll and provides accessible dialog pattern.
 *
 * @typedef {Object} ModalProps
 * @property {boolean} open - Bindable visibility state
 * @property {'small'|'medium'|'large'} [size='medium'] - Modal size
 * @property {boolean} [closeOnBackdrop=true] - Allow backdrop close
 * @property {string} [title=''] - Modal title
 * @property {() => void} [onclose] - Close callback
 *
 * @example
 * ```svelte
 * <Modal bind:open={showModal} title="Confirm">
 *   <p>Confirmation message</p>
 *   {#snippet footer()}
 *     <Button onclick={() => showModal = false}>Close</Button>
 *   {/snippet}
 * </Modal>
 * ```
 *
 * @fires {void} close - Fired when modal closes
 */
```

### Data Display Components

```javascript
/**
 * @component SessionCard
 * @description
 * Interactive card displaying session data with selection and actions.
 * Shows type icon, title, workspace path, and last activity.
 *
 * @typedef {Object} SessionCardProps
 * @property {Object} session - Session data
 * @property {string} session.id - Session ID
 * @property {string} session.type - Session type
 * @property {string|null} [selectedSession=null] - Currently selected ID
 * @property {(session: Object) => void} [onSelect] - Selection handler
 *
 * @example
 * ```svelte
 * <SessionCard
 *   {session}
 *   selectedSession={currentId}
 *   onSelect={handleSelect}
 * />
 * ```
 */
```

## Best Practices

### 1. Always Include

- **@component** tag with component name
- **@description** with multi-line explanation
- **@typedef** for props object
- **@example** with realistic usage
- **@fires** for custom events

### 2. Prop Documentation

```javascript
/**
 * @property {Type} name - Description
 *
 * Type formats:
 * - Primitives: string, number, boolean
 * - Literals: 'primary'|'secondary'
 * - Functions: (param: Type) => ReturnType
 * - Snippets: import('svelte').Snippet
 * - Optional: [propName='default']
 * - Arrays: string[]
 * - Objects: {key: Type}
 */
```

### 3. Event Documentation

```javascript
/**
 * @fires {EventType} eventName - When and why the event fires
 *
 * Examples:
 * @fires {MouseEvent} click - Fired when button is clicked
 * @fires {void} close - Fired when modal closes
 * @fires {Object} select - Fired with selected item data
 */
```

### 4. Example Quality

- Show basic usage first
- Include common prop combinations
- Demonstrate event handlers
- Show snippet usage for complex components
- Use realistic prop values

**Good Example:**

```svelte
/**
 * @example
 * ```svelte
 * <!-- Basic usage -->
 * <Input bind:value={email} type="email" label="Email" />
 *
 * <!-- With validation -->
 * <Input
 *   bind:value={password}
 *   type="password"
 *   label="Password"
 *   error={passwordError}
 *   help="Minimum 8 characters"
 * />
 * ```
 */
```

### 5. Svelte 5 Patterns

Document Svelte 5-specific features:

```javascript
/**
 * @typedef {Object} ComponentProps
 * @property {string} value - Bindable with $bindable()
 * @property {import('svelte').Snippet} [icon] - Icon snippet
 * @property {import('svelte').Snippet} [children] - Content snippet
 */

let {
	value = $bindable(''),
	icon = undefined,
	children = undefined
} = $props();
```

## Tools and Validation

### IDE Support

VSCode with Svelte extension provides:
- Hover documentation
- Prop autocomplete
- Type checking
- Quick info panels

### Type Checking

```bash
# Run type checking
npm run check
```

### Documentation Generation

Future: Consider using `typedoc` or `sveltedoc-parser` for automated API documentation generation from JSDoc comments.

## Component Documentation Checklist

When documenting a component, ensure:

- [ ] @component tag with correct name
- [ ] @description explains purpose and usage
- [ ] @typedef with all props documented
- [ ] Optional props marked with [brackets]
- [ ] Default values specified
- [ ] Event handlers typed correctly
- [ ] @example with 2-3 realistic usages
- [ ] @fires for custom events
- [ ] Snippets documented if used
- [ ] Complex types explained

## Migration Plan

### Already Documented

Core foundation components with comprehensive JSDoc:

- Button, Input, Modal, LoadingSpinner
- IconButton, EmptyState, ErrorDisplay, StatusBadge
- ConfirmationDialog, SessionCard, TypeCard, MetricCard
- FormSection, InfoBox, AppVersion, Header

### To Be Documented

Remaining components can use templates from this guide:

- Workspace components (`src/lib/client/shared/components/workspace/`)
- Directory browser (`src/lib/client/shared/components/directory-browser/`)
- Settings components
- Specialized UI components
- Icon components (optional - simple SVG wrappers)

## Summary

- **Start with @component and @description** - Explain what and why
- **Document all props with @typedef** - Types, defaults, and descriptions
- **Provide realistic @example blocks** - Show common usage patterns
- **Document events with @fires** - Explain when/why events occur
- **Use this guide as reference** - Templates for every component type

For questions or additions to this guide, consult the development team.
