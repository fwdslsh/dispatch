# API Documentation Guide

This guide explains how to maintain and use the Dispatch API documentation system.

## Overview

Dispatch provides comprehensive API documentation through:

1. **OpenAPI 3.0 Specification** - Machine-readable API definition
2. **Interactive API Explorer** - Browser-based testing and documentation
3. **Markdown References** - Detailed guides and examples

## Accessing API Documentation

### Interactive API Explorer

Visit `/api-docs` in your browser to access the interactive API documentation:

```
http://localhost:5173/api-docs      # Development
http://localhost:7173/api-docs      # Test server
http://localhost:3030/api-docs      # Production
```

**Features:**
- Browse all API endpoints
- View request/response schemas
- Test endpoints with authentication
- Download OpenAPI spec
- Search endpoints and schemas

### OpenAPI Specification

The OpenAPI 3.0 specification is available at `/openapi.json`:

```bash
# Download the spec
curl http://localhost:5173/openapi.json > openapi.json

# Use with OpenAPI tools
openapi-generator-cli generate -i openapi.json -g typescript-fetch
```

### Markdown Documentation

Detailed API documentation is maintained in:

- `docs/reference/api-routes.md` - Complete REST API reference
- `docs/reference/workspace-api.md` - Workspace management API
- `docs/reference/socket-events.md` - Socket.IO event protocol
- `docs/reference/database-schema.md` - Database schema reference

## Maintaining the OpenAPI Specification

### File Location

```
static/openapi.json
```

This file is served directly by SvelteKit's static file handler.

### Structure

The OpenAPI spec follows OpenAPI 3.0.3 format:

```json
{
  "openapi": "3.0.3",
  "info": { ... },
  "servers": [ ... ],
  "paths": { ... },
  "components": {
    "securitySchemes": { ... },
    "schemas": { ... },
    "responses": { ... }
  }
}
```

### Adding New Endpoints

When adding a new API route, update the OpenAPI spec:

**1. Define the path:**

```json
"/api/new-endpoint": {
  "post": {
    "tags": ["Category"],
    "summary": "Brief description",
    "description": "Detailed description",
    "requestBody": {
      "required": true,
      "content": {
        "application/json": {
          "schema": {
            "$ref": "#/components/schemas/RequestSchema"
          }
        }
      }
    },
    "responses": {
      "200": {
        "description": "Success response",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/ResponseSchema"
            }
          }
        }
      }
    }
  }
}
```

**2. Define schemas:**

```json
"components": {
  "schemas": {
    "RequestSchema": {
      "type": "object",
      "required": ["field1"],
      "properties": {
        "field1": {
          "type": "string",
          "description": "Field description"
        }
      }
    }
  }
}
```

### Updating Existing Endpoints

When modifying an API route:

1. Update the corresponding path definition in `openapi.json`
2. Update request/response schemas if changed
3. Update the markdown documentation in `docs/reference/api-routes.md`
4. Test the changes in the API explorer

### Schema Reusability

Use `$ref` to avoid duplicating schemas:

```json
{
  "paths": {
    "/sessions": {
      "get": {
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Session"
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Session": {
        "type": "object",
        "properties": { ... }
      }
    }
  }
}
```

## Authentication Documentation

The OpenAPI spec documents both authentication methods:

### Cookie Authentication

```json
"securitySchemes": {
  "cookieAuth": {
    "type": "apiKey",
    "in": "cookie",
    "name": "session",
    "description": "Session cookie authentication"
  }
}
```

### API Key Authentication

```json
"securitySchemes": {
  "bearerAuth": {
    "type": "http",
    "scheme": "bearer",
    "description": "API key authentication via Authorization header"
  }
}
```

### Testing with Authentication

In the API Explorer:

1. Click "Authorize" button
2. Enter API key in Bearer token field
3. Test endpoints with authentication

## Best Practices

### 1. Keep Spec and Code in Sync

When modifying API routes:
- [ ] Update OpenAPI spec
- [ ] Update markdown docs
- [ ] Update related tests
- [ ] Test in API explorer

### 2. Use Descriptive Names

```json
// Good
"summary": "List all active sessions",
"description": "Returns all sessions with optional workspace filter. Supports pagination via limit/offset parameters."

// Bad
"summary": "Get sessions",
"description": "Returns sessions"
```

### 3. Document Error Responses

Always document error responses:

```json
"responses": {
  "200": { "description": "Success" },
  "400": { "$ref": "#/components/responses/BadRequest" },
  "401": { "$ref": "#/components/responses/Unauthorized" },
  "404": { "$ref": "#/components/responses/NotFound" }
}
```

### 4. Include Examples

Provide example request/response bodies:

```json
"schema": {
  "type": "object",
  "properties": {
    "name": { "type": "string" }
  },
  "example": {
    "name": "My Workspace"
  }
}
```

### 5. Tag Endpoints Logically

Use tags to group related endpoints:

```json
"tags": [
  { "name": "Sessions", "description": "Session management" },
  { "name": "Workspaces", "description": "Workspace operations" }
]
```

## Validation

### OpenAPI Spec Validation

Validate the spec using online tools or CLI:

```bash
# Using swagger-cli (if installed)
swagger-cli validate static/openapi.json

# Using online validator
# Visit: https://editor.swagger.io
# Paste the contents of openapi.json
```

### Testing in API Explorer

After updates:
1. Visit `/api-docs`
2. Verify all endpoints appear
3. Test request/response examples
4. Check authentication flow

## Code Generation

The OpenAPI spec can be used to generate client libraries:

### TypeScript Client

```bash
# Install generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i static/openapi.json \
  -g typescript-fetch \
  -o src/lib/client/generated-api

# Use generated client
import { SessionsApi } from '$lib/client/generated-api';
const api = new SessionsApi();
const sessions = await api.sessionsList();
```

### Python Client

```bash
openapi-generator-cli generate \
  -i static/openapi.json \
  -g python \
  -o clients/python
```

## RapiDoc Configuration

The API explorer uses RapiDoc. Key configuration options:

```svelte
<rapi-doc
  spec-url="/openapi.json"
  theme="dark"                    # Light or dark theme
  render-style="focused"          # Focused, read, or view
  allow-try="true"                # Enable try-it-out
  allow-authentication="true"     # Show auth UI
  allow-server-selection="true"   # Allow server switching
  schema-style="table"            # Table or tree view
/>
```

See [RapiDoc documentation](https://rapidocweb.com/api.html) for all options.

## Troubleshooting

### API Explorer Not Loading

**Issue**: `/api-docs` shows blank page

**Solutions:**
1. Check browser console for errors
2. Verify `/openapi.json` is accessible
3. Check RapiDoc script loaded successfully

### Endpoints Not Appearing

**Issue**: New endpoints don't show in explorer

**Solutions:**
1. Verify endpoint added to `paths` in openapi.json
2. Check JSON syntax is valid
3. Refresh browser cache (Ctrl+Shift+R)

### Authentication Failing

**Issue**: Cannot test authenticated endpoints

**Solutions:**
1. Generate API key in `/settings/api-keys`
2. Copy key to clipboard
3. Click "Authorize" in API explorer
4. Paste key in Bearer token field
5. Click "Authorize" button

## Integration with Documentation

### Cross-References

Link to API docs from markdown:

```markdown
See the [API Documentation](/api-docs) for interactive endpoint testing.

Detailed endpoint reference: [Sessions API](/api-docs#tag/Sessions)
```

### Code Examples

Include curl examples in markdown docs:

```bash
# Create session
curl -X POST http://localhost:5173/api/sessions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type": "pty", "workspacePath": "/workspace/project"}'
```

## Future Enhancements

Potential improvements to the API documentation system:

1. **Automated Spec Generation** - Generate OpenAPI spec from route code
2. **Request/Response Validation** - Validate API responses against schema
3. **SDK Auto-generation** - Automatically generate client SDKs
4. **Versioning** - Support multiple API versions
5. **Mock Server** - Generate mock API from spec for testing

## Summary

- **OpenAPI spec** in `static/openapi.json` defines the API
- **API explorer** at `/api-docs` provides interactive testing
- **Markdown docs** in `docs/reference/` provide detailed guides
- **Keep all three in sync** when modifying APIs
- **Validate spec** before committing changes
- **Test in explorer** after updates

For questions or suggestions, consult the development team.
