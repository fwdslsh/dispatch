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

    let sessions = [];
    let active = null;
    let sessionMode = "bash"; // Default session mode

    export let data;
    
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
        const opts = { mode: sessionMode, cols: 80, rows: 24 };
        socket.emit("create", opts, (resp) => {
            if (resp.ok) {
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
                <!-- <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                </svg> -->
            </button>
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
</style>
