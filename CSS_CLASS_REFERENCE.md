# CSS Class Reference Guide

Quick reference for finding CSS classes in the Dispatch codebase.

## Component-Specific Classes

### Session Components

**SessionCard.svelte**
```css
/* Location: src/lib/client/shared/components/SessionCard.svelte <style> block */
.card-base
.card-session
.card-session:hover
.card-session:focus
.card-session.is-selected
.card-session.is-active
.card-session.is-inactive
.header-layout
.icon-container
.info-section
.title-text
.meta-text
.workspace-path
.date-text
```

**TypeCard.svelte**
```css
/* Location: src/lib/client/shared/components/TypeCard.svelte <style> block */
.type-card
.type-card__content
.type-card__icon
.type-card__info
.type-card__title
.type-card__desc
.type-card.active
.type-card:disabled
.type-card:hover
```

### Modal & Overlay Components

**Modal.svelte**
```css
/* Location: src/lib/client/shared/components/Modal.svelte <style> block */
.modal-backdrop
.modal-backdrop.open
.modal-container
.modal-container--small
.modal-container--medium
.modal-container--large
.modal-container--fullscreen
.modal-header
.modal-title
.modal-content
.modal-footer
```

### Form Components

**FormSection.svelte**
```css
/* Location: src/lib/client/shared/components/FormSection.svelte <style> block */
.form-section
.form-section__label
.form-section__label-icon
```

**Form Utilities (Various Components)**
```css
/* Location: Scoped in individual form components */
.form-wrapper
.form-label
.form-input
.form-textarea
.form-help
.form-error
.form-warning
.form-counter
.form-group
```

### Button Components

**IconButton.svelte**
```css
/* Location: src/lib/client/shared/components/IconButton.svelte <style> block */
.btn-icon-only
.btn-icon-only.primary
.btn-icon-only.secondary
.btn-icon-only.warn
.btn-icon-only.danger
.btn-icon-only.ghost
.btn-icon-only.active
.btn-icon-only:hover
.btn-icon-only:disabled
```

**Button Utilities**
```css
/* Location: src/lib/client/shared/components/Button.svelte <style> block */
.btn-layout
.btn__spinner
.btn__text--hidden
.btn-aug
```

### Content Display Components

**Markdown.svelte**
```css
/* Location: src/lib/client/shared/components/Markdown.svelte <style> block */
.markdown-content
.markdown-content h1 → h6
.markdown-content p
.markdown-content a
.markdown-content ul, ol, li
.markdown-content code
.markdown-content pre
.markdown-content blockquote
.markdown-content table, th, td
.markdown-content hr
.markdown-content img
/* Plus 80+ more typography rules */
```

**ErrorDisplay.svelte**
```css
/* Location: src/lib/client/shared/components/ErrorDisplay.svelte <style> block */
.error-display
.error-display--error
.error-display--warning
.error-display--info
.error-display--success
.error-display__icon
.error-display__content
.error-display__title
.error-display__message
.notification
.notification--error
.notification--warning
.toast
```

### Layout Components

**StatusBar.svelte**
```css
/* Location: src/lib/client/shared/components/StatusBar.svelte <style> block */
.status-bar-container
.status-bar
.status-bar-group
.status-bar-left
.status-bar-center
.status-bar-right
.desktop-navigation
.session-counter
```

**TileControls.svelte**
```css
/* Location: src/lib/client/shared/components/window-manager/TileControls.svelte */
.tile-controls
.tile-controls:hover
.tile-controls-group
```

**Panel/Menu Components**
```css
/* Location: Scoped in panel/menu components */
.menu-root
.tab-content
.panel
.panel-header
.panel-title
.panel-list
.count-badge
.directory-button
.directory-path
```

### Claude Components

**ClaudePane.svelte**
```css
/* Location: src/lib/client/claude/ClaudePane.svelte <style> block */
.claude-pane
.chat-header
.chat-container
.chat-content
.chat-input-area
.chat-actions
.ai-status
.ai-status.thinking
.ai-avatar
.ai-avatar-small
.message
.message--user
.message--assistant
.message--error
.message-text
.message-role
.send-button
.stop-button
.model-selector
.activity-summary
.activity-header
.activity-item
@keyframes avatarPulse
@keyframes messageSlideIn
```

**Claude Settings**
```css
/* Location: src/lib/client/settings/settings.css */
.claude-auth
.claude-settings
.auth-content
.status-card
.status-card--checking
.status-card--authenticated
.status-card--not-authenticated
.status-card--error
.status-info
.flow-actions
.flow-setup
.flow-steps
.flow-step
.step-number
.step-content
.step-title
.step-description
.setting-group
.setting-label
.setting-input
.setting-textarea
.setting-checkbox
.setting-description
.advanced-settings
.default-hint
.status-message
```

## Generic Utilities (Not Currently Used)

These ~93 utility classes were in `utilities.css` but the file is disabled.
If you need these, either:
1. Add them to a new `utilities.css` file
2. Use them inline in component `<style>` blocks

### Spacing
```css
.p-0, .p-1, .p-2, .p-3, .p-4, .p-5, .p-6
.m-0, .m-1, .m-2, .m-3, .m-4, .m-5, .m-6
.gap-0, .gap-1, .gap-2, .gap-3, .gap-4, .gap-5, .gap-6
.px-2, .px-3, .px-4
.py-1, .py-2, .py-3
.pt-2, .pb-2, .pl-2, .pr-2
.mx-auto, .mt-2, .mt-3, .mb-2, .mb-3, .ml-auto
.space-y-2, .space-y-3, .space-x-2, .space-x-3
```

### Layout
```css
.flex, .flex-col, .flex-center, .flex-between, .flex-wrap
.grid, .grid-cols-2, .grid-cols-3
.items-center, .items-start, .items-end
.justify-start, .justify-center, .justify-end, .justify-between, .justify-around
.flex-1, .flex-auto, .flex-none, .shrink-0, .grow
.w-full, .w-auto, .w-4, .h-4, .h-full, .min-w-0
.overflow-hidden, .overflow-x-auto, .overflow-y-auto
.relative, .absolute, .fixed
.block, .inline-block, .inline, .hidden
```

### Typography
```css
.text-left, .text-center, .text-right
.font-medium, .font-semibold, .font-bold
.text-xs, .text-sm, .text-base, .text-lg
.text-primary, .text-text, .text-muted, .text-success, .text-warning, .text-error
```

### Visual Effects
```css
.cursor-pointer, .cursor-not-allowed
.opacity-0, .opacity-50, .opacity-75, .opacity-100
.transform
.z-10, .z-20, .z-50
.shadow-sm, .shadow, .shadow-md, .shadow-lg
.rounded, .rounded-sm, .rounded-md, .rounded-lg, .rounded-xl
```

### Interactive States
```css
.interactive
.is-active, .is-selected, .is-disabled, .is-loading, .is-hidden, .is-invisible
```

### Modern Effects
```css
.glow-sm, .glow-md, .glow-lg, .glow-focus, .glow-success, .glow-error
.backdrop-blur, .backdrop-blur-sm, .backdrop-blur-lg
.glass, .glass-dark
```

### Transitions & Animations
```css
.transition-all, .transition-colors, .transition-transform
.duration-150, .duration-200, .duration-300
.ease-out, .ease-in-out
.animate-fade-in, .animate-slide-in, .animate-pulse, .animate-spin, .animate-scan
```

### Backgrounds & Borders
```css
.bg-surface, .bg-surface-glass, .bg-surface-highlight, .bg-surface-hover
.bg-primary-glow-5, .bg-primary-glow-10
.border, .border-surface-border, .border-b, .border-b-surface-border
```

### Responsive
```css
.mobile-hidden, .mobile-full-width
.desktop-only, .mobile-only
```

### Accessibility
```css
.sr-only
.focus-visible:focus-visible
@media (prefers-reduced-motion: reduce) { ... }
```

## How to Find CSS

### Method 1: Check Component File
Most components have scoped `<style>` blocks:

```svelte
<!-- src/lib/client/shared/components/Modal.svelte -->
<div class="modal-backdrop">...</div>

<style>
  .modal-backdrop { /* CSS is here */ }
</style>
```

### Method 2: Check Dedicated CSS Files

Some components have separate CSS files:
- `src/lib/client/settings/settings.css` - Settings/Claude auth components
- `src/lib/client/shared/components/window-manager/window-manager.css` - Window manager
- `src/lib/client/claude/activity-summaries/shared-styles.css` - Activity summaries

### Method 3: Global Styles

Global styles are in:
- `src/lib/client/shared/styles/variables.css` - CSS custom properties
- `src/lib/client/shared/styles/fonts.css` - Font definitions

### Method 4: Search with Grep

```bash
# Find where a class is defined
grep -r "\.class-name" --include="*.svelte" --include="*.css" src/

# Find where a class is used
grep -r "class-name" --include="*.svelte" src/
```

## Quick Tips

1. **Component CSS**: Always check the component's `<style>` block first
2. **Settings CSS**: Check `settings.css` for Claude/auth related styles
3. **Utilities**: The utilities.css file is deprecated - use scoped styles instead
4. **Design Tokens**: Use CSS variables from `variables.css` (e.g., `var(--primary)`)

## What Happened to utilities.css?

The `utilities.css` file was moved to `.remove/` directory and is no longer imported:

```
src/lib/client/shared/styles/
├── .remove/
│   └── utilities.css  ← Deprecated, ready to delete
```

All CSS from utilities.css has been migrated to:
- Component scoped `<style>` blocks
- Dedicated CSS files (settings.css, etc.)

**Recommendation**: Delete the deprecated file entirely.
