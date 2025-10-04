# Dispatch Release Notes & Quick Start

## 🚀 Quick Install & Start

**Install the Dispatch CLI:**

```bash
curl -fsSL https://raw.githubusercontent.com/fwdslsh/dispatch/main/install.sh | bash
```

**Initialize and Start:**

```bash
dispatch init
dispatch start
# Open http://localhost:3030 in your browser
```

_Requires bash and Docker_

---

## Configuration

Dispatch uses environment variables for configuration. After `dispatch init`, see `~/dispatch/home/.env`:

| Variable          | Default                          | Description                    |
| ----------------- | -------------------------------- | ------------------------------ |
| `TERMINAL_KEY`    | `change-me-to-a-strong-password` | **Required** - Access password |
| `PORT`            | `3030`                           | Web interface port             |
| `WORKSPACES_ROOT` | `/workspace`                     | Project directory              |
| `ENABLE_TUNNEL`   | `false`                          | Public URL sharing             |
| `LT_SUBDOMAIN`    | `""`                             | Custom subdomain               |

---

## Using Docker Directly

```bash
mkdir -p ~/dispatch/{home,workspace}
docker run -d -p 3030:3030 \
  --env-file ~/dispatch/home/.env \
  -v ~/dispatch/workspace:/workspace \
  -v ~/dispatch/home:/home/dispatch \
  --name dispatch fwdslsh/dispatch:latest
```

---

## Documentation & Support

- [Full Documentation](https://github.com/fwdslsh/dispatch/tree/main/docs)
- [GitHub Issues](https://github.com/fwdslsh/dispatch/issues)

---
