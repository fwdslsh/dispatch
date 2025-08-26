<script>
  import { goto } from "$app/navigation";
  import { io } from "socket.io-client";
  import { onMount } from "svelte";
  import Container from "$lib/components/Container.svelte";
  let key = "";
  let error = "";
  let loading = false;

  onMount(() => {
    // Check if already authenticated
    const storedAuth = localStorage.getItem("dispatch-auth-token");
    if (storedAuth) {
      goto("/sessions");
      return;
    }

    // Check if auth is required by testing with empty key
    const socket = io({ transports: ["websocket", "polling"] });
    socket.emit("auth", "", (resp) => {
      if (resp.ok) {
        // No auth required, redirect to sessions
        localStorage.setItem("dispatch-auth-token", "no-auth");
        goto("/sessions");
      }
      socket.disconnect();
    });
  });

  async function handleLogin(e) {
    e.preventDefault();
    loading = true;
    error = "";
    const socket = io({ transports: ["websocket", "polling"] });
    socket.emit("auth", key, (resp) => {
      loading = false;
      if (resp.ok) {
        localStorage.setItem("dispatch-auth-token", key);
        goto("/sessions");
      } else {
        error = resp.error || "Invalid key";
      }
      socket.disconnect();
    });
  }
</script>

<svelte:head>
  <title>dispatch - Terminal Access</title>
</svelte:head>

<main class="login-page">
  <Container>
    {#snippet children()}
      <h1>dispatch</h1>
      <p>terminal access via web</p>

      <div class="form-container">
        <form on:submit={handleLogin}>
          <input
            type="password"
            placeholder="terminal key"
            bind:value={key}
            required
            autocomplete="off"
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? "connecting..." : "connect"}
          </button>
        </form>
      </div>
      {#if error}
        <div class="error">{error}</div>
      {/if}
    {/snippet}
  </Container>
</main>

<style>
  :global(.login-page .container-content) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    h1,
    p {
      text-align: center;
    }
  }
  @media (max-width: 800px) {
    .login-page :global(.container) {
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding-inline: var(--space-lg);

      h1{
        font-size: 5rem;
      }
    }
  }
  .form-container {
    margin-top: var(--space-lg);
    width: 100%;
    display: flex;
    justify-content: center;
  }

  /* Enhanced form styling */
  form {
    background: rgba(0, 0, 0, 0.1);
    padding: var(--space-xl);
    border-radius: 12px;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.05);
    box-shadow:
      0 8px 25px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }
</style>
