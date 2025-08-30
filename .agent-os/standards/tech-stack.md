# Tech Stack

## Context

Global tech stack defaults for Agent OS projects, overridable in project-specific `.agent-os/product/tech-stack.md`.

- App Framework: SvelteKit latest stable
- Language: JavaScript (ES2022+) with JSDoc
- Type System: JSDoc annotations for IntelliSense
- Primary Database: Azure PostgresSQL Database
- ORM: Prisma with JSDoc types
- Build Tool: Vite (bundled with SvelteKit)
- Import Strategy: ES modules
- Package Manager: npm
- Node Version: 22 LTS
- CSS Framework: PicoCSS
- UI Components: Custom components (no external libraries)
- Font Provider: Google Fonts
- Font Loading: Self-hosted for performance
- Icons: Bootstrap Icons
- Application Hosting: Azure Container Apps
- Hosting Region: Primary region based on user base
- Database Hosting: Azure PostgreSQL
- Database Backups: Azure automated point-in-time restore
- Asset Storage: Azure Blob Storage
- CI/CD Platform: Azure DevOps or GitHub Actions
- CI/CD Trigger: Push to main/staging branches
- Tests: Run before deployment
- Production Environment: main branch
- Test Environment: test branch
