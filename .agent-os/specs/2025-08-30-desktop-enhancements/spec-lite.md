# Desktop Enhancements - Quick Spec (No Dependencies)

## Goal
Enhance Dispatch for desktop power users with multi-pane terminal layouts using xterm.js and custom-built features.

## Key Features

### 1. Multi-Pane Terminals
- CSS Grid-based layout system
- Custom resize handles with mouse dragging
- Multiple xterm.js instances (one per pane)
- Navigate between panes (Alt+Arrow keys)
- Save/restore layouts in localStorage

### 2. Link Detection
- Custom regex for URL detection
- Integration with xterm.js link provider API
- Click to open links in new tabs
- Optional: File path and IP detection

## Success Criteria
- [ ] Users can split terminals into 4+ panes
- [ ] Smooth mouse resizing with custom drag handles
- [ ] Links in output are clickable via xterm.js
- [ ] Each pane runs independent xterm instance
- [ ] Layouts persist across sessions

## Priority Order
1. Multi-pane layout with CSS Grid
2. Custom resize handles
3. Multiple xterm.js instances
4. Link detection via xterm API