# Dispatch Docker Usage

This document explains how to run the [Dispatch Docker image](https://hub.docker.com/r/fwdslsh/dispatch) with automatic SSL certificate management using Let's Encrypt.

## 🔒 SSL/HTTPS Support (Recommended)

Dispatch now includes **automatic Let's Encrypt SSL certificate management** with nginx reverse proxy for production-ready HTTPS out of the box.

### ✨ **Automatic SSL Setup (Recommended)**

The easiest way to deploy Dispatch with free, globally trusted SSL certificates:

```bash
# 1. Clone or download Dispatch
git clone https://github.com/fwdslsh/dispatch.git
cd dispatch

# 2. Run the SSL setup script
./docker/ssl-setup.sh
```

The setup script will:

- ✅ Create a `.env` file from template (if it doesn't exist)
- ✅ Validate your configuration (domain, email, terminal key)
- ✅ Set up nginx reverse proxy configuration
- ✅ Obtain Let's Encrypt SSL certificates automatically
- ✅ Start all services with HTTPS enabled
- ✅ Configure automatic certificate renewal (every 60 days)

### 📝 **Manual Configuration**

If you prefer manual setup:

1. **Copy environment template:**

   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` file with your settings:**

   ```bash
   # Your domain name
   DOMAIN=dispatch.yourdomain.com

   # Strong password for web access
   TERMINAL_KEY=your-super-secure-password

   # Email for Let's Encrypt notifications
   LETSENCRYPT_EMAIL=admin@yourdomain.com
   ```

3. **Initialize SSL certificates:**

   ```bash
   ./docker/init-letsencrypt.sh
   ```

4. **Start services:**
   ```bash
   docker-compose up -d
   ```

### 🌐 **Access Your Application**

After setup, your Dispatch application will be available at:

- **HTTPS:** `https://yourdomain.com` (primary, secure access)
- HTTP traffic is automatically redirected to HTTPS

## 🔧 **Configuration Options**

### Environment Variables

| Variable              | Default     | Description                                        |
| --------------------- | ----------- | -------------------------------------------------- |
| `DOMAIN`              | `localhost` | **Required** - Your domain name                    |
| `TERMINAL_KEY`        | `change-me` | **Required** - Web interface password              |
| `LETSENCRYPT_EMAIL`   | -           | **Required** - Email for certificate notifications |
| `LETSENCRYPT_STAGING` | `0`         | Set to `1` for testing (staging certificates)      |

This SSL-enabled setup provides enterprise-grade security with minimal configuration, making it perfect for production deployments while maintaining the ease of use that Dispatch is known for.
