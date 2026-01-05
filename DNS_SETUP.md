# DNS Setup Guide for Escrowly Backend API

## DNS Settings for Your Domain Provider

### Option 1: Subdomain (Recommended)
**Subdomain:** `api.escrowly.com` (or `api.yourdomain.com`)

**DNS Record Type:** `A` Record

**Settings:**
- **Name/Host:** `api` (or `@` if using root domain)
- **Type:** `A`
- **Value/IP:** `52.41.232.252`
- **TTL:** `3600` (or default)

### Option 2: Root Domain
**Domain:** `escrowly.com`

**DNS Record Type:** `A` Record

**Settings:**
- **Name/Host:** `@` (or leave blank)
- **Type:** `A`
- **Value/IP:** `52.41.232.252`
- **TTL:** `3600`

---

## Step-by-Step Setup

### 1. DNS Configuration (Do this first)

**For your domain provider (GoDaddy, Namecheap, Cloudflare, etc.):**

1. Log into your domain provider's DNS management
2. Add a new `A` record:
   - **Host:** `api`
   - **Type:** `A`
   - **Value:** `52.41.232.252`
   - **TTL:** `3600`
3. Save the record
4. Wait 5-10 minutes for DNS propagation

**Verify DNS is working:**
```bash
# Check if DNS resolves
nslookup api.escrowly.com
# or
dig api.escrowly.com
```

### 2. Update EC2 Security Group

Add these rules to your EC2 security group (`dev-escrowly-ec2-sg`):

- **Type:** HTTP (port 80)
- **Source:** 0.0.0.0/0
- **Description:** HTTP for Let's Encrypt

- **Type:** HTTPS (port 443)
- **Source:** 0.0.0.0/0
- **Description:** HTTPS for API

### 3. Setup Nginx + SSL on EC2

```bash
# SSH into EC2
ssh -i escrowly-key.pem ec2-user@52.41.232.252

# Pull latest changes
cd ~/escrowly
git pull origin dev

# Make script executable
chmod +x scripts/setup-nginx-ssl.sh

# Run setup (replace with your actual domain)
sudo bash scripts/setup-nginx-ssl.sh api.escrowly.com

# Get SSL certificate
sudo certbot --nginx -d api.escrowly.com

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: Yes)
```

### 4. Update Frontend Environment Variable

Update your Vercel environment variable:

```
VITE_API_BASE_URL=https://api.escrowly.com/api/v1
```

---

## DNS Provider Examples

### Cloudflare
1. Go to DNS → Records
2. Click "Add record"
3. Type: `A`
4. Name: `api`
5. IPv4 address: `52.41.232.252`
6. Proxy status: **DNS only** (gray cloud) - Important!
7. TTL: Auto
8. Save

### GoDaddy
1. Go to DNS Management
2. Click "Add"
3. Type: `A`
4. Host: `api`
5. Points to: `52.41.232.252`
6. TTL: `600 seconds`
7. Save

### Namecheap
1. Go to Domain List → Manage → Advanced DNS
2. Add new record
3. Type: `A Record`
4. Host: `api`
5. Value: `52.41.232.252`
6. TTL: `Automatic`
7. Save

---

## Verify Everything Works

```bash
# 1. Check DNS resolves
nslookup api.escrowly.com
# Should return: 52.41.232.252

# 2. Check HTTP redirects to HTTPS
curl -I http://api.escrowly.com
# Should return: 301 redirect to https://

# 3. Check HTTPS works
curl https://api.escrowly.com/api/v1/health
# Should return: {"status":"ok"}

# 4. Test from browser
# Visit: https://api.escrowly.com/api/v1/health
```

---

## Troubleshooting

**DNS not resolving?**
- Wait 10-15 minutes for propagation
- Check DNS record is correct
- Use `dig` or `nslookup` to verify

**SSL certificate fails?**
- Make sure port 80 is open (for Let's Encrypt verification)
- Check domain DNS is pointing to EC2 IP
- Verify Nginx is running: `sudo systemctl status nginx`

**502 Bad Gateway?**
- Check BFF service is running: `docker-compose ps bff-service`
- Check Nginx can reach localhost:3001
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

