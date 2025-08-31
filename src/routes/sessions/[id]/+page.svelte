<script>
  import Terminal from "$lib/components/Terminal.svelte";
  import Chat from "$lib/components/Chat.svelte";
  import HeaderToolbar from "$lib/components/HeaderToolbar.svelte";
  import Container from "$lib/components/Container.svelte";
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { browser } from "$app/environment";
  import { io } from "socket.io-client";
  import { AnsiUp } from "ansi_up";
  import BackIcon from "$lib/components/Icons/BackIcon.svelte";
  import EndSessionIcon from "$lib/components/Icons/EndSessionIcon.svelte";
  import ConfirmationDialog from "$lib/components/ConfirmationDialog.svelte";
  import TerminalReadonly from "$lib/components/TerminalReadonly.svelte";

  let authed = false;
  let sessionId;
  let socket;
  let chatView = false;
  let ansiUp;

  // Dialog state
  let showEndSessionDialog = false;

  // Constants for history management
  const MAX_CHAT_EVENTS = 300000; // Maximum number of events to keep for chat
  const MAX_TERMINAL_BUFFER_LENGTH = 500000; // Maximum terminal buffer length in characters

  // Unified session history - single source of truth
  let sessionHistory = {
    // All terminal I/O as structured events
    events: [],
    // Raw terminal buffer for terminal view
    terminalBuffer: "",
    // Current partial input/output being built
    currentInput: "",
    currentOutput: "",
  };

  onMount(() => {
    // Initialize AnsiUp for processing terminal output
    ansiUp = new AnsiUp();
    ansiUp.use_classes = true;

    if (browser) {
      const storedAuth = localStorage.getItem("dispatch-auth-token");
      if (storedAuth) {
        authed = true;
        sessionId = page.params.id;
        // Create socket connection for end session functionality

        socket = io(import.meta.env.DEV ? "http://localhost:3030" : undefined, { transports: ["websocket", "polling"] });
        const authKey = storedAuth === "no-auth" ? "" : storedAuth;
        socket.emit("auth", authKey, (res) => {
          console.debug("Session page: auth response:", res);
          if (res && res.ok) {
            // Now attach to the session so chat can send/receive data
            const dims = { cols: 80, rows: 24 }; // Default dimensions for chat
            console.debug(
              "Session page: attempting to attach to session:",
              sessionId,
            );
            socket.emit("attach", { sessionId, ...dims }, (resp) => {
              if (resp && resp.ok) {
                console.debug("Socket attached to session successfully");
              } else {
                console.error("Failed to attach socket to session:", resp);
                // If session doesn't exist, redirect to sessions page
                if (resp && resp.error === "Session not found") {
                  console.debug(
                    "Session not found, redirecting to sessions page",
                  );
                  goto("/sessions");
                }
              }
            });
          }
        });
      } else {
        goto("/");
        return;
      }
    }
  });

  function showEndDialog() {
    showEndSessionDialog = true;
  }

  function endSession() {
    if (sessionId && socket) {
      socket.emit("end", sessionId);
      // Redirect immediately, server will handle cleanup
      goto("/sessions");
    } else {
      // No session to end, just go back
      goto("/sessions");
    }
  }

  function closeEndDialog() {
    showEndSessionDialog = false;
  }

  function toggleView() {
    chatView = !chatView;
    console.debug("View toggled to:", chatView ? "chat" : "terminal");
  }

  // UUID fallback for non-secure contexts
  function generateUUID() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID generator for non-secure contexts
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c == "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  // Unified history management functions
  function addInputEvent(input) {
    const event = {
      type: "input",
      content: input,
      timestamp: new Date(),
      id: generateUUID(),
    };
    sessionHistory.events = [...sessionHistory.events, event];

    // Trim events if needed
    trimEventsIfNeeded();

    console.debug("Added input event:", input);
  }

  function addOutputEvent(output) {
    const event = {
      type: "output",
      content: output,
      timestamp: new Date(),
      id: generateUUID(),
    };
    sessionHistory.events = [...sessionHistory.events, event];

    // Trim events if needed
    trimEventsIfNeeded();

    console.debug("Added output event, length:", output.length);
  }

  function trimEventsIfNeeded() {
    if (sessionHistory.events.length > MAX_CHAT_EVENTS) {
      const eventsToRemove = sessionHistory.events.length - MAX_CHAT_EVENTS;
      sessionHistory.events = sessionHistory.events.slice(eventsToRemove);
      console.debug(
        `Trimmed ${eventsToRemove} chat events, now have ${sessionHistory.events.length} events`,
      );
    }
  }

  function updateTerminalBuffer(buffer) {
    sessionHistory.terminalBuffer = buffer;

    // Trim terminal buffer if it gets too large
    if (sessionHistory.terminalBuffer.length > MAX_TERMINAL_BUFFER_LENGTH) {
      // Keep the last portion of the buffer
      const keepLength = Math.floor(MAX_TERMINAL_BUFFER_LENGTH * 0.8); // Keep 80% when trimming
      sessionHistory.terminalBuffer =
        sessionHistory.terminalBuffer.slice(-keepLength);
      console.debug(
        `Trimmed terminal buffer to ${sessionHistory.terminalBuffer.length} characters`,
      );
    }
  }

  // Make chat history reactive to sessionHistory changes
  let chatHistory = { chatMessages: [], currentInput: "", currentOutput: "" };

  $: {
    // Convert events to chat messages format whenever sessionHistory changes
    const chatMessages = [];

    // Add welcome message if no events
    if (sessionHistory.events.length === 0) {
      chatMessages.push({
        type: "system",
        content: "Chat view enabled. Commands will appear as messages below.",
        timestamp: new Date(),
      });
    }

    // Convert I/O events to chat messages
    for (const event of sessionHistory.events) {
      if (event.type === "input") {
        chatMessages.push({
          type: "user",
          content: event.content,
          timestamp: event.timestamp,
        });
      } else if (event.type === "output") {
        // Process ANSI codes to HTML for chat display
        const htmlContent = ansiUp
          ? ansiUp.ansi_to_html(event.content)
          : event.content;
        chatMessages.push({
          type: "assistant",
          content: htmlContent,
          timestamp: event.timestamp,
          isHtml: true, // Content is now processed HTML
        });
      }
    }

    chatHistory = {
      chatMessages,
      currentInput: sessionHistory.currentInput,
      currentOutput: sessionHistory.currentOutput,
    };

    console.debug(
      "Session page: Updated chat history with",
      chatMessages.length,
      "messages from",
      sessionHistory.events.length,
      "events",
    );
    console.debug("Session page: Chat messages:", chatMessages);
    console.debug("Session page: Passing chatHistory:", chatHistory);
  }

  function getHistoryForTerminal() {
    return sessionHistory.terminalBuffer;
  }
</script>

<Container sessionContainer={true}>
  {#snippet header()}
    <HeaderToolbar>
      {#snippet left()}
        <button
          onclick={() => goto("/sessions")}
          class="btn-icon-only"
          title="Back to sessions"
          aria-label="Back to sessions"
        >
          <BackIcon />
        </button>
      {/snippet}

      {#snippet right()}
        {#if authed && sessionId}
          <h2># {page.params.id.slice(0, 8)}</h2>

          <button
            title="End Session"
            aria-label="End Session"
            class="button-danger end-session-btn btn-icon-only"
            onclick={showEndDialog}
          >
            <EndSessionIcon />
          </button>
        {/if}
      {/snippet}
    </HeaderToolbar>
  {/snippet}

  {#snippet children()}
    <div class="terminal-page-container">
      {#if authed && sessionId}
        {#if chatView}
          <Chat
            {socket}
            {sessionId}
            initialHistory={chatHistory}
            onInputEvent={addInputEvent}
            onOutputEvent={addOutputEvent}
            onterminalclick={toggleView}
          />
        {:else}
          <Terminal 
            {socket}
            {sessionId} 
            onchatclick={toggleView}
            initialHistory={getHistoryForTerminal()}
            onInputEvent={addInputEvent}
            onOutputEvent={addOutputEvent}
            onBufferUpdate={updateTerminalBuffer}
          />
          <!-- <TerminalReadonly
            {socket}
            {sessionId}
            onchatclick={toggleView}
            initialHistory={getHistoryForTerminal()}
            onInputEvent={addInputEvent}
            onOutputEvent={addOutputEvent}
            onBufferUpdate={updateTerminalBuffer}
          /> -->
        {/if}
      {:else}
        <div style="text-align: center; padding: 2rem;">
          <p class="loading">initializing session...</p>
        </div>
      {/if}
    </div>
  {/snippet}
</Container>

<!-- Confirmation Dialog for ending session -->
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
  .terminal-page-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-height: 400px; /* Minimum height for terminal functionality */
  }

  @media (max-width: 768px) {
    .terminal-page-container {
      min-height: 0; /* Allow flex child to shrink on mobile */
      width: 100%;
      max-width: 100vw;
      overflow-x: hidden;
      box-sizing: border-box;
    }
  }

  .end-session-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: var(--space-sm);
    border-radius: var(--radius);
    transition:
      background 0.2s,
      border-color 0.2s;
  }

  .end-session-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-hover);
  }
  .loading {
    color: var(--text-muted);
  }
</style>
