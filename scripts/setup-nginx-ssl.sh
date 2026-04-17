#!/bin/bash
# Setup Nginx reverse proxy with SSL for Escrowly Backend
# Run this on EC2 after domain is pointed to the instance

set -e

DOMAIN="${1:-api.escrowly.com}"  # Default domain, or pass as first argument

echo "Setting up Nginx with SSL for domain: $DOMAIN"

# Install Nginx
sudo yum install -y nginx

# Install Certbot (Let's Encrypt)
sudo yum install -y certbot python3-certbot-nginx

# Create Nginx config (HTTP only - Certbot will add SSL)
sudo tee /etc/nginx/conf.d/escrowly-api.conf > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    # Proxy to BFF service
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3001/api/v1/health;
        access_log off;
    }
}
EOF

# Test Nginx config
sudo nginx -t

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Open ports 80 and 443 in firewall (if firewalld is running)
if systemctl is-active --quiet firewalld; then
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --reload
fi

echo "✅ Nginx configured. Now run Certbot to get SSL certificate:"
echo "sudo certbot --nginx -d $DOMAIN"
echo ""
echo "After SSL is set up, update your frontend .env:"
echo "VITE_API_BASE_URL=https://$DOMAIN/api/v1"

