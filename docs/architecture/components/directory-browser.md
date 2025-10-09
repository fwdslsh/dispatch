# DirectoryBrowser Component Architecture

**Component**: DirectoryBrowser
**Location**: `src/lib/client/shared/components/directory-browser/`
**Pattern**: MVVM (Model-View-ViewModel)
**Last Updated**: 2025-10-08

## Overview

The DirectoryBrowser component provides a file system navigation interface for selecting directories within workspace boundaries. It follows the MVVM pattern with clean separation between business logic (ViewModel), presentation (View), and state management (Svelte 5 runes).

## Component Hierarchy

```
DirectoryBrowser.svelte (260 lines)
├── DirectoryBrowserViewModel.svelte.js (338 lines) [Business Logic]
│   ├── State Management ($state, $derived runes)
│   ├── API Integration (browse, create, clone)
│   └── Navigation Logic (path validation, breadcrumbs)
│
└── Sub-Components
    ├── DirectoryBreadcrumbs.svelte (67 lines)
    │   └── Breadcrumb trail navigation with close button
    ├── DirectorySearchBar.svelte (55 lines)
    │   └── Search + action buttons (create, clone, upload, toggle hidden)
    ├── NewDirectoryForm.svelte (38 lines)
    │   └── Create directory input form
    ├── CloneDirectoryForm.svelte (56 lines)
    │   └── Clone directory form with source/target paths
    ├── DirectoryList.svelte (44 lines)
    │   └── Container for directory entries
    │       └── DirectoryItem.svelte (170 lines)
    │           └── Individual file/directory entry display
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    DirectoryBrowser.svelte                       │
│                  (Main Orchestrator - 260 lines)                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │    DirectoryBrowserViewModel.svelte.js                 │    │
│  │    (ViewModel - Business Logic - 338 lines)            │    │
│  │                                                         │    │
│  │  State:                                                 │    │
│  │  • currentPath, loading, error, entries                │    │
│  │  • query, showHidden, filtered (derived)               │    │
│  │  • breadcrumbs, showNewDirInput, showCloneDirInput     │    │
│  │                                                         │    │
│  │  Business Logic:                                        │    │
│  │  • browse(path) - API call to fetch directory          │    │
│  │  • navigateTo(path) - Navigate with boundary checks    │    │
│  │  • createNewDirectory() - Create directory API call    │    │
│  │  • cloneDirectory() - Clone directory API call         │    │
│  │  • handleFileUpload() - Upload files API call          │    │
│  │  • toggleHidden() - Toggle hidden files visibility     │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Composed Sub-Components:                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  DirectoryBreadcrumbs.svelte (67 lines)                  │  │
│  │  ├─ Renders breadcrumb trail                             │  │
│  │  ├─ Clickable navigation                                 │  │
│  │  └─ Close button (when not always open)                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  DirectorySearchBar.svelte (55 lines)                    │  │
│  │  ├─ Search input (bindable query)                        │  │
│  │  ├─ Action buttons (create, clone, upload)               │  │
│  │  └─ Hidden files toggle                                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  NewDirectoryForm.svelte (38 lines)                      │  │
│  │  ├─ Directory name input                                 │  │
│  │  ├─ Create/Cancel buttons                                │  │
│  │  └─ Enter key support                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CloneDirectoryForm.svelte (56 lines)                    │  │
│  │  ├─ Source/target path inputs                            │  │
│  │  ├─ Overwrite checkbox                                   │  │
│  │  └─ Clone/Cancel buttons                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  DirectoryList.svelte (44 lines)                         │  │
│  │  ├─ Parent directory (..) entry                          │  │
│  │  ├─ Loop through entries                                 │  │
│  │  └─ Empty state display                                  │  │
│  │      │                                                    │  │
│  │      ├─────────────────────────────────────────┐         │  │
│  │      │  DirectoryItem.svelte (170 lines)       │         │  │
│  │      │  ├─ Icon (folder/file)                  │         │  │
│  │      │  ├─ Entry name (clickable)              │         │  │
│  │      │  ├─ Type label (directory/file)         │         │  │
│  │      │  └─ Select button (for directories)     │         │  │
│  │      └─────────────────────────────────────────┘         │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## MVVM Data Flow

```
┌──────────────┐
│    Model     │  (API Response)
│  /api/browse │  { path: string, entries: [...] }
└──────┬───────┘
       │
       ├──────────────────┐
       │                  │
       ▼                  ▼
┌────────────────┐  ┌───────────────────┐
│   ViewModel    │  │   View (Props)    │
│                │  │                   │
│ State:         │  │ • selected        │
│ • currentPath  │  │ • api             │
│ • loading      │  │ • startPath       │
│ • error        │  │ • onSelect        │
│ • entries      │  │ • onNavigate      │
│ • query        │  │ • showFileActions │
│ • filtered     │◀─┤ • onFileOpen      │
│                │  │ • onFileUpload    │
│ Methods:       │  └───────────────────┘
│ • browse()     │
│ • navigateTo() │
│ • create()     │
│ • clone()      │
└────────┬───────┘
         │
         ├─────────────────────────────────────────┐
         │                                         │
         ▼                                         ▼
┌──────────────────┐                    ┌──────────────────┐
│  Sub-Components  │                    │  Event Callbacks │
│                  │                    │                  │
│ DirectoryItem    │                    │ onNavigate(path) │
│ ├─ Props         │                    │ onSelect(path)   │
│ │  • entry       │                    │ onCreate()       │
│ │  • isSelected  │                    │ onClone()        │
│ └─ Events        │                    │ onFileOpen(file) │
│    • onNavigate  │────────────────────▶ onFileUpload()   │
│    • onSelect    │                    └──────────────────┘
│    • onFileOpen  │
└──────────────────┘
```

## Component Communication

**Props Flow Down ▼**
```
DirectoryBrowser (orchestrator)
├─▼ DirectoryBreadcrumbs (breadcrumbs, onNavigate, onClose)
├─▼ DirectorySearchBar (query, showHidden, onToggleHidden, actions)
├─▼ NewDirectoryForm (visible, newDirName, onCreate, onCancel)
├─▼ CloneDirectoryForm (visible, paths, onClone, onCancel)
└─▼ DirectoryList (entries, selected)
    └─▼ DirectoryItem (entry, isSelected, onNavigate, onSelect)
```

**Events Flow Up ▲**
```
DirectoryBrowser
▲── onNavigate (from breadcrumbs, directory items)
▲── onCreate (from NewDirectoryForm)
▲── onClone (from CloneDirectoryForm)
▲── onSelect (from DirectoryItem)
▲── onToggleHidden (from DirectorySearchBar)
```

## ViewModel State Management

### Core State ($state)

```javascript
class DirectoryBrowserViewModel {
  // Navigation state
  currentPath = $state(null);
  entries = $state([]);
  breadcrumbs = $state([]);

  // UI state
  loading = $state(false);
  error = $state('');

  // Search state
  query = $state('');
  showHidden = $state(false);

  // Form states
  showNewDirInput = $state(false);
  newDirName = $state('');
  creatingDir = $state(false);

  showCloneDirInput = $state(false);
  cloneSourcePath = $state('');
  cloneTargetPath = $state('');
  cloningDir = $state(false);
  cloneOverwrite = $state(false);

  // Upload state
  uploadFiles = $state(null);
  uploading = $state(false);
}
```

### Derived State ($derived)

```javascript
// Filtered entries based on search query and hidden files
filtered = $derived.by(() => {
  const q = this.query.trim().toLowerCase();
  let result = this.showHidden
    ? this.entries
    : this.entries.filter(e => !e.name.startsWith('.'));

  if (q) {
    result = result.filter(e => e.name.toLowerCase().includes(q));
  }

  return result;
});
```

### Component-Specific State

```javascript
// DirectoryBrowser.svelte (UI-only state)
let isOpen = $state(isAlwaysOpen);  // Collapsed/expanded state
let fileInputId = $state('...');    // File input element ID
```

## Key Methods & API Integration

### Navigation

```javascript
// Browse directory (API call)
async browse(path = this.currentPath) {
  this.loading = true;
  try {
    const response = await fetch(`/api/browse?path=${encodeURIComponent(path)}`);
    const data = await response.json();
    this.currentPath = data.path;
    this.entries = data.entries;
    this.updateBreadcrumbs(data.path);
  } finally {
    this.loading = false;
  }
}

// Navigate to path with boundary checks
async navigateTo(path) {
  if (!this.isWithinBoundary(path)) {
    this.error = 'Cannot navigate outside workspace';
    return;
  }
  await this.browse(path);
}
```

### Directory Operations

```javascript
// Create new directory
async createNewDirectory() {
  this.creatingDir = true;
  try {
    await this.api.createDirectory(this.currentPath, this.newDirName);
    this.showNewDirInput = false;
    this.newDirName = '';
    await this.browse(); // Refresh
  } finally {
    this.creatingDir = false;
  }
}

// Clone directory
async cloneDirectory() {
  this.cloningDir = true;
  try {
    await this.api.cloneDirectory(
      this.cloneSourcePath,
      this.cloneTargetPath,
      this.cloneOverwrite
    );
    this.showCloneDirInput = false;
    await this.browse();
  } finally {
    this.cloningDir = false;
  }
}

// Upload files
async handleFileUpload(files) {
  this.uploading = true;
  try {
    await this.api.uploadFiles(this.currentPath, files);
    await this.browse(); // Refresh
  } finally {
    this.uploading = false;
  }
}
```

## Benefits of This Architecture

### 1. Clear Separation of Concerns

- **Business Logic**: DirectoryBrowserViewModel (338 lines)
- **Presentation**: View components (260 lines + sub-components)
- **State**: Svelte 5 runes ($state, $derived)

### 2. Testability

**ViewModel Tests:**
- Test `browse()` API calls
- Test navigation logic
- Test filtering logic
- Test boundary enforcement

**Component Tests:**
- Test DirectoryItem rendering
- Test event handling
- Test conditional UI
- Test accessibility

### 3. Reusability

- `DirectoryItem` → Can be used in other file browsers
- `DirectoryList` → Can render any entry collection
- `NewDirectoryForm` → Can be used in other contexts
- `CloneDirectoryForm` → Reusable clone UI

### 4. Maintainability

**Before Refactoring:**
```
DirectoryBrowser.svelte (869 lines)
└─ Everything mixed together
```

**After Refactoring:**
```
├─ DirectoryBrowserViewModel.svelte.js (338 lines) - Business logic
├─ DirectoryBrowser.svelte (260 lines) - Orchestrator
├─ DirectoryBreadcrumbs.svelte (67 lines) - Navigation UI
├─ DirectorySearchBar.svelte (55 lines) - Search/actions
├─ DirectoryList.svelte (44 lines) - Entry container
├─ DirectoryItem.svelte (170 lines) - Single entry
├─ NewDirectoryForm.svelte (38 lines) - Create form
└─ CloneDirectoryForm.svelte (56 lines) - Clone form

Each file has a single, clear purpose
```

### 5. Scalability

Easy to add new features:
- ✅ New actions → Add button to DirectorySearchBar
- ✅ New entry types → Extend DirectoryItem
- ✅ New forms → Add new form component
- ✅ New derived state → Add to ViewModel
- ✅ New API operations → Add methods to ViewModel

## Extension Examples

### Adding a New Action (Rename Directory)

**1. Add state to ViewModel:**
```javascript
class DirectoryBrowserViewModel {
  showRenameInput = $state(false);
  renameTarget = $state('');
  renameNewName = $state('');

  async renameDirectory(oldPath, newPath) {
    // API call implementation
  }
}
```

**2. Create form component:**
```svelte
<!-- RenameDirectoryForm.svelte -->
<script>
  let { target, newName, onRename, onCancel } = $props();
</script>

<form on:submit|preventDefault={onRename}>
  <input bind:value={newName} placeholder="New name" />
  <Button type="submit">Rename</Button>
  <Button type="button" onclick={onCancel}>Cancel</Button>
</form>
```

**3. Add button to DirectorySearchBar:**
```svelte
<IconButton onclick={onToggleRename} title="Rename directory">
  <IconEdit />
</IconButton>
```

**4. Wire up in DirectoryBrowser:**
```svelte
{#if vm.showRenameInput}
  <RenameDirectoryForm
    target={vm.renameTarget}
    newName={vm.renameNewName}
    onRename={vm.renameDirectory}
    onCancel={() => vm.showRenameInput = false}
  />
{/if}
```

### Adding Virtual Scrolling

```javascript
// DirectoryList.svelte
import VirtualList from 'svelte-virtual-list';

<VirtualList items={entries} let:item>
  <DirectoryItem entry={item} ... />
</VirtualList>
```

### Adding Drag & Drop

```javascript
// DirectoryItem.svelte
<div
  draggable={entry.isDirectory}
  ondragstart={handleDragStart}
  ondrop={handleDrop}
  ondragover={handleDragOver}
>
  <!-- existing content -->
</div>
```

## API Contracts

### GET /api/browse

**Request:**
```
GET /api/browse?path=/workspace/project&showHidden=false
```

**Response:**
```json
{
  "path": "/workspace/project",
  "entries": [
    {
      "name": "src",
      "isDirectory": true,
      "size": null,
      "modified": "2025-10-08T12:00:00Z"
    },
    {
      "name": "package.json",
      "isDirectory": false,
      "size": 1024,
      "modified": "2025-10-07T15:30:00Z"
    }
  ]
}
```

### POST /api/directories

**Request:**
```json
{
  "path": "/workspace/project",
  "name": "new-directory"
}
```

**Response:**
```json
{
  "success": true,
  "path": "/workspace/project/new-directory"
}
```

## Testing Strategy

### Unit Tests

**ViewModel Tests** (`DirectoryBrowserViewModel.test.js`):
```javascript
describe('DirectoryBrowserViewModel', () => {
  it('filters entries based on search query', () => {
    const vm = new DirectoryBrowserViewModel(/* ... */);
    vm.entries = [{ name: 'test.js' }, { name: 'other.md' }];
    vm.query = 'test';
    expect(vm.filtered).toEqual([{ name: 'test.js' }]);
  });

  it('enforces workspace boundaries', () => {
    const vm = new DirectoryBrowserViewModel(/* ... */);
    expect(vm.isWithinBoundary('/workspace/../etc')).toBe(false);
  });
});
```

**Component Tests** (`DirectoryItem.test.js`):
```javascript
describe('DirectoryItem', () => {
  it('renders directory icon for directories', () => {
    render(DirectoryItem, { entry: { name: 'src', isDirectory: true } });
    expect(screen.getByRole('img', { name: /folder/i })).toBeInTheDocument();
  });

  it('emits navigate event on click', async () => {
    const onNavigate = vi.fn();
    render(DirectoryItem, { entry: { name: 'src' }, onNavigate });
    await userEvent.click(screen.getByText('src'));
    expect(onNavigate).toHaveBeenCalledWith(expect.stringContaining('src'));
  });
});
```

### Integration Tests

```javascript
describe('DirectoryBrowser integration', () => {
  it('creates new directory and refreshes list', async () => {
    const { component } = render(DirectoryBrowser, { /* ... */ });

    // Click create button
    await userEvent.click(screen.getByTitle('Create new directory'));

    // Fill in form
    await userEvent.type(screen.getByPlaceholderText('Directory name'), 'new-dir');
    await userEvent.click(screen.getByText('Create'));

    // Verify API call and refresh
    await waitFor(() => {
      expect(screen.getByText('new-dir')).toBeInTheDocument();
    });
  });
});
```

## Performance Considerations

- **Lazy Loading**: Only load directory contents when navigated
- **Debounced Search**: Search query updates are debounced (300ms)
- **Virtual Scrolling**: Consider for directories with 1000+ entries
- **Memoization**: Derived state automatically memoized by Svelte

## Accessibility

- **Keyboard Navigation**: Full keyboard support (Enter, Escape, Arrow keys)
- **Screen Reader**: Proper ARIA labels and roles
- **Focus Management**: Focus returns to trigger after modal close
- **Contrast**: All text meets WCAG AA standards

## Related Documentation

- **MVVM Patterns**: `src/docs/architecture/mvvm-patterns.md`
- **Adapter Pattern**: `docs/architecture/adapter-guide.md`
- **Visual Design**: `docs/reference/visual-design-system.md`

## Summary

The DirectoryBrowser architecture demonstrates:

1. **Clean boundaries** between business logic and presentation
2. **Single responsibility** for each component
3. **Testable** ViewModel and components
4. **Reusable** building blocks
5. **Scalable** design for future features
6. **Maintainable** codebase with focused files

This refactoring transformed a monolithic 869-line component into a well-structured, MVVM-compliant architecture following Svelte 5 best practices.
