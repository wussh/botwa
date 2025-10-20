# 🗄️ Database Setup Guide

BotWA supports three database backends for storing memory:

1. **SQLite** (Recommended) - Lightweight, no setup required
2. **MongoDB** - Flexible NoSQL, better for scaling
3. **JSON** (Default) - Simple file storage (legacy)

## 📊 Comparison

| Feature | SQLite | MongoDB | JSON |
|---------|--------|---------|------|
| Setup | ✅ Zero config | ⚠️ Requires server | ✅ Zero config |
| Performance | ⚡⚡⚡ Fast | ⚡⚡⚡ Fast | ⚡ Slow for large data |
| Queries | ✅ SQL queries | ✅ Rich queries | ❌ Limited |
| Concurrent Access | ⚠️ Limited | ✅ Excellent | ❌ Not safe |
| Scalability | ⚠️ Single file | ✅ Horizontal scaling | ❌ Not scalable |
| Backup | ✅ Copy file | ⚠️ Export needed | ✅ Copy file |
| Recommended For | Single bot instance | Multiple bots/users | Development only |

---

## 🚀 Quick Start

### Option 1: SQLite (Recommended)

**1. Install dependencies:**
```bash
npm install sqlite3
```

**2. Update `config.js`:**
```javascript
DATABASE_TYPE: 'sqlite',
DATABASE_OPTIONS: {
  sqlite: {
    dbPath: 'memory/botwa.db'
  }
}
```

**3. Migrate existing data (if any):**
```bash
node database/migrate.js sqlite
```

**4. Start the bot:**
```bash
node bot.js
```

✅ **Done!** SQLite database created automatically at `memory/botwa.db`

---

### Option 2: MongoDB

**1. Install MongoDB:**

**Ubuntu/Debian:**
```bash
# Install MongoDB
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

**Docker:**
```bash
docker run -d \
  --name mongodb \
  -p 27017:27017 \
  -v mongodb_data:/data/db \
  mongo:6.0
```

**2. Install Node.js driver:**
```bash
npm install mongodb
```

**3. Update `config.js`:**
```javascript
DATABASE_TYPE: 'mongodb',
DATABASE_OPTIONS: {
  mongodb: {
    connectionString: 'mongodb://localhost:27017',
    dbName: 'botwa'
  }
}
```

**For remote MongoDB (with authentication):**
```javascript
mongodb: {
  connectionString: 'mongodb://username:password@host:27017',
  dbName: 'botwa'
}
```

**4. Migrate existing data:**
```bash
node database/migrate.js mongodb
# Or with custom connection string:
node database/migrate.js mongodb mongodb://username:password@host:27017
```

**5. Start the bot:**
```bash
node bot.js
```

---

### Option 3: JSON (Default - No Setup Needed)

Already working! No changes needed. Just keep:
```javascript
DATABASE_TYPE: 'json'
```

⚠️ **Note:** JSON is fine for development, but for production with many users, use SQLite or MongoDB.

---

## 📦 Migration Guide

### Migrating from JSON to SQLite

```bash
# 1. Install SQLite
npm install sqlite3

# 2. Run migration
node database/migrate.js sqlite

# 3. Update config.js
# Change DATABASE_TYPE: 'json' to DATABASE_TYPE: 'sqlite'

# 4. Restart bot
node bot.js

# 5. Verify migration
# Check that memory/botwa.db exists
ls -lh memory/botwa.db

# 6. Backup original JSON (already done by migration script)
# memory/memory.json.backup.TIMESTAMP
```

### Migrating from JSON to MongoDB

```bash
# 1. Install MongoDB (see above)
npm install mongodb

# 2. Run migration
node database/migrate.js mongodb

# 3. Update config.js
# Change DATABASE_TYPE: 'json' to DATABASE_TYPE: 'mongodb'

# 4. Restart bot
node bot.js

# 5. Verify migration
mongo
> use botwa
> db.chatMemory.count()
> db.longTermMemory.count()
```

### Migrating from SQLite to MongoDB

```bash
# Use the export-import approach
node database/migrate.js mongodb
```

---

## 🔍 Database Operations

### SQLite

**View database:**
```bash
# Install SQLite CLI
sudo apt install sqlite3  # Ubuntu/Debian
brew install sqlite3      # macOS

# Open database
sqlite3 memory/botwa.db

# Show tables
.tables

# Query data
SELECT * FROM chat_memory LIMIT 10;
SELECT sender, COUNT(*) FROM chat_memory GROUP BY sender;
SELECT * FROM emotional_events WHERE emotion = 'sad';

# Exit
.quit
```

**Backup:**
```bash
cp memory/botwa.db memory/botwa.db.backup
```

**Restore:**
```bash
cp memory/botwa.db.backup memory/botwa.db
```

---

### MongoDB

**View database:**
```bash
# Connect to MongoDB
mongo
# or
mongosh

# Switch to botwa database
use botwa

# Show collections
show collections

# Query data
db.chatMemory.find().limit(10)
db.chatMemory.count()
db.emotionalEvents.find({ emotion: "sad" })
db.chatMemory.find({ sender: "6281234567890" })

# Get stats
db.stats()
```

**Backup:**
```bash
# Backup all data
mongodump --db botwa --out ./backup

# Backup specific collection
mongodump --db botwa --collection chatMemory --out ./backup
```

**Restore:**
```bash
# Restore all data
mongorestore --db botwa ./backup/botwa

# Restore specific collection
mongorestore --db botwa --collection chatMemory ./backup/botwa/chatMemory.bson
```

---

## 🧹 Maintenance

### Clear old data (SQLite)

```bash
sqlite3 memory/botwa.db <<EOF
-- Delete chat messages older than 30 days
DELETE FROM chat_memory WHERE timestamp < datetime('now', '-30 days');

-- Delete mood history older than 7 days
DELETE FROM mood_history WHERE timestamp < datetime('now', '-7 days');

-- Vacuum to reclaim space
VACUUM;
EOF
```

### Clear old data (MongoDB)

```bash
mongo botwa <<EOF
// Delete chat messages older than 30 days
db.chatMemory.deleteMany({
  timestamp: { \$lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
});

// Delete mood history older than 7 days
db.moodHistory.deleteMany({
  timestamp: { \$lt: Date.now() - 7 * 24 * 60 * 60 * 1000 }
});
EOF
```

### Clear specific user's data

```javascript
// In bot.js, add admin command
if (text === '/clear_memory' && isAdmin(sender)) {
  await db.clearAllMemory(sender);
  await sock.sendMessage(sender, { text: '🗑️ Your memory has been cleared.' });
}
```

---

## 🔧 Troubleshooting

### SQLite: "Database is locked"
```bash
# Check for other processes
fuser memory/botwa.db

# Kill if needed
pkill -f bot.js

# Or restart
```

### MongoDB: "Connection refused"
```bash
# Check if MongoDB is running
sudo systemctl status mongod

# Start if not running
sudo systemctl start mongod

# Check logs
sudo tail -f /var/log/mongodb/mongod.log
```

### Migration fails
```bash
# Check file permissions
ls -la memory/

# Make migration script executable
chmod +x database/migrate.js

# Run with full path
node $(pwd)/database/migrate.js sqlite
```

### Performance issues

**SQLite:**
```sql
-- Add missing indexes
CREATE INDEX IF NOT EXISTS idx_sender_timestamp ON chat_memory(sender, timestamp);

-- Analyze database
ANALYZE;
```

**MongoDB:**
```javascript
// Rebuild indexes
db.chatMemory.reIndex()
db.semanticMemory.reIndex()
```

---

## 📊 Monitoring

### Database size

**SQLite:**
```bash
du -h memory/botwa.db
```

**MongoDB:**
```javascript
db.stats().dataSize / 1024 / 1024  // Size in MB
```

### Query performance

**SQLite:**
```sql
EXPLAIN QUERY PLAN SELECT * FROM chat_memory WHERE sender = '6281234567890';
```

**MongoDB:**
```javascript
db.chatMemory.find({ sender: '6281234567890' }).explain('executionStats')
```

---

## 🎯 Best Practices

1. **Backup regularly**
   - SQLite: Copy the `.db` file daily
   - MongoDB: Use `mongodump` in cron job

2. **Clean old data**
   - Automatically delete messages > 30 days
   - Keep emotional events for max 60 days

3. **Monitor size**
   - SQLite: Keep database < 1GB
   - MongoDB: Monitor disk usage

4. **Use indexes**
   - Already created by init scripts
   - Add custom indexes for new queries

5. **Connection pooling**
   - Reuse database connection
   - Don't create new connection per query

---

## 🔐 Security

### SQLite
```bash
# Set proper permissions
chmod 600 memory/botwa.db
chown youruser:youruser memory/botwa.db
```

### MongoDB
```javascript
// Create user with authentication
use botwa
db.createUser({
  user: "botwa_user",
  pwd: "strong_password_here",
  roles: [{ role: "readWrite", db: "botwa" }]
})

// Update config.js
connectionString: 'mongodb://botwa_user:strong_password_here@localhost:27017'
```

---

## 📈 Scaling

### Multiple bot instances

**Option 1: SQLite with separate databases**
```javascript
// bot1: DATABASE_OPTIONS.sqlite.dbPath = 'memory/bot1.db'
// bot2: DATABASE_OPTIONS.sqlite.dbPath = 'memory/bot2.db'
```

**Option 2: MongoDB (Recommended)**
```javascript
// Both bots can share the same MongoDB
// Automatic handling of concurrent access
DATABASE_TYPE: 'mongodb'
```

---

## 💡 Tips

- Start with SQLite for simplicity
- Migrate to MongoDB if you need:
  - Multiple bot instances
  - Advanced queries
  - Better concurrency
- Keep JSON backup even after migrating
- Test migration on copy of data first

---

**Need help?** Check the main README.md or open an issue on GitHub!
