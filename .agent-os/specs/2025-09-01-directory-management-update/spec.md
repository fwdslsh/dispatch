# Spec Requirements Document

> Spec: Directory Management Update
> Created: 2025-09-01

## Overview

Update the Dispatch application to implement the new hierarchical directory management strategy outlined in docs/directories.md. This change will separate configuration from projects data, add project-based organization, implement proper path validation, and ensure all application components follow the new standards.

## User Stories

### Project-Based Development

As a developer, I want to organize my work into isolated projects, so that I can maintain clean separation between different clients, features, or development efforts.

The user will be able to create named projects (e.g., "client-website", "internal-api") that act as containers for all related sessions and persistent files. Each project will have its own workspace directory for persistent files and a sessions directory for temporary work. Projects will be discoverable through a registry and support metadata like tags, descriptions, and ownership.

### Secure Session Isolation

As a system administrator, I want each session to run in an isolated directory with proper validation, so that users cannot traverse outside their designated areas or interfere with other sessions.

Sessions will be created with timestamp-based names including milliseconds (YYYY-MM-DD-HHMMSS-SSS) to prevent collisions. Each session will have its working directory within the project structure. Path validation will prevent directory traversal attacks and enforce project boundaries. Sessions can traverse up to the project root and access all other files in the project directory, but should not be able to leave the project directory.

### Configuration Flexibility

As a DevOps engineer, I want to configure directory locations through environment variables, so that I can adapt the application to different deployment scenarios and storage architectures.

The application will respect DISPATCH_CONFIG_DIR for configuration files and DISPATCH_PROJECTS_DIR for project data. Default locations will follow XDG Base Directory specifications. Docker deployments can override these through volume mounts and environment variables.

## Spec Scope

1. **Directory Structure Implementation** - Update application code to create and manage the new hierarchical directory structure with projects and sessions
2. **Path Validation System** - Implement comprehensive path validation including sanitization, boundary checks, and reserved name blocking
3. **Environment Variable Support** - Add support for DISPATCH_CONFIG_DIR and DISPATCH_PROJECTS_DIR environment variables throughout the application
4. **Docker Configuration Update** - Modify Dockerfile and docker-compose files to support the new directory structure with appropriate volume mounts
5. **Documentation Synchronization** - Update all documentation files, README, and CLAUDE.md to reflect the new directory management strategy

## Out of Scope

- Migration tools for existing sessions (fresh deployment assumed)
- GUI for project management (command-line and API only)
- Backup and restore functionality
- Multi-user access control (single-user/team assumed)

## Expected Deliverable

1. Application creates projects in ~/dispatch-projects (or DISPATCH_PROJECTS_DIR) with proper .dispatch metadata structure
2. Sessions are created with millisecond timestamps in project-specific sessions directories
3. Path validation prevents directory traversal and enforces project isolation boundaries
