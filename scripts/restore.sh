#!/bin/bash

# Restore Script for BotWA
# Restores from a backup archive

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}❌ Usage: $0 <backup_file.tar.gz>${NC}"
    echo ""
    echo "Available backups:"
    ls -lh /backup/botwa/*.tar.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Backup file not found: $BACKUP_FILE${NC}"
    exit 1
fi

echo -e "${YELLOW}⚠️  WARNING: This will replace current data!${NC}"
echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
read

echo -e "${GREEN}🔄 Starting restore process...${NC}"

# Extract backup
TEMP_DIR=$(mktemp -d)
echo -e "${YELLOW}📦 Extracting backup...${NC}"
tar -xzf "$BACKUP_FILE" -C "$TEMP_DIR"

# Find the extracted directory
BACKUP_DIR=$(find "$TEMP_DIR" -mindepth 1 -maxdepth 1 -type d)

if [ -z "$BACKUP_DIR" ]; then
    echo -e "${RED}❌ Failed to extract backup${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Stop bot
echo -e "${YELLOW}🛑 Stopping bot...${NC}"
docker-compose stop botwa

# Restore SQLite database
if [ -f "$BACKUP_DIR/botwa.db" ]; then
    echo -e "${YELLOW}📦 Restoring SQLite database...${NC}"
    docker cp "$BACKUP_DIR/botwa.db" botwa:/app/memory/
    echo -e "${GREEN}✅ SQLite restored${NC}"
fi

# Restore MongoDB
if [ -f "$BACKUP_DIR/mongodb.archive" ]; then
    echo -e "${YELLOW}📦 Restoring MongoDB...${NC}"
    docker cp "$BACKUP_DIR/mongodb.archive" botwa-mongodb:/tmp/
    docker-compose exec mongodb mongorestore \
        --archive=/tmp/mongodb.archive \
        --drop
    docker-compose exec mongodb rm /tmp/mongodb.archive
    echo -e "${GREEN}✅ MongoDB restored${NC}"
fi

# Restore auth
if [ -d "$BACKUP_DIR/auth" ]; then
    echo -e "${YELLOW}📦 Restoring auth credentials...${NC}"
    docker cp "$BACKUP_DIR/auth" botwa:/app/
    echo -e "${GREEN}✅ Auth restored${NC}"
fi

# Restore config
if [ -f "$BACKUP_DIR/config.js" ]; then
    echo -e "${YELLOW}📦 Restoring configuration...${NC}"
    docker cp "$BACKUP_DIR/config.js" botwa:/app/
    echo -e "${GREEN}✅ Config restored${NC}"
fi

# Cleanup
rm -rf "$TEMP_DIR"

# Start bot
echo -e "${YELLOW}🚀 Starting bot...${NC}"
docker-compose start botwa

# Wait for bot to be healthy
echo -e "${YELLOW}⏳ Waiting for bot to be ready...${NC}"
sleep 5

# Check status
if docker ps | grep -q botwa; then
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ Restore completed successfully!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════${NC}"
    echo ""
    echo "Check logs with: docker-compose logs -f botwa"
else
    echo -e "${RED}❌ Bot failed to start. Check logs:${NC}"
    docker-compose logs botwa
    exit 1
fi
