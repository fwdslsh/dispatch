#!/bin/bash

# Initialize Let's Encrypt certificates for Dispatch
# This script sets up SSL certificates using Let's Encrypt for the Dispatch application

set -e

# Configuration
DOMAIN=${DOMAIN:-localhost}
EMAIL=${LETSENCRYPT_EMAIL:-admin@${DOMAIN}}
STAGING=${LETSENCRYPT_STAGING:-0}
RSA_KEY_SIZE=4096

# Paths
CERTBOT_PATH="./certbot"
NGINX_PATH="./nginx"

echo "🔒 Initializing Let's Encrypt certificates for Dispatch"
echo "   Domain: $DOMAIN"
echo "   Email: $EMAIL"
echo "   Staging: $STAGING"

# Create necessary directories
mkdir -p "$CERTBOT_PATH/conf/live/$DOMAIN"
mkdir -p "$CERTBOT_PATH/www"
mkdir -p "$NGINX_PATH"

if [ ! -e "$CERTBOT_PATH/conf/options-ssl-nginx.conf" ] || [ ! -e "$CERTBOT_PATH/conf/ssl-dhparams.pem" ]; then
  echo "📥 Downloading recommended TLS parameters..."
  mkdir -p "$CERTBOT_PATH/conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$CERTBOT_PATH/conf/options-ssl-nginx.conf"
  curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$CERTBOT_PATH/conf/ssl-dhparams.pem"
  echo "✅ TLS parameters downloaded"
fi

echo "🔧 Creating dummy certificate for $DOMAIN..."
PATH_LIVE="$CERTBOT_PATH/conf/live/$DOMAIN"
docker-compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:$RSA_KEY_SIZE -days 1 \
    -keyout '/etc/letsencrypt/live/$DOMAIN/privkey.pem' \
    -out '/etc/letsencrypt/live/$DOMAIN/fullchain.pem' \
    -subj '/CN=localhost'" certbot
echo "✅ Dummy certificate created"

echo "🚀 Starting nginx..."
docker-compose up --force-recreate -d nginx
echo "✅ Nginx started"

echo "🗑️ Deleting dummy certificate for $DOMAIN..."
docker-compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$DOMAIN && \
  rm -Rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -Rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot
echo "✅ Dummy certificate deleted"

echo "🎫 Requesting Let's Encrypt certificate for $DOMAIN..."
# Join domains for the certificate request
DOMAIN_ARGS="-d $DOMAIN"

# Select appropriate email arg
CASE="$EMAIL"
if [ "$EMAIL" = "" ]; then
  EMAIL_ARG="--register-unsafely-without-email"
else
  EMAIL_ARG="--email $EMAIL"
fi

# Enable staging mode if requested
if [ $STAGING != "0" ]; then
  STAGING_ARG="--staging"
else
  STAGING_ARG=""
fi

docker-compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $STAGING_ARG \
    $EMAIL_ARG \
    $DOMAIN_ARGS \
    --rsa-key-size $RSA_KEY_SIZE \
    --agree-tos \
    --force-renewal" certbot

echo "✅ Certificate obtained successfully!"

echo "🔄 Reloading nginx..."
docker-compose exec nginx nginx -s reload

echo "🎉 SSL setup complete!"
echo ""
echo "Your Dispatch application is now available at:"
echo "  https://$DOMAIN"
echo ""
echo "Certificate auto-renewal is configured and will run every 12 hours."
echo "Certificates are valid for 90 days and will be renewed when they have 30 days or less remaining."