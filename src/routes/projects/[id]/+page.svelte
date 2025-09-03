<script>
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { io } from "socket.io-client";
  import { goto } from "$app/navigation";
  import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
  import SessionPanel from "$lib/components/project/SessionPanel.svelte";
  import SessionContent from "$lib/components/project/SessionContent.svelte";
  import { ProjectViewModel } from "$lib/components/project/ProjectViewModel.svelte.js";

  let { data } = $props();
  let projectId = $derived(page.params.id);

  // ViewModel
  const viewModel = new ProjectViewModel();
  // Simple reactive state  
  let socket = $state(null);
  let authed = $state(false);
  let showChat = $state(false);
  let activeSession = $derived.by(() => {
    // Only return a session if we have a valid activeSessionId
    if (!viewModel.state.activeSessionId) {
      return null;
    }
    
    const session = viewModel.state.sessions.find(s => s.id === viewModel.state.activeSessionId);
    return session || null;
  });

  

  onMount(() => {
    if (!projectId) {
      goto("/projects");
      return;
    }

    // Initialize socket
    socket = io();
    
    socket.on("connect", () => {
      // Get stored auth token from login
      const storedAuth = localStorage.getItem("dispatch-auth-token");
      const authKey = storedAuth === "no-auth" ? "" : storedAuth || "testkey12345";
      
      socket.emit("auth", authKey, (response) => {
        console.log('Auth response:', response);
        if (response?.ok || response?.success) {
          authed = true;
          console.log('Authentication successful, loading project:', projectId);
          viewModel.loadProject(projectId, socket);
        } else {
          console.error('Authentication failed:', response);
        }
      });
    });

    socket.on("sessions-updated", (sessions) => {
      viewModel.updateSessionsList(sessions);
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  });

  function handleSessionSelect(sessionId) {
    viewModel.setActiveSession(sessionId);
  }

  function handleSessionCreate() {
    // Simple session creation
    socket.emit("create", {
      mode: "shell",
      cols: 80,
      rows: 24,
      project: projectId
    }, (response) => {
      if (response.success) {
        viewModel.loadSessions(socket);
      }
    });
  }

  function handleSessionEnd(sessionId) {
    socket.emit("end", sessionId, (response) => {
      if (response.success) {
        if (viewModel.state.activeSessionId === sessionId) {
          viewModel.setActiveSession(null);
        }
        viewModel.loadSessions(socket);
      }
    });
  }

  function toggleChat() {
    showChat = !showChat;
  }
</script>

{#if viewModel.state.project}
  <HeaderToolbar title={viewModel.state.project.name} />
{/if}

<main class="project-layout">
  {#if authed && viewModel.state.project}
    <div class="project-view">
      <SessionPanel
        sessions={viewModel.state.sessions}
        activeSessions={viewModel.state.activeSessions}
        activeSessionId={viewModel.state.activeSessionId}
        onSessionSelect={handleSessionSelect}
        onSessionCreate={handleSessionCreate}
        onSessionEnd={handleSessionEnd}
      />
      
      <SessionContent
        session={activeSession}
        {socket}
        {projectId}
        {showChat}
        onChatToggle={toggleChat}
      />
    </div>
  {:else if viewModel.state.loading}
    <div class="loading">Loading project...</div>
  {:else if viewModel.state.error}
    <div class="error">
      <div>Error: {viewModel.state.error}</div>
      <div>Debug: authed={authed}, projectId={projectId}, socket={!!socket}</div>
    </div>
  {:else}
    <div class="loading">
      <div>Connecting...</div>
      <div>Debug: authed={authed}, projectId={projectId}, socket={!!socket}</div>
    </div>
  {/if}
</main>

<style>
  .project-layout {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .project-view {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .loading, .error {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text);
  }

  .error {
    color: var(--error);
  }

  @media (max-width: 768px) {
    .project-view {
      flex-direction: column;
    }
  }
</style>