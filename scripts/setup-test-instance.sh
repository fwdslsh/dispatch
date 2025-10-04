#!/usr/bin/env bash
#
# Dispatch Testing Instance Setup Script
#
# Creates a fresh Dispatch instance in temporary directories with options
# to automatically complete onboarding and seed the database.
#
# Usage:
#   ./scripts/setup-test-instance.sh [OPTIONS]
#
# Options:
#   --auto-onboard           Complete onboarding automatically
#   --key KEY                Set custom TERMINAL_KEY (default: test-automation-key-12345)
#   --workspace PATH         Create workspace at PATH (requires --auto-onboard)
#   --workspace-name NAME    Set workspace name (default: derived from path)
#   --port PORT              Server port (default: 7173)
#   --start                  Start the dev server after setup
#   --print-home             Print HOME directory path and exit
#   --help                   Show this help message
#
# Examples:
#   # Create fresh instance with auto-onboarding
#   ./scripts/setup-test-instance.sh --auto-onboard
#
#   # Create instance with custom key and workspace
#   ./scripts/setup-test-instance.sh --auto-onboard --key "my-key" --workspace "/workspace/myapp"
#
#   # Create instance and start server
#   ./scripts/setup-test-instance.sh --auto-onboard --start
#

set -euo pipefail

# Default configuration
AUTO_ONBOARD=false
TERMINAL_KEY="test-automation-key-12345"
WORKSPACE_PATH=""
WORKSPACE_NAME=""
PORT=7173
START_SERVER=false
PRINT_HOME=false

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    sed -n '2,27p' "$0" | sed 's/^# //' | sed 's/^#//'
    exit 0
}

# Parse command line arguments
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
        --start)
            START_SERVER=true
            shift
            ;;
        --print-home)
            PRINT_HOME=true
            shift
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

# Validate configuration
if [[ -n "$WORKSPACE_PATH" && "$AUTO_ONBOARD" == "false" ]]; then
    log_error "--workspace requires --auto-onboard"
    exit 1
fi

if [[ -n "$WORKSPACE_NAME" && -z "$WORKSPACE_PATH" ]]; then
    log_error "--workspace-name requires --workspace"
    exit 1
fi

# Create temporary directories
TEST_HOME=$(mktemp -d /tmp/dispatch-test-home.XXXXXX)
TEST_WORKSPACES=$(mktemp -d /tmp/dispatch-test-workspaces.XXXXXX)

log_info "Created temporary directories:"
log_info "  HOME: $TEST_HOME"
log_info "  WORKSPACES_ROOT: $TEST_WORKSPACES"

# If just printing home, do it and exit
if [[ "$PRINT_HOME" == "true" ]]; then
    echo "$TEST_HOME"
    exit 0
fi

# Create .dispatch directory structure
DISPATCH_DIR="$TEST_HOME/.dispatch"
DATA_DIR="$DISPATCH_DIR/data"
mkdir -p "$DATA_DIR"

log_success "Created .dispatch directory structure"

# Database path
DB_PATH="$DATA_DIR/workspace.db"

# Initialize SQLite database with schema
log_info "Initializing SQLite database..."

# We'll use a minimal Node.js script to initialize the database properly
# This ensures we use the same schema as the application
NODE_SCRIPT=$(cat <<'EOF'
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.argv[2];
const autoOnboard = process.argv[3] === 'true';
const terminalKey = process.argv[4];
const workspacePath = process.argv[5] || '';
const workspaceName = process.argv[6] || '';

const db = new sqlite3.Database(dbPath);

// Helper to promisify db operations
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

async function initDatabase() {
    // Enable WAL mode
    await run('PRAGMA journal_mode=WAL');
    await run('PRAGMA foreign_keys=ON');
    
    // Create sessions table
    await run(`
        CREATE TABLE IF NOT EXISTS sessions (
            run_id TEXT PRIMARY KEY,
            owner_user_id TEXT,
            kind TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            meta_json TEXT NOT NULL
        )
    `);
    
    // Create session_events table
    await run(`
        CREATE TABLE IF NOT EXISTS session_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            seq INTEGER NOT NULL,
            channel TEXT NOT NULL,
            type TEXT NOT NULL,
            payload BLOB NOT NULL,
            ts INTEGER NOT NULL,
            FOREIGN KEY (run_id) REFERENCES sessions(run_id)
        )
    `);
    
    // Create workspace_layout table
    await run(`
        CREATE TABLE IF NOT EXISTS workspace_layout (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL,
            client_id TEXT NOT NULL,
            tile_id TEXT NOT NULL,
            created_at INTEGER,
            updated_at INTEGER,
            UNIQUE(run_id, client_id)
        )
    `);
    
    // Create workspaces table
    await run(`
        CREATE TABLE IF NOT EXISTS workspaces (
            path TEXT PRIMARY KEY,
            name TEXT,
            last_active INTEGER,
            created_at INTEGER,
            updated_at INTEGER
        )
    `);
    
    // Create settings table
    await run(`
        CREATE TABLE IF NOT EXISTS settings (
            category TEXT PRIMARY KEY,
            settings_json TEXT NOT NULL,
            description TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
    `);
    
    // Create user_preferences table
    await run(`
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id TEXT NOT NULL,
            category TEXT NOT NULL,
            preferences_json TEXT NOT NULL DEFAULT '{}',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, category)
        )
    `);
    
    console.log('✓ Database schema created');
    
    if (autoOnboard) {
        const now = Date.now();
        const isoNow = new Date().toISOString();
        
        // Insert authentication settings
        await run(`
            INSERT INTO settings (category, settings_json, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `, [
            'authentication',
            JSON.stringify({ terminal_key: terminalKey }),
            'Test authentication settings',
            now,
            now
        ]);
        
        console.log('✓ Authentication configured');
        
        // Insert onboarding completion
        const onboardingData = {
            isComplete: true,
            completedAt: isoNow,
            firstWorkspaceId: workspacePath || null
        };
        
        await run(`
            INSERT INTO settings (category, settings_json, description, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        `, [
            'onboarding',
            JSON.stringify(onboardingData),
            'Automated test onboarding',
            now,
            now
        ]);
        
        console.log('✓ Onboarding marked complete');
        
        // Create workspace if provided
        if (workspacePath) {
            const wsName = workspaceName || workspacePath.split('/').filter(Boolean).pop() || 'Test Workspace';
            
            await run(`
                INSERT INTO workspaces (path, name, last_active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
            `, [workspacePath, wsName, now, now, now]);
            
            console.log(`✓ Workspace created: ${workspacePath}`);
        }
    }
}

initDatabase()
    .then(() => {
        db.close();
        process.exit(0);
    })
    .catch(err => {
        console.error('Error initializing database:', err);
        process.exit(1);
    });
EOF
)

# Create a temporary Node.js script file
TEMP_SCRIPT=$(mktemp /tmp/dispatch-init-db.XXXXXX.mjs)
echo "$NODE_SCRIPT" > "$TEMP_SCRIPT"

# Run the database initialization script
if node "$TEMP_SCRIPT" "$DB_PATH" "$AUTO_ONBOARD" "$TERMINAL_KEY" "$WORKSPACE_PATH" "$WORKSPACE_NAME"; then
    log_success "Database initialized successfully"
else
    log_error "Failed to initialize database"
    rm -f "$TEMP_SCRIPT"
    exit 1
fi

# Clean up temporary script
rm -f "$TEMP_SCRIPT"

# Create workspace directory if specified
if [[ -n "$WORKSPACE_PATH" ]]; then
    FULL_WORKSPACE_PATH="$TEST_WORKSPACES${WORKSPACE_PATH#/workspace}"
    mkdir -p "$FULL_WORKSPACE_PATH"
    log_success "Created workspace directory: $FULL_WORKSPACE_PATH"
fi

# Print configuration summary
echo ""
log_success "Test instance created successfully!"
echo ""
echo "Configuration:"
echo "  Home Directory:    $TEST_HOME"
echo "  Workspaces Root:   $TEST_WORKSPACES"
echo "  Database:          $DB_PATH"
echo "  Terminal Key:      $TERMINAL_KEY"
echo "  Port:              $PORT"
echo "  Auto-onboarded:    $AUTO_ONBOARD"
if [[ -n "$WORKSPACE_PATH" ]]; then
    echo "  Workspace Path:    $WORKSPACE_PATH"
    echo "  Workspace Name:    ${WORKSPACE_NAME:-$(basename "$WORKSPACE_PATH")}"
fi
echo ""

# Export environment variables
echo "Environment variables:"
echo "  export HOME=\"$TEST_HOME\""
echo "  export WORKSPACES_ROOT=\"$TEST_WORKSPACES\""
echo "  export TERMINAL_KEY=\"$TERMINAL_KEY\""
echo "  export SSL_ENABLED=false"
echo "  export PORT=$PORT"
echo ""

# Optionally start the server
if [[ "$START_SERVER" == "true" ]]; then
    log_info "Starting dev server..."
    echo ""
    
    # Find the project root (where package.json is)
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
    
    cd "$PROJECT_ROOT"
    
    exec env \
        HOME="$TEST_HOME" \
        WORKSPACES_ROOT="$TEST_WORKSPACES" \
        TERMINAL_KEY="$TERMINAL_KEY" \
        SSL_ENABLED=false \
        PORT="$PORT" \
        npm run dev -- --host
else
    echo "To start the server with this instance:"
    echo ""
    echo "  HOME=\"$TEST_HOME\" WORKSPACES_ROOT=\"$TEST_WORKSPACES\" TERMINAL_KEY=\"$TERMINAL_KEY\" SSL_ENABLED=false PORT=$PORT npm run dev -- --host"
    echo ""
    echo "Or source these variables and run:"
    echo ""
    echo "  export HOME=\"$TEST_HOME\""
    echo "  export WORKSPACES_ROOT=\"$TEST_WORKSPACES\""
    echo "  export TERMINAL_KEY=\"$TERMINAL_KEY\""
    echo "  export SSL_ENABLED=false"
    echo "  export PORT=$PORT"
    echo "  npm run dev -- --host"
    echo ""
fi

# Cleanup instructions
echo "To clean up this instance later:"
echo "  rm -rf \"$TEST_HOME\" \"$TEST_WORKSPACES\""
echo ""
