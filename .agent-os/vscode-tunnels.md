
# **VS Code Remote Tunnel Integration & Toggle**

---

## Purpose / Problem Statement

We want to allow a user (admin) to enable or disable a VS Code Remote Tunnel from within the Dispatch application, using a single container (no extra services), and provide:

* A simple UI toggle to start/stop the tunnel
* A per-host tunnel naming convention
* A link to open the workspace in **VS Code Web** (`vscode.dev`)
* Compatibility with VS Code Desktop using Remote – Tunnels
* Persistence of tunnel state across container restarts
* Visibility into the running tunnel (PID, name, folder, open-URL)

This removes the burden of manual CLI setup, avoids needing `docker-compose`, and gives in-app control for the VS Code tunnel.

---

## Scope & Constraints

**In scope:**

* Installing the VS Code CLI inside the Dispatch container
* Exposing APIs (GET/POST) to start/stop the tunnel
* UI component (toggle + status + “Open in VS Code” link)
* Persisting state (e.g. in filesystem)
* Naming the tunnel based on container/host name
* Only single user (admin) control

**Out of scope / will not be supported initially:**

* Multi-user, multi-tenant tunnel sharing
* Fine-grained permission per-user for tunneling
* Auto-configuration of VS Code desktop extension (user config required)
* Graceful restarts while users are actively editing
* Advanced telemetry or auditing of tunnel usage

**Assumptions:**

* The container has a persistent home directory mount (e.g. `/home/dispatch`)
* Users have or will install **Remote – Tunnels** in VS Code desktop
* Once the tunnel is started, the user will complete device login (one-time) via a login URL
* The `code` CLI is compatible with the container OS (e.g. Alpine or Debian suffix)

---

## User Personas

| Persona   | Goal regarding this feature                                                   |
| --------- | ----------------------------------------------------------------------------- |
| Admin     | Turn VS Code access on/off; open in browser or VS Code                        |
| Developer | (Indirect) Use this to connect to the Dispatch workspace from VS Code desktop |

---

## High-Level User Flows

1. **View tunnel status**
   The admin navigates to “Settings → VS Code Tunnel.” The UI shows whether a tunnel is running, and if so, displays the tunnel’s name, PID, folder, and **Open in VS Code** link.

2. **Start the tunnel**

   * Admin clicks “Start Tunnel”
   * Backend spawns `code tunnel …` as a child process
   * State file is written (PID, name, folder, open-URL)
   * UI polls or fetches updated status
   * The admin sees the device login URL in logs or UI and performs device login
   * After login, tunnel is active and stays running

3. **Stop the tunnel**

   * Admin clicks “Stop Tunnel”
   * Backend sends `SIGTERM` to the child process (or kills by PID)
   * State file is cleared
   * UI updates to show tunnel is stopped

4. **Restart / Container reboot**

   * On application startup, the backend checks for existing state file
   * If state file exists and process is alive, the UI renders “running” state
   * If process is dead or missing, state is cleaned up

5. **Open in VS Code Web / Open via Remote – Tunnels**

   * When tunnel is running, UI exposes a link `https://vscode.dev/tunnel/<tunnelName>/<folder>`
   * Users open that link (in browser) or use **Remote – Tunnels** in VS Code desktop to connect

---

## Functional Requirements

### 1. Tunnel State & Persistence

* System must store a state information (e.g. JSON) in the database containing:

  * `pid` (number)
  * `name` (string)
  * `folder` (string) (the default folder opened in VS Code)
  * `args` (string\[])
  * `startedAt` (timestamp)
  * `openUrl` (string)

* On application startup (or first API call), the backend must:

  * Read the state file if present
  * Verify if the process (by PID) is still alive
  * If alive, keep that as the running tunnel
  * If dead / missing, clear the state file

### 2. Tunnel Naming (per-host)

* The tunnel `name` must default to `dispatch-<hostname>`

  * `hostname` is fetched from `process.env.HOSTNAME` or system hostname
  * Override is allowed via API parameter
* The `openUrl` must reflect that name and folder (URL-escaped)

  * e.g. `https://vscode.dev/tunnel/dispatch-myhost/%2Fhome%2Fdispatch`

### 3. API Endpoints (backend)

**GET /api/admin/tunnel**

* Returns JSON:

  ```json
  {
    "running": boolean,
    "state": {
      "pid": number,
      "name": string,
      "folder": string,
      "openUrl": string,
      "startedAt": string
    } | null
  }
  ```

**POST /api/admin/tunnel**

* Accepts JSON body, e.g. `{ "action": "start" }` or `{ "action": "stop" }`
* For `action = "start"`:

  * Optionally allow `name`, `folder`, `extra` (array of additional CLI arguments)
  * Spawns the `code` CLI process with arguments:

    ```
    code tunnel --accept-server-license-terms --name <name> --no-sleep [extra...]
    ```
  * Returns `{ "ok": true, "state": { … } }`
* For `action = "stop"`:

  * Terminates the running process (or kills by PID)
  * Clears the state file
  * Returns `{ "ok": true }`
* If invalid action: return HTTP `400` with `{ ok: false, error: "Invalid action" }`

### 4. UI Component

* Show current status (“Running” or “Stopped”)
* If running:

  * Show Name, PID, Folder
  * Show **Open in VS Code** link (clickable)
  * Show a “Stop Tunnel” button
* If not running:

  * Show “Start Tunnel” button
  * Optionally a hint: “First start requires device login”
* Disable buttons while waiting (busy state)
* Stream the device login URL from backend logs to show it in the UI

### 5. Log / Device Login Streaming

* While starting, the backend should capture the `stdout` / `stderr` lines of the `code tunnel` process
* Forward relevant lines (device login prompt) via WebSocket or Socket.IO to the UI
* The UI can display the prompt dynamically so the admin doesn’t need to check container logs

---

## Minimal Code Samples (Sketch)

### Tunnel Manager Example Code (Node)

```js
import { spawn } from "node:child_process";
import fs from "fs/promises";
import { resolve } from "path";

const HOME = process.env.HOME || "/home/dispatch";
const STATE_PATH = resolve(HOME, ".dispatch/tunnel-state.json");

let child = null;

export async function getState() {
  try {
    return JSON.parse(await fs.readFile(STATE_PATH, "utf-8"));
  } catch {
    return null;
  }
}

export async function startTunnel({ name, folder, extra = [] } = {}) {
  if (child) throw new Error("Already running");

  const host = process.env.HOSTNAME || "container";
  const tunnelName = name || `dispatch-${host}`;
  const cwd = folder || HOME;

  const args = ["tunnel", "--accept-server-license-terms", "--name", tunnelName, "--no-sleep", ...extra];
  child = spawn("code", args, { cwd });

  // Logging
  child.stdout.on("data", (b) => console.log("[vscode-tunnel]", b.toString()));
  child.stderr.on("data", (b) => console.error("[vscode-tunnel]", b.toString()));

  const openUrl = `https://vscode.dev/tunnel/${encodeURIComponent(tunnelName)}/${encodeURIComponent(cwd)}`;
  const state = { pid: child.pid, name: tunnelName, folder: cwd, args, startedAt: new Date().toISOString(), openUrl };

  await fs.mkdir(resolve(STATE_PATH, ".."), { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2));

  child.on("exit", () => fs.rm(STATE_PATH, { force: true }));
  return state;
}

export async function stopTunnel() {
  const state = await getState();
  if (child) child.kill("SIGTERM");
  else if (state?.pid) process.kill(state.pid, "SIGTERM");
  await fs.rm(STATE_PATH, { force: true });
}
```

### API Example Code (+server in SvelteKit)

```js
// GET handler
const state = await getState();
return new Response(JSON.stringify({ running: !!state, state }), { headers: { "Content-Type": "application/json" } });

// POST handler
const body = await request.json();
if (body.action === "start") {
  const state = await startTunnel(body);
  return new Response(JSON.stringify({ ok: true, state }), { headers: { "Content-Type": "application/json" } });
}
if (body.action === "stop") {
  await stopTunnel();
  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
}
return new Response(JSON.stringify({ ok: false, error: "Invalid action" }), { status: 400, headers: { "Content-Type": "application/json" } });
```

## Success Criteria / Acceptance Tests

1. **Start/Stop flow works**

   * Admin clicks “Start”, backend launches tunnel, UI updates, link appears
   * Admin clicks “Stop”, tunnel stops, UI resets

2. **Persistence across restarts**

   * Start the tunnel, then restart the container
   * UI should show “Running” if process is alive
   * If process is dead, UI goes to “Stopped”

3. **Correct naming & link**

   * Tunnel name should be `dispatch-<hostname>` by default
   * The **Open in VS Code** link should match that name and folder

4. **Device login usable**

   * On first tunnel start, the logs or UI display a device login URL
   * The user completes login and the tunnel is fully usable

5. **Proper error & invalid handling**

   * Attempting to start when already running yields a handled error
   * Invalid action in POST returns `400`

6. **Security**

   * Only authorized (admin) users can call the API
   * UI does not leak internal outputs beyond safe fields
