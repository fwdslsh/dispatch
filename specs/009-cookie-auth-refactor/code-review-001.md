Findings

High: Settings endpoints still call auth.updateCachedKey, but the new AuthService no longer defines that method, so any PUT to /api/auth/config or /api/settings/authentication now throws at runtime. See src/routes/api/auth/config/+server.js:116, src/routes/api/settings/[category]/+server.js:54, and src/lib/server/shared/auth.js:12.
High: OAuth callback never creates a row in auth_users, yet SessionManager.createSession enforces the foreign key. The first OAuth login will fail with SQLITE_CONSTRAINT: FOREIGN KEY failed. See src/routes/api/auth/callback/+server.js:40 and src/lib/server/auth/SessionManager.server.js:55.
High: The login UI still checks authConfig.terminal_key_set before rendering the API-key form (src/lib/client/shared/state/AuthViewModel.svelte.js:63), but /api/auth/config now derives that flag solely from the legacy terminal key (src/routes/api/auth/config/+server.js:26). As soon as operators drop the TERMINAL_KEY env (which they’re encouraged to under the new API-key flow), the login form disappears.
Medium: MultiAuthManager continues to read/write the old auth_sessions/auth_users schema (src/lib/server/shared/auth/oauth.js:640-707). With the new tables, these queries hit missing columns and the fallback in AuthService.validateAuth will keep throwing—worth either updating or removing to avoid latent runtime errors and confusion.
Low: The original root login page at src/routes/+page.svelte:1 is now unreachable because hooks.server.js:149 redirects unauthenticated traffic to /login and authenticated traffic to /workspace. Keeping both versions around is dead code and risks future drift.
Next Steps

1. Remove the updateCachedKey calls to stop the runtime regressions when saving auth settings.
2. Upsert OAuth users into auth_users before calling SessionManager.createSession.
3. Always render the API keys form instead of keying off the deprecated terminal_key_set.
4. Retire MultiAuthManager to prevent silent SQL errors.
5. Drop the login page and use only the root page for login to keep the entry flow single-sourced.
