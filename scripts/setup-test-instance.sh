#!/usr/bin/env bash
#
# Dispatch Testing Instance Setup Script (API-based onboarding)
#
# Creates a fresh Dispatch instance in temporary directories, starts the server,
# and completes onboarding using the API endpoint (no direct DB manipulation).
#
# Usage:
#   ./scripts/setup-test-instance.sh [OPTIONS]
#
# Options:
#   --auto-onboard           Complete onboarding automatically (default)
#   --key KEY                Set custom TERMINAL_KEY (default: test-automation-key-12345)
#   --workspace PATH         Create workspace at PATH
#   --workspace-name NAME    Set workspace name (default: derived from path)
#   --port PORT              Server port (default: 7173)
#   --help                   Show this help message
#
# Examples:
#   ./scripts/setup-test-instance.sh --auto-onboard
#   ./scripts/setup-test-instance.sh --auto-onboard --key "my-key" --workspace "/workspace/myapp"

set -euo pipefail

AUTO_ONBOARD=true
TERMINAL_KEY="test-automation-key-12345"
WORKSPACE_PATH=""
WORKSPACE_NAME=""
PORT=7173

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }
show_help()   { sed -n '2,28p' "$0" | sed 's/^# //' | sed 's/^#//'; exit 0; }

while [[ $# -gt 0 ]]; do
    case $1 in
        --auto-onboard)
            AUTO_ONBOARD=true
            shift
            ;;
        --key)
            TERMINAL_KEY="$2"
            shift 2
            ;;
        --workspace)
            WORKSPACE_PATH="$2"
            shift 2
            ;;
        --workspace-name)
            WORKSPACE_NAME="$2"
            shift 2
            ;;
        --port)
            PORT="$2"
            shift 2
            ;;
        --help)
            show_help
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Create temporary directories
TEST_HOME=$(mktemp -d /tmp/dispatch-test-home.XXXXXX)
TEST_WORKSPACES=$(mktemp -d /tmp/dispatch-test-workspaces.XXXXXX)

log_info "Created temporary directories:"
log_info "  HOME: $TEST_HOME"
log_info "  WORKSPACES_ROOT: $TEST_WORKSPACES"

# Kill any process using the port
log_info "Checking for processes using port $PORT..."
if lsof -ti:$PORT > /dev/null 2>&1; then
    log_warn "Port $PORT is in use, killing existing processes..."
    lsof -ti:$PORT | xargs kill -9 2>/dev/null || true
    sleep 1
    log_success "Cleared port $PORT"
fi

# Start the dev server in the background
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

log_info "Starting dev server on port $PORT..."
HOME="$TEST_HOME" WORKSPACES_ROOT="$TEST_WORKSPACES" TERMINAL_KEY="$TERMINAL_KEY" SSL_ENABLED=false PORT="$PORT" npx vite dev --host --port "$PORT" &
SERVER_PID=$!

# Wait for server to be ready
log_info "Waiting for server to be ready..."
for i in {1..30}; do
    if curl -s "http://localhost:$PORT/api/status" | grep -q 'onboarding'; then
        log_success "Server is up!"
        break
    fi
    sleep 1
    if [[ $i -eq 30 ]]; then
        log_error "Server did not start within 30 seconds."
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
done

# Complete onboarding via API if requested
if [[ "$AUTO_ONBOARD" == "true" ]]; then
    log_info "Completing onboarding via API..."
    JSON_BODY="{\"terminalKey\": \"$TERMINAL_KEY\""
    if [[ -n "$WORKSPACE_PATH" ]]; then
        JSON_BODY+="\n, \"workspaceName\": \"${WORKSPACE_NAME:-$(basename "$WORKSPACE_PATH")}\", \"workspacePath\": \"$WORKSPACE_PATH\""
    fi
    JSON_BODY+="}"
    RESPONSE=$(curl -s -X POST "http://localhost:$PORT/api/settings/onboarding" \
        -H "Content-Type: application/json" \
        -d "$JSON_BODY")
    if echo "$RESPONSE" | grep -q 'success'; then
        log_success "Onboarding completed!"
    else
        log_error "Onboarding failed: $RESPONSE"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
fi

# Print configuration summary
echo ""
log_success "Test instance created and server started!"
echo ""
echo "Configuration:"
echo "  Home Directory:    $TEST_HOME"
echo "  Workspaces Root:   $TEST_WORKSPACES"
echo "  Terminal Key:      $TERMINAL_KEY"
echo "  Port:              $PORT"
echo "  Workspace Path:    $WORKSPACE_PATH"
echo "  Workspace Name:    ${WORKSPACE_NAME:-$(basename "$WORKSPACE_PATH")}"
echo "  Server PID:        $SERVER_PID"
echo ""
echo "Environment variables:"
echo "  export HOME=\"$TEST_HOME\""
echo "  export WORKSPACES_ROOT=\"$TEST_WORKSPACES\""
echo "  export TERMINAL_KEY=\"$TERMINAL_KEY\""
echo "  export SSL_ENABLED=false"
echo "  export PORT=$PORT"
echo ""
echo "To connect:"
echo "  Open http://localhost:$PORT in your browser"
echo "  Use terminal key: $TERMINAL_KEY"
echo ""
echo "To clean up this instance later:"
echo "  kill $SERVER_PID"
echo "  rm -rf \"$TEST_HOME\" \"$TEST_WORKSPACES\""
echo ""
