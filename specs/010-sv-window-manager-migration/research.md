# Research Findings: sv-window-manager Migration

**Date**: 2025-10-20
**Status**: ✅ **APPROVED WITH CLARIFICATIONS**

## Executive Summary

Research into the sv-window-manager library reveals key information for implementation planning:

1. **Library Status**: Published to npm, maintained by internal team
2. **Svelte 5 Compatibility**: Native Svelte 5 library with runes support
3. **Feature Set**: Core window management (addPane, resizing) with application-level persistence
4. **Development Approach**: Lightweight library requiring custom implementation for advanced features

**Recommendation**: ✅ **PROCEED** with understanding that minimize/maximize/close/keyboard shortcuts will be custom implementations.

## Corrected Information

**CORRECTION**: The package **IS published to npm** at https://www.npmjs.com/package/sv-window-manager and is **maintained by the internal team**.

---

## Detailed Findings

### 1. Library Status & Availability

**Version**: 0.0.2+ (current version on npm)

**Distribution**: ✅ **PUBLISHED TO NPM**
- Install via: `npm install sv-window-manager`
- Standard npm package with semantic versioning
- CI/CD compatible dependency resolution

**Maintenance Status**: ✅ **INTERNALLY MAINTAINED**
- Maintained by internal team (confirmed)
- Control over breaking changes and releases
- Can add features as needed for migration
- Direct support available

**Development Stage**: Early but Controlled
- Active development with internal oversight
- Can be stabilized for production use
- Internal usage provides battle-testing

### 2. Svelte Compatibility

**✅ Svelte 5 Compatible**
- Requires Svelte 5.0.0+ (peer dependency: `^5.0.0`)
- Built with Svelte 5 runes (`$state`, `$derived`, `$effect`)
- Works with SvelteKit 2.x
- Full TypeScript support

### 3. API Overview

#### Core Component: `BwinHost`

**Props**:
```typescript
interface BwinHostProps {
  config?: BwinConfig;
  oncreated?: (event: any, node: any) => void;
  onupdated?: () => void;
}
```

**Configuration**:
```typescript
interface BwinConfig {
  fitContainer?: boolean;
  width?: number;
  height?: number;
  [key: string]: any;
}
```

**Pane Configuration**:
```typescript
interface PaneConfig {
  position?: 'top' | 'right' | 'bottom' | 'left';
  content?: HTMLElement;
  size?: number | string;
  id?: string;
  title?: string | HTMLElement;
  [key: string]: any;
}
```

#### Key Methods

**`addPane(sessionId, paneConfig, Component, componentProps?)`**
- Adds new pane with Svelte component
- Returns sash object
- Automatically creates container with 100% width/height styling

**`getInfo()`**
- Returns root sash node or null
- Used for accessing current window manager state

### 4. Feature Gaps vs. Requirements

| Requirement | sv-window-manager Support | Gap Analysis |
|-------------|---------------------------|--------------|
| **Drag to reposition** | Yes | |
| **Resize via edges/corners** | Yes |  |
| **Minimize/Maximize** | Yes | |
| **Close windows** | Yes |  |
| **Keyboard shortcuts** | ❌ No | All interactions mouse-only |
| **Layout persistence** | ❌ No | Application responsibility |
| **Off-screen handling** | ❌ No | Undefined behavior |
| **Z-index ordering** | Yes | |
| **60fps performance** | Yes |  |

**CRITICAL**: Library lacks **5 of 8 core requirements** from feature specification.

### 5. Integration Patterns

**Basic Setup**:
```svelte
<script lang="ts">
  import BwinHost from 'sv-window-manager';

  let bwinHostRef = $state<BwinHost | undefined>();

  const config = { fitContainer: true };
</script>

<BwinHost bind:this={bwinHostRef} {config} />
```

**Adding Sessions Dynamically**:
```typescript
function addSession(sessionId: string, Component: SvelteComponent, props: any) {
  bwinHostRef.addPane(sessionId, {}, Component, props);
}
```

### 6. Layout Persistence

**❌ NOT PROVIDED** - Application must implement:
- Track pane structure and configuration
- Serialize layout to storage (database, localStorage)
- Rebuild layout on restore by calling `addPane()` for each saved pane

**Implementation Burden**: High - Requires custom state management layer on top of library.

### 7. Dependencies

**Core Dependency**:
- `bwin` (^0.2.8) - Binary window manager for browsers
  - Repository: https://github.com/bhjsdev/bwin
  - License: MIT
  - Also early stage with limited documentation

**Peer Dependencies**:
- `svelte` (^5.0.0)

**Transitive Risk**: Both sv-window-manager AND its core dependency (bwin) are early-stage, unpublished packages.

### 8. Known Limitations

#### From sv-window-manager:
1. ❌ Not published to npm
2. ❌ No keyboard shortcuts or navigation
3. ❌ No layout persistence built-in
4. ❌ No event system beyond oncreated/onupdated
5. ❌ No accessibility features (ARIA, screen readers)
6. ❌ No off-screen window handling
7. ❌ Limited documentation and examples
8. ❌ No removePane method exposed (can't close windows)

#### From underlying bwin library:
1. ⚠️ React StrictMode incompatibility (React version)
2. ⚠️ SSR hydration issues (React version, may affect Svelte)
3. ⚠️ Binary tree structure limits (max 2 children per sash)

#### Compatibility Concerns:
- ❌ Svelte 4 and earlier: NOT compatible
- ❓ Server-Side Rendering: Potentially problematic
- ❌ Mobile/Touch: No gesture support documented

---

## Constitutional Compliance Analysis

### ⚠️ **Principle I: Simplicity & Maintainability - VIOLATION RISK**

**Issue**: Using an unpublished, early-stage library with significant feature gaps **increases complexity** rather than reducing it.

**Risks**:
1. **Development burden**: Must implement 5+ missing features (minimize, maximize, close, keyboard nav, layout persistence)
2. **Maintenance risk**: Library may break or change without notice
3. **Dependency risk**: Both sv-window-manager and bwin are unproven
4. **Testing burden**: Minimal library test coverage means extensive app-level testing required

**Simpler Alternatives**:
1. **Keep custom implementation** - Known code, full control, no external dependency risk
2. **Use mature library** - WinBox.js, Golden Layout, or similar production-ready solution
3. **Build with Svelte 5 primitives** - Custom solution using $state/$derived without third-party library

### ✅ **Other Principles**: No violations

Principles II-VI remain compliant as window manager is UI-only, single-user focused.

---

## Alternatives Considered

### Option A: Keep Custom Implementation
**Pros**:
- Known code, full feature set
- No external dependency risk
- Already tested and working

**Cons**:
- Maintains current code complexity
- No code reduction benefit

### Option B: Use Mature Window Manager Library
**Examples**: WinBox.js, Golden Layout, React Grid Layout (with Svelte wrapper)

**Pros**:
- Production-ready, well-tested
- Active maintenance and community
- Published to npm with semantic versioning
- Comprehensive documentation

**Cons**:
- May require framework adapters
- Potential feature mismatches

### Option C: Build with Svelte 5 Runes
**Pros**:
- Full control over features and behavior
- Leverages Svelte 5's powerful reactivity
- No external dependencies
- Tailored to exact requirements

**Cons**:
- Initial development effort
- Need to implement all features

### Option D: Proceed with sv-window-manager (AS PLANNED)
**Pros**:
- Svelte 5 native
- Lightweight (assumes library matures)

**Cons**:
- ❌ Not published to npm
- ❌ Missing 5+ critical features
- ❌ Extensive custom implementation required
- ❌ High risk, low reward

---

## Recommendations

### 🟢 **Primary Recommendation: PROCEED with sv-window-manager**

**Rationale** (Updated with Internal Maintenance Confirmation):
1. ✅ Published to npm - standard dependency management
2. ✅ Internally maintained - control over features, releases, and bug fixes
3. ✅ Svelte 5 native - aligns with existing architecture
4. ⚠️ Feature gaps expected - plan for custom layer (minimize, maximize, close, keyboard shortcuts)

**Approach**: Use sv-window-manager as **foundation library** with custom feature layer on top.

### Implementation Strategy

**Core Library Provides**:
- Window creation and lifecycle (`addPane`)
- Binary tree layout management
- Resizing via draggable dividers (muntins)
- Component mounting and rendering

**Custom Implementation Required**:
- Window state management (normal/minimized/maximized)
- Window controls UI (close, minimize, maximize buttons)
- Keyboard shortcuts for window operations
- Layout persistence to database
- Off-screen window detection and repositioning
- Z-index management for window focusing

**Benefits of This Approach**:
- Leverage library's binary tree layout engine (complex algorithm)
- Reduce custom code by delegating core positioning/resizing to library
- Full control over UX features (minimize, maximize, close, keyboard)
- Can contribute missing features back to library if needed

---

## Next Steps

**Proceed with Phase 1 Planning**:

1. ✅ **Constitution Check**: PASS (with internal maintenance, dependency risk is acceptable)
2. ✅ **Technical approach**: Use sv-window-manager as foundation + custom feature layer
3. ➡️ **Data Model**: Define window state, layout persistence schema
4. ➡️ **Contracts**: Define ViewModels and Services for window management
5. ➡️ **Quickstart**: Document integration patterns and migration approach

**Implementation Considerations**:

1. Plan for custom layer implementing: minimize, maximize, close, keyboard shortcuts, persistence
2. Create comprehensive E2E test suite (library has minimal tests)
3. Consider contributing features back to sv-window-manager library
4. Budget for custom development work in task breakdown

---

## Conclusion

With **internal team maintenance confirmed**, sv-window-manager is a **viable foundation library** for the migration. The approach is to use it for core layout management (binary tree, resizing, pane positioning) while building a custom feature layer on top for minimize/maximize/close/keyboard/persistence functionality.

**Recommendation**: ✅ **PROCEED with migration** using hybrid approach (library foundation + custom features).
