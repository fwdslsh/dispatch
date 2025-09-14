Testing Overview

- Unit (Vitest): `npm test` runs unit tests. Some environments may show esbuild warnings; this does not affect manager/E2E coverage.
- Core managers (SQLite-backed): `npm run test:core` runs the History/Workspace/Terminal managers integration.
- E2E (Playwright): `npm run test:e2e` runs UI-focused specs via `playwright-ui.config.js` (excludes Claude-dependent tests). Pass Playwright flags through, e.g. `npm run test:e2e -- --headed`.

Common commands

- Format: `npm run format` (Prettier write)
- Lint: `npm run lint` (Prettier check + ESLint)
- Managers: `npm run test:core`
- E2E: `npm run test:e2e` (UI config by default)

Notes

- For full UI E2E including Claude-dependent flows, run Playwright with `playwright.config.js`: `npx playwright test -c playwright.config.js`.
- First time on a machine, install browsers: `npm run playwright:install`.
- In CI, prefer `test:core` and UI-focused E2E to keep runs stable and fast.
