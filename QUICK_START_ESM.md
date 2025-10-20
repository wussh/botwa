# 🚀 Quick Start - ESM Modular BotWA

## ⚡ Get Started in 3 Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure
Edit `src/config/index.js` or `config.js` with your settings:
```javascript
ALLOWED_CONTACTS: [
  "6283108490895",  // Replace with your numbers
  "6285174237321"
]
```

### 3. Run the Bot
```bash
npm start
```

That's it! Scan the QR code and start chatting! 🎉

---

## 📱 Development Mode

Want auto-reload when you edit code?
```bash
npm run dev
```

---

## 🐳 Docker Quick Start

```bash
# Build
make build

# Run
make up

# View logs (and scan QR)
make logs
```

---

## 📂 Project Structure

```
src/
├── index.js              # Start here - main entry point
├── config/index.js       # Configuration
├── utils/                # Utilities (logger, validation, etc.)
├── ai/                   # AI services (intent, emotion, models)
├── memory/               # Memory management
├── whatsapp/             # WhatsApp connection & messages
└── database/             # Database abstraction
```

---

## 🎯 Common Tasks

### View Logs
```bash
# All logs
npm start

# Debug mode
LOG_LEVEL=debug npm start
```

### Clear Memory
```bash
rm memory/memory.json
npm start
```

### Backup Data
```bash
make backup
# or
./scripts/backup.sh
```

### Switch Database
Edit `src/config/index.js`:
```javascript
DATABASE_TYPE: 'sqlite',  // or 'mongodb', 'json'
```

---

## 🐛 Troubleshooting

### Bot won't start?
```bash
# Check Node version (need v16+)
node --version

# Reinstall dependencies
rm -rf node_modules
npm install
```

### QR code not showing?
```bash
# View raw logs
npm start 2>&1 | less

# Or in Docker
docker logs botwa
```

### Permission errors?
```bash
chmod +x scripts/*.sh
```

---

## 📚 Learn More

- **Full Documentation**: See `ESM_MIGRATION_COMPLETE.md`
- **Architecture Details**: See `ESM_FINAL_SUMMARY.md`
- **Module Usage**: Check individual files (all have JSDoc comments)

---

## 💡 Example Usage

### Import and Use Modules
```javascript
import { logger } from './src/utils/logger.js';
import { memoryManager } from './src/memory/memoryManager.js';
import { generateResponse } from './src/ai/aiService.js';

// Use logger
logger.info('Hello!');

// Use memory
const history = memoryManager.getChatMemory('user123');

// Generate AI response
const messages = [
  { role: 'system', content: 'You are helpful' },
  { role: 'user', content: 'Hello!' }
];
const reply = await generateResponse(messages, 'gemma3:4b-it-qat');
```

---

## 🎉 You're Ready!

Start the bot and send a message from your authorized number!

```bash
npm start
```

**Have fun! 🚀**
