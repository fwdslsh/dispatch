# Webhook Execution Interface - Implementation Plan

## Overview

Build a webhook execution system that allows users to define custom HTTP endpoints that execute bash commands when called. Similar to the cron scheduling system, this provides automation capabilities triggered by external HTTP requests rather than time-based schedules.

## Core Concept

Each webhook consists of:
- **Custom URI path** - e.g., `/hooks/deploy-staging`
- **HTTP method** - GET, POST, PUT, DELETE, PATCH
- **Bash command** - The command to execute when the webhook is triggered
- **Optional workspace path** - Working directory for command execution

When a matching request arrives, the system:
1. Validates the webhook exists and is enabled
2. Writes request details (headers, body, query params, method) to a temporary JSON file
3. Executes the bash command with the temp file path available as `$WEBHOOK_REQUEST_FILE`
4. Logs the execution result
5. Returns the command output as the HTTP response

---

## Implementation Components

### 1. Database Schema (Migration 5)

**File:** `src/lib/server/shared/db/migrate.js`

Add Migration 5 with two tables:

```sql
-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    uri_path TEXT NOT NULL UNIQUE,  -- e.g., '/hooks/deploy'
    http_method TEXT NOT NULL DEFAULT 'POST',  -- GET, POST, PUT, DELETE, PATCH
    command TEXT NOT NULL,
    workspace_path TEXT,
    status TEXT NOT NULL DEFAULT 'active',  -- active, disabled
    secret_token TEXT,  -- Optional authentication token
    last_triggered INTEGER,
    last_status TEXT,
    last_error TEXT,
    trigger_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    created_by TEXT DEFAULT 'default'
);

-- Webhook execution logs
CREATE TABLE IF NOT EXISTS webhook_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id TEXT NOT NULL,
    request_method TEXT NOT NULL,
    request_path TEXT NOT NULL,
    request_headers TEXT,  -- JSON
    request_body TEXT,
    triggered_at INTEGER NOT NULL,
    completed_at INTEGER,
    status TEXT NOT NULL,  -- running, success, failed
    exit_code INTEGER,
    output TEXT,
    error TEXT,
    duration_ms INTEGER,
    client_ip TEXT,
    FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS ix_webhooks_uri_method ON webhooks(uri_path, http_method);
CREATE INDEX IF NOT EXISTS ix_webhooks_status ON webhooks(status);
CREATE INDEX IF NOT EXISTS ix_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS ix_webhook_logs_triggered_at ON webhook_logs(triggered_at);
```

### 2. Repository Layer

**File:** `src/lib/server/shared/db/WebhookRepository.js`

Plain functions (following CronRepository pattern):

```javascript
// List all webhooks
export async function listWebhooks(db, status = null)

// Get webhook by ID
export async function getWebhook(db, id)

// Get webhook by URI path and method
export async function getWebhookByRoute(db, uriPath, httpMethod)

// Create webhook
export async function createWebhook(db, webhook)

// Update webhook
export async function updateWebhook(db, id, updates)

// Delete webhook
export async function deleteWebhook(db, id)

// Create webhook log
export async function createWebhookLog(db, log)

// Update webhook log
export async function updateWebhookLog(db, id, updates)

// Get logs for a webhook
export async function getWebhookLogs(db, webhookId, limit = 100)

// Get all recent logs
export async function getAllWebhookLogs(db, limit = 100)

// Delete old logs
export async function deleteOldWebhookLogs(db, olderThanTimestamp)
```

### 3. Backend Service

**File:** `src/lib/server/webhook/WebhookExecutorService.js`

Service class (following CronSchedulerService pattern):

```javascript
export class WebhookExecutorService {
    constructor(db, io = null) {
        this.db = db;
        this.io = io;
    }

    async init() {
        // Load webhooks, validate URI patterns
    }

    async createWebhook(webhookData) {
        // Validate URI pattern (must start with /hooks/)
        // Validate HTTP method
        // Generate ID, save to database
    }

    async updateWebhook(webhookId, updates) {
        // Update webhook configuration
    }

    async deleteWebhook(webhookId) {
        // Remove webhook
    }

    async enableWebhook(webhookId) {
        // Set status to 'active'
    }

    async disableWebhook(webhookId) {
        // Set status to 'disabled'
    }

    async executeWebhook(webhook, request) {
        // 1. Write request to temp file as JSON
        // 2. Execute command with env var WEBHOOK_REQUEST_FILE
        // 3. Log execution
        // 4. Return result
    }

    async findMatchingWebhook(uriPath, httpMethod) {
        // Find webhook by route
    }

    // Logging and utility methods
    async getWebhookLogs(webhookId, limit)
    async getAllLogs(limit)
    async cleanupOldLogs(days)
    emitUpdate(event, data)
}
```

### 4. API Routes

**CRUD Routes:**

**File:** `src/routes/api/webhooks/+server.js`
- `GET` - List all webhooks
- `POST` - Create new webhook

**File:** `src/routes/api/webhooks/[webhookId]/+server.js`
- `GET` - Get webhook details
- `PATCH` - Update webhook
- `DELETE` - Delete webhook

**File:** `src/routes/api/webhooks/[webhookId]/logs/+server.js`
- `GET` - Get execution logs for webhook

**File:** `src/routes/api/webhooks/logs/+server.js`
- `GET` - Get all recent webhook logs

**Webhook Trigger Route:**

**File:** `src/routes/hooks/[...path]/+server.js`

This is the dynamic route that handles incoming webhook requests:

```javascript
// Handle all HTTP methods
export async function GET(event) { return handleWebhook(event); }
export async function POST(event) { return handleWebhook(event); }
export async function PUT(event) { return handleWebhook(event); }
export async function DELETE(event) { return handleWebhook(event); }
export async function PATCH(event) { return handleWebhook(event); }

async function handleWebhook(event) {
    const { webhookExecutor } = event.locals.services;
    const uriPath = `/hooks/${event.params.path}`;
    const method = event.request.method;

    // Find matching webhook
    const webhook = await webhookExecutor.findMatchingWebhook(uriPath, method);
    if (!webhook) {
        return json({ error: 'Webhook not found' }, { status: 404 });
    }

    // Optional: Validate secret token from header
    if (webhook.secret_token) {
        const providedToken = event.request.headers.get('X-Webhook-Token');
        if (providedToken !== webhook.secret_token) {
            return json({ error: 'Invalid token' }, { status: 401 });
        }
    }

    // Build request object for temp file
    const requestData = {
        method,
        path: uriPath,
        headers: Object.fromEntries(event.request.headers),
        query: Object.fromEntries(event.url.searchParams),
        body: await event.request.text(),
        clientIp: event.getClientAddress(),
        timestamp: Date.now()
    };

    // Execute webhook
    const result = await webhookExecutor.executeWebhook(webhook, requestData);

    // Return response based on execution result
    return new Response(result.output || '', {
        status: result.exitCode === 0 ? 200 : 500,
        headers: {
            'Content-Type': 'text/plain',
            'X-Webhook-Execution-Id': String(result.logId)
        }
    });
}
```

### 5. Service Registration

**File:** `src/lib/server/shared/services.js`

Add WebhookExecutorService to the service registry:

```javascript
import { WebhookExecutorService } from '../webhook/WebhookExecutorService.js';

// In createServices():
const webhookExecutor = new WebhookExecutorService(db, null);

// In return object:
webhookExecutor,

// In initializeServices():
await services.webhookExecutor.init();
```

### 6. Frontend Client Service

**File:** `src/lib/client/shared/services/WebhookService.svelte.js`

Following CronService.svelte.js pattern:

```javascript
export class WebhookService {
    webhooks = $state([]);
    logs = $state([]);
    loading = $state(false);
    error = $state(null);
    selectedWebhookId = $state(null);

    constructor(socketService = null) {
        this.socketService = socketService;
        this.setupRealtimeUpdates();
    }

    // CRUD operations
    async loadWebhooks(status = null)
    async createWebhook(webhookData)
    async updateWebhook(webhookId, updates)
    async deleteWebhook(webhookId)
    async enableWebhook(webhookId)
    async disableWebhook(webhookId)

    // Log operations
    async loadWebhookLogs(webhookId, limit = 100)
    async loadAllLogs(limit = 100)

    // Utility
    getWebhook(webhookId)
    clearError()
    validateUriPath(path)
}
```

Register in ServiceContainer:

**File:** `src/lib/client/shared/services/ServiceContainer.svelte.js`

```javascript
webhookService: {
    create: (container) => {
        const socketService = container.get('socketService');
        return new WebhookService(socketService);
    }
}
```

### 7. Frontend Components

**File:** `src/routes/webhooks/+page.svelte`

Main page with:
- Statistics cards (total, active, disabled, recent triggers)
- Filter tabs (All, Active, Disabled)
- Webhook cards grid
- Create/Edit modal
- Log viewer modal

**File:** `src/routes/webhooks/WebhookCard.svelte`

Card component showing:
- Webhook name and status badge
- URI path with copy button
- HTTP method badge (color-coded)
- Command preview
- Last triggered time
- Trigger count
- Enable/Disable toggle
- Edit/Delete actions
- View logs button

**File:** `src/routes/webhooks/WebhookForm.svelte`

Modal form with fields:
- Name (required)
- Description
- URI Path (required, must start with /hooks/, validated for uniqueness)
- HTTP Method dropdown (GET, POST, PUT, DELETE, PATCH)
- Command (required, multi-line textarea)
- Workspace Path (optional)
- Secret Token (optional, with generate button)

**File:** `src/routes/webhooks/WebhookLogViewer.svelte`

Log viewer modal showing:
- Execution timestamp
- HTTP method and path
- Status (success/failed)
- Duration
- Exit code
- Request headers/body (expandable)
- Command output (scrollable)
- Error message if failed

### 8. Shared Utilities

**File:** `src/lib/shared/webhook-utils.js`

```javascript
// HTTP method colors
export const HTTP_METHOD_COLORS = {
    GET: 'method-get',      // blue
    POST: 'method-post',    // green
    PUT: 'method-put',      // orange
    DELETE: 'method-delete', // red
    PATCH: 'method-patch'   // purple
};

// Validate URI path format
export function validateUriPath(path) {
    if (!path) return { valid: false, error: 'URI path is required' };
    if (!path.startsWith('/hooks/')) {
        return { valid: false, error: 'URI path must start with /hooks/' };
    }
    if (!/^\/hooks\/[a-zA-Z0-9\-_\/]+$/.test(path)) {
        return { valid: false, error: 'URI path contains invalid characters' };
    }
    return { valid: true };
}

// Generate webhook URL preview
export function getWebhookUrl(baseUrl, uriPath) {
    return `${baseUrl}${uriPath}`;
}

// Generate secret token
export function generateSecretToken() {
    return crypto.randomUUID().replace(/-/g, '');
}

// Format duration
export function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
}
```

### 9. Navigation Update

**File:** `src/lib/client/shared/components/AdaptiveNav.svelte`

Add webhooks link alongside cron:

```svelte
<NavItem href="/webhooks" icon={WebhookIcon}>Webhooks</NavItem>
```

**File:** `src/lib/client/shared/components/CommandPalette.svelte`

Add webhook-related commands.

---

## Request File Format

When a webhook is triggered, the request details are written to a temp file as JSON:

```json
{
    "method": "POST",
    "path": "/hooks/deploy-staging",
    "headers": {
        "content-type": "application/json",
        "x-github-event": "push",
        "x-webhook-token": "secret123"
    },
    "query": {
        "force": "true"
    },
    "body": "{\"ref\":\"refs/heads/main\",\"commits\":[...]}",
    "clientIp": "192.168.1.100",
    "timestamp": 1734307200000
}
```

The temp file path is available as:
- Environment variable: `$WEBHOOK_REQUEST_FILE`
- The file is automatically deleted after command execution completes

Example command usage:
```bash
# Parse JSON body with jq
cat $WEBHOOK_REQUEST_FILE | jq -r '.body' | jq -r '.ref'

# Deploy script
./deploy.sh --branch=$(cat $WEBHOOK_REQUEST_FILE | jq -r '.body' | jq -r '.ref')
```

---

## Security Considerations

1. **URI Namespace Isolation**: All webhooks must use `/hooks/` prefix to avoid conflicts with application routes

2. **Optional Token Authentication**: Webhooks can require a secret token via `X-Webhook-Token` header

3. **Execution Isolation**: Commands run in specified workspace with same security model as cron jobs

4. **Input Sanitization**: Request data is JSON-encoded to prevent injection when passed to commands

5. **Rate Limiting** (future): Could add rate limiting per webhook to prevent abuse

6. **Audit Logging**: All executions are logged with client IP and request details

---

## Socket.IO Events

Real-time updates for the frontend:

```javascript
// Webhook events
'webhook:created' - New webhook created
'webhook:updated' - Webhook configuration changed
'webhook:deleted' - Webhook removed
'webhook:triggered' - Webhook execution started
'webhook:completed' - Webhook execution finished
'webhook:error' - Webhook execution failed
```

---

## File Structure Summary

```
src/
├── lib/
│   ├── server/
│   │   ├── webhook/
│   │   │   └── WebhookExecutorService.js       # Backend service
│   │   └── shared/
│   │       └── db/
│   │           ├── WebhookRepository.js        # Database operations
│   │           └── migrate.js                  # Add migration 5
│   ├── client/
│   │   └── shared/
│   │       └── services/
│   │           ├── WebhookService.svelte.js    # Frontend service
│   │           └── ServiceContainer.svelte.js  # Register service
│   └── shared/
│       └── webhook-utils.js                    # Shared utilities
└── routes/
    ├── webhooks/
    │   ├── +page.svelte                        # Main page
    │   ├── WebhookCard.svelte                  # Card component
    │   ├── WebhookForm.svelte                  # Create/edit form
    │   └── WebhookLogViewer.svelte             # Log viewer
    ├── hooks/
    │   └── [...path]/
    │       └── +server.js                      # Webhook trigger route
    └── api/
        └── webhooks/
            ├── +server.js                      # List/Create
            ├── logs/
            │   └── +server.js                  # All logs
            └── [webhookId]/
                ├── +server.js                  # Get/Update/Delete
                └── logs/
                    └── +server.js              # Webhook logs
```

---

## Implementation Order

1. **Database Migration** - Add webhooks and webhook_logs tables
2. **Repository Layer** - WebhookRepository.js with all database operations
3. **Backend Service** - WebhookExecutorService.js with execution logic
4. **Service Registration** - Add to services.js
5. **Webhook Trigger Route** - Dynamic route at /hooks/[...path]
6. **API Routes** - CRUD endpoints for webhook management
7. **Shared Utilities** - webhook-utils.js
8. **Frontend Service** - WebhookService.svelte.js
9. **Frontend Components** - Page, Card, Form, LogViewer
10. **Navigation Updates** - Add to nav and command palette

---

## Testing Strategy

1. **Unit Tests**
   - WebhookRepository database operations
   - WebhookExecutorService execution logic
   - URI path validation
   - Request file generation

2. **Integration Tests**
   - Webhook CRUD via API
   - Webhook trigger with various HTTP methods
   - Token authentication
   - Command execution and logging

3. **E2E Tests**
   - Create webhook via UI
   - Trigger webhook and verify execution
   - View execution logs
   - Enable/disable webhook
