# 🚀 Quick Start with Docker

Get your bot running in 5 minutes!

## 📋 Prerequisites

- Docker installed ([Get Docker](https://docs.docker.com/get-docker/))
- Docker Compose installed (included with Docker Desktop)
- Git (to clone the repository)

## ⚡ Fast Track (SQLite - Recommended)

```bash
# 1. Clone repository
git clone https://github.com/wussh/botwa.git
cd botwa

# 2. Setup environment
make setup
# or manually:
cp .env.example .env
mkdir -p auth memory backup

# 3. Configure allowed contacts
nano config.js
# Update ALLOWED_CONTACTS with your WhatsApp numbers

# 4. Build and start
make build
make up

# 5. Scan QR code
make logs
# Look for the QR code in the logs and scan with WhatsApp
```

**Done!** Your bot is running 🎉

## 🗄️ With MongoDB (For Scaling)

```bash
# 1-3. Same as above

# 4. Update config.js
DATABASE_TYPE: 'mongodb'

# 5. Start with MongoDB
make up-mongo

# 6. Access Mongo Express
open http://localhost:8081
# Username: admin
# Password: admin123
```

## 🛠️ Development Mode

```bash
# Start with hot reload
make up-dev

# Code changes will auto-reload
```

## 📊 Common Tasks

```bash
# View logs
make logs

# Restart bot
make restart

# Stop bot
make down

# Backup data
make backup

# Check status
make status

# Access SQLite database
make db-sqlite

# Access MongoDB shell
make db-mongo
```

## 🔧 Troubleshooting

### QR Code Not Showing?
```bash
# View raw logs
docker-compose logs botwa | less -R
```

### Bot Not Starting?
```bash
# Check logs for errors
make logs

# Check container status
make status

# View resource usage
make stats
```

### Need to Reset?
```bash
# Full reset (removes all data!)
make reset
```

## 📚 Next Steps

- Read [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed documentation
- Check [DATABASE_SETUP.md](DATABASE_SETUP.md) for database options
- See [README.md](README.md) for full feature list

## 🆘 Need Help?

```bash
# Show all available commands
make help
```

Or check the documentation files:
- `DOCKER_SETUP.md` - Complete Docker guide
- `DATABASE_SETUP.md` - Database configuration
- `README.md` - Full documentation

---

**Pro Tips:**

- Use `make up` for production with SQLite
- Use `make up-mongo` if you need MongoDB features
- Use `make up-dev` for development with hot reload
- Run `make backup` daily to backup your data
- Monitor with `make stats` to check resource usage

🎉 **Happy chatting!**
