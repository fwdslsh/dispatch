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
  import { AnsiUp } from 'ansi_up';
  import BackIcon from "$lib/components/BackIcon.svelte";
  import EndSessionIcon from "$lib/components/Icons/EndSessionIcon.svelte";
  import ConfirmationDialog from "$lib/components/ConfirmationDialog.svelte";

  let authed = false;
  let sessionId;
  let socket;
  let sessionAttached = false;
  let chatView = false;
  let ansiUp;
  
  // Dialog state
  let showEndSessionDialog = false;
  
  // Unified session history - single source of truth
  let sessionHistory = {
    // All terminal I/O as structured events
    events: [],
    // Raw terminal buffer for terminal view
    terminalBuffer: '',
    // Current partial input/output being built
    currentInput: '',
    currentOutput: ''
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
        socket = io({ transports: ["websocket", "polling"] });
        const authKey = storedAuth === "no-auth" ? "" : storedAuth;
        socket.emit("auth", authKey, (res) => {
          console.debug('Session page: auth response:', res);
          if (res && res.ok) {
            // Now attach to the session so chat can send/receive data
            const dims = { cols: 80, rows: 24 }; // Default dimensions for chat
            console.debug('Session page: attempting to attach to session:', sessionId);
            socket.emit('attach', { sessionId, ...dims }, (resp) => {
              if (resp && resp.ok) {
                sessionAttached = true;
                console.debug('Socket attached to session successfully');
              } else {
                console.error('Failed to attach socket to session:', resp);
                // If session doesn't exist, redirect to sessions page
                if (resp && resp.error === 'Session not found') {
                  console.debug('Session not found, redirecting to sessions page');
                  goto('/sessions');
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
    console.debug('View toggled to:', chatView ? 'chat' : 'terminal');
  }

  // UUID fallback for non-secure contexts
  function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID generator for non-secure contexts
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Unified history management functions
  function addInputEvent(input) {
    const event = {
      type: 'input',
      content: input,
      timestamp: new Date(),
      id: generateUUID()
    };
    sessionHistory.events = [...sessionHistory.events, event];
    console.debug('Added input event:', input);
  }

  function addOutputEvent(output) {
    const event = {
      type: 'output', 
      content: output,
      timestamp: new Date(),
      id: generateUUID()
    };
    sessionHistory.events = [...sessionHistory.events, event];
    console.debug('Added output event, length:', output.length);
  }

  function updateTerminalBuffer(buffer) {
    sessionHistory.terminalBuffer = buffer;
  }

  // Make chat history reactive to sessionHistory changes
  let chatHistory = { chatMessages: [], currentInput: '', currentOutput: '' };
  
  $: {
    // Convert events to chat messages format whenever sessionHistory changes
    const chatMessages = [];
    
    // Add welcome message if no events
    if (sessionHistory.events.length === 0) {
      chatMessages.push({
        type: 'system',
        content: 'Chat view enabled. Commands will appear as messages below.',
        timestamp: new Date()
      });
    }

    // Convert I/O events to chat messages
    for (const event of sessionHistory.events) {
      if (event.type === 'input') {
        chatMessages.push({
          type: 'user',
          content: event.content,
          timestamp: event.timestamp
        });
      } else if (event.type === 'output') {
        // Process ANSI codes to HTML for chat display
        const htmlContent = ansiUp ? ansiUp.ansi_to_html(event.content) : event.content;
        chatMessages.push({
          type: 'assistant',
          content: htmlContent,
          timestamp: event.timestamp,
          isHtml: true // Content is now processed HTML
        });
      }
    }

    chatHistory = {
      chatMessages,
      currentInput: sessionHistory.currentInput,
      currentOutput: sessionHistory.currentOutput
    };
    
    console.debug('Session page: Updated chat history with', chatMessages.length, 'messages from', sessionHistory.events.length, 'events');
    console.debug('Session page: Chat messages:', chatMessages);
    console.debug('Session page: Passing chatHistory:', chatHistory);
  }

  function getHistoryForTerminal() {
    return sessionHistory.terminalBuffer;
  }
</script>

<Container sessionContainer={true}>
  {#snippet header()}
    <HeaderToolbar>
      {#snippet left()}
        <button onclick={() => goto('/sessions')} class="btn-icon-only" title="Back to sessions" aria-label="Back to sessions">
          <BackIcon />
        </button>
      {/snippet}

      {#snippet right()}
        {#if authed && sessionId}
          <button
            title={chatView ? "Switch to Terminal" : "Switch to Chat"}
            aria-label={chatView ? "Switch to Terminal view" : "Switch to Chat view"}
            class="view-toggle-header btn-icon-only"
            onclick={toggleView}
          >
            {#if chatView}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
                <line x1="8" y1="21" x2="16" y2="21"/>
                <line x1="12" y1="17" x2="12" y2="21"/>
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            {/if}
          </button>

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

  .back-link {
    display: flex;
    align-items: center;
    color: var(--primary);
    text-decoration: none;
    padding: var(--space-xs);
    border-radius: 4px;
    transition: color 0.2s ease;
  }

  .back-link:hover {
    color: var(--text-primary);
  }

  .back-icon {
    width: 1.5rem;
    height: 1.5rem;
    margin-right: var(--space-sm);
  }
  
  @media (max-width: 768px) {
    .terminal-page-container {
      min-height: 0; /* Allow flex child to shrink on mobile */
    }
    
    .back-link {
      padding: var(--space-sm);
      min-width: 44px;
      min-height: 44px;
      justify-content: center;
    }
    
    .back-icon {
      width: 1.75rem;
      height: 1.75rem;
      margin-right: 0;
    }
  }

  .view-toggle-header {
    background: transparent !important;
    color: var(--primary) !important;
    border: none !important;
    padding: var(--space-sm) !important;
    border-radius: 6px !important;
    transition: all 0.2s ease !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .view-toggle-header:hover {
    background: rgba(0, 255, 136, 0.1) !important;
    color: var(--text-primary) !important;
  }

  .view-toggle-header svg {
    width: 1.25rem;
    height: 1.25rem;
    stroke-width: 2;
  }

  .end-session-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    padding: var(--space-sm);
    border-radius: var(--radius);
    transition: background 0.2s, border-color 0.2s;
  }

  .end-session-btn:hover {
    background: var(--surface-hover);
    border-color: var(--border-hover);
  }

  .end-icon {
    width: 1.25rem;
    height: 1.25rem;
  }

  .loading {
    color: var(--text-muted);
  }
</style>