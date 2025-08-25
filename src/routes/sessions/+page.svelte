<script>
    import { onMount, onDestroy } from "svelte";
    import { io } from "socket.io-client";
    import { goto } from "$app/navigation";
    import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";

    let sessions = [];
    let active = null;
    let sessionMode = "claude"; // Default session mode

    let socket;
    let authed = false;

    function connectSocket() {
        socket = io({ transports: ["websocket", "polling"] });

        socket.on("connect", () => {
            const storedAuth = localStorage.getItem("dispatch-auth-token");
            if (storedAuth) {
                socket.emit("auth", storedAuth, (res) => {
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

    function endSession(id) {
        socket.emit("end", id);
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

<div class="container">
    <HeaderToolbar>
        {#snippet left()}
            <h2>sessions</h2>
        {/snippet}

        {#snippet right()}
            <button class="button-secondary logout-btn btn-icon-only" on:click={logout} title="Logout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                    <polyline points="16,17 21,12 16,7"/>
                    <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
            </button>
        {/snippet}
    </HeaderToolbar>

    <div class="sessions">
        <div class="new-session-controls">
            <select bind:value={sessionMode}>
                <option value="claude">claude mode</option>
                <option value="bash">bash mode</option>
            </select>
            <button class="btn-icon-only" on:click={addSession} title="Create new session">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="16"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                </svg>
            </button>
        </div>

        {#if sessions.length === 0}
            <div
                style="text-align: center; padding: 2rem; color: var(--text-muted);"
            >
                <p>no active sessions</p>
                <p style="font-size: 0.9rem;">
                    create a new session to get started
                </p>
            </div>
        {:else}
            <ul>
                {#each sessions as session}
                    <li>
                        <div class="session-item">
                            <div class="session-name">
                                {session.name}
                                {#if active === session.id}
                                    <span class="session-status">(active)</span>
                                {/if}
                            </div>
                            <div class="session-actions">
                                <button
                                    class="button-secondary btn-sm btn-icon-only"
                                    on:click={() => switchSession(session.id)}
                                    title="Open session"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <polygon points="5,3 19,12 5,21"/>
                                    </svg>
                                </button>
                                <button
                                    class="button-danger btn-sm btn-icon-only"
                                    on:click={() => endSession(session.id)}
                                    title="End session"
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                        <line x1="18" y1="6" x2="6" y2="18"/>
                                        <line x1="6" y1="6" x2="18" y2="18"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </li>
                {/each}
            </ul>
        {/if}
    </div>
</div>
<style>
    .sessions{
        padding-inline: 1rem;
        padding-top: 1rem;
    }
</style>