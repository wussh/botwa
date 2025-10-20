#!/bin/bash

# Automated Backup Script for BotWA
# Run this script via cron for regular backups

set -e

# Configuration
BACKUP_ROOT="/backup/botwa"
BACKUP_DIR="$BACKUP_ROOT/$(date +%Y%m%d_%H%M%S)"
KEEP_DAYS=30

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔄 Starting BotWA backup...${NC}"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup SQLite database
if docker ps | grep -q botwa; then
    echo -e "${YELLOW}📦 Backing up SQLite database...${NC}"
    if docker exec botwa test -f /app/memory/botwa.db; then
        docker cp botwa:/app/memory/botwa.db "$BACKUP_DIR/"
        echo -e "${GREEN}✅ SQLite backup completed${NC}"
    else
        echo -e "${YELLOW}⚠️  No SQLite database found${NC}"
    fi
fi

# Backup MongoDB (if running)
if docker ps | grep -q botwa-mongodb; then
    echo -e "${YELLOW}📦 Backing up MongoDB...${NC}"
    docker-compose exec -T mongodb mongodump \
        --db botwa \
        --archive > "$BACKUP_DIR/mongodb.archive"
    echo -e "${GREEN}✅ MongoDB backup completed${NC}"
fi

# Backup auth credentials
echo -e "${YELLOW}📦 Backing up auth credentials...${NC}"
if docker exec botwa test -d /app/auth; then
    docker cp botwa:/app/auth "$BACKUP_DIR/"
    echo -e "${GREEN}✅ Auth backup completed${NC}"
fi

# Backup config
echo -e "${YELLOW}📦 Backing up configuration...${NC}"
docker cp botwa:/app/config.js "$BACKUP_DIR/"

# Create backup info file
cat > "$BACKUP_DIR/backup_info.txt" <<EOF
Backup Date: $(date)
Hostname: $(hostname)
Container: botwa
Database Type: ${DATABASE_TYPE:-sqlite}
EOF

# Compress backup
echo -e "${YELLOW}📦 Compressing backup...${NC}"
cd "$BACKUP_ROOT"
tar -czf "$(basename $BACKUP_DIR).tar.gz" "$(basename $BACKUP_DIR)"
rm -rf "$BACKUP_DIR"

# Calculate size
BACKUP_SIZE=$(du -h "$(basename $BACKUP_DIR).tar.gz" | cut -f1)
echo -e "${GREEN}✅ Backup compressed: $BACKUP_SIZE${NC}"

# Clean old backups
echo -e "${YELLOW}🧹 Cleaning old backups (keeping last $KEEP_DAYS days)...${NC}"
find "$BACKUP_ROOT" -name "*.tar.gz" -mtime +$KEEP_DAYS -delete
echo -e "${GREEN}✅ Old backups cleaned${NC}"

# Show backup summary
echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Backup completed successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "Location: $BACKUP_ROOT/$(basename $BACKUP_DIR).tar.gz"
echo -e "Size: $BACKUP_SIZE"
echo -e "Timestamp: $(date)"
echo ""

# Optional: Upload to remote storage (uncomment and configure)
# echo -e "${YELLOW}☁️  Uploading to remote storage...${NC}"
# rclone copy "$BACKUP_ROOT/$(basename $BACKUP_DIR).tar.gz" remote:botwa-backups/
# echo -e "${GREEN}✅ Remote upload completed${NC}"
