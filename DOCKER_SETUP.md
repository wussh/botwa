# 🐳 Docker Compose Setup for BotWA

This guide covers different deployment scenarios using Docker Compose.

## 📋 Available Configurations

1. **SQLite Setup** (Recommended) - `docker-compose.yml`
2. **MongoDB Setup** - `docker-compose.mongodb.yml`
3. **Development Setup** - `docker-compose.dev.yml`

---

## 🚀 Quick Start (SQLite)

### 1. Prepare Configuration

```bash
# Copy your config if needed
cp config.js config.production.js

# Update database type in config.js
DATABASE_TYPE: 'sqlite'
```

### 2. Build and Run

```bash
# Build the image
docker-compose build

# Start the bot
docker-compose up -d

# View logs
docker-compose logs -f botwa

# On first run, scan QR code
docker-compose logs botwa | grep -A 30 "scan the QR"
```

### 3. Verify Running

```bash
# Check status
docker-compose ps

# Check logs
docker-compose logs --tail=50 botwa

# Access SQLite database
docker-compose exec botwa sqlite3 /app/memory/botwa.db
```

---

## 🗄️ MongoDB Setup

### 1. Use MongoDB Compose File

```bash
# Use the MongoDB-specific compose file
docker-compose -f docker-compose.mongodb.yml up -d
```

### 2. Update Configuration

Edit `config.js`:
```javascript
DATABASE_TYPE: 'mongodb',
DATABASE_OPTIONS: {
  mongodb: {
    connectionString: 'mongodb://botwa_admin:your_password@mongodb:27017',
    dbName: 'botwa'
  }
}
```

### 3. Access MongoDB

**Via Mongo Express (Web UI):**
```
http://localhost:8081
Username: admin
Password: admin123
```

**Via CLI:**
```bash
docker-compose exec mongodb mongosh -u botwa_admin -p your_password
```

---

## 🔧 Common Commands

### Basic Operations

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart bot
docker-compose restart botwa

# View logs
docker-compose logs -f

# View bot logs only
docker-compose logs -f botwa

# Check resource usage
docker stats
```

### Maintenance

```bash
# Rebuild after code changes
docker-compose build --no-cache
docker-compose up -d

# Update environment variables
docker-compose up -d --force-recreate

# Remove everything (including volumes)
docker-compose down -v
```

### Database Operations

**SQLite:**
```bash
# Backup database
docker-compose exec botwa cp /app/memory/botwa.db /app/memory/botwa.db.backup

# Copy database to host
docker cp botwa:/app/memory/botwa.db ./backup/

# Restore database
docker cp ./backup/botwa.db botwa:/app/memory/botwa.db
docker-compose restart botwa
```

**MongoDB:**
```bash
# Backup database
docker-compose exec mongodb mongodump --db botwa --out /dump
docker cp botwa-mongodb:/dump ./backup/

# Restore database
docker cp ./backup/dump botwa-mongodb:/dump
docker-compose exec mongodb mongorestore /dump
```

---

## 📊 Monitoring

### Health Checks

```bash
# Check service health
docker-compose ps

# Detailed health status
docker inspect --format='{{json .State.Health}}' botwa | jq
```

### Logs

```bash
# Live logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Logs since 1 hour ago
docker-compose logs --since 1h

# Save logs to file
docker-compose logs > logs.txt
```

### Resource Usage

```bash
# Real-time stats
docker stats botwa

# Memory usage
docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}"
```

---

## 🔐 Security Best Practices

### 1. Change Default Passwords

Edit `.env` file:
```env
MONGO_ROOT_PASSWORD=your_secure_password_here
MONGO_EXPRESS_PASSWORD=another_secure_password
```

### 2. Secure MongoDB

```javascript
// config.js
mongodb: {
  connectionString: 'mongodb://botwa_user:${MONGO_PASSWORD}@mongodb:27017/botwa?authSource=admin'
}
```

### 3. Limit Exposed Ports

Remove port mappings for internal services:
```yaml
# Remove this from docker-compose.yml for production
ports:
  - "27017:27017"  # Don't expose MongoDB to host
```

### 4. Use Docker Secrets (Production)

```yaml
secrets:
  mongo_password:
    file: ./secrets/mongo_password.txt

services:
  mongodb:
    secrets:
      - mongo_password
```

---

## 🐛 Troubleshooting

### Bot Not Starting

```bash
# Check logs for errors
docker-compose logs botwa

# Verify permissions
docker-compose exec botwa ls -la /app/auth /app/memory

# Check config
docker-compose exec botwa cat /app/config.js
```

### Database Connection Issues

**SQLite:**
```bash
# Check database file exists
docker-compose exec botwa ls -la /app/memory/botwa.db

# Check permissions
docker-compose exec botwa chmod 666 /app/memory/botwa.db
```

**MongoDB:**
```bash
# Test connection
docker-compose exec mongodb mongosh -u botwa_admin -p your_password --eval "db.adminCommand('ping')"

# Check MongoDB logs
docker-compose logs mongodb
```

### QR Code Not Showing

```bash
# View raw logs (QR code in terminal)
docker-compose logs botwa | less -R

# Or attach to container
docker attach botwa
```

### Out of Memory

```bash
# Set memory limits in docker-compose.yml
services:
  botwa:
    mem_limit: 512m
    mem_reservation: 256m
```

---

## 🔄 Updating the Bot

### 1. Update Code

```bash
# Pull latest code
git pull origin master

# Rebuild image
docker-compose build --no-cache

# Restart with new image
docker-compose up -d
```

### 2. Migrate Database

```bash
# If switching from JSON to SQLite
docker-compose exec botwa node database/migrate.js sqlite

# Update config
# DATABASE_TYPE: 'sqlite'

# Restart
docker-compose restart botwa
```

---

## 📦 Backup Strategy

### Automated Backups (Cron Job)

Create `backup.sh`:
```bash
#!/bin/bash
BACKUP_DIR="/backup/botwa/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# SQLite
docker cp botwa:/app/memory/botwa.db "$BACKUP_DIR/"

# MongoDB
docker-compose exec -T mongodb mongodump --db botwa --archive > "$BACKUP_DIR/mongodb.archive"

# Auth credentials
docker cp botwa:/app/auth "$BACKUP_DIR/"

echo "Backup completed: $BACKUP_DIR"
```

Add to crontab:
```bash
0 2 * * * /path/to/backup.sh
```

---

## 🌐 Reverse Proxy Setup (Optional)

### Nginx Configuration

If you add a health/stats endpoint to the bot:

```nginx
server {
    listen 80;
    server_name bot.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 📈 Scaling

### Multiple Bot Instances (MongoDB Required)

```yaml
# docker-compose.scale.yml
services:
  botwa:
    deploy:
      replicas: 3
    environment:
      - DATABASE_TYPE=mongodb
      - ALLOWED_CONTACTS=${BOT_CONTACTS}
```

Run:
```bash
docker-compose -f docker-compose.scale.yml up -d --scale botwa=3
```

---

## 🧪 Development Setup

### Hot Reload Development

```bash
# Use dev compose file
docker-compose -f docker-compose.dev.yml up

# Mounts code directory for live changes
```

---

## 📝 Environment Variables

Create `.env` file:
```env
# Timezone
TZ=Asia/Jakarta

# Database
DATABASE_TYPE=sqlite
DATABASE_PATH=/app/memory/botwa.db

# MongoDB (if used)
MONGO_ROOT_USERNAME=botwa_admin
MONGO_ROOT_PASSWORD=change_this_password
MONGO_DB_NAME=botwa

# Bot Configuration
LOG_LEVEL=info
NODE_ENV=production

# Security
MONGO_EXPRESS_USERNAME=admin
MONGO_EXPRESS_PASSWORD=admin123
```

Use in `docker-compose.yml`:
```yaml
environment:
  - TZ=${TZ:-Asia/Jakarta}
  - DATABASE_TYPE=${DATABASE_TYPE:-sqlite}
```

---

## 🎯 Production Checklist

- [ ] Change all default passwords
- [ ] Set up automated backups
- [ ] Configure log rotation
- [ ] Set resource limits
- [ ] Enable monitoring
- [ ] Test recovery process
- [ ] Document deployment
- [ ] Set up alerts
- [ ] Use environment variables
- [ ] Restrict network access

---

## 📚 Additional Resources

- [Docker Compose Docs](https://docs.docker.com/compose/)
- [MongoDB Docker](https://hub.docker.com/_/mongo)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)

---

**Need help?** Check the main [README.md](README.md) or [DATABASE_SETUP.md](DATABASE_SETUP.md)
