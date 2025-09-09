<script>
    import { onMount } from 'svelte';

    let projects = [];
    let sessions = [];
    let messages = [];
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
        messages = [];
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
        loading = true;
        error = null;
        
        try {
            const response = await fetch(`/api/claude/sessions/${encodeURIComponent(selectedProject)}/${encodeURIComponent(session.id)}?full=1`);
            if (response.ok) {
                const data = await response.json();
                messages = data.entries || [];
            } else {
                error = 'Failed to load messages';
            }
        } catch (err) {
            error = 'Error loading messages: ' + err.message;
        }
        loading = false;
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

    function parseMessage(entry) {
        let role = 'system';
        let content = 'No content available';
        let tools = [];
        let type = 'text';
        
        if (entry.message) {
            const message = entry.message;
            role = message.role || 'system';
            
            if (Array.isArray(message.content)) {
                const textParts = [];
                
                for (const part of message.content) {
                    if (part.type === 'text') {
                        textParts.push(part.text);
                    } else if (part.type === 'tool_use') {
                        type = 'tool_use';
                        tools.push({
                            type: 'tool_use',
                            name: part.name,
                            input: part.input,
                            id: part.id
                        });
                    } else if (part.type === 'tool_result') {
                        tools.push({
                            type: 'tool_result',
                            tool_use_id: part.tool_use_id,
                            content: part.content
                        });
                    }
                }
                
                if (textParts.length > 0) {
                    content = textParts.join('\n\n');
                }
            } else if (typeof message.content === 'string') {
                content = message.content;
            }
        }
        
        return {
            role,
            type,
            content,
            tools,
            timestamp: entry.timestamp,
            id: entry.id,
            raw: entry
        };
    }

    function getRoleIcon(role) {
        switch (role) {
            case 'user': return '👤';
            case 'assistant': return '🤖';
            default: return '⚙️';
        }
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

            <!-- Messages Panel -->
            <div class="panel messages-panel">
                <h2>Messages</h2>
                <div class="panel-content">
                    {#if !selectedSession}
                        <div class="empty">Select a session to view messages</div>
                    {:else if loading && messages.length === 0}
                        <div class="loading">Loading messages...</div>
                    {:else if messages.length === 0}
                        <div class="empty">No messages found</div>
                    {:else}
                        <div class="messages-list">
                            {#each messages as entry}
                                {@const parsed = parseMessage(entry)}
                                <div class="message-item" class:tool-message={parsed.type === 'tool_use'}>
                                    <div class="message-header">
                                        <span class="role-icon">{getRoleIcon(parsed.role)}</span>
                                        <span class="role-label">{parsed.role}</span>
                                        {#if parsed.type === 'tool_use'}
                                            <span class="tool-badge">Tool Use</span>
                                        {/if}
                                        <span class="message-time">
                                            {new Date(parsed.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    
                                    {#if parsed.content}
                                        <div class="message-content">
                                            {parsed.content}
                                        </div>
                                    {/if}

                                    {#if parsed.tools.length > 0}
                                        <div class="tools-section">
                                            {#each parsed.tools as tool}
                                                <details class="tool-details">
                                                    <summary>
                                                        {#if tool.type === 'tool_use'}
                                                            🔧 {tool.name}
                                                        {:else}
                                                            📋 Tool Result
                                                        {/if}
                                                    </summary>
                                                    <pre class="tool-content">{JSON.stringify(tool, null, 2)}</pre>
                                                </details>
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
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

    .browser-layout {
        display: grid;
        grid-template-columns: 1fr 1fr 2fr;
        gap: 1rem;
        height: calc(100vh - 200px);
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

    .messages-list {
        padding: 0;
    }

    .message-item {
        padding: 1rem;
        border-bottom: 1px solid var(--surface-border);
    }

    .message-item.tool-message {
        background: color-mix(in oklch, var(--surface-hover) 50%, transparent 50%);
        border-left: 2px solid var(--accent);
        padding-left: calc(1rem - 2px);
    }

    .message-header {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }

    .role-icon {
        font-size: 1.2rem;
    }

    .role-label {
        font-weight: 600;
        color: var(--accent);
    }

    .tool-badge {
        background: var(--accent);
        color: var(--bg);
        padding: 0.2rem 0.4rem;
        border-radius: 0.2rem;
        font-size: 0.8rem;
        font-weight: 500;
    }

    .message-time {
        margin-left: auto;
        opacity: 0.6;
        font-size: 0.8rem;
    }

    .message-content {
        background: var(--surface-hover);
        padding: 0.75rem;
        border-radius: 0.25rem;
        white-space: pre-wrap;
        font-family: var(--font-mono);
        font-size: 0.9rem;
        margin-bottom: 0.5rem;
        line-height: 1.4;
    }

    .tools-section {
        margin-top: 0.5rem;
    }

    .tool-details {
        margin-bottom: 0.5rem;
    }

    .tool-details summary {
        cursor: pointer;
        padding: 0.5rem;
        background: var(--surface);
        border-radius: 0.25rem;
        font-weight: 500;
        transition: background 0.2s;
    }

    .tool-details summary:hover {
        background: var(--surface-hover);
    }

    .tool-content {
        background: var(--bg);
        padding: 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.8rem;
        overflow-x: auto;
        margin-top: 0.5rem;
        border: 1px solid var(--surface-border);
    }

    .loading, .empty {
        padding: 2rem;
        text-align: center;
        color: var(--text-muted);
        font-style: italic;
    }

    @media (max-width: 1024px) {
        .browser-layout {
            grid-template-columns: 1fr;
            height: auto;
        }
        
        .panel {
            height: 400px;
        }
    }
</style>