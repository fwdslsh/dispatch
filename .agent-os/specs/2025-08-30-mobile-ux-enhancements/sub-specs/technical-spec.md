# Technical Specification

This is the technical specification for the spec detailed in @.agent-os/specs/2025-08-30-mobile-ux-enhancements/spec.md

> Created: 2025-08-30
> Version: 1.0.0

## Technical Requirements

### Virtual Keyboard Optimization

- Implement custom toolbar overlay for xterm.js terminal when virtual keyboard is active
- Detect keyboard visibility using visualViewport API and resize events
- Create toolbar component with configurable buttons for: Tab, Escape, Ctrl, Alt, Arrow keys, Pipe, common shortcuts (Ctrl+C, Ctrl+Z, etc.)
- Store toolbar configuration in localStorage with user customization support
- Position toolbar above virtual keyboard using CSS fixed positioning and safe-area-inset-bottom

### Collapsible UI Panel System

- Implement auto-collapse behavior for HeaderToolbar.svelte on mobile viewports
- Add swipe-down gesture detection to reveal collapsed header
- Create slide-out sidebar for session list accessible via hamburger menu or swipe-right gesture
- Use CSS transforms and transitions for smooth panel animations
- Maintain panel state in component stores for persistence across navigation

### Mobile Command Palette

- Create new CommandPalette.svelte component with mobile-first design
- Implement fuzzy search using existing command history from localStorage
- Support categories: Recent Commands, Favorites, Common Operations
- Use native touch events for better responsiveness
- Integrate with virtual keyboard toolbar for quick access button
- Maximum height constraint to prevent keyboard overlap

### Intelligent Output Deduplication

- Implement output buffer analysis in Terminal.svelte before rendering
- Create similarity detection algorithm using Levenshtein distance or simhash
- Threshold configuration: 85% similarity triggers replacement
- Pattern detection for common cases: progress bars, percentage updates, spinner animations
- Maintain rolling buffer of last 100 lines for comparison
- Use requestAnimationFrame for efficient diff checking
- Replace in-place using xterm.js write with cursor positioning

### Responsive Design Implementation

- Define breakpoints: Mobile (<768px), Tablet (768px-1024px), Desktop (>1024px)
- Use CSS container queries for component-level responsiveness
- Implement orientation detection for landscape/portrait optimizations
- Adjust terminal font size based on viewport: 12px mobile, 14px tablet, 16px desktop
- Dynamic cols/rows calculation based on available space
- Touch target minimum size: 44x44px for all interactive elements

### Performance Optimizations

- Implement virtual scrolling for session list on mobile
- Debounce resize events with 100ms delay
- Use CSS will-change for animated panels
- Lazy load command palette component
- Optimize Socket.IO reconnection for mobile network changes
- Implement output throttling: max 30fps update rate on mobile

### Browser Compatibility

- Target iOS Safari 15+, Chrome 100+, Firefox 100+
- Use feature detection for visualViewport API with fallbacks
- Polyfill for container queries if needed
- Test touch events vs pointer events for best compatibility
- Ensure proper viewport meta tag configuration

## Approach

### Implementation Strategy

1. **Phase 1: Core Infrastructure** - Implement responsive breakpoints and panel system foundation
2. **Phase 2: Virtual Keyboard Support** - Add toolbar overlay and keyboard detection
3. **Phase 3: Output Optimization** - Implement intelligent deduplication algorithm
4. **Phase 4: Command Palette** - Create mobile command interface
5. **Phase 5: Polish & Performance** - Optimize animations and add gesture support

### Component Architecture

- Extend existing Terminal.svelte with mobile detection and overlay management
- Create new MobileToolbar.svelte component for virtual keyboard buttons
- Add CommandPalette.svelte as overlay component with portal rendering
- Enhance HeaderToolbar.svelte with collapsible behavior
- Implement MobileGestureHandler utility for swipe detection

### State Management

- Use Svelte stores for panel visibility states
- Implement mobile detection store with reactive viewport queries
- Create keyboard visibility store using visualViewport API
- Maintain command history in localStorage with mobile-optimized structure

### Integration Points

- Hook into existing xterm.js resize handling in Terminal.svelte
- Extend Socket.IO event handling for mobile network resilience
- Integrate with existing session management in session-store.js
- Leverage current augmented-ui styling system for consistent mobile design

## External Dependencies

**diff-match-patch** - For efficient text similarity detection in output deduplication
**Justification:** Provides optimized algorithms for detecting similar text patterns, essential for intelligent output replacement

**@floating-ui/dom** - For positioning command palette and toolbar overlays
**Justification:** Handles complex positioning scenarios including keyboard avoidance and viewport boundaries better than manual calculations

**hammer.js** - For consistent gesture detection across devices
**Justification:** Provides reliable swipe and pan gesture detection with good mobile browser support, reducing custom implementation complexity
