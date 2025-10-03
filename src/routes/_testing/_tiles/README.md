# Tiling Window Manager Demo

This is a comprehensive demonstration of the tiling window manager component built with Svelte 5 and modern runes.

## Demo Features

🪟 **Dynamic Layout Management**

- Create horizontal and vertical splits
- Drag-to-resize dividers
- Keyboard-driven navigation
- Focus management with visual indicators

🎯 **Interactive Examples**

- Sample content for different use cases
- Editable tile titles and content
- Real-time focus indicators
- Collapsible instructions panel

⌨️ **Keyboard Shortcuts**

- `Ctrl+Enter` - Split right (horizontal)
- `Ctrl+Shift+Enter` - Split down (vertical)
- `Ctrl+W` - Close current tile
- `Alt+→/←` - Navigate between tiles
- `Ctrl+↑/↓` - Resize focused tile
- `Click` - Focus tile directly

## Usage

1. **Start the development server:**

   ```bash
   npm run dev
   ```

2. **Visit the demo page:**

   ```
   http://localhost:5174/_tiles/
   ```

3. **Try the features:**
   - Use keyboard shortcuts to create splits
   - Click tiles to focus them
   - Drag dividers to resize panes
   - Edit tile content and titles
   - Toggle instructions panel

## Implementation Details

- **Framework**: Svelte 5 with runes mode
- **Components**: Modular window manager architecture
- **Styling**: CSS-in-JS with global styles for layout
- **State Management**: Reactive state with `$state` and `$derived`
- **Type Safety**: Full TypeScript support with JSDoc annotations

## Component Architecture

```
WindowManager.svelte     # Main container and layout logic
├── Split.svelte         # Split pane with drag-to-resize
└── Tile.svelte         # Individual tile/panel component
```

## Customization

The window manager supports:

- Custom keyboard shortcuts via `keymap` prop
- Adjustable gap sizes and minimum tile sizes
- Custom tile content via snippet rendering
- Flexible initial layouts
- Event handling for focus and layout changes

## Testing

Comprehensive test suite available in `tests/components/window-manager/`:

- Unit tests for each component
- Integration tests for complete workflows
- Browser-based testing with Playwright

Run tests with:

```bash
npm run test:unit -- tests/components/window-manager/
```
