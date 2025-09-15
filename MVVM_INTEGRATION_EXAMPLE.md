# MVVM Integration Example

This document demonstrates how to integrate the new MVVM architecture with ViewModels in UI components.

## Example: Workspace Page Integration

Here's how the main workspace page (`src/routes/+page.svelte`) would be refactored to use the new ViewModels:

### 1. Service Container Setup

```javascript
// In your root layout or main component
import { provideServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';

// Initialize services
const container = provideServiceContainer({
    apiBaseUrl: '',
    socketUrl: '',
    authTokenKey: 'dispatch-auth-key',
    debug: false
});
```

### 2. ViewModel Integration

```svelte
<!-- src/routes/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    import { useServiceContainer } from '$lib/client/shared/services/ServiceContainer.svelte.js';
    import { WorkspaceViewModel } from '$lib/client/shared/viewmodels/WorkspaceViewModel.svelte.js';
    import { SessionViewModel } from '$lib/client/shared/viewmodels/SessionViewModel.svelte.js';
    import { LayoutViewModel } from '$lib/client/shared/viewmodels/LayoutViewModel.svelte.js';
    import { ModalViewModel } from '$lib/client/shared/viewmodels/ModalViewModel.svelte.js';

    // Get services
    const container = useServiceContainer();

    // Initialize ViewModels
    let workspaceViewModel = $state();
    let sessionViewModel = $state();
    let layoutViewModel = $state();
    let modalViewModel = $state();

    onMount(async () => {
        // Get required services
        const workspaceApi = await container.get('workspaceApi');
        const sessionApi = await container.get('sessionApi');
        const persistence = await container.get('persistence');
        const layout = await container.get('layout');
        const socket = await container.get('socket');

        // Initialize ViewModels
        workspaceViewModel = new WorkspaceViewModel(workspaceApi, persistence);
        sessionViewModel = new SessionViewModel(sessionApi, persistence, layout);
        layoutViewModel = new LayoutViewModel(layout, persistence);
        modalViewModel = new ModalViewModel();

        // Load initial data
        await workspaceViewModel.loadWorkspaces();
        await workspaceViewModel.loadRecentWorkspaces();
        await sessionViewModel.loadSessions();
    });

    // Reactive derived states
    const currentWorkspace = $derived(workspaceViewModel?.currentWorkspace);
    const visibleSessions = $derived(sessionViewModel?.visibleSessions || []);
    const layoutState = $derived(layoutViewModel?.state);
    const activeModal = $derived(modalViewModel?.activeModal);
</script>

<!-- UI Template -->
{#if workspaceViewModel && sessionViewModel && layoutViewModel}
    <div class="workspace-layout" class:mobile={layoutState?.isMobile}>
        <!-- Sidebar -->
        <aside class="sidebar" class:collapsed={layoutState?.sidebarCollapsed}>
            <div class="workspace-section">
                <h3>Workspaces</h3>
                <ul>
                    {#each workspaceViewModel.workspaces as workspace}
                        <li
                            class:active={workspace.path === currentWorkspace?.path}
                            onclick={() => workspaceViewModel.openWorkspace(workspace.path)}
                        >
                            {workspace.name || workspace.path.split('/').pop()}
                        </li>
                    {/each}
                </ul>

                <button onclick={() => modalViewModel.openModal('create-workspace')}>
                    New Workspace
                </button>
            </div>

            <div class="recent-section">
                <h3>Recent</h3>
                <ul>
                    {#each workspaceViewModel.recentWorkspaces as workspace}
                        <li onclick={() => workspaceViewModel.openWorkspace(workspace.path)}>
                            {workspace.name}
                            <small>{workspace.lastAccessed}</small>
                        </li>
                    {/each}
                </ul>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            {#if currentWorkspace}
                <!-- Sessions Display -->
                <div class="sessions-container">
                    {#if layoutState?.isMobile}
                        <!-- Mobile: Single session view with navigation -->
                        <div class="mobile-session-nav">
                            {#each visibleSessions as session, index}
                                <button
                                    class:active={index === sessionViewModel.currentMobileSession}
                                    onclick={() => sessionViewModel.setCurrentMobileSession(index)}
                                >
                                    {session.title || `Session ${index + 1}`}
                                </button>
                            {/each}
                        </div>

                        {#if visibleSessions[sessionViewModel.currentMobileSession]}
                            <div class="session-pane">
                                <SessionPane
                                    session={visibleSessions[sessionViewModel.currentMobileSession]}
                                    {sessionViewModel}
                                />
                            </div>
                        {/if}
                    {:else}
                        <!-- Desktop: Multiple sessions -->
                        <div class="desktop-sessions" class:grid={layoutState?.useGridLayout}>
                            {#each visibleSessions as session}
                                <div class="session-pane">
                                    <SessionPane {session} {sessionViewModel} />
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>

                <!-- Action Bar -->
                <div class="action-bar">
                    <button onclick={() => modalViewModel.openModal('new-session')}>
                        New Session
                    </button>
                    <button onclick={() => sessionViewModel.refreshSessions()}>
                        Refresh
                    </button>
                    <button onclick={() => layoutViewModel.toggleLayout()}>
                        Toggle Layout
                    </button>
                </div>
            {:else}
                <!-- No workspace selected -->
                <div class="empty-state">
                    <h2>Select a workspace to get started</h2>
                    <p>Choose from your recent workspaces or create a new one.</p>
                </div>
            {/if}
        </main>
    </div>

    <!-- Modals -->
    {#if activeModal}
        <Modal onclose={() => modalViewModel.closeModal()}>
            {#if activeModal.type === 'create-workspace'}
                <CreateWorkspaceModal
                    {workspaceViewModel}
                    onclose={() => modalViewModel.closeModal()}
                />
            {:else if activeModal.type === 'new-session'}
                <NewSessionModal
                    workspace={currentWorkspace}
                    {sessionViewModel}
                    onclose={() => modalViewModel.closeModal()}
                />
            {/if}
        </Modal>
    {/if}
{:else}
    <!-- Loading state -->
    <div class="loading">
        <p>Initializing workspace...</p>
    </div>
{/if}
```

### 3. Component Integration Example

```svelte
<!-- SessionPane.svelte -->
<script>
    export let session;
    export let sessionViewModel;

    // Reactive session state
    const isActive = $derived(session.status === 'active');
    const hasOutput = $derived(session.output && session.output.length > 0);

    // Session actions
    function handleInput(data) {
        sessionViewModel.sendInput(session.id, data);
    }

    function togglePin() {
        sessionViewModel.togglePin(session.id);
    }

    function closeSession() {
        sessionViewModel.stopSession(session.id);
    }
</script>

<div class="session-pane" class:active={isActive}>
    <header class="session-header">
        <h4>{session.title}</h4>
        <div class="session-controls">
            <button
                class:pinned={session.pinned}
                onclick={togglePin}
                title={session.pinned ? 'Unpin' : 'Pin'}
            >
                📌
            </button>
            <button onclick={closeSession} title="Close">
                ✕
            </button>
        </div>
    </header>

    <div class="session-content">
        {#if session.type === 'terminal'}
            <TerminalView {session} {handleInput} />
        {:else if session.type === 'claude'}
            <ClaudeView {session} {handleInput} />
        {/if}
    </div>

    {#if !isActive}
        <div class="session-overlay">
            <p>Session ended</p>
            <button onclick={() => sessionViewModel.resumeSession(session.id)}>
                Resume
            </button>
        </div>
    {/if}
</div>
```

### 4. Modal Component Example

```svelte
<!-- CreateWorkspaceModal.svelte -->
<script>
    export let workspaceViewModel;
    export let onclose;

    let path = $state('');
    let name = $state('');
    let action = $state('open'); // 'open', 'create', 'clone'
    let cloneFrom = $state('');
    let loading = $state(false);
    let error = $state(null);

    async function handleSubmit() {
        if (!path.trim()) {
            error = 'Path is required';
            return;
        }

        loading = true;
        error = null;

        try {
            if (action === 'clone' && cloneFrom) {
                await workspaceViewModel.cloneWorkspace(cloneFrom, path, name);
            } else if (action === 'create') {
                await workspaceViewModel.createWorkspace(path, name);
            } else {
                await workspaceViewModel.openWorkspace(path);
            }
            onclose();
        } catch (err) {
            error = err.message;
        } finally {
            loading = false;
        }
    }
</script>

<div class="modal-content">
    <h2>Workspace</h2>

    <form onsubmit|preventDefault={handleSubmit}>
        <div class="field">
            <label>Action:</label>
            <select bind:value={action}>
                <option value="open">Open Existing</option>
                <option value="create">Create New</option>
                <option value="clone">Clone From Existing</option>
            </select>
        </div>

        <div class="field">
            <label>Path:</label>
            <input
                type="text"
                bind:value={path}
                placeholder="/path/to/workspace"
                required
            />
        </div>

        {#if action !== 'open'}
            <div class="field">
                <label>Name (optional):</label>
                <input
                    type="text"
                    bind:value={name}
                    placeholder="My Workspace"
                />
            </div>
        {/if}

        {#if action === 'clone'}
            <div class="field">
                <label>Clone from:</label>
                <select bind:value={cloneFrom}>
                    <option value="">Select workspace to clone</option>
                    {#each workspaceViewModel.workspaces as workspace}
                        <option value={workspace.path}>
                            {workspace.name || workspace.path}
                        </option>
                    {/each}
                </select>
            </div>
        {/if}

        {#if error}
            <div class="error">{error}</div>
        {/if}

        <div class="actions">
            <button type="button" onclick={onclose} disabled={loading}>
                Cancel
            </button>
            <button type="submit" disabled={loading || !path.trim()}>
                {loading ? 'Working...' : 'Continue'}
            </button>
        </div>
    </form>
</div>
```

## Benefits Demonstrated

### 1. **Separation of Concerns**
- UI components focus purely on presentation
- ViewModels handle business logic and state
- Services manage data access and external integrations

### 2. **Reactive State Management**
- Automatic UI updates when ViewModel state changes
- Derived states compute automatically from base state
- No manual DOM manipulation required

### 3. **Testability**
- ViewModels can be tested independently of UI
- Services can be mocked for ViewModel tests
- UI components have minimal logic to test

### 4. **Maintainability**
- Clear data flow: Service → ViewModel → Component
- Centralized state management
- Easy to add new features or modify existing ones

### 5. **Mobile Responsiveness**
- Layout logic handled in LayoutViewModel
- UI adapts automatically to mobile/desktop modes
- Touch gestures integrated at ViewModel level

## Migration Strategy

To migrate existing components:

1. **Identify State**: Extract state management to ViewModels
2. **Extract API Calls**: Move to appropriate service clients
3. **Update Templates**: Use reactive state from ViewModels
4. **Add Tests**: Create tests for extracted ViewModels
5. **Gradual Migration**: Migrate one component at a time

This architecture provides a solid foundation for scalable, maintainable frontend development while preserving all existing functionality.