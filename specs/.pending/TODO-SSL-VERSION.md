# TODO: SSL Configuration and Version Management Fixes

## Overview

This document outlines the work needed to fix SSL configuration issues and ensure proper Docker image version management in the Dispatch container system.

## Critical Issues

### 1. SSL Mode Configuration Issues

**Current Problem:**
- When `SSL_MODE=self-signed` or `SSL_MODE=letsencrypt`, the container fails to start
- Error: `nginx: [emerg] unknown directive "http2" in /etc/nginx/nginx.conf:48`
- Root cause: nginx configuration uses deprecated `http2` directive syntax

**Impact:**
- Users cannot use SSL (self-signed or Let's Encrypt) modes
- Only `SSL_MODE=disabled` works currently
- Limits production deployment options

### 2. DISPATCH_VERSION Verification Gap

**Current Problem:**
- `DISPATCH_VERSION` environment variable sets the Docker image tag
- No verification that the started container is actually using the specified version
- Could lead to confusion if wrong image is running

**Impact:**
- Users may think they're running a specific version but actually running a different one
- Debugging version-specific issues becomes harder

---

## Task Breakdown

### Phase 1: SSL Configuration Fix

#### Task 1.1: Diagnose nginx Configuration
**Priority:** HIGH
**Estimated Effort:** 1-2 hours

**Subtasks:**
- [ ] Connect to running container: `docker exec -it dispatch bash`
- [ ] Locate nginx configuration: `find /etc/nginx -name "*.conf"`
- [ ] Review nginx.conf and site configurations
- [ ] Identify all uses of `http2` directive
- [ ] Check nginx version: `nginx -v`
- [ ] Research nginx version requirements for http2 directive vs listen directive

**Expected Findings:**
- nginx version number
- Exact location and syntax of `http2` directive
- Whether nginx was compiled with http2 support

**Files to Check:**
```bash
/etc/nginx/nginx.conf
/etc/nginx/conf.d/*.conf
/etc/nginx/sites-enabled/*
```

#### Task 1.2: Update nginx Configuration for Modern Syntax
**Priority:** HIGH
**Estimated Effort:** 2-3 hours

**Background:**
- nginx 1.25.1+ deprecated standalone `http2` directive
- Modern syntax: `listen 443 ssl http2;` (combined)
- Old syntax: `listen 443 ssl;` + `http2 on;` (separate, now deprecated)

**Subtasks:**
- [ ] Locate Dockerfile or entrypoint.sh that generates nginx configs
- [ ] Update nginx configuration generation to use modern syntax
- [ ] Replace `http2 on;` with `listen 443 ssl http2;` in all configs
- [ ] Ensure http2 module is loaded in nginx build
- [ ] Test with `nginx -t` for configuration validation

**Files to Modify:**
```
docker/entrypoint.sh (if config is generated at runtime)
docker/nginx-templates/ (if using templates)
OR
docker/nginx.conf (if static config)
```

**Modern nginx Configuration Template:**
```nginx
server {
    listen 443 ssl http2;  # Combined in single directive
    listen [::]:443 ssl http2;

    server_name ${SSL_DOMAIN};

    ssl_certificate /etc/ssl/dispatch/fullchain.pem;
    ssl_certificate_key /etc/ssl/dispatch/privkey.pem;

    # ... rest of config
}
```

#### Task 1.3: Test Self-Signed SSL Mode
**Priority:** HIGH
**Estimated Effort:** 1 hour

**Subtasks:**
- [ ] Update .env: `SSL_MODE=self-signed`
- [ ] Update .env: `SSL_DOMAIN=localhost`
- [ ] Stop container: `./bin/dispatch stop`
- [ ] Start container: `./bin/dispatch start --verbose`
- [ ] Check logs: `docker logs dispatch`
- [ ] Verify nginx starts successfully
- [ ] Test HTTPS: `curl -k https://localhost:3030`
- [ ] Verify self-signed cert: `openssl s_client -connect localhost:3030`

**Success Criteria:**
- Container starts without errors
- HTTPS responds with 200 status
- Self-signed certificate is valid

#### Task 1.4: Test Let's Encrypt SSL Mode
**Priority:** MEDIUM
**Estimated Effort:** 2-3 hours

**Prerequisites:**
- Requires publicly accessible domain name
- Requires ports 80 and 443 accessible from internet
- DNS A record pointing to server

**Subtasks:**
- [ ] Set up test domain (e.g., dispatch-test.yourdomain.com)
- [ ] Update .env: `SSL_MODE=letsencrypt`
- [ ] Update .env: `SSL_DOMAIN=dispatch-test.yourdomain.com`
- [ ] Update .env: `LETSENCRYPT_EMAIL=your@email.com`
- [ ] Ensure ports 80/443 mapped: `--port 80:80 --port 443:443`
- [ ] Start container: `./bin/dispatch start --verbose`
- [ ] Monitor certbot logs for certificate request
- [ ] Verify Let's Encrypt cert: `curl -v https://dispatch-test.yourdomain.com`
- [ ] Test auto-renewal: check certbot cron/timer

**Success Criteria:**
- Container starts without errors
- Let's Encrypt certificates obtained successfully
- HTTPS responds with valid certificate
- Certificate auto-renewal configured

#### Task 1.5: Update Documentation
**Priority:** MEDIUM
**Estimated Effort:** 1 hour

**Subtasks:**
- [ ] Update README.md with SSL configuration examples
- [ ] Document SSL mode options (disabled, self-signed, letsencrypt)
- [ ] Add troubleshooting section for SSL issues
- [ ] Document port requirements for Let's Encrypt mode
- [ ] Update CLI help text with SSL examples
- [ ] Add SSL configuration to quickstart guide

**Files to Update:**
```
README.md
docs/configuration/ssl-setup.md (create new)
bin/dispatch (help text)
```

---

### Phase 2: Version Management Enhancement

#### Task 2.1: Add Image Tag Verification
**Priority:** MEDIUM
**Estimated Effort:** 1-2 hours

**Subtasks:**
- [ ] After `docker run`, get actual running container's image tag
- [ ] Compare with requested `DISPATCH_VERSION`
- [ ] Display warning if mismatch detected
- [ ] Add debug logging for image inspection

**Implementation:**
```bash
# In cmd_start() after container starts
log_debug "Verifying container image version..."

# Get the image ID of the running container
local running_image=$(docker inspect --format='{{.Image}}' "$CONTAINER_NAME" 2>/dev/null)

# Get the image tag from the ID
local running_tag=$(docker inspect --format='{{index .RepoTags 0}}' "$running_image" 2>/dev/null)

log_debug "Expected image: $DOCKER_IMAGE"
log_debug "Running image: $running_tag"

if [[ "$running_tag" != "$DOCKER_IMAGE" ]]; then
    log_warn "Container is running different image than expected"
    log_warn "  Expected: $DOCKER_IMAGE"
    log_warn "  Actual: $running_tag"
fi
```

**Success Criteria:**
- Script verifies container image matches DISPATCH_VERSION
- Warnings displayed when mismatch occurs
- Debug mode shows detailed image information

#### Task 2.2: Add Image Version Display in Status Command
**Priority:** LOW
**Estimated Effort:** 30 minutes

**Subtasks:**
- [ ] Modify `cmd_status()` to show container image tag
- [ ] Display DISPATCH_VERSION environment variable value
- [ ] Show if version mismatch exists

**Implementation:**
```bash
# In cmd_status()
if is_container_running; then
    log_success "Container '$CONTAINER_NAME' is running"

    # Show container details
    docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

    # Show version information
    local running_image=$(docker inspect --format='{{index .Config.Image}}' "$CONTAINER_NAME" 2>/dev/null)
    log_info "Container image: $running_image"

    if [[ -n "$DISPATCH_VERSION" ]]; then
        log_info "DISPATCH_VERSION: $DISPATCH_VERSION"
    fi

    # ... rest of status output
fi
```

**Success Criteria:**
- `dispatch status` shows current running image version
- Shows DISPATCH_VERSION if set
- Easy to identify version mismatches

#### Task 2.3: Add Version Pull Verification
**Priority:** LOW
**Estimated Effort:** 1 hour

**Subtasks:**
- [ ] Before starting container, verify image exists locally
- [ ] If missing, prompt user to run `dispatch update`
- [ ] Add `--pull` option to force image update before start
- [ ] Show image digest for verification

**Implementation:**
```bash
# In cmd_start()
check_docker

# Verify image exists
if ! docker image inspect "$DOCKER_IMAGE" >/dev/null 2>&1; then
    log_warn "Docker image '$DOCKER_IMAGE' not found locally"
    log_info "Run 'dispatch update' to pull the image first"
    exit 1
fi

log_debug "Docker image verified: $DOCKER_IMAGE"

# Optional: Show image digest
if [[ "$VERBOSE" == "true" ]]; then
    local image_digest=$(docker image inspect --format='{{.Id}}' "$DOCKER_IMAGE" 2>/dev/null)
    log_debug "Image digest: $image_digest"
fi
```

**Success Criteria:**
- Script verifies image exists before attempting start
- Clear error message if image is missing
- Optional --pull flag to update image automatically

---

## Testing Plan

### SSL Testing Matrix

| SSL Mode | Domain | Expected Result | Verification Method |
|----------|--------|----------------|-------------------|
| disabled | localhost | HTTP only, no nginx | `curl http://localhost:3030` → 200 |
| self-signed | localhost | HTTPS with self-signed cert | `curl -k https://localhost:3030` → 200 |
| letsencrypt | real domain | HTTPS with valid cert | `curl https://domain.com` → 200 |

### Version Testing Matrix

| Scenario | DISPATCH_VERSION | Expected Behavior |
|----------|------------------|-------------------|
| Not set | (empty) | Uses :latest tag |
| Set to version | 0.3.0 | Uses :0.3.0 tag |
| Set to rc | 0.3.0-rc-e16ea2f | Uses :0.3.0-rc-e16ea2f tag |
| Image missing | 0.9.9 | Error with helpful message |
| Mismatch | 0.3.0 (but 0.2.0 running) | Warning displayed |

### Manual Test Checklist

- [ ] Test fresh install with `dispatch init`
- [ ] Test SSL disabled mode (default)
- [ ] Test SSL self-signed mode
- [ ] Test SSL letsencrypt mode (requires domain)
- [ ] Test version setting with DISPATCH_VERSION
- [ ] Test version mismatch detection
- [ ] Test missing image scenario
- [ ] Test update command with specific version
- [ ] Test verbose logging for all commands
- [ ] Test start/stop/restart cycle
- [ ] Test port mapping customization
- [ ] Test workspace volume mounting

---

## Implementation Order

1. **SSL Fix (Phase 1)** - URGENT
   - Task 1.1: Diagnose nginx config (2 hours)
   - Task 1.2: Update nginx config (3 hours)
   - Task 1.3: Test self-signed SSL (1 hour)
   - Task 1.4: Test Let's Encrypt SSL (3 hours)
   - Task 1.5: Update documentation (1 hour)
   - **Total:** ~10 hours

2. **Version Management (Phase 2)** - MEDIUM PRIORITY
   - Task 2.1: Add image verification (2 hours)
   - Task 2.2: Enhance status command (30 min)
   - Task 2.3: Add pull verification (1 hour)
   - **Total:** ~3.5 hours

**Grand Total:** ~13.5 hours of development work

---

## Success Criteria

### SSL Fix Complete When:
- [ ] All three SSL modes work (disabled, self-signed, letsencrypt)
- [ ] No nginx configuration errors
- [ ] HTTPS connections successful
- [ ] Certificate generation automated
- [ ] Documentation updated
- [ ] No breaking changes to existing users

### Version Management Complete When:
- [ ] DISPATCH_VERSION reliably controls image tag
- [ ] Warnings shown for version mismatches
- [ ] Status command shows version info
- [ ] Missing images detected before start
- [ ] Debug logging shows image details

---

## Related Files

### SSL Configuration Files (likely in docker/)
```
docker/Dockerfile
docker/entrypoint.sh
docker/nginx-templates/
docker/nginx.conf
docker/certbot/
```

### CLI Script
```
bin/dispatch
```

### Documentation
```
README.md
docs/cli-guide.md
docs/configuration/ssl-setup.md (to be created)
```

---

## Notes and Considerations

### SSL Mode Behavior
- **disabled**: Node.js serves HTTP directly, no nginx
- **self-signed**: nginx with auto-generated self-signed certs
- **letsencrypt**: nginx with certbot for Let's Encrypt certs

### Version Management Considerations
- Default behavior (no DISPATCH_VERSION) should remain :latest
- Version mismatch warnings should be informative but not block startup
- Consider adding `--force-version` flag to pull specific version before start
- Image tag verification helps debug "works locally but not in container" issues

### Breaking Change Mitigation
- Ensure default behavior (SSL disabled) continues to work
- Test upgrade path for existing users
- Document migration steps if config changes needed
- Consider deprecation warnings before removing old SSL syntax support

### Future Enhancements
- Add `dispatch ssl-setup` interactive wizard
- Add `dispatch version` command to show/manage versions
- Support multiple named containers for version testing
- Add health checks to verify SSL certificates are valid
- Auto-renewal monitoring for Let's Encrypt certificates

---

## Questions to Resolve

1. **nginx Version**: What version of nginx is in the container? Need to check compatibility.
2. **Config Location**: Where is nginx config generated - Dockerfile, entrypoint, or templates?
3. **SSL Port Mapping**: Should script auto-map 443 when SSL is enabled?
4. **Version Pinning**: Should we recommend pinning versions in production .env files?
5. **Breaking Changes**: Is it acceptable to require config changes for SSL modes?

---

## References

- nginx http2 directive changes: https://nginx.org/en/docs/http/ngx_http_v2_module.html
- Let's Encrypt with Docker: https://docs.docker.com/compose/production/
- Docker image versioning best practices: https://docs.docker.com/engine/reference/commandline/tag/
