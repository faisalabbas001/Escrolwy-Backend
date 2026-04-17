# EC2 Deployment Guide

## Quick Deploy (< 1 hour)

### Prerequisites on EC2
```bash
# Install Docker
sudo yum update -y
sudo yum install -y docker
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ec2-user

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Git
sudo yum install -y git
```

### Deploy Steps

1. **Clone the repository**
```bash
git clone <your-repo-url> escrowly
cd escrowly/escrowly-backend
```

2. **Create environment file**
```bash
cp .env.example .env
nano .env
```

Fill in:
```env
JWT_SECRET=your_secure_jwt_secret_min_32_chars
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
S3_BUCKET=your_s3_bucket_name
FRONTEND_URL=http://your-frontend-domain.com
```

3. **Build and start services**
```bash
# Build all services
docker-compose build

# Start infrastructure first
docker-compose up -d postgres redis

# Wait for DB to be ready (30 seconds)
sleep 30

# Run migrations
docker-compose run --rm auth-service npx prisma migrate deploy --schema=prisma/schema.prisma
docker-compose run --rm admin-service npx prisma migrate deploy --schema=prisma/schema.prisma

# Start all services
docker-compose up -d
```

4. **Verify deployment**
```bash
# Check services are running
docker-compose ps

# Check logs
docker-compose logs -f

# Test health endpoints
curl http://localhost:3001/api/v1/health
curl http://localhost:3000/api/v1/health
curl http://localhost:3002/api/v1/health
```

### Ports
- **BFF Service**: 3001 (main entry point for frontend)
- **Auth Service**: 3000 (internal)
- **Admin Service**: 3002 (internal)
- **PostgreSQL**: 5433
- **Redis**: 6379

### Frontend Configuration
Update frontend `.env`:
```env
VITE_API_BASE_URL=http://<EC2_PUBLIC_IP>:3001/api/v1
```

### Security Checklist
- [ ] Set strong JWT_SECRET
- [ ] Configure AWS credentials
- [ ] Set up security groups (allow 3001 from frontend, block 3000/3002)
- [ ] Enable HTTPS with nginx/ALB (for production)

### Troubleshooting

**Services not starting?**
```bash
docker-compose logs auth-service
docker-compose logs admin-service
docker-compose logs bff-service
```

**Database connection issues?**
```bash
docker-compose logs postgres
docker-compose exec postgres psql -U escrowly_dev -d escrowly -c "\dt"
```

**Redis connection issues?**
```bash
docker-compose exec redis redis-cli -a escrowly_redis_password ping
```

### Data Backup
```bash
# Backup PostgreSQL
docker-compose exec postgres pg_dump -U escrowly_dev escrowly > backup.sql

# Restore
docker-compose exec -T postgres psql -U escrowly_dev escrowly < backup.sql
```

