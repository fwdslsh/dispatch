#!/bin/bash
set -e

# Dispatch Installer Script
# Installs the dispatch CLI to a user-accessible bin directory

VERSION="0.1.2"
SCRIPT_NAME="dispatch"
REPO_URL="https://github.com/fwdslsh/dispatch"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Find the best installation directory
find_install_dir() {
    local candidates=(
        "$HOME/bin"
        "$HOME/.local/bin"
        "/usr/local/bin"
    )
    
    for dir in "${candidates[@]}"; do
        if [[ -d "$dir" ]] && [[ -w "$dir" ]]; then
            echo "$dir"
            return 0
        fi
    done
    
    # Try to create ~/bin if it doesn't exist
    if [[ ! -d "$HOME/bin" ]]; then
        if mkdir -p "$HOME/bin" 2>/dev/null; then
            echo "$HOME/bin"
            return 0
        fi
    fi
    
    echo ""
    return 1
}

# Check if directory is in PATH
is_in_path() {
    local dir="$1"
    [[ ":$PATH:" == *":$dir:"* ]]
}

# Add directory to PATH in shell profile
add_to_path() {
    local dir="$1"
    local shell_profile=""
    
    # Determine shell profile file
    if [[ -n "$BASH_VERSION" ]]; then
        if [[ -f "$HOME/.bashrc" ]]; then
            shell_profile="$HOME/.bashrc"
        elif [[ -f "$HOME/.bash_profile" ]]; then
            shell_profile="$HOME/.bash_profile"
        elif [[ -f "$HOME/.profile" ]]; then
            shell_profile="$HOME/.profile"
        fi
    elif [[ -n "$ZSH_VERSION" ]]; then
        shell_profile="$HOME/.zshrc"
    elif [[ -f "$HOME/.profile" ]]; then
        shell_profile="$HOME/.profile"
    fi
    
    if [[ -n "$shell_profile" ]]; then
        if ! grep -q "export PATH.*$dir" "$shell_profile" 2>/dev/null; then
            echo "" >> "$shell_profile"
            echo "# Added by dispatch installer" >> "$shell_profile"
            echo "export PATH=\"$dir:\$PATH\"" >> "$shell_profile"
            log_success "Added $dir to PATH in $shell_profile"
            return 0
        else
            log_info "$dir is already in PATH via $shell_profile"
            return 0
        fi
    fi
    
    return 1
}

# Install from current directory (for local development)
install_local() {
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local source_script="$script_dir/bin/$SCRIPT_NAME"
    
    if [[ ! -f "$source_script" ]]; then
        log_error "Source script not found: $source_script"
        log_info "Make sure you're running this from the dispatch repository root"
        exit 1
    fi
    
    local install_dir=$(find_install_dir)
    if [[ -z "$install_dir" ]]; then
        log_error "Could not find a writable directory to install to"
        log_info "Try creating ~/bin or ~/.local/bin directory first"
        exit 1
    fi
    
    local target_script="$install_dir/$SCRIPT_NAME"
    
    log_info "Installing dispatch CLI..."
    log_info "Source: $source_script"
    log_info "Target: $target_script"
    
    # Copy the script
    if cp "$source_script" "$target_script"; then
        chmod +x "$target_script"
        log_success "Installed $SCRIPT_NAME to $install_dir"
    else
        log_error "Failed to copy script to $install_dir"
        exit 1
    fi
    
    # Check if install directory is in PATH
    if ! is_in_path "$install_dir"; then
        log_warn "$install_dir is not in your PATH"
        
        if add_to_path "$install_dir"; then
            log_info "Restart your shell or run: source ~/.bashrc (or ~/.zshrc)"
        else
            log_warn "Could not automatically add to PATH"
            log_info "Add this line to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
            log_info "export PATH=\"$install_dir:\$PATH\""
        fi
    else
        log_success "$install_dir is already in your PATH"
    fi
    
    log_success "Installation complete!"
    log_info "Run 'dispatch help' to get started"
    
    return 0
}

# Download and install from GitHub
install_remote() {
    local install_dir=$(find_install_dir)
    if [[ -z "$install_dir" ]]; then
        log_error "Could not find a writable directory to install to"
        log_info "Try creating ~/bin or ~/.local/bin directory first"
        exit 1
    fi
    
    local target_script="$install_dir/$SCRIPT_NAME"
    local download_url="$REPO_URL/raw/main/bin/$SCRIPT_NAME"
    
    log_info "Downloading dispatch CLI from GitHub..."
    log_info "URL: $download_url"
    log_info "Target: $target_script"
    
    # Download the script using curl or wget
    if command -v curl >/dev/null 2>&1; then
        if curl -fsSL "$download_url" -o "$target_script"; then
            chmod +x "$target_script"
            log_success "Downloaded and installed $SCRIPT_NAME to $install_dir"
        else
            log_error "Failed to download script with curl"
            exit 1
        fi
    elif command -v wget >/dev/null 2>&1; then
        if wget -q "$download_url" -O "$target_script"; then
            chmod +x "$target_script"
            log_success "Downloaded and installed $SCRIPT_NAME to $install_dir"
        else
            log_error "Failed to download script with wget"
            exit 1
        fi
    else
        log_error "Neither curl nor wget is available"
        log_info "Please install curl or wget to use remote installation"
        exit 1
    fi
    
    # Check if install directory is in PATH
    if ! is_in_path "$install_dir"; then
        log_warn "$install_dir is not in your PATH"
        
        if add_to_path "$install_dir"; then
            log_info "Restart your shell or run: source ~/.bashrc (or ~/.zshrc)"
        else
            log_warn "Could not automatically add to PATH"
            log_info "Add this line to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
            log_info "export PATH=\"$install_dir:\$PATH\""
        fi
    else
        log_success "$install_dir is already in your PATH"
    fi
    
    log_success "Installation complete!"
    log_info "Run 'dispatch help' to get started"
    
    return 0
}

# Show help
show_help() {
    cat << EOF
Dispatch CLI Installer v$VERSION

This script installs the dispatch CLI to your system.

USAGE:
    ./install.sh [OPTIONS]

OPTIONS:
    --local          Install from local repository (default if bin/dispatch exists)
    --remote         Download and install from GitHub
    --help           Show this help message

EXAMPLES:
    ./install.sh            # Auto-detect local vs remote
    ./install.sh --local    # Install from current directory
    ./install.sh --remote   # Download from GitHub

The installer will:
1. Find a suitable installation directory (~/bin, ~/.local/bin, or /usr/local/bin)
2. Copy or download the dispatch script
3. Make it executable
4. Add the directory to your PATH if needed

For more information, visit: $REPO_URL
EOF
}

# Main function
main() {
    local install_mode=""
    
    # Parse command line options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --local)
                install_mode="local"
                shift
                ;;
            --remote)
                install_mode="remote"
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Auto-detect install mode if not specified
    if [[ -z "$install_mode" ]]; then
        local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        if [[ -f "$script_dir/bin/$SCRIPT_NAME" ]]; then
            install_mode="local"
            log_info "Auto-detected local installation (bin/$SCRIPT_NAME found)"
        else
            install_mode="remote"
            log_info "Auto-detected remote installation (no local bin/$SCRIPT_NAME found)"
        fi
    fi
    
    # Perform installation
    case "$install_mode" in
        local)
            install_local
            ;;
        remote)
            install_remote
            ;;
        *)
            log_error "Invalid install mode: $install_mode"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"