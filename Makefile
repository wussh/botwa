# Makefile for BotWA Docker Operations

.PHONY: help build up down restart logs backup restore clean

# Default target
help:
	@echo "🤖 BotWA Docker Commands"
	@echo "======================="
	@echo ""
	@echo "Basic Operations:"
	@echo "  make build        - Build Docker image"
	@echo "  make up           - Start bot (SQLite)"
	@echo "  make up-mongo     - Start bot with MongoDB"
	@echo "  make up-dev       - Start in development mode"
	@echo "  make down         - Stop all services"
	@echo "  make restart      - Restart bot"
	@echo "  make logs         - View logs (follow)"
	@echo ""
	@echo "Maintenance:"
	@echo "  make backup       - Create backup"
	@echo "  make restore      - Restore from backup"
	@echo "  make clean        - Remove containers and volumes"
	@echo "  make reset        - Full reset (clean + rebuild)"
	@echo ""
	@echo "Database:"
	@echo "  make db-sqlite    - Open SQLite shell"
	@echo "  make db-mongo     - Open MongoDB shell"
	@echo "  make migrate      - Run database migration"
	@echo ""
	@echo "Monitoring:"
	@echo "  make status       - Check container status"
	@echo "  make stats        - Show resource usage"
	@echo "  make health       - Check health status"
	@echo ""

# Build the Docker image
build:
	@echo "🔨 Building Docker image..."
	docker-compose build --no-cache

# Start services
up:
	@echo "🚀 Starting bot (SQLite)..."
	docker-compose up -d
	@echo "✅ Bot started! View logs with: make logs"

up-mongo:
	@echo "🚀 Starting bot with MongoDB..."
	docker-compose -f docker-compose.mongodb.yml up -d
	@echo "✅ Bot and MongoDB started!"
	@echo "📊 Mongo Express UI: http://localhost:8081"

up-dev:
	@echo "🛠️  Starting in development mode..."
	docker-compose -f docker-compose.dev.yml up

# Stop services
down:
	@echo "🛑 Stopping services..."
	docker-compose down

# Restart bot
restart:
	@echo "🔄 Restarting bot..."
	docker-compose restart botwa

# View logs
logs:
	docker-compose logs -f botwa

logs-all:
	docker-compose logs -f

# Backup
backup:
	@echo "💾 Creating backup..."
	@chmod +x scripts/backup.sh
	@./scripts/backup.sh

# Restore
restore:
	@echo "♻️  Starting restore process..."
	@chmod +x scripts/restore.sh
	@./scripts/restore.sh $(BACKUP)

# Database operations
db-sqlite:
	@echo "📊 Opening SQLite shell..."
	docker-compose exec botwa sqlite3 /app/memory/botwa.db

db-mongo:
	@echo "📊 Opening MongoDB shell..."
	docker-compose exec mongodb mongosh -u botwa_admin -p

migrate:
	@echo "🔄 Running database migration..."
	docker-compose exec botwa node database/migrate.js $(DB_TYPE)

# Status and monitoring
status:
	@echo "📊 Container Status:"
	@docker-compose ps

stats:
	@echo "📈 Resource Usage:"
	@docker stats --no-stream botwa

health:
	@echo "🏥 Health Check:"
	@docker inspect --format='{{json .State.Health}}' botwa | jq

# Cleanup
clean:
	@echo "🧹 Cleaning up..."
	docker-compose down -v
	@echo "✅ Cleanup complete"

reset: clean build up
	@echo "✅ Full reset complete"

# Update bot
update:
	@echo "🔄 Updating bot..."
	git pull origin master
	docker-compose build --no-cache
	docker-compose up -d
	@echo "✅ Update complete"

# Setup
setup:
	@echo "⚙️  Setting up BotWA..."
	@cp .env.example .env
	@mkdir -p auth memory backup scripts
	@chmod +x scripts/*.sh
	@echo "✅ Setup complete!"
	@echo ""
	@echo "Next steps:"
	@echo "1. Edit .env with your settings"
	@echo "2. Edit config.js with your configuration"
	@echo "3. Run: make build"
	@echo "4. Run: make up"
