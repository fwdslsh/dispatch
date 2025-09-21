
# Manual Setup for Advanced Configuration

For more control over your sandbox environment:

```bash
# Create sandbox directory structure
mkdir -p ~/dispatch/{home,projects,config}

# Copy essential configurations (optional)
cp ~/.bashrc ~/.gitconfig ~/dispatch/home/ 2>/dev/null || true
cp -r ~/.claude ~/dispatch/home/ 2>/dev/null || true

# Start with explicit mounts
docker run -d -p 3030:3030 \
  -e TERMINAL_KEY=sandbox-key-$(date +%s) \
  -e PROJECT_SANDBOX_ENABLED=true \
  -v ~/dispatch/home:/home/appuser \
  -v ~/dispatch/projects:/workspace \
  -v ~/dispatch/config:/config \
  -v ~/.ssh:/home/appuser/.ssh:ro \
  --name dispatch-sandbox \
  fwdslsh/dispatch:latest
```

## Workspace Sharing Patterns

### Pattern 1: Shared Development Workspace

```bash
# Mount a specific project directory for AI collaboration
dispatch start \
  --projects ~/my-ai-projects \
  --home ~/dispatch/home \
  --ssh ~/.ssh

# AI agents can access files in ~/my-ai-projects
# Host system remains protected in ~/dispatch/home
```

### Pattern 2: Temporary Sandbox

```bash
# Create temporary workspace for experimentation
mkdir -p /tmp/ai-sandbox
dispatch start \
  --projects /tmp/ai-sandbox \
  --home ~/dispatch/home

# Perfect for testing AI-generated code safely
```

### Pattern 3: Protected Production Setup

```bash
# Production setup with read-only host access
dispatch start \
  --projects ~/dispatch/projects \
  --home ~/dispatch/home \
  --config ~/.config:ro \
  --ssh ~/.ssh:ro

# AI agents work in isolation, critical configs are protected
```

## Sample AI Agent Workflows

### Code Review & Analysis

```bash
# Start sandbox for code analysis
dispatch start --projects ~/code-review --open

# In the web terminal:
# 1. Clone repository: git clone <repo-url>
# 2. Create Claude session for code review
# 3. AI analyzes code safely in isolated environment
# 4. Results saved to ~/code-review on host
```

### Data Processing Pipeline

```bash
# Set up data processing sandbox
mkdir -p ~/ai-data/{input,output,temp}
dispatch start --projects ~/ai-data --open

# Mount data directories:
# - input/: Raw data files (read-only)
# - output/: Processed results
# - temp/: Temporary processing files
```

### Collaborative Development

```bash
# Enable public access for team collaboration
dispatch start \
  --projects ~/team-project \
  --tunnel --subdomain team-ai-workspace \
  --open

# Share the tunnel URL with team members
# Multiple people can collaborate with AI in the same environment
```
