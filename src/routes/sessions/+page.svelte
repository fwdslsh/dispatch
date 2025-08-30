<script>
    import { onMount, onDestroy } from "svelte";
    import { io } from "socket.io-client";
    import { goto } from "$app/navigation";
    import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
    import Container from "$lib/components/Container.svelte";
    import BackIcon from "$lib/components/Icons/BackIcon.svelte";
    import EndSessionIcon from "$lib/components/Icons/EndSessionIcon.svelte";
    import SessionIcon from "$lib/components/Icons/SessionIcon.svelte";
    import StartSession from "$lib/components/Icons/StartSession.svelte";
    import ConfirmationDialog from "$lib/components/ConfirmationDialog.svelte";
    import PublicUrlDisplay from "$lib/components/PublicUrlDisplay.svelte";
    import { validateSessionNameRealtime, validateSessionNameWithFeedback } from "$lib/utils/session-name-validation.js";

    let sessions = [];
    let active = null;
    let sessionMode = "bash"; // Default session mode
    let sessionName = ""; // Custom session name input
    
    // Validation state
    let nameValidation = { isValid: true };
    let showValidation = false;

    export let data;
    
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

    function connectSocket() {
        socket = io({ transports: ["websocket", "polling"] });

        socket.on("connect", () => {
            const storedAuth = localStorage.getItem("dispatch-auth-token");
            if (storedAuth) {
                const authKey = storedAuth === "no-auth" ? "" : storedAuth;
                socket.emit("auth", authKey, (res) => {
                    authed = !!(res && res.ok);
                    if (!authed) {
                        // Auth failed, redirect to login
                        localStorage.removeItem("dispatch-auth-token");
                        goto("/");
                        return;
                    }
                });
            } else {
                // No stored auth, redirect to login
                goto("/");
                return;
            }

            socket.emit("list", (resp) => {
                if (resp.ok) {
                    sessions = resp.sessions || [];
                    active = resp.active || null;
                }
            });
        });

        socket.on("sessions-updated", (data) => {
            sessions = data.sessions || [];
            active = data.active || null;
        });
    }

    function disconnectSocket() {
        socket?.disconnect();
        socket = null;
    }

    function addSession() {
        // Validate name before creating session
        if (!validateBeforeSubmit()) {
            return; // Don't create session if validation fails
        }
        
        const opts = { 
            mode: sessionMode, 
            cols: 80, 
            rows: 24,
            name: sessionName.trim() || undefined // Include name if provided
        };
        socket.emit("create", opts, (resp) => {
            if (resp.ok) {
                // Clear the name input and validation state after successful creation
                sessionName = "";
                nameValidation = { isValid: true };
                showValidation = false;
                goto(`/sessions/${resp.sessionId}`);
            } else {
                alert("Failed to create session: " + (resp.error || "unknown"));
            }
        });
    }

    function switchSession(id) {
        goto(`/sessions/${id}`);
    }

    function showEndDialog(id) {
        sessionToEnd = id;
        showEndSessionDialog = true;
    }

    function endSession() {
        if (sessionToEnd) {
            socket.emit("end", sessionToEnd);
            sessionToEnd = null;
        }
    }

    function closeEndDialog() {
        showEndSessionDialog = false;
        sessionToEnd = null;
    }

    function logout() {
        // Clear authentication token
        localStorage.removeItem("dispatch-auth-token");
        // Disconnect socket
        disconnectSocket();
        // Redirect to login page
        goto("/");
    }

    onMount(connectSocket);
    onDestroy(disconnectSocket);
</script>

<Container>
    {#snippet header()}
        <HeaderToolbar>
            {#snippet left()}
                {#if data.hasTerminalKey}
                <button
                    class="button-secondary logout-btn btn-icon-only"
                    on:click={logout}
                    title="Logout"
                    aria-label="Logout"
                >
                    <!-- <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                        <polyline points="16,17 21,12 16,7"/>
                        <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg> -->

                    <BackIcon />
                </button>
                {:else}
                <h2 class="error-text">No key set</h2>
                {/if}
            {/snippet}

            {#snippet right()}
                <h2>sessions</h2>
            {/snippet}
        </HeaderToolbar>
    {/snippet}

    {#snippet children()}
        <div class="sessions">
            {#if sessions.length === 0}
                <div class="empty-state">
                    <h2>no active sessions</h2>
                    <p style="font-size: 0.9rem;">
                        create a new session to get started
                    </p>
                </div>
            {:else}
                <ul>
                    {#each sessions as session}
                        <li>
                            <div
                                class="session-item"
                                data-augmented-ui="tl-clip tr-clip br-clip bl-clip both"
                                on:click={() => switchSession(session.id)}
                                role="button"
                                tabindex="0"
                                on:keydown={(e) => e.key === 'Enter' && switchSession(session.id)}
                                title="Open session"
                                aria-label="Open session {session.name}"
                            >
                                <div class="session-actions">
                                    <button
                                        class="button-danger btn-sm btn-icon-only"
                                        on:click={(e) => {
                                            e.stopPropagation();
                                            showEndDialog(session.id);
                                        }}
                                        title="End session"
                                        aria-label="End session"
                                    >
                                        <EndSessionIcon />
                                    </button>
                                </div>
                                <div class="session-name">
                                    {session.name}
                                    {#if active === session.id}
                                        <span class="session-status"
                                            >(active)</span
                                        >
                                    {/if}
                                </div>
                                <button
                                    class="btn-sm btn-icon-only"
                                    on:click={(e) => {
                                        e.stopPropagation();
                                        switchSession(session.id);
                                    }}
                                    title="Open session"
                                    aria-label="Open session"
                                >
                                    <SessionIcon />
                                    <!-- <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                    >
                                        <polygon points="5,3 19,12 5,21" />
                                    </svg> -->
                                </button>
                            </div>
                        </li>
                    {/each}
                </ul>
            {/if}
        </div>
    {/snippet}

    {#snippet footer()}

        <PublicUrlDisplay />
        <div class="new-session-form">
            <div class="session-name-input">
                <input
                    type="text"
                    placeholder="session name (optional)"
                    bind:value={sessionName}
                    maxlength="50"
                    autocomplete="off"
                    class:error={!nameValidation.isValid}
                    class:warning={nameValidation.isValid && nameValidation.severity === 'warning'}
                    on:keydown={(e) => e.key === 'Enter' && addSession()}
                />
                {#if showValidation && nameValidation.message}
                    <div 
                        class="validation-message"
                        class:error={nameValidation.severity === 'error'}
                        class:warning={nameValidation.severity === 'warning'}
                        class:info={nameValidation.severity === 'info'}
                    >
                        {nameValidation.message}
                    </div>
                {/if}
            </div>
            <div class="new-session-controls">
                <select bind:value={sessionMode}>
                    <option value="bash">bash mode</option>
                    <option value="claude">claude mode</option>
                    <option value="qwen">qwen mode</option>
                    <option value="gemini">gemini mode</option>
                </select>
                <button
                    class="btn-icon-only"
                    on:click={addSession}
                    title="Create new session"
                    aria-label="Create new session"
                >
                    <StartSession />
                </button>
            </div>
        </div>
    {/snippet}
</Container>

<!-- Confirmation Dialog for ending sessions -->
<ConfirmationDialog
    open={showEndSessionDialog}
    title="End Session"
    message="Are you sure you want to end this session? All unsaved work will be lost."
    confirmText="End Session"
    cancelText="Cancel"
    onConfirm={endSession}
    onClose={closeEndDialog}
/>

<style>
    .sessions {
        flex: 1; /* Take up remaining space on desktop too */
        max-height: 400px; /* Limit height on desktop for scrolling */
        overflow-y: auto;
        padding: var(--space-md);
    }

    .sessions ul {
        margin: 0;
        padding: 0;
        list-style: none;
    }

    .empty-state {
        text-align: center;
        padding: 2rem;
        color: var(--text-muted);
        backdrop-filter: blur(10px);
        margin: var(--space-md);
    }
    
    .empty-state p:first-child {
        font-size: 1.2rem;
        color: var(--text-secondary);
        margin-bottom: var(--space-sm);
    }
    
    select {
        padding-inline-start: var(--space-md);
    }

    .new-session-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
        margin-top: var(--space-md);
    }

    .session-name-input {
        display: flex;
        justify-content: center;
    }

    .session-name-input input {
        width: 100%;
        max-width: 300px;
        padding: var(--space-sm) var(--space-md);
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 0.9rem;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
    }

    .session-name-input input::placeholder {
        color: var(--text-muted);
    }

    .session-name-input input:focus {
        outline: none;
        border-color: rgba(0, 255, 136, 0.6);
        box-shadow: 
            0 0 12px rgba(0, 255, 136, 0.15),
            0 0 24px rgba(0, 255, 136, 0.05);
        background: rgba(26, 26, 26, 0.9);
    }

    .session-name-input input:hover:not(:focus) {
        border-color: rgba(0, 255, 136, 0.4);
        background: rgba(26, 26, 26, 0.85);
    }

    .session-name-input input.error {
        border-color: rgba(255, 82, 82, 0.6);
        background: rgba(26, 26, 26, 0.9);
    }

    .session-name-input input.error:focus {
        border-color: rgba(255, 82, 82, 0.8);
        box-shadow: 
            0 0 12px rgba(255, 82, 82, 0.2),
            0 0 24px rgba(255, 82, 82, 0.1);
    }

    .session-name-input input.warning {
        border-color: rgba(255, 193, 7, 0.5);
    }

    .session-name-input input.warning:focus {
        border-color: rgba(255, 193, 7, 0.7);
        box-shadow: 
            0 0 12px rgba(255, 193, 7, 0.15),
            0 0 24px rgba(255, 193, 7, 0.05);
    }

    .validation-message {
        font-size: 0.75rem;
        margin-top: var(--space-xs);
        text-align: center;
        padding: var(--space-xs) var(--space-sm);
        border-radius: 4px;
        backdrop-filter: blur(10px);
    }

    .validation-message.error {
        color: rgba(255, 82, 82, 0.9);
        background: rgba(255, 82, 82, 0.1);
        border: 1px solid rgba(255, 82, 82, 0.2);
    }

    .validation-message.warning {
        color: rgba(255, 193, 7, 0.9);
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.2);
    }

    .validation-message.info {
        color: rgba(0, 255, 136, 0.8);
        background: rgba(0, 255, 136, 0.05);
        border: 1px solid rgba(0, 255, 136, 0.2);
    }

    .new-session-controls {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: var(--space-md);
    }

    @media (max-width: 768px) {
        .sessions {
            max-height: none; /* Allow full height on mobile */
            flex: 1; /* Take up remaining space */
            overflow-y: auto; /* Enable scrolling */
            padding: var(--space-sm); /* Reduce padding on mobile */
            padding-top: var(--space-md); /* Reduced since header auto-hides */
        }

        .new-session-form {
            padding: var(--space-sm);
            gap: var(--space-sm);
            background: rgba(26, 26, 26, 0.95);
            backdrop-filter: blur(10px);
            border-top: 1px solid rgba(0, 255, 136, 0.2);
            margin-top: var(--space-sm); /* Add space between PublicUrlDisplay and form */
        }
        
        .session-name-input input {
            max-width: none;
            font-size: 0.85rem;
        }
        
        .new-session-controls {
            gap: var(--space-sm);
        }
    }
</style>
