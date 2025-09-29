#!/bin/bash
set -e

# Default user details (can be overridden by build args)
DEFAULT_UID=${DEFAULT_UID:-1000}
DEFAULT_GID=${DEFAULT_GID:-1000}
USER_NAME="dispatch"

# Get host UID/GID from environment variables (set by CLI or docker run)
HOST_UID=${HOST_UID:-$DEFAULT_UID}
HOST_GID=${HOST_GID:-$DEFAULT_GID}

# SSL Configuration
SSL_MODE=${SSL_MODE:-letsencrypt}
DOMAIN=${DOMAIN:-localhost}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:-}
LETSENCRYPT_STAGING=${LETSENCRYPT_STAGING:-false}

echo "🔒 Dispatch Container Startup with SSL"
echo "   SSL Mode: $SSL_MODE"
echo "   Domain: $DOMAIN"
echo "   Default container user: ${USER_NAME} (${DEFAULT_UID}:${DEFAULT_GID})"
echo "   Requested host mapping: ${HOST_UID}:${HOST_GID}"

# Function to setup user mapping
setup_user_mapping() {
    # Check if we need to adjust the user mapping
    if [ "$HOST_UID" != "$DEFAULT_UID" ] || [ "$HOST_GID" != "$DEFAULT_GID" ]; then
        echo "🔄 Adjusting user mapping to match host user..."
        
        # Create group if it doesn't exist or update existing one
        if ! getent group "$HOST_GID" > /dev/null 2>&1; then
            groupadd -g "$HOST_GID" "$USER_NAME" || {
                # If group name conflicts, modify existing group
                groupmod -g "$HOST_GID" "$USER_NAME" 2>/dev/null || {
                    # If that fails, delete and recreate
                    groupdel "$USER_NAME" 2>/dev/null || true
                    groupadd -g "$HOST_GID" "$USER_NAME"
                }
            }
        else
            # Group with this GID exists, modify our user's group
            groupmod -g "$HOST_GID" "$USER_NAME" 2>/dev/null || {
                # If that fails, try alternative approach
                existing_group=$(getent group "$HOST_GID" | cut -d: -f1)
                usermod -g "$existing_group" "$USER_NAME" 2>/dev/null || true
            }
        fi
        
        # Update user UID
        usermod -u "$HOST_UID" "$USER_NAME" 2>/dev/null || {
            echo "⚠️  Warning: Could not change UID to $HOST_UID, using existing UID"
        }
        
        echo "✅ User mapping updated"
    else
        echo "✅ Using default user mapping (no changes needed)"
    fi

    # Get the actual UID/GID of our user (may be different if usermod failed)
    ACTUAL_UID=$(id -u "$USER_NAME")
    ACTUAL_GID=$(id -g "$USER_NAME")
    echo "   Actual container user: ${USER_NAME} (${ACTUAL_UID}:${ACTUAL_GID})"
}

# Function to setup directories
setup_directories() {
    echo "📁 Setting up directories..."
    
    # Standard directories that should be writable by the app user
    DIRS_TO_SETUP=(
        "/home/$USER_NAME"
        "/workspace"
        "/tmp/dispatch-sessions"
        "/etc/letsencrypt"
        "/var/www/certbot"
        "/var/log/supervisor"
    )
    
    for dir in "${DIRS_TO_SETUP[@]}"; do
        if [ ! -d "$dir" ]; then
            mkdir -p "$dir"
            echo "   ✓ Created: $dir"
        fi
    done

    # Set proper ownership for SSL directories
    chown -R dispatch:dispatch /etc/letsencrypt /var/www/certbot
    
    echo "✅ Directory setup complete"
}

# Function to generate self-signed certificates
generate_self_signed_cert() {
    echo "🔐 Generating self-signed certificates for $DOMAIN..."
    
    local cert_dir="/etc/ssl/dispatch"
    local cert_file="$cert_dir/fullchain.pem"
    local key_file="$cert_dir/privkey.pem"
    
    mkdir -p "$cert_dir"
    
    # Generate private key
    openssl genrsa -out "$key_file" 2048
    
    # Generate certificate
    openssl req -new -x509 -key "$key_file" -out "$cert_file" -days 365 \
        -subj "/C=US/ST=CA/L=San Francisco/O=Dispatch/OU=IT Department/CN=$DOMAIN" \
        -config <(
            echo '[req]'
            echo 'distinguished_name = req_distinguished_name'
            echo 'req_extensions = v3_req'
            echo 'prompt = no'
            echo '[req_distinguished_name]'
            echo 'C = US'
            echo 'ST = CA'
            echo 'L = San Francisco'
            echo 'O = Dispatch'
            echo 'OU = IT Department'
            echo "CN = $DOMAIN"
            echo '[v3_req]'
            echo 'keyUsage = keyEncipherment, dataEncipherment'
            echo 'extendedKeyUsage = serverAuth'
            echo "subjectAltName = DNS:$DOMAIN,DNS:localhost,IP:127.0.0.1"
        )
    
    # Set proper permissions
    chmod 600 "$key_file"
    chmod 644 "$cert_file"
    
    echo "✅ Self-signed certificates generated"
    echo "   Certificate: $cert_file"
    echo "   Private Key: $key_file"
    
    # Return paths for nginx configuration
    export SSL_CERT_PATH="$cert_file"
    export SSL_KEY_PATH="$key_file"
}

# Function to setup Let's Encrypt certificates
setup_letsencrypt() {
    echo "🌐 Setting up Let's Encrypt certificates for $DOMAIN..."
    
    if [ -z "$LETSENCRYPT_EMAIL" ]; then
        echo "❌ LETSENCRYPT_EMAIL is required for Let's Encrypt mode"
        echo "   Please set LETSENCRYPT_EMAIL environment variable"
        exit 1
    fi
    
    local cert_dir="/etc/letsencrypt/live/$DOMAIN"
    local cert_file="$cert_dir/fullchain.pem"
    local key_file="$cert_dir/privkey.pem"
    
    # Check if certificates already exist and are valid
    if [ -f "$cert_file" ] && [ -f "$key_file" ]; then
        if openssl x509 -in "$cert_file" -checkend 86400 -noout >/dev/null 2>&1; then
            echo "✅ Valid Let's Encrypt certificates found"
            export SSL_CERT_PATH="$cert_file"
            export SSL_KEY_PATH="$key_file"
            return 0
        else
            echo "⚠️  Existing certificates are expiring soon or invalid"
        fi
    fi
    
    echo "📄 Requesting new Let's Encrypt certificates..."
    
    # Prepare certbot arguments
    local staging_arg=""
    if [ "$LETSENCRYPT_STAGING" = "true" ] || [ "$LETSENCRYPT_STAGING" = "1" ]; then
        staging_arg="--staging"
        echo "   Using Let's Encrypt staging environment"
    fi
    
    # Create a temporary nginx config for ACME challenge
    cat > /etc/nginx/nginx.conf << EOF
events { worker_connections 1024; }
http {
    server {
        listen 80;
        server_name $DOMAIN;
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        location / {
            return 200 'Let\\'s Encrypt challenge server';
            add_header Content-Type text/plain;
        }
    }
}
EOF
    
    # Start nginx for ACME challenge
    nginx &
    local nginx_pid=$!

    # Wait for nginx to be ready (max 10 seconds)
    for i in {1..10}; do
        if curl --fail --silent http://localhost/.well-known/acme-challenge/ >/dev/null 2>&1; then
            break
        fi
        sleep 1
    done
    # Check if nginx is ready
    if ! curl --fail --silent http://localhost/.well-known/acme-challenge/ >/dev/null 2>&1; then
        echo "❌ Nginx did not start or is not responding on port 80"
        kill $nginx_pid 2>/dev/null || true
        wait $nginx_pid 2>/dev/null || true
        exit 1
    fi
    # Request certificate
    certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email "$LETSENCRYPT_EMAIL" \
        --agree-tos \
        --no-eff-email \
        $staging_arg \
        -d "$DOMAIN" \
        --non-interactive
    
    local certbot_result=$?
    
    # Stop temporary nginx
    kill $nginx_pid 2>/dev/null || true
    wait $nginx_pid 2>/dev/null || true
    
    if [ $certbot_result -eq 0 ] && [ -f "$cert_file" ] && [ -f "$key_file" ]; then
        echo "✅ Let's Encrypt certificates obtained successfully"
        export SSL_CERT_PATH="$cert_file"
        export SSL_KEY_PATH="$key_file"
    else
        echo "❌ Failed to obtain Let's Encrypt certificates"
        echo "   Falling back to self-signed certificates"
        generate_self_signed_cert
    fi
}

# Function to configure nginx based on SSL mode
configure_nginx() {
    echo "🔧 Configuring nginx for SSL mode: $SSL_MODE"
    
    local template_file="/etc/nginx/nginx-template.conf"
    local config_file="/etc/nginx/nginx.conf"
    
    # Copy template to working config
    cp "$template_file" "$config_file"
    
    # Replace domain placeholder
    sed -i "s/__DOMAIN__/$DOMAIN/g" "$config_file"
    
    # Configure based on SSL mode
    case "$SSL_MODE" in
        "none")
            echo "   Configuring HTTP-only mode"
            # Remove SSL sections, keep only HTTP
            sed -i '/__SSL_MODE_SSL_HTTP_START__/,/__SSL_MODE_SSL_HTTP_END__/d' "$config_file"
            sed -i '/__SSL_MODE_SSL_HTTPS_START__/,/__SSL_MODE_SSL_HTTPS_END__/d' "$config_file"
            # Remove section markers for none mode
            sed -i 's/__SSL_MODE_NONE_START__//g' "$config_file"
            sed -i 's/__SSL_MODE_NONE_END__//g' "$config_file"
            ;;
        
        "self-signed"|"letsencrypt")
            echo "   Configuring HTTPS mode with $SSL_MODE certificates"
            # Remove HTTP-only section
            sed -i '/__SSL_MODE_NONE_START__/,/__SSL_MODE_NONE_END__/d' "$config_file"
            # Remove section markers for SSL modes
            sed -i 's/__SSL_MODE_SSL_HTTP_START__//g' "$config_file"
            sed -i 's/__SSL_MODE_SSL_HTTP_END__//g' "$config_file"
            sed -i 's/__SSL_MODE_SSL_HTTPS_START__//g' "$config_file"
            sed -i 's/__SSL_MODE_SSL_HTTPS_END__//g' "$config_file"
            
            # Configure Let's Encrypt challenge location
            if [ "$SSL_MODE" = "letsencrypt" ]; then
                sed -i 's/__LETSENCRYPT_CHALLENGE_START__//g' "$config_file"
                sed -i 's/__LETSENCRYPT_CHALLENGE_END__//g' "$config_file"
            else
                sed -i '/__LETSENCRYPT_CHALLENGE_START__/,/__LETSENCRYPT_CHALLENGE_END__/d' "$config_file"
            fi
            
            # Set SSL certificate paths
            sed -i "s|__SSL_CERT_PATH__|$SSL_CERT_PATH|g" "$config_file"
            sed -i "s|__SSL_KEY_PATH__|$SSL_KEY_PATH|g" "$config_file"
            ;;
        
        *)
            echo "❌ Invalid SSL_MODE: $SSL_MODE"
            echo "   Valid options: none, self-signed, letsencrypt"
            exit 1
            ;;
    esac
    
    # Test nginx configuration
    if nginx -t; then
        echo "✅ Nginx configuration is valid"
    else
        echo "❌ Nginx configuration is invalid"
        exit 1
    fi
}

# Function to configure supervisord
configure_supervisord() {
    echo "🔧 Configuring supervisord..."
    
    local template_file="/etc/supervisor/conf.d/supervisord.conf"
    
    # Configure certbot renewal based on SSL mode
    if [ "$SSL_MODE" = "letsencrypt" ]; then
        sed -i "s/__CERTBOT_AUTOSTART__/true/g" "$template_file"
        sed -i "s/__DOMAIN__/$DOMAIN/g" "$template_file"
        echo "   Certbot auto-renewal enabled"
    else
        sed -i "s/__CERTBOT_AUTOSTART__/false/g" "$template_file"
        echo "   Certbot auto-renewal disabled"
    fi
}

# Main setup flow
main() {
    setup_user_mapping
    setup_directories
    
    # SSL setup based on mode
    case "$SSL_MODE" in
        "none")
            echo "🚫 SSL disabled - HTTP only mode"
            ;;
        "self-signed")
            generate_self_signed_cert
            ;;
        "letsencrypt")
            setup_letsencrypt
            ;;
    esac
    
    # Configure nginx and supervisord
    configure_nginx
    configure_supervisord
    
    echo "🚀 Starting Dispatch with SSL mode: $SSL_MODE"
    echo "   Environment:"
    echo "     PORT: ${PORT:-3030}"
    echo "     DOMAIN: $DOMAIN"
    echo "     SSL_MODE: $SSL_MODE"
    echo "     ENABLE_TUNNEL: ${ENABLE_TUNNEL:-false}"
    
    # Execute the command (usually supervisord)
    exec "$@"
}

# Run main function
main "$@"