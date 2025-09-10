<script>
    import { onMount } from 'svelte';
    import ClaudePane from '$lib/components/ClaudePane.svelte';

    let projects = [];
    let sessions = [];
    let selectedProject = null;
    let selectedSession = null;
    let loading = false;
    let error = null;

    async function loadProjects() {
        loading = true;
        error = null;
        try {
            const response = await fetch('/api/claude/projects');
            if (response.ok) {
                const data = await response.json();
                projects = data.projects || [];
            } else {
                error = 'Failed to load projects';
            }
        } catch (err) {
            error = 'Error loading projects: ' + err.message;
        }
        loading = false;
    }

    async function selectProject(project) {
        selectedProject = project.name;
        selectedSession = null;
        loading = true;
        error = null;
        
        try {
            const response = await fetch(`/api/claude/projects/${encodeURIComponent(project.name)}/sessions`);
            if (response.ok) {
                const data = await response.json();
                sessions = data.sessions || [];
            } else {
                error = 'Failed to load sessions';
            }
        } catch (err) {
            error = 'Error loading sessions: ' + err.message;
        }
        loading = false;
    }

    async function selectSession(session) {
        selectedSession = session.id;
    }

    function cleanProjectName(projectName) {
        // Handle the ugly path format properly
        if (projectName.includes('--dispatch-home-workspaces-')) {
            const match = projectName.match(/--dispatch-home-workspaces-(.+)$/);
            if (match) {
                return match[1].charAt(0).toUpperCase() + match[1].slice(1);
            }
        }
        
        if (projectName.includes('--claude-projects--')) {
            const match = projectName.match(/--claude-projects--(.+)$/);
            if (match) {
                const cleaned = match[1].replace(/--dispatch-home-workspaces-(.+)$/, '$1');
                return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
            }
        }
        
        // Fallback: extract the last meaningful part
        const parts = projectName.split(/[-_]/);
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart !== 'dispatch' && lastPart !== 'home') {
            return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
        }
        
        return 'Unknown Project';
    }


    onMount(() => {
        loadProjects();
    });
</script>

<svelte:head>
    <title>Claude Session Browser</title>
</svelte:head>

<main class="session-browser">
    <div class="container">
        <header class="browser-header">
            <h1>Claude Session Browser</h1>
            <button on:click={loadProjects} class="refresh-btn" disabled={loading}>
                {loading ? 'Loading...' : 'Refresh'}
            </button>
        </header>

        {#if error}
            <div class="error-banner">
                <span class="error-icon">⚠️</span>
                {error}
            </div>
        {/if}

        <div class="main-layout">
            <!-- Left Side: Session Browser -->
            <div class="browser-section">
                <div class="browser-layout">
                    <!-- Projects Panel -->
                    <div class="panel projects-panel">
                        <h2>Projects</h2>
                        <div class="panel-content">
                            {#if loading && projects.length === 0}
                                <div class="loading">Loading projects...</div>
                            {:else if projects.length === 0}
                                <div class="empty">No projects found</div>
                            {:else}
                                {#each projects as project}
                                    <div 
                                        class="project-item" 
                                        class:selected={selectedProject === project.name}
                                        on:click={() => selectProject(project)}
                                    >
                                        <div class="project-header">
                                            <div class="project-name">{cleanProjectName(project.name)}</div>
                                            <div class="project-stats">
                                                <span class="session-count">{project.sessionCount} sessions</span>
                                                <span class="last-modified">{new Date(project.lastModified).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div class="project-path">{project.path.split('/').slice(-2).join('/')}</div>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </div>

                    <!-- Sessions Panel -->
                    <div class="panel sessions-panel">
                        <h2>Sessions</h2>
                        <div class="panel-content">
                            {#if !selectedProject}
                                <div class="empty">Select a project to view sessions</div>
                            {:else if loading && sessions.length === 0}
                                <div class="loading">Loading sessions...</div>
                            {:else if sessions.length === 0}
                                <div class="empty">No sessions found</div>
                            {:else}
                                {#each sessions as session}
                                    <div 
                                        class="session-item"
                                        class:selected={selectedSession === session.id}
                                        on:click={() => selectSession(session)}
                                    >
                                        <div class="session-header">
                                            <div class="session-id">{session.id.substring(0, 8)}...</div>
                                            <div class="session-size">{Math.round(session.size / 1024)}KB</div>
                                        </div>
                                        <div class="session-info">
                                            <span class="session-date">{new Date(session.lastModified).toLocaleDateString()}</span>
                                            <span class="session-time">{new Date(session.lastModified).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Right Side: Claude Session Interface -->
            <div class="claude-section">
                {#if selectedSession}
                    <div class="claude-header">
                        <h2>Claude Session</h2>
                        <div class="session-info-header">
                            <span class="project-name">{cleanProjectName(selectedProject)}</span>
                            <span class="session-id-full">{selectedSession}</span>
                        </div>
                    </div>
                    <div class="claude-pane-container">
                        {#key selectedSession}
                            <ClaudePane 
                                sessionId={selectedSession}
                                claudeSessionId={selectedSession}
                                shouldResume={true}
                            />
                        {/key}
                    </div>
                {:else}
                    <div class="empty-claude">
                        <div class="empty-icon">🤖</div>
                        <h3>Select a Session</h3>
                        <p>Choose a project and session from the left to open an interactive Claude interface</p>
                    </div>
                {/if}
            </div>
        </div>
    </div>
</main>

<style>
    .session-browser {
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family: var(--font-sans);
    }

    .container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 1rem;
    }

    .browser-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid var(--surface-border);
    }

    .browser-header h1 {
        color: var(--accent);
        font-size: 2rem;
        margin: 0;
    }

    .refresh-btn {
        background: var(--accent);
        color: var(--bg);
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 0.25rem;
        cursor: pointer;
        font-family: inherit;
        transition: opacity 0.2s;
    }

    .refresh-btn:hover {
        opacity: 0.8;
    }

    .refresh-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .error-banner {
        background: #ff4444;
        color: white;
        padding: 1rem;
        margin-bottom: 1rem;
        border-radius: 0.25rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .main-layout {
        display: grid;
        grid-template-columns: 600px 1fr;
        gap: 1rem;
        height: calc(100vh - 200px);
    }

    .browser-section {
        display: flex;
        flex-direction: column;
    }

    .browser-layout {
        display: grid;
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 1rem;
        height: 100%;
    }

    .claude-section {
        display: flex;
        flex-direction: column;
        background: var(--surface);
        border: 1px solid var(--surface-border);
        border-radius: 0.5rem;
        overflow: hidden;
    }

    .panel {
        background: var(--surface);
        border: 1px solid var(--surface-border);
        border-radius: 0.5rem;
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .panel h2 {
        background: var(--surface-hover);
        margin: 0;
        padding: 1rem;
        border-bottom: 1px solid var(--surface-border);
        font-size: 1.1rem;
        color: var(--accent);
        font-weight: 600;
    }

    .panel-content {
        flex: 1;
        overflow-y: auto;
        padding: 0;
    }

    .project-item, .session-item {
        padding: 1rem;
        border-bottom: 1px solid var(--surface-border);
        cursor: pointer;
        transition: background-color 0.15s ease;
        position: relative;
    }

    .project-item:hover, .session-item:hover {
        background: var(--surface-hover);
    }

    .project-item.selected, .session-item.selected {
        background: color-mix(in oklch, var(--accent) 10%, var(--surface) 90%);
        border-left: 3px solid var(--accent);
        padding-left: calc(1rem - 3px);
        font-weight: 600;
    }

    .project-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 0.5rem;
    }

    .project-name {
        font-weight: 700;
        font-size: 1.1rem;
        color: var(--text);
        line-height: 1.2;
    }

    .project-stats {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.15rem;
        font-size: 0.75rem;
    }

    .session-count {
        background: var(--accent);
        color: var(--bg);
        padding: 0.15rem 0.4rem;
        border-radius: 0.75rem;
        font-weight: 600;
        font-size: 0.7rem;
    }

    .last-modified {
        opacity: 0.7;
        font-weight: 500;
    }

    .project-path {
        font-size: 0.8rem;
        opacity: 0.6;
        font-family: var(--font-mono);
        background: var(--surface-hover);
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        margin-top: 0.25rem;
    }

    .session-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.4rem;
    }

    .session-id {
        font-family: var(--font-mono);
        font-size: 0.9rem;
        font-weight: 600;
        color: var(--accent);
    }

    .session-size {
        background: var(--surface-hover);
        color: var(--text);
        padding: 0.15rem 0.4rem;
        border-radius: 0.25rem;
        font-size: 0.7rem;
        font-weight: 600;
    }

    .session-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 0.75rem;
        opacity: 0.8;
    }

    .session-date {
        font-weight: 500;
    }

    .session-time {
        font-family: var(--font-mono);
        opacity: 0.7;
    }


    .loading, .empty {
        padding: 2rem;
        text-align: center;
        color: var(--text-muted);
        font-style: italic;
    }

    .claude-header {
        background: var(--surface-hover);
        padding: 1rem;
        border-bottom: 1px solid var(--surface-border);
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .claude-header h2 {
        margin: 0;
        color: var(--accent);
        font-size: 1.1rem;
        font-weight: 600;
    }

    .session-info-header {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 0.25rem;
        font-size: 0.8rem;
    }

    .session-info-header .project-name {
        font-weight: 600;
        color: var(--text);
    }

    .session-id-full {
        font-family: var(--font-mono);
        opacity: 0.7;
        font-size: 0.7rem;
    }

    .claude-pane-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .empty-claude {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 3rem;
        color: var(--text-muted);
    }

    .empty-icon {
        font-size: 4rem;
        margin-bottom: 1rem;
        opacity: 0.5;
    }

    .empty-claude h3 {
        margin: 0 0 1rem 0;
        color: var(--text);
        font-size: 1.5rem;
    }

    .empty-claude p {
        margin: 0;
        opacity: 0.8;
        line-height: 1.5;
        max-width: 300px;
    }

    @media (max-width: 1024px) {
        .main-layout {
            grid-template-columns: 1fr;
            grid-template-rows: 400px 1fr;
        }
        
        .browser-layout {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr;
        }

        .panel {
            height: 350px;
        }
    }
</style>