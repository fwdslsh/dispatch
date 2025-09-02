<script>
    import { onMount, onDestroy, mount, unmount } from "svelte";
    import { page } from "$app/stores";
    import { io } from "socket.io-client";
    import { goto } from "$app/navigation";
    import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
    import Container from "$lib/components/Container.svelte";
    import Terminal from "$lib/components/Terminal.svelte";
    import Chat from "$lib/components/ChatInterface.svelte";
    import BackIcon from "$lib/components/Icons/BackIcon.svelte";
    import EndSessionIcon from "$lib/components/Icons/EndSessionIcon.svelte";
    import SessionIcon from "$lib/components/Icons/SessionIcon.svelte";
    import StartSession from "$lib/components/Icons/StartSession.svelte";
    import ConfirmationDialog from "$lib/components/ConfirmationDialog.svelte";
    import PublicUrlDisplay from "$lib/components/PublicUrlDisplay.svelte";
    import DirectoryPicker from "$lib/components/DirectoryPicker.svelte";
    import {
        validateSessionNameRealtime,
        validateSessionNameWithFeedback,
    } from "$lib/utils/session-name-validation.js";
    import { createClaudeAuthContext } from "$lib/contexts/claude-auth-context.svelte.js";

    export let data;

    $: projectId = $page.params.id;

    let project = null;
    let sessions = [];
    let activeSessions = [];
    let activeSessionId = null;
    let sessionMode = "shell"; // Default session mode
    let sessionName = ""; // Custom session name input
    let workingDirectory = ""; // Working directory for Claude sessions

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
    
    // Claude authentication state
    let claudeAuthState = 'unchecked'; // 'unchecked', 'checking', 'authenticated', 'not-authenticated', 'authenticating', 'waiting-for-token'
    let claudeAuthSessionId = null;
    let claudeOAuthUrl = null;
    let claudeAuthToken = '';
    
    // Create Claude auth context for Chat components
    const claudeAuthContext = createClaudeAuthContext();

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
                    if (currentTerminal) {
                        unmount(currentTerminal);
                        currentTerminal = null;
                    }
                    if (currentChat) {
                        unmount(currentChat);
                        currentChat = null;
                    }
                }
                
                // Reload project to update session statuses
                loadProject();
            });

            socket.on("disconnect", () => {
                console.log("Disconnected from server");
                authed = false;
            });

            // Claude authentication event handlers
            socket.on("claude-auth-url", (data) => {
                console.log("Received Claude OAuth URL:", data);
                claudeOAuthUrl = data.url;
                claudeAuthState = 'waiting-for-token';
            });

            socket.on("claude-auth-output", (data) => {
                console.log("Claude auth output:", data.data);
            });

            socket.on("claude-token-saved", (data) => {
                console.log("Claude token saved:", data);
                // Token was automatically saved, mark as authenticated
                claudeAuthState = 'authenticated';
                claudeOAuthUrl = null;
                claudeAuthToken = '';
                claudeAuthSessionId = null;
                // Refresh project to update UI
                loadProject();
            });

            socket.on("claude-auth-error", (data) => {
                console.error("Claude auth error:", data.error);
                claudeAuthState = 'not-authenticated';
            });

            socket.on("claude-auth-ended", (data) => {
                console.log("Claude auth session ended:", data);
                if (data.exitCode === 0) {
                    // Authentication successful (fallback if token wasn't auto-detected)
                    claudeAuthState = 'authenticated';
                    claudeOAuthUrl = null;
                    claudeAuthToken = '';
                    claudeAuthSessionId = null;
                    // Refresh project to update UI
                    loadProject();
                } else {
                    // Authentication failed
                    claudeAuthState = 'not-authenticated';
                    claudeOAuthUrl = null;
                    claudeAuthToken = '';
                    claudeAuthSessionId = null;
                }
            });

        } catch (error) {
            console.error("Failed to connect:", error);
        }
    });

    onDestroy(() => {
        // Cleanup components
        if (currentTerminal) {
            unmount(currentTerminal);
            currentTerminal = null;
        }
        if (currentChat) {
            unmount(currentChat);
            currentChat = null;
        }
        
        if (socket) {
            socket.disconnect();
        }
    });

    function loadProject() {
        if (!socket || !authed || !projectId) return;

        socket.emit("get-project", { projectId }, (response) => {
            if (response.success) {
                project = response.project;
                sessions = project.sessions || [];
                activeSessions = project.activeSessions || [];
                console.log("Loaded project:", project);
                console.log("Sessions from project:", sessions);
                console.log("Active sessions from project:", activeSessions);
                
                // Check Claude authentication status when project loads
                checkClaudeAuth();
            } else {
                console.error("Failed to load project:", response.error);
                if (response.error === 'Project not found') {
                    goto('/projects');
                }
            }
        });
    }

    function checkClaudeAuth() {
        if (!socket || !authed || !projectId) return;
        
        claudeAuthState = 'checking';
        socket.emit("check-claude-auth", { projectId }, (response) => {
            if (response.success) {
                claudeAuthState = response.authenticated ? 'authenticated' : 'not-authenticated';
            } else {
                console.error("Failed to check Claude auth:", response.error);
                claudeAuthState = 'not-authenticated';
            }
        });
    }

    function startClaudeAuth() {
        if (!socket || !authed || !projectId) return;
        
        claudeAuthState = 'authenticating';
        claudeOAuthUrl = null;
        claudeAuthToken = '';
        
        socket.emit("start-claude-auth", { projectId }, (response) => {
            if (response.success) {
                claudeAuthSessionId = response.sessionId;
                console.log("Started Claude auth session:", claudeAuthSessionId);
            } else {
                console.error("Failed to start Claude auth:", response.error);
                claudeAuthState = 'not-authenticated';
            }
        });
    }

    function submitAuthToken() {
        if (!socket || !authed || !claudeAuthSessionId || !claudeAuthToken.trim()) return;
        
        socket.emit("submit-auth-token", { 
            sessionId: claudeAuthSessionId, 
            token: claudeAuthToken.trim() 
        }, (response) => {
            if (response.success) {
                console.log("Token submitted successfully");
                // Wait for claude-auth-ended event to update state
            } else {
                console.error("Failed to submit token:", response.error);
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

        // Check Claude authentication if creating a Claude session
        if (sessionMode === 'claude' && claudeAuthState !== 'authenticated') {
            nameValidation = { 
                isValid: false, 
                message: 'Claude authentication required. Please authenticate first.',
                severity: 'error'
            };
            showValidation = true;
            return;
        }

        try {
            const result = await new Promise((resolve, reject) => {
                socket.emit('create-session-in-project', {
                    projectId: projectId,
                    sessionOpts: {
                        mode: sessionMode,
                        name: sessionName.trim() || undefined,
                        workingDirectory: sessionMode === 'claude' && workingDirectory ? workingDirectory : undefined,
                        cols: 80,
                        rows: 24
                    }
                }, (response) => {
                    if (response.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response.error || 'Creation failed'));
                    }
                });
            });

            console.log('Session created successfully:', result);
            
            // Clear form
            sessionName = "";
            workingDirectory = "";
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
        if (currentTerminal) {
            unmount(currentTerminal);
            currentTerminal = null;
        }
        if (currentChat) {
            unmount(currentChat);
            currentChat = null;
        }

        socket.emit("attach", { sessionId, cols: 80, rows: 24 }, (response) => {
            if (response.success) {
                activeSessionId = sessionId;
                console.log("Attached to session:", sessionId);
                
                // Create appropriate component based on session type
                const sessionInfo = sessions.find(s => s.id === sessionId) || 
                                  activeSessions.find(s => s.sessionId === sessionId);
                
                if (sessionInfo?.type === 'claude') {
                    // Create chat component with Claude auth context
                    setTimeout(() => {
                        const chatContainer = document.getElementById('chat-container');
                        if (chatContainer) {
                            currentChat = mount(Chat, {
                                target: chatContainer,
                                props: { 
                                    sessionId, 
                                    socket,
                                    claudeAuthContext: claudeAuthContext
                                }
                            });
                        }
                    }, 100);
                } else {
                    // Create terminal component
                    setTimeout(() => {
                        const terminalContainer = document.getElementById('terminal-container');
                        if (terminalContainer) {
                            currentTerminal = mount(Terminal, {
                                target: terminalContainer,
                                props: { sessionId, socket, projectId }
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
        console.log('confirmEndSession called with sessionId:', sessionId);
        const sessionInfo = sessions.find(s => s.id === sessionId) || 
                           activeSessions.find(s => s.sessionId === sessionId);
        sessionToEnd = { id: sessionId, name: sessionInfo?.name || sessionId };
        showEndSessionDialog = true;
        console.log('showEndSessionDialog set to:', showEndSessionDialog, 'sessionToEnd:', sessionToEnd);
    }

    async function endSession() {
        console.log('endSession called, sessionToEnd:', sessionToEnd);
        if (!sessionToEnd || !socket || !authed) return;

        try {
            const result = await new Promise((resolve, reject) => {
                socket.emit('end', sessionToEnd.id, (response) => {
                    if (response?.success) {
                        resolve(response);
                    } else {
                        reject(new Error(response?.error || 'End session failed'));
                    }
                });
            });

            console.log('Session ended successfully');
            showEndSessionDialog = false;
            
            // If this was the active session, clear it
            if (sessionToEnd && activeSessionId === sessionToEnd.id) {
                activeSessionId = null;
                if (currentTerminal) {
                    unmount(currentTerminal);
                    currentTerminal = null;
                }
                if (currentChat) {
                    unmount(currentChat);
                    currentChat = null;
                }
            }
            
            sessionToEnd = null;
            
            // Reload project to update session list
            loadProject();
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
                    class="btn-icon-only"
                    on:click={backToProjects}
                    title="Back to projects"
                    aria-label="Back to projects"
                >
                    <BackIcon />
                </button>
            {/snippet}
            {#snippet right()}
                <div class="header-content">
                    <h2>{project?.name || 'Loading...'}</h2>
                    {#if project?.description}
                        <p class="project-description">{project.description}</p>
                    {/if}
                </div>
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
                                            <button
                                                class="btn-sm btn-danger"
                                                on:click={() => confirmEndSession(session.id)}
                                                title="Remove from project"
                                            >
                                                <EndSessionIcon />
                                            </button>
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
                        {#if sessionMode === 'claude'}
                            <div class="session-mode-info">
                                {#if claudeAuthState === 'checking'}
                                    <p>🔍 <strong>Checking Claude Authentication...</strong></p>
                                {:else if claudeAuthState === 'authenticated'}
                                    <p>✅ <strong>Claude AI Ready</strong></p>
                                    <p>You're authenticated and ready to create Claude sessions.</p>
                                {:else if claudeAuthState === 'not-authenticated'}
                                    <p>🤖 <strong>Claude AI Authentication Required</strong></p>
                                    <p>Click the button below to start the authentication process.</p>
                                    <button 
                                        class="btn-auth" 
                                        on:click={startClaudeAuth}
                                        disabled={!socket || !authed}
                                    >
                                        🚀 Start Authentication
                                    </button>
                                {:else if claudeAuthState === 'authenticating'}
                                    <p>⏳ <strong>Starting Authentication...</strong></p>
                                    <p>Setting up authentication session...</p>
                                {:else if claudeAuthState === 'waiting-for-token'}
                                    <p>🔗 <strong>OAuth Authentication</strong></p>
                                    <p>1. Click the link below to authenticate with Claude AI:</p>
                                    <a href={claudeOAuthUrl} target="_blank" class="oauth-link">
                                        🔗 Open Claude Authentication
                                    </a>
                                    <p>2. After completing authentication, enter your token code:</p>
                                    <div class="token-input-group">
                                        <input
                                            type="text"
                                            bind:value={claudeAuthToken}
                                            placeholder="Paste your authentication token here"
                                            class="token-input"
                                            on:keydown={(e) => e.key === "Enter" && submitAuthToken()}
                                        />
                                        <button 
                                            class="btn-submit-token" 
                                            on:click={submitAuthToken}
                                            disabled={!claudeAuthToken.trim()}
                                        >
                                            Submit Token
                                        </button>
                                    </div>
                                {/if}
                            </div>
                        {/if}
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

                    {#if sessionMode === 'claude'}
                        <DirectoryPicker
                            bind:selectedPath={workingDirectory}
                            {socket}
                            {projectId}
                            disabled={!socket || !authed}
                            on:select={(event) => {
                                workingDirectory = event.detail.path;
                            }}
                        />
                    {/if}

                    <button
                        class="btn-primary"
                        on:click={createSessionInProject}
                        disabled={(!nameValidation.isValid && !!sessionName.trim()) || (sessionMode === 'claude' && claudeAuthState !== 'authenticated')}
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
    open={showEndSessionDialog}
    title="End Session"
    message="Are you sure you want to end session '{sessionToEnd?.name}'? This will terminate the session and you may lose unsaved work."
    confirmText="End Session"
    cancelText="Cancel"
    onConfirm={endSession}
    onCancel={cancelEndSession}
    onClose={cancelEndSession}
/>

<style>
    .header-content {
        text-align: center;
        flex: 1;
    }

    .header-content h1 {
        margin: 0;
        color: var(--text-primary);
    }

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

    .session-mode-info {
        margin-top: var(--space-xs);
        padding: var(--space-sm);
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        border-radius: 4px;
        font-size: 0.8rem;
    }

    .session-mode-info p {
        margin: 0;
        margin-bottom: var(--space-xs);
        color: #ffc107;
    }

    .session-mode-info p:last-child {
        margin-bottom: 0;
    }

    .session-mode-info strong {
        color: var(--accent);
    }

    .btn-auth {
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
        margin-top: var(--space-xs);
    }

    .btn-auth:hover:not(:disabled) {
        background: rgba(0, 255, 136, 0.8);
    }

    .btn-auth:disabled {
        background: rgba(0, 255, 136, 0.3);
        cursor: not-allowed;
    }

    .oauth-link {
        display: inline-block;
        background: rgba(0, 123, 255, 0.1);
        color: #007bff;
        text-decoration: none;
        padding: var(--space-xs) var(--space-sm);
        border: 1px solid rgba(0, 123, 255, 0.3);
        border-radius: 4px;
        margin: var(--space-xs) 0;
        font-weight: 500;
        transition: all 0.2s ease;
    }

    .oauth-link:hover {
        background: rgba(0, 123, 255, 0.2);
        border-color: #007bff;
        text-decoration: none;
    }

    .token-input-group {
        display: flex;
        gap: var(--space-xs);
        margin-top: var(--space-xs);
    }

    .token-input {
        flex: 1;
        padding: var(--space-xs) var(--space-sm);
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 4px;
        color: var(--text-primary);
        font-size: 0.9rem;
        font-family: 'Courier New', monospace;
    }

    .token-input:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 2px rgba(0, 255, 136, 0.1);
    }

    .btn-submit-token {
        padding: var(--space-xs) var(--space-sm);
        background: var(--accent);
        color: var(--bg);
        border: none;
        border-radius: 4px;
        font-weight: 500;
        font-size: 0.9rem;
        cursor: pointer;
        transition: background-color 0.2s ease;
        white-space: nowrap;
    }

    .btn-submit-token:hover:not(:disabled) {
        background: rgba(0, 255, 136, 0.8);
    }

    .btn-submit-token:disabled {
        background: rgba(0, 255, 136, 0.3);
        cursor: not-allowed;
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