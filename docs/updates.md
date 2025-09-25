# Authentication and Hosting Requirements Outline

## 1. Core Use Cases & Modes of Operation

### 1.1 LAN-only (local network access)

- Fully functional with no Internet dependency.
- Default auth does not require external IdP.
- Minimal setup (shared access code/device pairing).
- Optional **mkcert-based** HTTPS for trusted, warning-free access on devices where trust is installed.

### 1.2 Remote access (outside LAN)

- One-click exposure via **LocalTunnel** (no domain purchase or DNS).
- App adapts to a public HTTPS origin (cookies/CORS/callbacks).
- Public URL changes are detected and **auto-applied** across security settings and auth callbacks.

### 1.3 Mixed / transitional scenarios

- Seamless transition from LAN-only → remote and back.
- Auth mechanism can be switched (local → OAuth/Passkey/Proxy) without data model changes or container rebuilds.
- System tolerates changing public URLs (with passkey caveats).

---

## 2. Authentication / Authorization Capabilities

### 2.1 Default “local” auth fallback

- Access code / device pairing suitable for home use.
- Household multi-device sessions.
- Central revocation and logout.

### 2.2 Optional stronger / advanced auth

- **WebAuthn / Passkeys**: enabled only when HTTPS + valid rpID for current hostname.
- **OAuth** (Google, GitHub, etc.) as optional paths.
- **Proxy / Reverse-proxy auth**: trust well-scoped headers from Authelia/Authentik/etc.

### 2.3 Auth mode flexibility

- Toggle modes (local, passkey, OAuth, proxy) **via settings** (DB-backed).
- Login UI reflects currently allowed modes and runtime context (e.g., passkeys hidden when rpID invalid).

---

## 3. Configuration & Persistence

- All operational settings are persisted in a **database/settings store** (not env), including:
  - Enabled auth modes
  - OAuth credentials & metadata
  - Current **public URL** (auto-updated)
  - Passkey rpID / origin
  - Rate limits & security policies
  - **Tunnel preferences** (enabled flag, preferred subdomain, reconnect policy)
  - **HTTPS profiles** (active profile, cert source, renewal status)

- Minimal bootstrap secret to create initial admin; thereafter managed in-app.
- Config changes apply at runtime (no rebuild required).

---

## 4. Session / Cookie / Security Policy

- Cookies: `HttpOnly`, `SameSite=Lax` (or stricter), `Secure` when on HTTPS.
- CSRF protection for state-changing routes.
- Rate limiting on login/pairing and other attack surfaces.
- CORS/origin checks locked to configured origin(s) (LAN and/or current public URL).
- **HSTS** enabled when HTTPS and public origin are stable/intentional.

---

## 5. Passkey / WebAuthn Constraints

- Requires secure context (HTTPS).
- **rpID must match hostname**; changing hostnames (e.g., new LocalTunnel subdomain) invalidates existing passkeys.
- UI dynamically shows/hides passkey options based on HTTPS + rpID validity.
- Support registration (attestation) and authentication (assertion).
- Admin warnings when changing hostnames that would invalidate passkeys.

---

## 6. OAuth / External Login Constraints

- Client IDs/secrets stored securely in the settings store.
- **Redirect/callback URIs update automatically** when public URL changes.
- Graceful degradation if OAuth not configured or temporarily down (fall back to local login).

---

## 7. Remote Tunnel / Public Exposure Support (LocalTunnel)

- Built-in **LocalTunnel** integration:
  - **Enable/disable** tunnel from the UI.
  - Set **preferred subdomain**.
  - On connect/reconnect, **auto-update public URL** in settings and propagate to:
    - Cookie `Secure` & `SameSite` behavior
    - CORS allowed origins
    - OAuth redirect URIs
    - WebAuthn rpID eligibility

- Status panel shows tunnel state, assigned URL, and reconnect/backoff info.
- Security guidance in-app when exposing publicly (e.g., enable stronger auth, rate limits).
- (Note: LocalTunnel provides TLS at the public edge; custom certs are managed by the tunnel provider.)

---

## 8. Admin / Device Management & Control

- Admin UI for:
  - View/revoke device sessions.
  - Rotate the local access code/secret.
  - Enable/disable auth modes (local/OAuth/passkey/proxy).
  - **Start/stop LocalTunnel**, set preferred subdomain, view status.
  - Update/inspect **HTTPS profile** (mkcert, Let’s Encrypt, tunnel TLS).
  - Review configuration health (WebAuthn readiness, OAuth validity, HSTS on/off).
  - Trigger re-evaluation/reload of security headers after URL/cert changes.

---

## 9. Migration / Stability Considerations

- Transition from LAN-only → remote without losing users/sessions.
- Changes to auth mode or public URL don’t require redeploys or data loss.
- Explicit warnings for passkey breakage when hostname changes.
- Safe rollback: previous configuration snapshots retained in settings history.

---

## 10. Deployment & Operational Constraints

- Runs in a single container with minimal dependencies.
- Example **Docker Compose** may be provided, but not required.
- Persist database/settings and (if used) cert materials on a mounted volume.
- No external services required for LAN auth.
- Remote mode works via LocalTunnel without domain ownership.
- Health/readiness endpoints reflect current auth/origin/cert posture.

---

## 11. HTTPS & Certificate Profiles

- **Profiles** (selectable in settings):
  1. **Tunnel TLS (LocalTunnel)**
     - HTTPS terminated by LocalTunnel; app treats origin as public HTTPS.
     - No local cert management; relies on tunnel’s certs.

  2. **LAN HTTPS via mkcert**
     - Admin generates/imports mkcert cert/key; app serves HTTPS locally.
     - Trust chain must be installed on client devices to avoid warnings.
     - Supports hostname changes by regenerating certs; UI to upload/rotate.

  3. **Public HTTPS via Let’s Encrypt**
     - For admins with a real domain pointing to the app (not the tunnel hostname).
     - ACME provisioning/renewal managed by the app; auto-renew and **auto-switch** callbacks/CORS/HSTS on success.
     - Clear guidance on domain control and port/HTTP-01/ALPN-01 requirements.

- Certificate storage is encrypted at rest in the app’s settings store or on a protected volume.
- UI shows certificate state (issuer, expiry), renewal status, and remediation steps.

---

## 12. Observability, Status & Safe Controls

- **Security Posture** widget: HTTPS on/off, HSTS, passkey readiness, OAuth validity, tunnel status.
- **Change Impact Notices**: Display effects of URL/cert/auth changes (e.g., “This will invalidate existing passkeys”).
- **Dry-run/Preview** mode for config changes (where feasible).
- Audit log of admin actions that affect auth/tunnel/certs.

---

### Notes & Constraints (informational, not implementation)

- Passkeys are origin-bound: rotating LocalTunnel subdomains changes rpID and invalidates prior registrations. The UI must make this explicit.
- Let’s Encrypt requires control of a stable domain that resolves to the app—**not** applicable to arbitrary LocalTunnel hostnames you don’t own.
- mkcert is ideal for LAN; clients must trust the local CA once per device to avoid warnings.

## Capability Matrix

Here’s a **capability matrix** showing how the app behaves across three common deployment modes: **LAN-only**, **LocalTunnel (public URL)**, and **Custom Domain with Let’s Encrypt**.

| **Capability**                            | **LAN-Only** (Local Network)                                            | **Remote Access via LocalTunnel**                                                                    | **Public HTTPS via Custom Domain + Let’s Encrypt**                                |
| ----------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Primary Use Case**                      | Home/private network, no Internet dependency.                           | Secure external access without domain purchase or DNS setup.                                         | Production-grade external access with stable domain and TLS cert.                 |
| **Authentication Defaults**               | Simple local auth (access code/device pairing).                         | Local auth + optional WebAuthn/OAuth if enabled.                                                     | Full WebAuthn, OAuth, proxy auth.                                                 |
| **WebAuthn / Passkeys**                   | Optional with mkcert HTTPS. rpID = LAN hostname or IP.                  | Supported but **rpID tied to tunnel subdomain** → new subdomain invalidates existing passkeys.       | Fully supported. Stable domain ensures passkey continuity.                        |
| **OAuth Support**                         | Optional but requires HTTPS via mkcert. Callback URL = LAN IP/hostname. | Supported. Callback URL auto-updates when tunnel URL changes.                                        | Fully supported with stable callback URL.                                         |
| **Certificate Management**                | mkcert (self-signed CA installed on client devices).                    | TLS provided automatically by LocalTunnel. No local certs needed.                                    | Automatic issuance/renewal via Let’s Encrypt ACME flow.                           |
| **Cookie Security (`Secure` flag, etc.)** | Optional (`Secure` disabled if HTTP).                                   | Always `Secure` because tunnel enforces HTTPS.                                                       | Always `Secure` because HTTPS required.                                           |
| **CORS / Origin Control**                 | Origin limited to LAN IP/hostname.                                      | Dynamically updates to tunnel hostname.                                                              | Fixed stable domain origin.                                                       |
| **Public URL Handling**                   | Not applicable.                                                         | Tunnel URL auto-updates in app settings when LocalTunnel connects or reconnects.                     | Manually configured stable domain.                                                |
| **Admin Control of Tunnel**               | N/A                                                                     | Start/stop tunnel, set preferred subdomain, view tunnel status.                                      | N/A                                                                               |
| **HSTS Support**                          | Disabled by default, optional with mkcert.                              | Enabled automatically for tunnel domains.                                                            | Enabled automatically after Let’s Encrypt cert issuance.                          |
| **User Setup Complexity**                 | Very low – no external dependencies.                                    | Low – no DNS or domain purchase required.                                                            | Moderate – requires domain ownership and DNS configuration.                       |
| **Security Risk Surface**                 | Local network only, minimal exposure.                                   | Public exposure with rotating subdomains → strong rate limiting and local auth strongly recommended. | Public exposure with stable domain → strong auth required, passkeys fully stable. |
| **Use Case Fit**                          | Families, home labs, local-only apps.                                   | Temporary demos, hobby projects, remote troubleshooting.                                             | Long-term stable deployment, production hosting.                                  |

---

### **Key Notes**

- **Passkeys & rpID**
  - LocalTunnel subdomains change periodically → existing passkeys become invalid when the hostname changes.
  - Stable domains via Let’s Encrypt avoid this issue.

- **LocalTunnel TLS**
  - HTTPS is handled at the tunnel edge automatically.
  - Internal app connections remain HTTP inside the container.

- **mkcert vs. Let’s Encrypt**
  - Use mkcert for trusted HTTPS in a LAN environment by installing a local CA certificate on client devices.
  - Use Let’s Encrypt when you have a stable public domain.
