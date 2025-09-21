# Troubleshooting Dispatch

## Troubleshooting Sandbox Issues

**AI Agent Can't Access Files:**

```bash
# Check mount permissions
ls -la ~/dispatch/workspace
docker exec dispatch-sandbox ls -la /workspace
```

**Container Won't Start:**

```bash
# Check Docker status and logs
docker ps -a
docker logs dispatch-sandbox
```

**Permission Errors:**

```bash
# Fix ownership issues
sudo chown -R $(id -u):$(id -g) ~/dispatch/
```