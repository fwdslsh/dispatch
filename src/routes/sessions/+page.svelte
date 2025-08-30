<script>
    import { onMount, onDestroy } from "svelte";
    import { io } from "socket.io-client";
    import { goto } from "$app/navigation";
    import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
    import Container from "$lib/components/Container.svelte";
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

    // Rename state
    let editingSessionId = null;
    let editingSessionName = "";
    let showRenameValidation = false;
    let renameValidation = { isValid: true };

    function loadSessions() {
        if (socket) {
            socket.emit("list", (resp) => {
                if (resp.ok) {
                    sessions = resp.sessions || [];
                    active = resp.active || null;
                }
            });
        }
    }

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
                    // Load sessions after authentication
                    loadSessions();
                });
            } else {
                // No stored auth, try empty key (for development mode)
                socket.emit("auth", "", (res) => {
                    if (res && res.ok) {
                        // No auth required, set token and continue
                        localStorage.setItem("dispatch-auth-token", "no-auth");
                        authed = true;
                        loadSessions();
                    } else {
                        // Auth required, redirect to login
                        goto("/");
                    }
                });
            }
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
            name: sessionName.trim() || undefined, // Include name if provided
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

    function startRenaming(sessionId, currentName) {
        editingSessionId = sessionId;
        editingSessionName = currentName;
        showRenameValidation = false;
        renameValidation = { isValid: true };
    }

    function cancelRename() {
        editingSessionId = null;
        editingSessionName = "";
        showRenameValidation = false;
        renameValidation = { isValid: true };
    }

    function saveRename() {
        const validation = validateSessionNameWithFeedback(editingSessionName);
        renameValidation = validation;
        showRenameValidation = !validation.isValid;

        if (!validation.isValid) {
            return;
        }

        // Send rename request to backend
        socket.emit(
            "rename",
            {
                sessionId: editingSessionId,
                newName: editingSessionName.trim(),
            },
            (resp) => {
                if (resp.success) {
                    // Success - clear editing state
                    cancelRename();
                    // Sessions will be updated via sessions-updated event
                } else {
                    alert(
                        "Failed to rename session: " +
                            (resp.error || "unknown"),
                    );
                }
            },
        );
    }

    function logout() {
        // Clear authentication token
        localStorage.removeItem("dispatch-auth-token");
        // Disconnect socket
        disconnectSocket();
        // Redirect to login page
        goto("/");
    }

    onMount(() => {
        // Connect to socket
        connectSocket();
    });
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
                                on:keydown={(e) =>
                                    e.key === "Enter" &&
                                    switchSession(session.id)}
                                title="Open session"
                                aria-label="Open session {session.name}"
                            >
                                <div class="session-actions">
                                    <button
                                        class="btn-sm btn-icon-only session-rename-btn"
                                        on:click={(e) => {
                                            e.stopPropagation();
                                            startRenaming(
                                                session.id,
                                                session.name,
                                            );
                                        }}
                                        title="Rename session"
                                        aria-label="Rename session"
                                    >
                                        <svg
                                            viewBox="0 0 24 24"
                                            fill="none"
                                            stroke="currentColor"
                                            stroke-width="2"
                                        >
                                            <path
                                                d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                                            />
                                            <path
                                                d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                                            />
                                        </svg>
                                    </button>
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
                                    {#if editingSessionId === session.id}
                                        <div class="session-rename-form">
                                            <input
                                                type="text"
                                                on:click={(e) =>
                                                    e.stopPropagation()}
                                                bind:value={editingSessionName}
                                                class="session-rename-input"
                                                class:error={!renameValidation.isValid}
                                                class:warning={renameValidation.isValid &&
                                                    renameValidation.severity ===
                                                        "warning"}
                                                on:keydown={(e) => {
                                                    if (e.key === "Enter")
                                                        saveRename();
                                                    if (e.key === "Escape")
                                                        cancelRename();
                                                }}
                                                placeholder="Session name"
                                                maxlength="50"
                                                autocomplete="off"
                                            />
                                            <div class="rename-actions">
                                                <button
                                                    class="btn-sm rename-save"
                                                    on:click={saveRename}
                                                    title="Save">✓</button
                                                >
                                                <button
                                                    class="btn-sm rename-cancel"
                                                    on:click={cancelRename}
                                                    title="Cancel">✕</button
                                                >
                                            </div>
                                            {#if showRenameValidation && renameValidation.message}
                                                <div
                                                    class="rename-validation-message"
                                                    class:error={renameValidation.severity ===
                                                        "error"}
                                                    class:warning={renameValidation.severity ===
                                                        "warning"}
                                                    class:info={renameValidation.severity ===
                                                        "info"}
                                                >
                                                    {renameValidation.message}
                                                </div>
                                            {/if}
                                        </div>
                                    {:else}
                                        {session.name}
                                        {#if active === session.id}
                                            <span class="session-status"
                                                >(active)</span
                                            >
                                        {/if}
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
        <div class="footer-content">
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
                        class:warning={nameValidation.isValid &&
                            nameValidation.severity === "warning"}
                        on:keydown={(e) =>
                            e.key === "Enter" && addSession()}
                    />
                    {#if showValidation && nameValidation.message}
                        <div
                            class="validation-message"
                            class:error={nameValidation.severity ===
                                "error"}
                            class:warning={nameValidation.severity ===
                                "warning"}
                            class:info={nameValidation.severity === "info"}
                        >
                            {nameValidation.message}
                        </div>
                    {/if}
                </div>
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
        padding: var(--space-sm) var(--space-md);
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 0.9rem;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
        cursor: pointer;
        min-width: 120px;
    }

    select:focus {
        outline: none;
        border-color: rgba(0, 255, 136, 0.6);
        box-shadow:
            0 0 12px rgba(0, 255, 136, 0.15),
            0 0 24px rgba(0, 255, 136, 0.05);
        background: rgba(26, 26, 26, 0.9);
    }

    select:hover:not(:focus) {
        border-color: rgba(0, 255, 136, 0.4);
        background: rgba(26, 26, 26, 0.85);
    }

    select option {
        background: rgba(26, 26, 26, 0.95);
        color: var(--text-primary);
    }

    .new-session-form {
        display: grid;
        gap: var(--space-sm);
        grid-template-columns: 1fr auto auto; /* Input takes remaining space, select and button are auto-sized */
        align-items: center;
    }

    .session-name-input {
        position: relative; /* For validation message positioning */
    }

    /* Validation message positioning */
    .validation-message {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        z-index: 10;
    }

    .session-name-input input {
        width: 100%;
        padding: var(--space-sm) var(--space-md);
        background: rgba(26, 26, 26, 0.8);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 6px;
        color: var(--text-primary);
        font-size: 0.9rem;
        transition: all 0.3s ease;
        backdrop-filter: blur(10px);
        min-width: 0; /* Allow grid item to shrink */
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

    .footer-content {
        display: grid;
        gap: var(--space-md);
        grid-template-rows: auto auto; /* Stack vertically by default */
    }


    /* Responsive adjustments */
    @media (max-width: 768px) {
        .sessions {
            max-height: unset;
            padding: var(--space-sm);
            padding-top: calc(56px + var(--space-sm)); /* Account for fixed header height */
        }

        .footer-content {
            padding: var(--space-md) var(--space-sm);
            background: rgba(26, 26, 26, 0.95);
            backdrop-filter: blur(10px);
            border-top: 1px solid rgba(0, 255, 136, 0.2);
        }

        .new-session-form {
            grid-template-columns: 1fr;
            grid-template-rows: auto auto auto;
            gap: var(--space-sm);
            text-align: center;
        }

        .session-name-input input {
            font-size: 0.85rem;
        }

        select {
            font-size: 0.85rem;
            min-width: 100px;
        }
    }

    /* Session rename styles */
    .session-rename-btn {
        opacity: 0.7;
        transition: opacity 0.2s ease;
    }

    .session-rename-btn:hover {
        opacity: 1;
        color: var(--primary);
    }

    .session-rename-btn svg {
        width: 14px;
        height: 14px;
    }

    .session-rename-form {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
        width: 100%;
    }

    .session-rename-input {
        background: rgba(26, 26, 26, 0.9);
        border: 1px solid rgba(0, 255, 136, 0.3);
        border-radius: 4px;
        color: var(--text-primary);
        padding: var(--space-xs) var(--space-sm);
        font-size: 0.9rem;
        width: 100%;
        transition: all 0.2s ease;
    }

    .session-rename-input:focus {
        outline: none;
        border-color: rgba(0, 255, 136, 0.6);
        box-shadow: 0 0 8px rgba(0, 255, 136, 0.1);
    }

    .session-rename-input.error {
        border-color: rgba(255, 82, 82, 0.6);
    }

    .session-rename-input.warning {
        border-color: rgba(255, 193, 7, 0.5);
    }

    .rename-actions {
        display: flex;
        gap: var(--space-xs);
    }

    .rename-save,
    .rename-cancel {
        padding: var(--space-xs);
        border: 1px solid;
        border-radius: 3px;
        font-size: 0.8rem;
        min-width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .rename-save {
        background: rgba(0, 255, 136, 0.1);
        border-color: rgba(0, 255, 136, 0.3);
        color: rgba(0, 255, 136, 0.9);
    }

    .rename-save:hover {
        background: rgba(0, 255, 136, 0.2);
        border-color: rgba(0, 255, 136, 0.5);
    }

    .rename-cancel {
        background: rgba(255, 82, 82, 0.1);
        border-color: rgba(255, 82, 82, 0.3);
        color: rgba(255, 82, 82, 0.9);
    }

    .rename-cancel:hover {
        background: rgba(255, 82, 82, 0.2);
        border-color: rgba(255, 82, 82, 0.5);
    }

    .rename-validation-message {
        font-size: 0.75rem;
        padding: var(--space-xs);
        border-radius: 3px;
        margin-top: var(--space-xs);
    }

    .rename-validation-message.error {
        color: rgba(255, 82, 82, 0.9);
        background: rgba(255, 82, 82, 0.1);
        border: 1px solid rgba(255, 82, 82, 0.2);
    }

    .rename-validation-message.warning {
        color: rgba(255, 193, 7, 0.9);
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.2);
    }

    .rename-validation-message.info {
        color: rgba(0, 255, 136, 0.8);
        background: rgba(0, 255, 136, 0.05);
        border: 1px solid rgba(0, 255, 136, 0.2);
    }
</style>
