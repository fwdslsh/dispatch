<script>
  import { onMount, createEventDispatcher } from 'svelte';

  // Use $props for runes-compatible bindings (writable via destructuring)
  let { selectedProject, selectedSession, storagePrefix } = $props();
  // props.selectedProject / props.selectedSession are bindable from parent
  // props.storagePrefix is optional

  // Internal state
  let projects = $state([]);
  let sessions = $state([]);
  let activeTab = $state('projects'); // 'projects' | 'sessions'
  let loading = $state(false);
  let error = $state(null);
  let restoring = $state(true);
  let isMobileView = $state(false);

  const prefix = $derived(storagePrefix ?? 'dispatch-menu');
  const STORAGE = $derived({
    activeTab: `${prefix}-active-tab`,
    selectedProject: `${prefix}-selected-project`,
    selectedSession: `${prefix}-selected-session`
  });

  const dispatch = createEventDispatcher();

  function cleanProjectName(projectName) {
    if (!projectName) return '';
    if (projectName.includes('--dispatch-home-workspaces-')) {
      const match = projectName.match(/--dispatch-home-workspaces-(.+)$/);
      if (match) return match[1].charAt(0).toUpperCase() + match[1].slice(1);
    }
    if (projectName.includes('--claude-projects--')) {
      const match = projectName.match(/--claude-projects--(.+)$/);
      if (match) {
        const cleaned = match[1].replace(/--dispatch-home-workspaces-(.+)$/, '$1');
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      }
    }
    const parts = projectName.split(/[-_]/);
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart !== 'dispatch' && lastPart !== 'home') {
      return lastPart.charAt(0).toUpperCase() + lastPart.slice(1);
    }
    return projectName;
  }

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
    selectedProject = project?.name || null;
    selectedSession = null;
    loading = true;
    error = null;
    try {
      if (selectedProject) {
        const response = await fetch(`/api/claude/projects/${encodeURIComponent(selectedProject)}/sessions`);
        if (response.ok) {
          const data = await response.json();
          sessions = data.sessions || [];
          activeTab = 'sessions';
        } else {
          error = 'Failed to load sessions';
        }
      } else {
        sessions = [];
      }
    } catch (err) {
      error = 'Error loading sessions: ' + err.message;
    }
    loading = false;
    dispatch('projectSelected', { name: selectedProject });
  }

  function selectSession(session) {
    selectedSession = session?.id || null;
    dispatch('sessionSelected', { id: selectedSession });
  }

  onMount(async () => {
    // Restore UI prefs
    try {
      const savedTab = localStorage.getItem(STORAGE.activeTab);
      if (savedTab === 'projects' || savedTab === 'sessions') activeTab = savedTab;
    } catch {}

    await loadProjects();

    try {
      const savedProject = localStorage.getItem(STORAGE.selectedProject);
      const savedSession = localStorage.getItem(STORAGE.selectedSession);

      if (savedProject) {
        await selectProject({ name: savedProject });
        if (savedSession && sessions.some((s) => s.id === savedSession)) {
          selectedSession = savedSession;
        }
      }
    } catch {}
    restoring = false;

    const updateMobile = () => {
      isMobileView = typeof window !== 'undefined' ? window.innerWidth < 768 : false;
    };
    updateMobile();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateMobile);
      return () => window.removeEventListener('resize', updateMobile);
    }
  });

  // Persistence effects
  $effect(() => {
    if (restoring) return;
    try { localStorage.setItem(STORAGE.activeTab, activeTab); } catch {}
  });
  $effect(() => {
    if (restoring) return;
    try { localStorage.setItem(STORAGE.selectedProject, selectedProject || ''); } catch {}
  });
  $effect(() => {
    if (restoring) return;
    try { localStorage.setItem(STORAGE.selectedSession, selectedSession || ''); } catch {}
  });

  // Public method to refresh projects
  export function refresh() {
    return loadProjects();
  }
</script>

<div class="menu-root">
  <!-- Tab Navigation (preserving testing page styles) -->
  <div class="mobile-tabs" class:desktop-tabs={!isMobileView}>
    <button
      class="tab-btn"
      class:active={activeTab === 'projects'}
      type="button"
      onclick={() => (activeTab = 'projects')}
    >Projects</button>
    <button
      class="tab-btn"
      class:active={activeTab === 'sessions'}
      type="button"
      onclick={() => (activeTab = 'sessions')}
      disabled={!selectedProject}
      aria-disabled={!selectedProject}
      title={!selectedProject ? 'Select a project first' : 'Sessions'}
    >Sessions</button>
  </div>

  <div class="browser-layout" class:mobile-browser={isMobileView} class:tabbed-layout={true}>
    <!-- Projects Panel -->
    <div class="panel" class:hidden={activeTab !== 'projects'}>
      <h2>Projects</h2>
      <div class="panel-content">
        {#if loading && projects.length === 0}
          <div class="status">Loading projects...</div>
        {:else if projects.length === 0}
          <div class="status">No projects found</div>
        {:else}
          {#each projects as project}
            <button
              type="button"
              class="project-item"
              class:selected={selectedProject === project.name}
              onclick={() => selectProject(project)}
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
    <div class="panel" class:hidden={activeTab !== 'sessions'}>
      <h2>Sessions</h2>
      <div class="panel-content">
        {#if !selectedProject}
          <div class="status">Select a project to view sessions</div>
        {:else if loading && sessions.length === 0}
          <div class="status">Loading sessions...</div>
        {:else if sessions.length === 0}
          <div class="status">No sessions found</div>
        {:else}
          {#each sessions as session}
            <button
              type="button"
              class="session-item"
              class:selected={selectedSession === session.id}
              onclick={() => selectSession(session)}
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

<style>
  .menu-root {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    height: 100%;
  }

  /* Tabs (Mobile and Desktop) from testing page */
  .mobile-tabs {
    display: flex;
    background: var(--surface);
    border-bottom: 2px solid var(--primary-dim);
    position: sticky;
    top: 0;
    z-index: 10;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .mobile-tabs.desktop-tabs {
    background: var(--surface-hover);
    border-radius: 0.5rem 0.5rem 0 0;
    border-bottom: 2px solid var(--surface-border);
    margin-bottom: 0;
    position: relative;
    box-shadow: none;
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

  .desktop-tabs .tab-btn {
    border-radius: 0.5rem 0.5rem 0 0;
    margin: 0 0.25rem;
  }

  .desktop-tabs .tab-btn.active {
    background: var(--surface);
    border-bottom-color: var(--surface);
    box-shadow:
      0 -2px 8px -4px rgba(0, 0, 0, 0.1),
      inset 0 -1px 0 var(--primary);
    position: relative;
    z-index: 1;
  }

  .desktop-tabs .tab-btn.active::before {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--surface);
  }

  .browser-layout {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
    gap: 1rem;
    height: 100%;
  }

  .browser-layout.tabbed-layout { grid-template-rows: 1fr; }
  .mobile-browser { grid-template-columns: 1fr !important; grid-template-rows: 1fr !important; }

  /* utility to hide inactive tab panels */
  .hidden { display: none !important; }

  .panels {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
    min-height: 0;
    flex: 1;
  }

  .panel {
    background: var(--surface);
    border: 1px solid var(--surface-border);
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 0;
  }
  .panel h2 {
    background: var(--surface-hover);
    margin: 0;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--surface-border);
    font-size: 0.95rem;
    color: var(--accent);
    font-weight: 700;
  }
  .panel-content {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .project-item, .session-item {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--surface-border);
    cursor: pointer;
    transition: all 0.2s ease;
    position: relative;
    background: transparent;
    border: none;
    width: 100%;
    text-align: left;
    font-family: inherit;
  }
  .project-item::before, .session-item::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 3px;
    background: linear-gradient(180deg, var(--primary), var(--accent-cyan));
    transform: scaleY(0);
    transition: transform 0.3s ease;
  }
  .project-item:hover, .session-item:hover {
    background: linear-gradient(90deg, color-mix(in oklab, var(--primary) 5%, transparent), transparent);
    padding-left: calc(1rem + 4px);
  }
  .project-item:hover::before, .session-item:hover::before { transform: scaleY(0.5); }

  .project-item.selected, .session-item.selected {
    background: linear-gradient(90deg,
      color-mix(in oklab, var(--primary) 10%, var(--surface)),
      color-mix(in oklab, var(--primary) 2%, var(--surface))
    );
    border-left: 3px solid transparent;
    padding-left: calc(1rem + 4px);
    font-weight: 600;
  }
  .project-item.selected::before, .session-item.selected::before { transform: scaleY(1); }

  .project-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.4rem;
  }
  .project-name {
    font-weight: 700;
    font-size: 1rem;
    color: var(--text);
    line-height: 1.2;
  }
  .project-stats {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.15rem;
    font-size: 0.7rem;
  }
  .session-count {
    background: linear-gradient(135deg, var(--primary), var(--accent-cyan));
    color: var(--bg);
    padding: 0.1rem 0.35rem;
    border-radius: 0.75rem;
    font-weight: 600;
    font-size: 0.65rem;
    box-shadow: 0 2px 6px rgba(46, 230, 107, 0.2);
  }
  .last-modified { opacity: 0.7; font-weight: 500; }

  .project-path {
    font-size: 0.75rem;
    opacity: 0.6;
    font-family: var(--font-mono);
    background: var(--surface-hover);
    padding: 0.2rem 0.4rem;
    border-radius: 0.25rem;
    margin-top: 0.25rem;
  }

  .session-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.35rem;
  }
  .session-id { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 600; color: var(--accent); }
  .session-size { background: var(--surface-hover); color: var(--text); padding: 0.15rem 0.4rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 600; }
  .session-info { display: flex; justify-content: space-between; align-items: center; font-size: 0.7rem; opacity: 0.8; }
  .session-date { font-weight: 500; }
  .session-time { font-family: var(--font-mono); opacity: 0.7; }

  .status { padding: 1.25rem; text-align: center; color: var(--text-muted); font-style: italic; }

  @media (max-width: 480px) {
    .panel h2 { font-size: 0.9rem; }
    .project-name { font-size: 0.95rem; }
  }
</style>
