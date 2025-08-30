# Spec Requirements Document

> Spec: Session Naming
> Created: 2025-08-30
> Status: Planning

## Overview

Enable users to assign custom names to terminal sessions for easy identification and organization. This feature will replace anonymous session IDs with meaningful names and create readable directory names in the file system.

## User Stories

### Primary User Story
As a developer using Dispatch for multiple projects, I want to name my terminal sessions, so that I can quickly identify and switch between different work contexts without having to remember session IDs.

When I create a new session, I can provide a descriptive name like "React Frontend" or "API Server Debug". The session appears in my session list with this name instead of a cryptic ID, and I can easily distinguish between my different work environments.

### Secondary User Story  
As a team lead sharing Dispatch environments, I want sessions to have meaningful names, so that team members can understand what each session is for when collaborating.

When I create sessions for different parts of our application stack, other team members can see names like "Database Migration" or "Frontend Testing" instead of random UUIDs, making collaboration more intuitive.

## Spec Scope

1. **Custom Session Naming** - Allow users to provide custom names during session creation
2. **Session Renaming** - Enable editing of existing session names through the UI  
3. **Name Validation** - Implement length and character restrictions for session names
4. **Default Name Generation** - Provide meaningful fallback names when no custom name is specified
5. **Readable Directory Names** - Create file system paths that correspond to session names for easy identification

## Out of Scope

- Session descriptions or detailed metadata (future enhancement)
- Session folders/categories/tags (separate roadmap feature)  
- Advanced session organization features
- Bulk session operations

## Expected Deliverable

1. Users can create new sessions with custom names through an enhanced UI
2. Existing sessions can be renamed without interrupting active terminal processes
3. Session list displays custom names with inline editing capabilities
4. File system includes readable directory paths for easy session identification

## Spec Documentation

- Tasks: @.agent-os/specs/2025-08-30-session-naming/tasks.md
- Technical Specification: @.agent-os/specs/2025-08-30-session-naming/sub-specs/technical-spec.md