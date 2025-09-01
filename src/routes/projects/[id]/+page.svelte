<script>
    import { onMount, onDestroy } from "svelte";
    import { page } from "$app/stores";
    import { io } from "socket.io-client";
    import { goto } from "$app/navigation";
    import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
    import Container from "$lib/components/Container.svelte";
    import Terminal from "$lib/components/Terminal.svelte";
    import Chat from "$lib/components/ChatInterface.svelte";
    import { panelStore } from "$lib/stores/panel-store.js";
    import BackIcon from "$lib/components/Icons/BackIcon.svelte";
    import EndSessionIcon from "$lib/components/Icons/EndSessionIcon.svelte";
    import SessionIcon from "$lib/components/Icons/SessionIcon.svelte";
    import StartSession from "$lib/components/Icons/StartSession.svelte";
    import ConfirmationDialog from "$lib/components/ConfirmationDialog.svelte";
    import PublicUrlDisplay from "$lib/components/PublicUrlDisplay.svelte";
    import {
        validateSessionNameRealtime,
        validateSessionNameWithFeedback,
    } from "$lib/utils/session-name-validation.js";

    export let data;

    $: projectId = $page.params.id;

    let project = null;
    let sessions = [];
    let activeSessions = [];
    let activeSessionId = null;
    let sessionMode = "shell"; // Default session mode
    let sessionName = ""; // Custom session name input

    // Validation state
    let nameValidation = { isValid: true };
    let showValidation = false;

    // Reactive validation
    $: {
        nameValidation = validateSessionNameRealtime(sessionName);
        // Only show validation feedback when there's a message or it's invalid
        showValidation = !nameValidation.isValid || nameValidation.message;
    }

    // Validate before submission
    function validateBeforeSubmit() {
        const finalValidation = validateSessionNameWithFeedback(sessionName);
        nameValidation = finalValidation;
        showValidation = !finalValidation.isValid;
        return finalValidation.isValid;
    }

    let socket;
    let authed = false;

    // Dialog state
    let showEndSessionDialog = false;
    let sessionToEnd = null;

    // Current terminal/chat instance
    let currentTerminal = null;
    let currentChat = null;

    onMount(async () => {
        if (!projectId) {
            goto('/projects');
            return;
        }

        panelStore.closeMobilePanel();

        try {
            socket = io();

            socket.on("connect", () => {
                console.log("Connected to server");
                
                // Authenticate
                socket.emit("auth", data?.terminalKey || "test", (response) => {
                    if (response?.ok || response?.success) {
                        authed = true;
                        loadProject();
                    } else {
                        console.error("Authentication failed");
                    }
                });
            });

            socket.on("projects-updated", (data) => {
                console.log("Projects updated:", data);
                // Reload current project if it still exists
                loadProject();
            });

            socket.on("session-ended", (data) => {
                console.log("Session ended:", data);
                const { sessionId } = data;
                
                // Remove from active sessions
                activeSessions = activeSessions.filter(s => s.sessionId !== sessionId);
                
                // If this was the active session, clear it
                if (activeSessionId === sessionId) {
                    activeSessionId = null;
                    currentTerminal = null;
                    currentChat = null;
                }
                
                // Reload project to update session statuses
                loadProject();
            });

            socket.on("disconnect", () => {
                console.log("Disconnected from server");
                authed = false;
            });

        } catch (error) {
            console.error("Failed to connect:", error);
        }
    });

    onDestroy(() => {
        if (socket) {
            socket.disconnect();
        }
    });

    function loadProject() {
        if (!socket || !authed || !projectId) return;

        socket.emit("get-project", { projectId }, (response) => {
            if (response.ok) {
                project = response.project;
                sessions = project.sessions || [];
                activeSessions = project.activeSessions || [];
                console.log("Loaded project:", project);
            } else {
                console.error("Failed to load project:", response.error);
                if (response.error === 'Project not found') {
                    goto('/projects');
                }
            }
        });
    }

    async function createSessionInProject() {
        if (!validateBeforeSubmit()) {
            return;
        }

        if (!socket || !authed || !projectId) {
            console.error("Not connected, authenticated, or no project ID");
            return;
        }

        try {
            const result = await new Promise((resolve, reject) => {
                socket.emit('create-session-in-project', {
                    projectId: projectId,
                    sessionOpts: {
                        mode: sessionMode,
                        name: sessionName.trim() || undefined,
                        cols: 80,
                        rows: 24
                    }
                }, (response) => {
                    if (response.ok) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error || 'Creation failed'));
                    }
                });
            });

            console.log('Session created successfully:', result);
            
            // Clear form
            sessionName = "";
            nameValidation = { isValid: true };
            showValidation = false;

            // Reload project to show new session
            loadProject();

            // Automatically attach to the new session
            attachToSession(result.sessionId);
        } catch (err) {
            console.error('Failed to create session:', err);
            nameValidation = { 
                isValid: false, 
                message: err.message || 'Failed to create session',
                severity: 'error'
            };
            showValidation = true;
        }
    }

    function attachToSession(sessionId) {
        if (!socket || !authed) {
            console.error("Not connected or authenticated");
            return;
        }

        // Clear current instances
        currentTerminal = null;
        currentChat = null;

        socket.emit("attach", { sessionId, cols: 80, rows: 24 }, (response) => {
            if (response.ok) {
                activeSessionId = sessionId;
                console.log("Attached to session:", sessionId);
                
                // Create appropriate component based on session type
                const sessionInfo = sessions.find(s => s.id === sessionId) || 
                                  activeSessions.find(s => s.sessionId === sessionId);
                
                if (sessionInfo?.type === 'claude') {
                    // Create chat component
                    setTimeout(() => {
                        const chatContainer = document.getElementById('chat-container');
                        if (chatContainer) {
                            currentChat = new Chat({
                                target: chatContainer,
                                props: { sessionId, socket }
                            });
                        }
                    }, 100);
                } else {
                    // Create terminal component
                    setTimeout(() => {
                        const terminalContainer = document.getElementById('terminal-container');
                        if (terminalContainer) {
                            currentTerminal = new Terminal({
                                target: terminalContainer,
                                props: { sessionId, socket }
                            });
                        }
                    }, 100);
                }
            } else {
                console.error("Failed to attach to session:", response.error);
            }
        });
    }

    function confirmEndSession(sessionId) {
        const sessionInfo = sessions.find(s => s.id === sessionId) || 
                           activeSessions.find(s => s.sessionId === sessionId);
        sessionToEnd = { id: sessionId, name: sessionInfo?.name || sessionId };
        showEndSessionDialog = true;
    }

    async function endSession() {
        if (!sessionToEnd || !socket || !authed) return;

        try {
            const result = await new Promise((resolve, reject) => {
                socket.emit('end', sessionToEnd.id, (response) => {
                    if (response?.ok !== false) {
                        resolve(response);
                    } else {
                        reject(new Error(response?.error || 'End session failed'));
                    }
                });
            });

            console.log('Session ended successfully');
            showEndSessionDialog = false;
            sessionToEnd = null;
            
            // If this was the active session, clear it
            if (activeSessionId === sessionToEnd.id) {
                activeSessionId = null;
                currentTerminal = null;
                currentChat = null;
            }
        } catch (err) {
            console.error('Failed to end session:', err);
            // Could show error to user here
        }
    }

    function cancelEndSession() {
        showEndSessionDialog = false;
        sessionToEnd = null;
    }

    function backToProjects() {
        goto('/projects');
    }
</script>

<Container>
    {#snippet header()}
        <HeaderToolbar>
            {#snippet left()}
                <button
                    class="btn-icon"
                    on:click={backToProjects}
                    title="Back to projects"
                    aria-label="Back to projects"
                >
                    <BackIcon />
                </button>
            {/snippet}
            {#snippet center()}
                <h1>{project?.name || 'Loading...'}</h1>
                {#if project?.description}
                    <p class="project-description">{project.description}</p>
                {/if}
            {/snippet}
            {#snippet right()}
                <PublicUrlDisplay />
            {/snippet}
        </HeaderToolbar>
    {/snippet}

    {#snippet children()}
        <div class="project-view">
            <!-- Sessions Panel -->
            <div class="sessions-panel">
                <h3>Sessions</h3>
                
                {#if sessions.length === 0 && activeSessions.length === 0}
                    <div class="empty-sessions">
                        <p>No sessions in this project yet.</p>
                    </div>
                {:else}
                    <ul class="sessions-list">
                        {#each sessions as session}
                            <li>
                                <div
                                    class="session-item"
                                    class:active={activeSessionId === session.id}
                                    data-augmented-ui="tl-clip tr-clip br-clip bl-clip both"
                                >
                                    <div class="session-info">
                                        <div class="session-name">{session.name}</div>
                                        <div class="session-meta">
                                            {session.type} • {session.status}
                                        </div>
                                    </div>
                                    <div class="session-actions">
                                        {#if session.status === 'active'}
                                            <button
                                                class="btn-sm"
                                                on:click={() => attachToSession(session.id)}
                                                title="Attach to session"
                                            >
                                                <SessionIcon />
                                            </button>
                                            <button
                                                class="btn-sm btn-danger"
                                                on:click={() => confirmEndSession(session.id)}
                                                title="End session"
                                            >
                                                <EndSessionIcon />
                                            </button>
                                        {:else}
                                            <span class="session-status-stopped">Stopped</span>
                                        {/if}
                                    </div>
                                </div>
                            </li>
                        {/each}
                        
                        {#each activeSessions as activeSession}
                            {#if !sessions.find(s => s.id === activeSession.sessionId)}
                                <li>
                                    <div
                                        class="session-item"
                                        class:active={activeSessionId === activeSession.sessionId}
                                        data-augmented-ui="tl-clip tr-clip br-clip bl-clip both"
                                    >
                                        <div class="session-info">
                                            <div class="session-name">{activeSession.name}</div>
                                            <div class="session-meta">
                                                Active session
                                            </div>
                                        </div>
                                        <div class="session-actions">
                                            <button
                                                class="btn-sm"
                                                on:click={() => attachToSession(activeSession.sessionId)}
                                                title="Attach to session"
                                            >
                                                <SessionIcon />
                                            </button>
                                            <button
                                                class="btn-sm btn-danger"
                                                on:click={() => confirmEndSession(activeSession.sessionId)}
                                                title="End session"
                                            >
                                                <EndSessionIcon />
                                            </button>
                                        </div>
                                    </div>
                                </li>
                            {/if}
                        {/each}
                    </ul>
                {/if}

                <!-- Create Session Form -->
                <div class="session-form">
                    <h4>Create New Session</h4>
                    
                    <div class="form-group">
                        <label for="session-mode">Type</label>
                        <select id="session-mode" bind:value={sessionMode}>
                            <option value="shell">Terminal (Shell)</option>
                            <option value="claude">Claude Agent</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="session-name">Name (optional)</label>
                        <input
                            id="session-name"
                            type="text"
                            bind:value={sessionName}
                            placeholder="Enter session name"
                            class:invalid={!nameValidation.isValid}
                            on:keydown={(e) => e.key === "Enter" && createSessionInProject()}
                        />
                        {#if showValidation && nameValidation.message}
                            <div
                                class="validation-message"
                                class:error={nameValidation.severity === "error"}
                                class:warning={nameValidation.severity === "warning"}
                                class:info={nameValidation.severity === "info"}
                            >
                                {nameValidation.message}
                            </div>
                        {/if}
                    </div>

                    <button
                        class="btn-primary"
                        on:click={createSessionInProject}
                        disabled={!nameValidation.isValid && sessionName.trim()}
                    >
                        <StartSession />
                        Create Session
                    </button>
                </div>
            </div>

            <!-- Content Panel -->
            <div class="content-panel">
                {#if activeSessionId}
                    {#if sessions.find(s => s.id === activeSessionId)?.type === 'claude' || activeSessions.find(s => s.sessionId === activeSessionId)?.type === 'claude'}
                        <div id="chat-container" class="session-content"></div>
                    {:else}
                        <div id="terminal-container" class="session-content"></div>
                    {/if}
                {:else}
                    <div class="no-session">
                        <h3>No Session Selected</h3>
                        <p>Create a new session or select an existing one to get started.</p>
                    </div>
                {/if}
            </div>
        </div>
    {/snippet}
</Container>

<!-- End session confirmation dialog -->
<ConfirmationDialog
    bind:show={showEndSessionDialog}
    title="End Session"
    message="Are you sure you want to end session '{sessionToEnd?.name}'? This will terminate the session and you may lose unsaved work."
    confirmText="End Session"
    cancelText="Cancel"
    dangerous={true}
    on:confirm={endSession}
    on:cancel={cancelEndSession}
/>

<style>
    .project-description {
        font-size: 0.9rem;
        color: var(--text-secondary);
        margin: 0;
        font-weight: normal;
    }

    .project-view {
        display: flex;
        height: 100%;
        gap: var(--space-md);
        padding: var(--space-md);
    }

    .sessions-panel {
        width: 300px;
        flex-shrink: 0;
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 8px;
        padding: var(--space-md);
        backdrop-filter: blur(10px);
        overflow-y: auto;
    }

    .sessions-panel h3 {
        margin-top: 0;
        margin-bottom: var(--space-md);
        color: var(--text-primary);
    }

    .sessions-panel h4 {
        margin-top: var(--space-lg);
        margin-bottom: var(--space-sm);
        color: var(--text-primary);
        font-size: 1rem;
    }

    .empty-sessions {
        text-align: center;
        padding: var(--space-lg);
        color: var(--text-muted);
    }

    .sessions-list {
        margin: 0;
        padding: 0;
        list-style: none;
        margin-bottom: var(--space-lg);
    }

    .session-item {
        display: flex;
        align-items: center;
        gap: var(--space-sm);
        padding: var(--space-sm);
        margin-bottom: var(--space-xs);
        background: rgba(26, 26, 26, 0.6);
        border: 1px solid rgba(0, 255, 136, 0.2);
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .session-item:hover {
        background: rgba(0, 255, 136, 0.05);
        border-color: rgba(0, 255, 136, 0.4);
    }

    .session-item.active {
        background: rgba(0, 255, 136, 0.1);
        border-color: var(--accent);
    }

    .session-info {
        flex: 1;
        min-width: 0;
    }

    .session-name {
        font-weight: 500;
        color: var(--text-primary);
        margin-bottom: var(--space-xs);
    }

    .session-meta {
        font-size: 0.8rem;
        color: var(--text-muted);
    }

    .session-actions {
        display: flex;
        gap: var(--space-xs);
    }

    .session-status-stopped {
        font-size: 0.8rem;
        color: var(--text-muted);
        padding: var(--space-xs);
    }

    .content-panel {
        flex: 1;
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 8px;
        backdrop-filter: blur(10px);
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .session-content {
        flex: 1;
        height: 100%;
    }

    .no-session {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        color: var(--text-muted);
    }

    .no-session h3 {
        margin-bottom: var(--space-sm);
        color: var(--text-secondary);
    }

    .session-form {
        border-top: 1px solid rgba(0, 255, 136, 0.2);
        padding-top: var(--space-md);
    }

    .form-group {
        margin-bottom: var(--space-sm);
    }

    .form-group label {
        display: block;
        margin-bottom: var(--space-xs);
        color: var(--text-secondary);
        font-size: 0.85rem;
    }

    .form-group input,
    .form-group select {
        width: 100%;
        padding: var(--space-xs) var(--space-sm);
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 4px;
        color: var(--text-primary);
        font-size: 0.9rem;
    }

    .form-group input:focus,
    .form-group select:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.1);
    }

    .form-group input.invalid {
        border-color: var(--error);
    }

    .validation-message {
        margin-top: var(--space-xs);
        padding: var(--space-xs);
        border-radius: 4px;
        font-size: 0.75rem;
    }

    .validation-message.error {
        background: rgba(255, 99, 99, 0.1);
        color: var(--error);
        border: 1px solid rgba(255, 99, 99, 0.3);
    }

    .validation-message.warning {
        background: rgba(255, 193, 7, 0.1);
        color: #ffc107;
        border: 1px solid rgba(255, 193, 7, 0.3);
    }

    .validation-message.info {
        background: rgba(0, 255, 136, 0.1);
        color: var(--accent);
        border: 1px solid rgba(0, 255, 136, 0.3);
    }

    .btn-primary {
        display: flex;
        align-items: center;
        gap: var(--space-xs);
        width: 100%;
        padding: var(--space-sm);
        background: var(--accent);
        color: var(--bg);
        border: none;
        border-radius: 4px;
        font-weight: 500;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background-color 0.2s ease;
    }

    .btn-primary:hover:not(:disabled) {
        background: rgba(0, 255, 136, 0.8);
    }

    .btn-primary:disabled {
        background: rgba(0, 255, 136, 0.3);
        cursor: not-allowed;
    }

    .btn-sm {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        padding: 0;
        background: rgba(0, 255, 136, 0.1);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 4px;
        color: var(--accent);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-sm:hover {
        background: rgba(0, 255, 136, 0.2);
        border-color: var(--accent);
    }

    .btn-danger {
        background: rgba(255, 99, 99, 0.1);
        border-color: rgba(255, 99, 99, 0.3);
        color: var(--error);
    }

    .btn-danger:hover {
        background: rgba(255, 99, 99, 0.2);
        border-color: var(--error);
    }

    /* Mobile responsiveness */
    @media (max-width: 768px) {
        .project-view {
            flex-direction: column;
            height: auto;
        }

        .sessions-panel {
            width: auto;
            margin-bottom: var(--space-md);
        }

        .content-panel {
            min-height: 400px;
        }
    }
</style>