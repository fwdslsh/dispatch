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
            <button class="button-secondary logout-btn" on:click={logout}>
                logout
            </button>
        {/snippet}
    </HeaderToolbar>

    <div class="sessions">
        <div class="new-session-controls">
            <select bind:value={sessionMode}>
                <option value="claude">claude mode</option>
                <option value="bash">bash mode</option>
            </select>
            <button on:click={addSession}>+ create new session</button>
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
                                    class="button-secondary"
                                    on:click={() => switchSession(session.id)}
                                >
                                    open
                                </button>
                                <button
                                    class="button-danger"
                                    on:click={() => endSession(session.id)}
                                >
                                    end
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