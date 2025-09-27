#!/bin/bash

# Dispatch SSL Setup Script
# Automated setup for Dispatch with Let's Encrypt SSL certificates

set -e

echo "🚀 Dispatch SSL Setup"
echo "===================="
echo ""

# Color codes for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Dependencies check passed"
}

# Check if .env file exists and has required variables
check_env_config() {
    print_info "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        print_warning ".env file not found. Creating from template..."
        cp .env.example .env
        print_warning "Please edit .env file with your domain and email before continuing."
        print_info "Required variables:"
        print_info "  - DOMAIN: Your domain name (e.g., dispatch.yourdomain.com)"
        print_info "  - TERMINAL_KEY: Strong password for web access"
        print_info "  - LETSENCRYPT_EMAIL: Email for certificate notifications"
        echo ""
        read -p "Press Enter after editing .env file to continue..."
    fi
    
    # Source the .env file
    set -a
    source .env
    set +a
    
    # Validate required variables
    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "yourdomain.com" ]; then
        print_error "DOMAIN is not set or still using example value in .env"
        exit 1
    fi
    
    if [ -z "$TERMINAL_KEY" ] || [ "$TERMINAL_KEY" = "change-me-to-a-strong-password" ]; then
        print_error "TERMINAL_KEY is not set or still using example value in .env"
        exit 1
    fi
    
    if [ -z "$LETSENCRYPT_EMAIL" ] || [ "$LETSENCRYPT_EMAIL" = "admin@yourdomain.com" ]; then
        print_error "LETSENCRYPT_EMAIL is not set or still using example value in .env"
        exit 1
    fi
    
    print_success "Environment configuration validated"
    print_info "Domain: $DOMAIN"
    print_info "Email: $LETSENCRYPT_EMAIL"
}

# Create necessary directories
create_directories() {
    print_info "Creating necessary directories..."
    
    mkdir -p dispatch-config
    mkdir -p dispatch-projects
    mkdir -p dispatch-workspace
    mkdir -p certbot/conf
    mkdir -p certbot/www
    
    print_success "Directories created"
}

# Generate nginx config with domain substitution
setup_nginx_config() {
    print_info "Setting up nginx configuration..."
    
    # Replace domain placeholder in nginx config
    sed "s/\${DOMAIN}/$DOMAIN/g" docker/nginx.conf > docker/nginx-generated.conf
    
    # Update docker-compose to use generated config
    export NGINX_CONFIG_PATH="./docker/nginx-generated.conf"
    
    print_success "Nginx configuration prepared"
}

# Initialize Let's Encrypt certificates
init_certificates() {
    print_info "Initializing Let's Encrypt certificates..."
    
    # Make init script executable
    chmod +x docker/init-letsencrypt.sh
    
    # Run certificate initialization
    DOMAIN="$DOMAIN" LETSENCRYPT_EMAIL="$LETSENCRYPT_EMAIL" LETSENCRYPT_STAGING="${LETSENCRYPT_STAGING:-0}" \
        ./docker/init-letsencrypt.sh
    
    print_success "Certificates initialized"
}

# Start services
start_services() {
    print_info "Starting Dispatch services..."
    
    docker-compose up -d
    
    print_success "Services started"
}

# Main setup flow
main() {
    echo "This script will set up Dispatch with automatic SSL certificates using Let's Encrypt."
    echo ""
    
    check_dependencies
    check_env_config
    create_directories
    setup_nginx_config
    
    echo ""
    print_warning "IMPORTANT: Before proceeding, ensure that:"
    print_warning "1. Your domain ($DOMAIN) points to this server's IP address"
    print_warning "2. Ports 80 and 443 are open and accessible from the internet"
    print_warning "3. No other services are using ports 80 or 443"
    echo ""
    
    read -p "Do you want to continue with certificate generation? (y/N): " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        init_certificates
        start_services
        
        echo ""
        print_success "🎉 Dispatch is now running with SSL!"
        print_success "Visit: https://$DOMAIN"
        print_success "Login with your TERMINAL_KEY: $TERMINAL_KEY"
        echo ""
        print_info "Certificate auto-renewal is configured."
        print_info "Certificates will be renewed automatically every 60 days."
        echo ""
        print_info "To view logs: docker-compose logs -f"
        print_info "To stop: docker-compose down"
    else
        print_info "Setup cancelled. You can run this script again when ready."
    fi
}

# Run main function
main "$@"