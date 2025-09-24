# Dispatch Docker Usage

This document explains how to run the [Dispatch Docker image](https://hub.docker.com/r/fwdslsh/dispatch) with automatic SSL certificate management using Let's Encrypt.

## 🔒 SSL/HTTPS Support (Built-in)

Dispatch includes **built-in SSL support with multiple modes** - no external dependencies or docker-compose required!

### ✨ **Quick Start**

```bash
# Let's Encrypt SSL (production-ready)
docker run -d -p 80:80 -p 443:443 \
  -e DOMAIN=dispatch.yourdomain.com \
  -e LETSENCRYPT_EMAIL=admin@yourdomain.com \
  -e TERMINAL_KEY=your-super-secure-password \
  fwdslsh/dispatch:latest

# Self-signed SSL (development/testing)
docker run -d -p 80:80 -p 443:443 \
  -e SSL_MODE=self-signed \
  -e DOMAIN=localhost \
  -e TERMINAL_KEY=your-password \
  fwdslsh/dispatch:latest

# HTTP only (no SSL)
docker run -d -p 80:80 \
  -e SSL_MODE=none \
  -e TERMINAL_KEY=your-password \
  fwdslsh/dispatch:latest
```

## 🔧 **SSL Modes**

Dispatch supports three SSL modes via the `SSL_MODE` environment variable:

### 🌐 **`letsencrypt` (Default - Production)**
- **Free, globally trusted certificates** from Let's Encrypt
- **Automatic certificate renewal** every 60 days
- **Zero trust warnings** - perfect for production
- **Requirements**: Valid domain pointing to your server, ports 80 and 443 accessible

### 🔐 **`self-signed` (Development/Testing)**
- **Self-signed certificates** generated automatically
- **Browser trust warnings** - click "Advanced" → "Proceed"
- **No external dependencies** - works offline
- **Perfect for development and testing**

### 🚫 **`none` (HTTP Only)**
- **No SSL/HTTPS** - HTTP only on port 80
- **Smallest container footprint**
- **Use behind external SSL terminator** (Cloudflare, load balancer)

## 🎯 **Key Benefits**

- ✅ **Single container** - no docker-compose required
- ✅ **Built-in SSL** - nginx + certbot included
- ✅ **Multiple SSL modes** - letsencrypt, self-signed, or none
- ✅ **Zero configuration** - works with just environment variables
- ✅ **Automatic renewal** - certificates renewed automatically
- ✅ **Production ready** - enterprise-grade nginx configuration
- ✅ **Easy switching** - change SSL modes without rebuilding

This approach provides the same enterprise-grade SSL security with much simpler deployment and management!
