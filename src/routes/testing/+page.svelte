<script>
    import { onMount } from 'svelte';
    import ClaudePane from '$lib/components/ClaudePane.svelte';
    
    let isMobileView = $state(false);
    let showSidebar = $state(false);
    let activeTab = $state('projects'); // 'projects' or 'sessions'

    // Persistence keys
    const STORAGE = {
        activeTab: 'dispatch-testing-active-tab',
        selectedProject: 'dispatch-testing-selected-project',
        selectedSession: 'dispatch-testing-selected-session',
        showSidebar: 'dispatch-testing-show-sidebar'
    };

    let projects = $state([]);
    let sessions = $state([]);
    let selectedProject = $state(null);
    let selectedSession = $state(null);
    let loading = $state(false);
    let error = $state(null);

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


    let restoring = $state(true);
    onMount(() => {
        // Initial UI state
        checkMobileView();

        // Restore simple UI prefs
        const savedTab = localStorage.getItem(STORAGE.activeTab);
        if (savedTab === 'projects' || savedTab === 'sessions') activeTab = savedTab;
        const savedSidebar = localStorage.getItem(STORAGE.showSidebar);
        if (savedSidebar != null) showSidebar = savedSidebar === 'true';

        // Finish restore once data fetched
        (async () => {
            await loadProjects();

            const savedProject = localStorage.getItem(STORAGE.selectedProject);
            const savedSession = localStorage.getItem(STORAGE.selectedSession);

            if (savedProject) {
                // selectProject only needs .name
                await selectProject({ name: savedProject });
                if (savedSession && sessions.some((s) => s.id === savedSession)) {
                    selectedSession = savedSession;
                }
            }
            restoring = false;
        })();

        window.addEventListener('resize', checkMobileView);
        return () => {
            window.removeEventListener('resize', checkMobileView);
        };
    });
    
    function checkMobileView() {
        isMobileView = window.innerWidth < 768;
        if (!isMobileView) {
            showSidebar = false; // Reset sidebar on desktop
        }
    }
    
    function toggleSidebar() {
        showSidebar = !showSidebar;
    }
    
    function closeSidebarAndSelect() {
        if (isMobileView) {
            showSidebar = false;
        }
    }
    
    // Persistence effects
    $effect(() => {
        if (restoring) return;
        try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE.activeTab, activeTab); } catch {}
    });

    $effect(() => {
        if (restoring) return;
        try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE.selectedProject, selectedProject || ''); } catch {}
    });

    $effect(() => {
        if (restoring) return;
        try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE.selectedSession, selectedSession || ''); } catch {}
    });

    $effect(() => {
        if (restoring) return;
        try { if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE.showSidebar, String(showSidebar)); } catch {}
    });
</script>

<svelte:head>
    <title>Claude Session Browser</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
</svelte:head>

<main class="session-browser">
    <div class="container">
        <header class="browser-header">
            {#if isMobileView}
                <button onclick={toggleSidebar} class="menu-btn" aria-label="Toggle menu" type="button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
                    </svg>
                </button>
            {/if}
            <h1>Claude Session Browser</h1>
            <button onclick={loadProjects} class="refresh-btn" disabled={loading} type="button">
                <svg class="refresh-icon" class:spinning={loading} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/>
                </svg>
                <span class="refresh-text">{loading ? 'Loading' : 'Refresh'}</span>
            </button>
        </header>

        {#if error}
            <div class="error-banner">
                <span class="error-icon">⚠️</span>
                {error}
            </div>
        {/if}

        <div class="main-layout" class:mobile-layout={isMobileView}>
            <!-- Mobile Overlay -->
            {#if isMobileView && showSidebar}
                <button class="mobile-overlay" onclick={toggleSidebar} type="button" aria-label="Close sidebar overlay"></button>
            {/if}
            
            <!-- Left Side: Session Browser -->
            <div class="browser-section" class:mobile-sidebar={isMobileView} class:show-sidebar={showSidebar}>
                <!-- Mobile Tab Navigation -->
                {#if isMobileView}
                    <div class="mobile-tabs">
                        <button 
                            class="tab-btn" 
                            class:active={activeTab === 'projects'}
                            onclick={() => activeTab = 'projects'}
                        >
                            Projects
                        </button>
                        <button 
                            class="tab-btn" 
                            class:active={activeTab === 'sessions'}
                            onclick={() => activeTab = 'sessions'}
                        >
                            Sessions
                        </button>
                    </div>
                {/if}
                
                <div class="browser-layout" class:mobile-browser={isMobileView}>
                    <!-- Projects Panel -->
                    <div class="panel projects-panel" class:mobile-hidden={isMobileView && activeTab !== 'projects'}>
                        <h2>Projects</h2>
                        <div class="panel-content">
                            {#if loading && projects.length === 0}
                                <div class="loading">Loading projects...</div>
                            {:else if projects.length === 0}
                                <div class="empty">No projects found</div>
                            {:else}
                                {#each projects as project}
                                    <button
                                        type="button"
                                        class="project-item"
                                        class:selected={selectedProject === project.name}
                                        onclick={() => {
                                            selectProject(project);
                                            if (isMobileView) activeTab = 'sessions';
                                        }}
                                    >
                                        <div class="project-header">
                                            <div class="project-name">{cleanProjectName(project.name)}</div>
                                            <div class="project-stats">
                                                <span class="session-count">{project.sessionCount} sessions</span>
                                                <span class="last-modified">{new Date(project.lastModified).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div class="project-path">{project.path.split('/').slice(-2).join('/')}</div>
                                    </button>
                                {/each}
                            {/if}
                        </div>
                    </div>

                    <!-- Sessions Panel -->
                    <div class="panel sessions-panel" class:mobile-hidden={isMobileView && activeTab !== 'sessions'}>
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
                                    <button
                                        type="button"
                                        class="session-item"
                                        class:selected={selectedSession === session.id}
                                        onclick={() => {
                                            selectSession(session);
                                            closeSidebarAndSelect();
                                        }}
                                    >
                                        <div class="session-header">
                                            <div class="session-id">{session.id.substring(0, 8)}...</div>
                                            <div class="session-size">{Math.round(session.size / 1024)}KB</div>
                                        </div>
                                        <div class="session-info">
                                            <span class="session-date">{new Date(session.lastModified).toLocaleDateString()}</span>
                                            <span class="session-time">{new Date(session.lastModified).toLocaleTimeString()}</span>
                                        </div>
                                    </button>
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
        background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
        background-clip: text;
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 2rem;
        font-family: var(--font-mono);
        font-weight: 800;
        margin: 0;
        letter-spacing: -0.02em;
        text-shadow: 0 0 30px rgba(46, 230, 107, 0.2);
    }

    .refresh-btn {
        background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
        color: var(--bg);
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 8px;
        cursor: pointer;
        font-family: var(--font-mono);
        font-weight: 600;
        transition: all 0.3s ease;
        box-shadow: 0 2px 8px rgba(46, 230, 107, 0.2);
        /* Ensure proper Unicode display */
        font-variant: normal;
        text-rendering: auto;
        -webkit-font-smoothing: antialiased;
    }

    .refresh-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(46, 230, 107, 0.4);
        background: linear-gradient(135deg, var(--accent-cyan), var(--primary));
    }

    .refresh-btn:active {
        transform: translateY(0);
    }

    .refresh-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
        background: linear-gradient(135deg, 
            color-mix(in oklab, var(--primary) 60%, var(--surface)),
            color-mix(in oklab, var(--accent-cyan) 60%, var(--surface))
        );
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

    .error-icon {
        font-size: 1.2em;
        /* Ensure emoji displays properly */
        font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', 'EmojiOne Color', 'Twemoji Mozilla', sans-serif;
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
        transition: all 0.2s ease;
        position: relative;
        background: transparent;
        border: none;
        border-bottom: 1px solid var(--surface-border);
        width: 100%;
        text-align: left;
        font-family: inherit;
    }

    .project-item::before, .session-item::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: linear-gradient(180deg, var(--primary), var(--accent-cyan));
        transform: scaleY(0);
        transition: transform 0.3s ease;
    }

    .project-item:hover, .session-item:hover {
        background: linear-gradient(90deg, 
            color-mix(in oklab, var(--primary) 5%, transparent),
            transparent
        );
        padding-left: calc(1rem + 4px);
    }

    .project-item:hover::before, .session-item:hover::before {
        transform: scaleY(0.5);
    }

    .project-item.selected, .session-item.selected {
        background: linear-gradient(90deg, 
            color-mix(in oklab, var(--primary) 10%, var(--surface)),
            color-mix(in oklab, var(--primary) 2%, var(--surface))
        );
        border-left: 3px solid transparent;
        padding-left: calc(1rem + 4px);
        font-weight: 600;
    }

    .project-item.selected::before, .session-item.selected::before {
        transform: scaleY(1);
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
        background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
        color: var(--bg);
        padding: 0.15rem 0.4rem;
        border-radius: 0.75rem;
        font-weight: 600;
        font-size: 0.7rem;
        box-shadow: 0 2px 6px rgba(46, 230, 107, 0.2);
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
        /* Ensure emoji displays properly */
        font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Android Emoji', 'EmojiOne Color', 'Twemoji Mozilla', sans-serif;
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

    /* Mobile Menu Button */
    .menu-btn {
        background: var(--surface);
        border: 2px solid var(--primary);
        color: var(--primary);
        padding: 0.5rem;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s ease;
        min-width: 44px;
        min-height: 44px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        position: relative;
        z-index: 101;
    }

    .menu-btn:hover {
        background: var(--primary);
        color: var(--bg);
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(46, 230, 107, 0.3);
    }

    .menu-btn:active {
        transform: translateY(0);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
    }

    .menu-btn svg {
        width: 24px;
        height: 24px;
    }

    /* Refresh Button Updates */
    .refresh-btn {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .refresh-icon {
        transition: transform 0.3s ease;
    }

    .refresh-icon.spinning {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }

    .refresh-text {
        display: inline;
    }

    /* Mobile Overlay */
    .mobile-overlay {      
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 998;
        backdrop-filter: blur(4px);
    }

    /* Mobile Sidebar */
    .mobile-sidebar {
        position: fixed;
        top: 0;
        left: -100%;
        width: 85%;
        max-width: 400px;
        height: 100vh;
        background: linear-gradient(180deg, var(--bg), color-mix(in oklab, var(--bg) 95%, var(--surface) 5%));
        z-index: 999;
        transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        overflow-y: auto;
        box-shadow: 
            4px 0 24px rgba(0, 0, 0, 0.15),
            2px 0 48px rgba(46, 230, 107, 0.1);
        border-right: 1px solid var(--primary-dim);
    }

    .mobile-sidebar.show-sidebar {
        left: 0;
    }
    
    .mobile-sidebar::before {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        width: 1px;
        height: 100%;
        background: linear-gradient(180deg, var(--primary), transparent, var(--accent-cyan));
        opacity: 0.3;
    }

    /* Mobile Tabs */
    .mobile-tabs {
        display: flex;
        background: var(--surface);
        border-bottom: 2px solid var(--primary-dim);
        position: sticky;
        top: 0;
        z-index: 10;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .tab-btn {
        flex: 1;
        padding: 1rem;
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        color: var(--text-muted);
        font-family: var(--font-mono);
        font-weight: 600;
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        cursor: pointer;
        transition: all 0.3s ease;
        position: relative;
    }

    .tab-btn::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 50%;
        width: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--primary), var(--accent-cyan));
        transition: all 0.3s ease;
        transform: translateX(-50%);
    }

    .tab-btn:hover {
        color: var(--text);
        background: var(--surface-hover);
    }

    .tab-btn.active {
        color: var(--primary);
        background: color-mix(in oklab, var(--primary) 5%, var(--surface));
    }

    .tab-btn.active::after {
        width: 100%;
    }

    .mobile-browser {
        grid-template-columns: 1fr !important;
        grid-template-rows: 1fr !important;
    }

    .mobile-hidden {
        display: none !important;
    }

    /* Tablet Styles */
    @media (max-width: 1024px) and (min-width: 768px) {
        .container {
            padding: 0.75rem;
        }

        .main-layout {
            grid-template-columns: 1fr;
            grid-template-rows: 400px 1fr;
            gap: 0.75rem;
        }
        
        .browser-layout {
            grid-template-columns: 1fr 1fr;
            grid-template-rows: 1fr;
        }

        .panel {
            height: 350px;
        }

        .browser-header h1 {
            font-size: 1.5rem;
        }
    }

    /* Mobile Styles */
    @media (max-width: 767px) {
        .container {
            padding: 0;
            max-width: 100%;
        }

        .browser-header {
            padding: 1rem;
            margin-bottom: 0;
            position: sticky;
            top: 0;
            z-index: 100;
            background: var(--bg);
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .browser-header h1 {
            font-size: 1.2rem;
            flex: 1;
            text-align: center;
        }

        .refresh-text {
            display: none;
        }

        .refresh-btn {
            padding: 0.5rem;
            min-width: 40px;
        }

        .main-layout.mobile-layout {
            display: block;
            height: calc(100vh - 70px);
        }

        .browser-section {
            height: 100%;
        }

        .claude-section {
            height: calc(100vh - 70px);
            border-radius: 0;
            border: none;
        }

        .panel {
            border-radius: 0;
            border: none;
            height: calc(100vh - 120px);
        }

        .panel h2 {
            padding: 0.75rem 1rem;
            font-size: 1rem;
        }

        .project-item, .session-item {
            padding: 0.875rem 1rem;
            border-left-width: 4px;
        }

        .project-item.selected, .session-item.selected {
            border-left-width: 4px;
            padding-left: calc(1rem - 4px);
        }

        .project-name {
            font-size: 1rem;
        }

        .project-stats {
            font-size: 0.7rem;
        }

        .session-count {
            padding: 0.125rem 0.35rem;
            font-size: 0.65rem;
        }

        .project-path {
            font-size: 0.75rem;
        }

        .claude-header {
            padding: 0.75rem 1rem;
        }

        .claude-header h2 {
            font-size: 1rem;
        }

        .session-info-header {
            font-size: 0.7rem;
        }

        .session-id-full {
            font-size: 0.6rem;
        }

        .empty-claude {
            padding: 2rem;
        }

        .empty-icon {
            font-size: 3rem;
        }

        .empty-claude h3 {
            font-size: 1.25rem;
        }

        .empty-claude p {
            font-size: 0.9rem;
        }

        /* Touch-friendly sizes */
        .project-item, .session-item {
            min-height: 60px;
        }

        /* Better scrolling on mobile */
        .panel-content {
            -webkit-overflow-scrolling: touch;
            scroll-behavior: smooth;
        }

        /* Hide scrollbars on mobile for cleaner look */
        .panel-content::-webkit-scrollbar {
            width: 0;
            height: 0;
        }
    }

    /* Small Mobile Styles */
    @media (max-width: 400px) {
        .browser-header h1 {
            font-size: 1rem;
        }

        .mobile-sidebar {
            width: 90%;
        }

        .project-name {
            font-size: 0.95rem;
        }

        .project-stats {
            flex-direction: row;
            gap: 0.25rem;
        }
    }

    /* Landscape Mobile */
    @media (max-width: 767px) and (orientation: landscape) {
        .browser-header {
            padding: 0.5rem 1rem;
        }

        .browser-header h1 {
            font-size: 1rem;
        }

        .panel {
            height: calc(100vh - 80px);
        }

        .claude-section {
            height: calc(100vh - 60px);
        }
    }

    /* High DPI Screens */
    @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
        .project-item, .session-item {
            border-bottom-width: 0.5px;
        }

        .panel {
            border-width: 0.5px;
        }
    }

    /* Accessibility - Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
        .mobile-sidebar {
            transition: none;
        }

        .tab-btn, .project-item, .session-item {
            transition: none;
        }
    }

    /* Dark Mode Adjustments for Mobile */
    @media (max-width: 767px) and (prefers-color-scheme: dark) {
        .mobile-overlay {
            background: rgba(0, 0, 0, 0.7);
        }

        .browser-header {
            box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
        }

        .mobile-sidebar {
            box-shadow: 2px 0 30px rgba(0, 0, 0, 0.5);
        }
    }
</style>
