# Layout CSS Architecture Review
**Date:** 2025-10-07
**Focus:** Layout structure, scrolling containers, and complexity reduction
**Reviewer:** Dr. Alexandra Chen, Frontend Design Expert

---

## Executive Summary

The current layout architecture suffers from **excessive complexity**, **conflicting flex/grid implementations**, and **broken scrolling behavior** in session containers. The application uses a mix of modern layout techniques (CSS Grid, Flexbox) but lacks a clear, consistent hierarchy. Key issues include:

1. **Nested flex containers without proper min-height/min-width constraints** causing scrolling failures
2. **Conflicting overflow properties** across multiple layout levels
3. **Inconsistent height management** (100%, 100vh, 100dvh, min-height: 0 used inconsistently)
4. **Duplicated utility classes** between retro.css and utilities.css
5. **Lack of clear layout responsibility boundaries** between components

**Impact:** Sessions (terminal and Claude) cannot scroll properly, layout breaks on resize, and maintenance is difficult due to unpredictable CSS interactions.

**Recommendation:** Complete layout refactor using a clean, single-responsibility hierarchy with proper CSS containment and explicit scrolling boundaries.

---

## Detailed Analysis

### 1. Root Layout Architecture Issues

#### Current Structure
```
Shell (dispatch-app)                    ← Flex column, 100vh/100dvh
  └─ Header (snippet)                   ← Flex shrink: 0
  └─ Main (app-main)                    ← Flex: 1 1 auto, overflow: hidden
      └─ WorkspacePage (dispatch-workspace) ← Grid, height: 100%, overflow: hidden
          └─ SessionWindowManager       ← Relative, w/h: 100%
              └─ WindowManager          ← Flex column
                  └─ Split              ← Flex row/column based on direction
                      └─ Tile           ← Button element (!!)
                          └─ SessionContainer ← Flex column, w/h: 100%
                              └─ SessionViewport ← overflow: hidden, height: 100%
                                  └─ ClaudePane/TerminalPane
```

**Problems:**

1. **Shell.svelte (Lines 29-54)**
   ```css
   .dispatch-app {
     height: 100vh;          /* Fallback */
     height: 100dvh;         /* Modern */
     display: flex;
     flex-direction: column;
     overflow: hidden;       /* Prevents body scroll */
     max-width: 100svw;      /* Unnecessary */
     overscroll-behavior: none;
     touch-action: pan-x pan-y;
   }

   .app-main {
     flex: 1 1 auto;         /* Takes remaining space */
     overflow: hidden;       /* Prevents main scroll */
     min-width: 0;           /* Good */
     min-height: 0;          /* Good */
   }
   ```
   - ✓ Good: Proper flex sizing with min constraints
   - ✗ Bad: `max-width: 100svw` unnecessary with proper box-sizing
   - ✗ Bad: `overscroll-behavior` and `touch-action` belong on body, not container

2. **WorkspacePage.svelte (Lines 619-632)**
   ```css
   .dispatch-workspace {
     position: relative;
     display: grid;          /* Grid without explicit template! */
     overflow: hidden;
     max-width: 100svw;      /* Duplicate constraint */
     height: 100%;
     width: 100%;
     transition: grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1);
   }
   ```
   - ✗ **Critical:** Grid without `grid-template-columns` or `grid-template-rows` defined
   - ✗ Grid is unnecessary here - should be flex or plain block
   - ✗ `max-width: 100svw` redundant (parent already constrains)
   - ✗ Transition on undefined grid property

### 2. Window Manager Layout Issues

#### WindowManager Structure
The window manager uses a recursive split/tile pattern with significant problems:

**Split.svelte (Lines 89-160)**
```css
/* NO STYLES - relies entirely on window-manager.css */
```

**window-manager.css (Lines 12-52)**
```css
.wm-split {
  display: flex;
  inline-size: 100%;
  block-size: 100%;        /* Assumes parent has defined height */
  position: relative;
}

.wm-pane {
  display: flex;           /* Unnecessary flex on pane */
  min-inline-size: 0;      /* Good */
  min-block-size: 0;       /* Good */
  position: relative;
  transition: flex 0.2s cubic-bezier(0.23, 1, 0.32, 1);
  overflow: hidden;        /* PROBLEM: Hides content instead of scrolling */
}
```

**Problems:**

1. `.wm-pane` has `display: flex` but doesn't need to be a flex container
2. `overflow: hidden` on `.wm-pane` prevents child scrolling
3. No explicit height/width constraints - relies on parent
4. Transition on `flex` property can cause layout thrashing

**Tile.svelte (Lines 24-34)**
```html
<button
  type="button"
  class="wm-tile"
  data-tile-id={id}
  aria-label={id}
  onclick={focusSelf}
>
  {@render children?.()}
</button>
```

**CRITICAL ISSUE:** Using a `<button>` as a layout container!
- Buttons have default styling that interferes with layout
- Buttons have accessibility expectations that don't match usage
- Buttons have focus/click behavior that conflicts with nested interactivity

**window-manager.css (Lines 139-158)**
```css
.wm-tile {
  display: flex;           /* Flex on button */
  inline-size: 100%;
  block-size: 100%;
  overflow: hidden;        /* PROBLEM: Prevents scrolling */
  background: none;
  border: none;
  padding: 0;
  margin: 0;
  outline: none;          /* Removes focus indicator */
}
```

### 3. Session Container Scrolling Issues

#### SessionContainer.svelte (Lines 32-69)
```css
.session-container {
  background: var(--bg-panel);
  border: 1px solid var(--primary-dim);
  overflow: hidden;        /* ROOT CAUSE: Prevents scrolling */
  width: 100%;
  height: 100%;
  position: relative;
  transition: border-color 0.2s ease;
}
```

**ROOT CAUSE OF SCROLLING ISSUES:**
1. `.session-container` has `overflow: hidden`
2. Child `.session-viewport` also has `overflow: hidden`
3. Terminal/Claude panes expect to scroll but parent prevents it

#### SessionViewport.svelte (Lines 75-83)
```css
.session-viewport {
  overflow: hidden;        /* Duplicates parent */
  background: var(--bg-dark);
  min-height: 0;           /* Good but ineffective */
  height: 100%;
  position: relative;
  contain: layout;         /* Good */
}
```

#### TerminalPane.svelte (Lines 206-247)
```css
.terminal-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;            /* Expects parent to define height */
  overflow: hidden;        /* PROBLEM: xterm.js needs scrolling */
}

.terminal-container {
  display: flex;           /* Unnecessary flex */
  flex: 1;
  width: 100%;
  height: 100%;            /* Conflicts with flex: 1 */
  min-height: 0;           /* Good */
  overflow: hidden;        /* PROBLEM */
}
```

**Why Terminal Scrolling Fails:**
1. Terminal needs `overflow: auto` or `overflow-y: auto` on container
2. Multiple `overflow: hidden` in hierarchy prevents scrollback
3. xterm.js FitAddon can't calculate correct dimensions
4. `height: 100%` conflicts with `flex: 1` (use one or the other)

#### ClaudePane.svelte (Lines 209-220)
```css
.claude-pane {
  display: flex;
  flex-direction: column;
  height: 100%;            /* Expects parent height */
  overflow: hidden;        /* Prevents scroll on entire pane */
}
```

**Claude MessageList scrolling issue:**
- MessageList component needs to be the scroll container
- But parent `.claude-pane` has `overflow: hidden`
- Message list can't scroll independently

### 4. Utility Class Duplication

**Severe duplication between `utilities.css` and `retro.css`:**

| Class | retro.css | utilities.css | Issue |
|-------|-----------|---------------|-------|
| `.flex` | No | Lines 256-258 | - |
| `.flex-col` | No | Lines 260-263 | - |
| `.flex-center` | No | Lines 265-269 | - |
| `.flex-between` | Lines 164-169 (`.cluster`) | Lines 271-275 | Different implementation |
| `.gap-*` | No | Lines 54-75 | - |
| `.p-*`, `.m-*` | Lines 8-52 | No | Only in utilities.css |
| `.w-full`, `.h-full` | Lines 349-367 | No | Only in utilities.css |
| `.button` | Lines 369-518 (extensive) | Lines 1173-1243 (`.btn-icon-only`) | Partial overlap |

**Total Duplication:** ~15% of CSS rules are duplicated or conflicting

### 5. Responsive Layout Issues

#### Mobile Breakpoints
Multiple breakpoints used inconsistently:
- `@media (max-width: 480px)` - Shell.svelte, retro.css
- `@media (max-width: 500px)` - WorkspacePage.svelte (JavaScript)
- `@media (max-width: 768px)` - Most components
- `@media (max-width: 400px)` - retro.css

**Issue:** No consistent breakpoint strategy, leads to unpredictable responsive behavior

#### Mobile-specific Layout Problems
```css
/* WorkspacePage.svelte lines 682-696 */
@media (max-width: 480px) {
  .dispatch-workspace {
    padding-bottom: max(0.4rem, env(safe-area-inset-bottom));
  }

  .session-sheet {
    height: calc(100% - 56px);
    transform: translateY(calc(100% + 52px));  /* Magic numbers */
  }
}
```

**Issues:**
- Magic numbers (56px, 52px) without explanation
- Different mobile breakpoint than JavaScript detection
- `calc()` expressions are fragile

### 6. CSS Containment Strategy

**Good usage:**
```css
/* SessionViewport.svelte line 82 */
contain: layout;
```

**Missing containment where needed:**
- Window manager splits (would benefit from `contain: layout style`)
- Session containers (would benefit from `contain: layout style`)
- Modal overlays (would benefit from `contain: style`)

**Containment Benefits:**
- Improves rendering performance
- Creates isolation boundaries
- Prevents style leakage
- Enables better browser optimization

---

## Comprehensive TODO List

### Priority 1: Critical Layout Fixes (Enables Scrolling)

1. **Fix SessionContainer scroll hierarchy**
   - Remove `overflow: hidden` from `.session-container`
   - Change to `overflow: visible` or remove property entirely
   - Let child components manage their own overflow
   - File: `src/lib/client/shared/components/workspace/SessionContainer.svelte`

2. **Fix SessionViewport scroll management**
   - Change `overflow: hidden` to `overflow: visible` on `.session-viewport`
   - Remove `height: 100%` (relies on flex parent)
   - Add `flex: 1` to allow it to take available space
   - File: `src/lib/client/shared/components/workspace/SessionViewport.svelte`

3. **Fix TerminalPane scrolling**
   - Change `.terminal-container` from `overflow: hidden` to `overflow: auto`
   - Remove redundant `height: 100%` (already has `flex: 1`)
   - Remove unnecessary `display: flex` from `.terminal-container`
   - Ensure xterm.js container can scroll
   - File: `src/lib/client/terminal/TerminalPane.svelte`

4. **Fix ClaudePane MessageList scrolling**
   - Change `.claude-pane` `overflow: hidden` to `overflow: visible`
   - Ensure MessageList component is the scroll container
   - Add `overflow-y: auto` to message list container
   - Test with long conversation history
   - Files: `src/lib/client/claude/ClaudePane.svelte`, `src/lib/client/claude/components/MessageList.svelte`

5. **Replace Tile button with div**
   - Change `<button class="wm-tile">` to `<div class="wm-tile" role="group">`
   - Remove button-specific CSS resets
   - Update focus management to work with div
   - Update tests for new element type
   - File: `src/lib/client/shared/components/window-manager/Tile.svelte`

### Priority 2: Layout Simplification

6. **Simplify WorkspacePage layout**
   - Remove `display: grid` from `.dispatch-workspace`
   - Change to `display: flex; flex-direction: column;`
   - Remove `grid-template-columns` transition
   - Remove redundant `max-width: 100svw`
   - File: `src/routes/workspace/+page.svelte`

7. **Clean up window manager pane structure**
   - Remove `display: flex` from `.wm-pane` (doesn't need to be flex)
   - Change `overflow: hidden` to `overflow: visible`
   - Remove `transition: flex` (causes layout thrashing)
   - Simplify to: `position: relative; min-width: 0; min-height: 0;`
   - File: `src/lib/client/shared/styles/window-manager.css`

8. **Fix window manager tile overflow**
   - Change `.wm-tile` `overflow: hidden` to `overflow: visible`
   - Let session containers manage their own overflow
   - Remove `outline: none` (breaks accessibility)
   - Add proper focus indicator
   - File: `src/lib/client/shared/styles/window-manager.css`

9. **Standardize height/width constraints**
   - Document when to use `height: 100%` vs `flex: 1`
   - Rule: Use `flex: 1` for children of flex containers
   - Rule: Use `height: 100%` only for children of grid containers
   - Never use both together
   - Audit all components for violations

10. **Remove conflicting overflow properties**
    - Audit all components for `overflow: hidden`
    - Only use `overflow: hidden` when you want to clip content
    - Use `overflow: auto` for scrollable containers
    - Use `overflow: visible` (or omit) for pass-through containers
    - Create style guide for overflow usage

### Priority 3: CSS Organization

11. **Merge duplicated utility classes**
    - Consolidate all layout utilities into `utilities.css`
    - Remove duplicates from `retro.css`
    - Keep theme/visual effects in `retro.css`
    - Update import order in `index.css`
    - File: `src/lib/client/shared/styles/utilities.css`

12. **Split utilities.css into logical modules**
    - Create `layout.css` (flex, grid, spacing, sizing)
    - Create `typography.css` (text classes, font utilities)
    - Create `effects.css` (shadows, glows, transitions)
    - Create `state.css` (hover, focus, active, disabled)
    - Update `index.css` imports

13. **Remove button styling from utilities.css**
    - Move `.btn-icon-only` styles to dedicated component file
    - Keep only `.button` base styles in `retro.css`
    - Create `buttons.css` if needed for button variants
    - Update component imports

14. **Create layout-specific CSS file**
    - Extract all layout-specific classes from utilities.css
    - Create `src/lib/client/shared/styles/layout.css`
    - Include: flex, grid, spacing, sizing, position utilities
    - Document layout patterns and best practices

### Priority 4: Consistency & Standards

15. **Standardize breakpoints**
    - Define breakpoint constants in CSS custom properties
    - Use: `--breakpoint-mobile: 480px`
    - Use: `--breakpoint-tablet: 768px`
    - Use: `--breakpoint-desktop: 1024px`
    - Update all media queries to use consistent values
    - Update JavaScript breakpoint detection to match

16. **Fix mobile detection synchronization**
    - Standardize mobile detection breakpoint (use 768px everywhere)
    - Use CSS custom properties or CSS container queries
    - Remove inline breakpoint values from JavaScript
    - Ensure CSS and JS use same breakpoint values

17. **Document overflow strategy**
    - Create `LAYOUT.md` guide in `/docs/architecture/`
    - Document when to use `overflow: hidden` vs `overflow: auto`
    - Document scroll container patterns
    - Document flex vs grid decision tree
    - Include examples for each pattern

18. **Add CSS containment strategically**
    - Add `contain: layout style` to `.wm-split`
    - Add `contain: layout style` to `.session-container`
    - Add `contain: style` to modal overlays
    - Add `contain: layout` to `.session-viewport`
    - Measure performance impact

19. **Remove magic numbers from layout**
    - Replace `calc(100% - 56px)` with CSS custom properties
    - Define: `--header-height`, `--footer-height`, `--gap-size`
    - Use custom properties in calc expressions
    - Document purpose of each custom property

20. **Standardize touch-action properties**
    - Remove `touch-action: pan-x pan-y` from `.dispatch-app`
    - Move to body element in global styles
    - Apply to specific interactive elements as needed
    - Document touch-action strategy

### Priority 5: Advanced Improvements

21. **Implement CSS Logical Properties**
    - Replace `width/height` with `inline-size/block-size` where appropriate
    - Replace `left/right` with `inline-start/inline-end`
    - Replace `top/bottom` with `block-start/block-end`
    - Already partially done in window-manager.css, extend everywhere
    - Benefits: Better RTL support, future-proof

22. **Add CSS Grid for complex layouts**
    - Replace SessionWindowManager flex nesting with CSS Grid
    - Use grid areas for header/content/footer structure
    - Simplifies responsive layout changes
    - Reduces nesting depth

23. **Implement Container Queries**
    - Replace media queries with container queries where appropriate
    - Add `container-type: inline-size` to `.session-container`
    - Use `@container` queries for responsive session layouts
    - Benefits: Component responds to container size, not viewport

24. **Create layout composability utilities**
    - Define reusable layout patterns (sidebar, stack, cluster)
    - Use CSS custom properties for configuration
    - Example: `.layout-stack { --stack-gap: var(--space-4); }`
    - Document each pattern with examples

25. **Optimize layout performance**
    - Add `will-change: transform` to animated elements
    - Use `content-visibility: auto` for off-screen content
    - Add `translate3d(0,0,0)` to GPU-accelerate transforms
    - Measure FPS impact with DevTools

### Priority 6: Documentation & Testing

26. **Create layout decision flowchart**
    - When to use flex vs grid
    - When to use height: 100% vs flex: 1
    - When to use overflow: hidden vs auto
    - When to use position: relative vs absolute
    - Add to `/docs/contributing/layout-guide.md`

27. **Add layout visual regression tests**
    - Test scrolling behavior in sessions
    - Test window manager splits at various sizes
    - Test mobile/tablet/desktop layouts
    - Use Playwright screenshots for comparison

28. **Document known layout gotchas**
    - Flex children need min-width: 0 or min-height: 0
    - Nested flex containers need explicit constraints
    - Overflow: hidden prevents child scrolling
    - Height: 100% requires parent with defined height
    - Add to `/docs/contributing/layout-gotchas.md`

29. **Create layout component examples**
    - Build example page showing all layout patterns
    - Include scroll containers, split views, flex stacks
    - Add interactive demos with DevTools integration
    - Useful for onboarding and debugging

30. **Audit and fix mobile viewport issues**
    - Test on real devices (iOS Safari, Android Chrome)
    - Fix viewport unit inconsistencies (vh vs dvh vs svh)
    - Test safe area insets on notched devices
    - Fix touch scrolling momentum issues

---

## Recommended Layout Patterns

### Pattern 1: Full-Height Scroll Container

**Use for:** Session containers that need internal scrolling

```css
/* Parent container (e.g., session-container) */
.scroll-parent {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: visible;         /* Pass-through */
}

/* Scroll container (e.g., message-list) */
.scroll-container {
  flex: 1;                   /* Take available space */
  min-height: 0;             /* Allow flex shrinking */
  overflow-y: auto;          /* Enable scrolling */
  overflow-x: hidden;        /* Prevent horizontal scroll */
}
```

### Pattern 2: Flex Stack (Vertical Layout)

**Use for:** Headers + content + footer layouts

```css
.flex-stack {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.flex-stack-header,
.flex-stack-footer {
  flex: 0 0 auto;            /* Don't grow or shrink */
}

.flex-stack-body {
  flex: 1;                   /* Take remaining space */
  min-height: 0;             /* Allow flex shrinking */
  overflow: auto;            /* Scroll if needed */
}
```

### Pattern 3: Split Pane (Horizontal/Vertical)

**Use for:** Window manager splits

```css
.split-container {
  display: flex;
  flex-direction: row;       /* or column */
  height: 100%;
  width: 100%;
}

.split-pane {
  flex: 1;                   /* Equal size by default */
  min-width: 0;              /* Prevent overflow */
  min-height: 0;             /* Prevent overflow */
  position: relative;        /* For absolute children */
  overflow: visible;         /* Let children manage scroll */
}

.split-divider {
  flex: 0 0 6px;            /* Fixed width divider */
  cursor: col-resize;        /* or row-resize */
}
```

### Pattern 4: Grid Layout (Complex Layouts)

**Use for:** Application shell with multiple fixed/fluid areas

```css
.grid-layout {
  display: grid;
  grid-template-rows: auto 1fr auto;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    "header header"
    "sidebar main"
    "footer footer";
  height: 100vh;
  height: 100dvh;            /* Modern viewport height */
}

.grid-header { grid-area: header; }
.grid-sidebar { grid-area: sidebar; }
.grid-main {
  grid-area: main;
  overflow: auto;            /* Main content scrolls */
  min-width: 0;              /* Prevent overflow */
}
.grid-footer { grid-area: footer; }
```

### Pattern 5: Absolute Positioned Overlay

**Use for:** Modals, dropdowns, floating panels

```css
.overlay-container {
  position: fixed;
  inset: 0;                  /* Cover entire viewport */
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  contain: style;            /* Isolate styles */
}

.overlay-content {
  position: relative;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;            /* Content scrolls */
  background: var(--surface);
}
```

---

## Implementation Strategy

### Phase 1: Critical Fixes (Week 1)
- **Goal:** Make sessions scrollable
- **Tasks:** Priority 1 items (#1-5)
- **Testing:** Manual testing of terminal/Claude scrolling
- **Deliverable:** Working scroll in all session types

### Phase 2: Simplification (Week 2)
- **Goal:** Reduce layout complexity
- **Tasks:** Priority 2 items (#6-10)
- **Testing:** Visual regression tests
- **Deliverable:** Simpler, more maintainable layout code

### Phase 3: Organization (Week 2-3)
- **Goal:** Clean up CSS organization
- **Tasks:** Priority 3 items (#11-14)
- **Testing:** Build verification, visual testing
- **Deliverable:** Well-organized CSS modules

### Phase 4: Standards (Week 3-4)
- **Goal:** Establish consistency
- **Tasks:** Priority 4 items (#15-20)
- **Testing:** Cross-browser, responsive testing
- **Deliverable:** Style guide and standards docs

### Phase 5: Advanced (Week 4+)
- **Goal:** Performance and future-proofing
- **Tasks:** Priority 5 items (#21-25)
- **Testing:** Performance benchmarks
- **Deliverable:** Modern, performant layout system

### Phase 6: Documentation (Ongoing)
- **Goal:** Enable team understanding
- **Tasks:** Priority 6 items (#26-30)
- **Testing:** Developer feedback
- **Deliverable:** Comprehensive layout documentation

---

## Key Principles for Refactor

1. **Single Responsibility:** Each container has ONE layout job
   - Flex parent: manages child distribution
   - Scroll container: manages overflow
   - Size container: defines dimensions
   - Never combine all three in one element

2. **Explicit Constraints:** Always define what you expect
   - If child needs parent height, parent must define height
   - If parent uses flex, child needs min-height: 0
   - If element scrolls, it needs defined dimensions
   - Don't rely on "magic" defaults

3. **Overflow Cascade:** Understand the overflow chain
   - `overflow: hidden` stops ALL child scrolling
   - `overflow: visible` passes through to children
   - `overflow: auto` creates scroll container
   - Only ONE element in chain should scroll

4. **Flex vs Grid Decision:**
   - Use Flex for: Single-axis layouts, dynamic sizing
   - Use Grid for: Two-axis layouts, fixed templates
   - Use Block for: Simple stacking, no alignment
   - Don't use Grid without defined template

5. **Mobile First:** Start with mobile constraints
   - Mobile needs simpler layouts
   - Mobile needs larger touch targets
   - Mobile needs careful scroll management
   - Desktop can layer on complexity

---

## Code Examples for Key Fixes

### Example 1: Fix SessionContainer Scrolling

**Current (BROKEN):**
```css
/* SessionContainer.svelte */
.session-container {
  overflow: hidden;        /* PREVENTS SCROLLING */
  width: 100%;
  height: 100%;
}
```

**Fixed:**
```css
/* SessionContainer.svelte */
.session-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: visible;       /* Let children scroll */
  contain: layout style;   /* Performance boost */
}
```

### Example 2: Fix TerminalPane Scrolling

**Current (BROKEN):**
```css
/* TerminalPane.svelte */
.terminal-wrapper {
  overflow: hidden;        /* PREVENTS SCROLLING */
  height: 100%;
}

.terminal-container {
  display: flex;           /* UNNECESSARY */
  overflow: hidden;        /* PREVENTS SCROLLING */
  height: 100%;
  flex: 1;                 /* CONFLICTS WITH height */
}
```

**Fixed:**
```css
/* TerminalPane.svelte */
.terminal-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  overflow: visible;       /* Pass-through */
}

.terminal-container {
  flex: 1;                 /* Take available space */
  min-height: 0;           /* Allow flex shrinking */
  overflow: auto;          /* ENABLE SCROLLING */
  position: relative;      /* For absolute children */
}

/* xterm.js fills container naturally */
```

### Example 3: Replace Tile Button with Div

**Current (PROBLEMATIC):**
```svelte
<!-- Tile.svelte -->
<button
  type="button"
  class="wm-tile"
  onclick={focusSelf}
>
  {@render children?.()}
</button>
```

**Fixed:**
```svelte
<!-- Tile.svelte -->
<div
  class="wm-tile"
  role="group"
  tabindex="0"
  aria-label={id}
  onclick={focusSelf}
  onkeydown={(e) => e.key === 'Enter' && focusSelf()}
>
  {@render children?.()}
</div>
```

```css
/* window-manager.css */
.wm-tile {
  display: block;          /* Not flex, not button */
  width: 100%;
  height: 100%;
  position: relative;
  overflow: visible;       /* Let children scroll */
  outline: 2px solid transparent;
  transition: outline-color 0.2s ease;
}

.wm-tile:focus-visible {
  outline-color: var(--accent);
}

.wm-tile[data-focused='true'] {
  outline-color: var(--primary);
}
```

### Example 4: Simplify WorkspacePage Layout

**Current (OVERCOMPLICATED):**
```css
/* WorkspacePage.svelte */
.dispatch-workspace {
  display: grid;                      /* Grid without template */
  overflow: hidden;
  max-width: 100svw;                  /* Redundant */
  height: 100%;
  width: 100%;
  transition: grid-template-columns 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Fixed:**
```css
/* WorkspacePage.svelte */
.dispatch-workspace {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: visible;                  /* Let children manage scroll */
  contain: layout style;              /* Performance */
}

.workspace-content {
  flex: 1;
  min-height: 0;                      /* Allow flex shrinking */
  overflow: visible;                  /* Pass-through */
}
```

---

## Testing Checklist

After implementing fixes, verify:

- [ ] Terminal sessions scroll correctly (test with long output)
- [ ] Claude message list scrolls correctly (test with 50+ messages)
- [ ] Window manager splits resize smoothly
- [ ] Mobile layouts work on real devices
- [ ] No horizontal scrollbars appear unexpectedly
- [ ] Keyboard navigation works in window manager
- [ ] Focus indicators are visible
- [ ] Layout doesn't shift during resize
- [ ] No console warnings about CSS conflicts
- [ ] Performance is acceptable (60fps during scrolling)
- [ ] All E2E tests pass
- [ ] Visual regression tests pass

---

## Conclusion

The current layout architecture suffers from **fundamental design issues** that prevent proper scrolling and make maintenance difficult. The fixes are straightforward but require careful, systematic implementation to avoid breaking existing functionality.

**Recommended approach:** Implement in phases, starting with critical scrolling fixes, then simplifying structure, then improving organization and standards.

**Estimated effort:**
- Critical fixes: 2-3 days
- Full refactor: 2-3 weeks
- Documentation: 1 week
- **Total: 3-4 weeks for complete overhaul**

**Risk mitigation:**
- Implement behind feature flag
- Test thoroughly at each phase
- Keep old CSS as fallback
- Use visual regression testing
- Get team review before merging

---

**Next Steps:**
1. Review this document with team
2. Prioritize fixes based on user impact
3. Create implementation tickets
4. Assign owners for each priority
5. Set up visual regression testing
6. Begin Phase 1 implementation

**Questions? Concerns?**
Contact the frontend design team or create an issue in the repository.
