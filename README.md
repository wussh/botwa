# 🤖 BotWA - Advanced AI WhatsApp Bot

An intelligent, emotionally-aware WhatsApp bot powered by multiple AI models with advanced memory, personality adaptation, and natural conversation abilities.

## ✨ Features

### 🧠 Advanced AI Capabilities
- **Multi-Model Intelligence**: Routes to optimal AI models based on intent, emotion, and context
- **Model Fallback System**: Automatically switches models if primary fails (phi3 → gemma3 → llama3.2 → phi4)
- **Intent Detection**: Classifies messages (question/command/emotional/technical/smalltalk/casual)
- **Emotion Recognition**: Detects user emotions (happy/sad/frustrated/anxious/flirty/neutral)
- **Language Support**: Bilingual (English & Indonesian) with automatic detection
- **Gibberish Detection**: Validates AI responses and rejects nonsensical outputs

### 💾 Sophisticated Memory System
- **Multiple Storage Options**: SQLite (recommended), MongoDB, or JSON file
- **Short-term Memory**: Last 10 messages per user
- **Long-term Memory**: Automatic summarization of conversation history
- **Semantic Memory**: Vector embeddings for intelligent context recall
- **Emotional Events**: Remembers significant emotional moments
- **Tone Memory**: Maintains conversational tone across sessions
- **Language Preference**: Remembers each user's preferred language
- **Personality Trends**: Tracks evolving personality traits over time
- **Mood History**: Monitors mood drift and patterns
- **Relationship Types**: Adapts persona (romantic/friend/counselor/mentor/companion)
- **Database Migration**: Easy migration from JSON to SQLite/MongoDB

### 🎭 Dynamic Personality
- **Adaptive Traits**: Curiosity, empathy, humor, flirtiness, logic, playfulness
- **Domain Awareness**: Adjusts personality based on conversation topics
- **Relationship Personas**: Different personalities for different relationship types
- **Personality Evolution**: Learns and evolves based on conversation outcomes
- **Temporal Awareness**: Time-of-day and weekend detection for contextual responses

### 🌐 Natural Behavior
- **Human-like Typing**: Dynamic reply delays based on message length and emotion
- **Presence Updates**: Shows "typing..." and "online" status naturally
- **Message Buffering**: Waits for user to finish typing before responding
- **Trivial Message Skipping**: Ignores repeated "ok", "hmm", "haha" messages
- **Message Deduplication**: Prevents duplicate responses on reconnect

### 🔐 Reliability & Security
- **Contact Whitelist**: Only responds to authorized phone numbers
- **Graceful Shutdown**: Saves memory before exit
- **Auto-reconnect**: Handles disconnections with exponential backoff
- **Health Monitoring**: Auto-detects stale connections
- **Structured Logging**: Comprehensive logging with pino
- **Error Recovery**: Robust fallback mechanisms at every level

## 📋 Requirements

- **Node.js**: v16 or higher
- **WhatsApp**: Active WhatsApp account for bot
- **AI Server**: Access to Ollama or compatible AI API endpoint
- **Database** (Optional): SQLite (recommended) or MongoDB for better performance

## 🚀 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/wussh/botwa.git
cd botwa

# Install dependencies
npm install

# Optional: Install database driver
npm install sqlite3        # For SQLite (recommended)
# OR
npm install mongodb       # For MongoDB
```

### 2. Configuration

Edit `config.js` to customize settings:

```javascript
module.exports = {
  // Your allowed WhatsApp numbers (include country code, no +)
  ALLOWED_CONTACTS: [
    "6281234567890",  // Replace with your numbers
    "6281234567890"
  ],
  
  // AI API endpoints
  AI_API_URL: 'https://ai.wush.site/v1/chat/completions',
  AI_EMBEDDING_URL: 'https://ai.wush.site/v1/embeddings',
  
  // Database Configuration
  DATABASE_TYPE: 'json',  // Options: 'sqlite', 'mongodb', 'json'
  DATABASE_OPTIONS: {
    sqlite: {
      dbPath: 'memory/botwa.db'
    },
    mongodb: {
      connectionString: 'mongodb://localhost:27017',
      dbName: 'botwa'
    }
  },
  
  // AI Models (optimized for speed and quality)
  AI_MODELS: {
    emotional: 'gemma3:4b-it-qat',       // Empathetic responses
    factual: 'gemma3:4b-it-qat',         // Information queries
    creative: 'gemma3:4b-it-qat',        // Creative/flirty
    summarization: 'gemma3:1b-it-qat',   // Efficient summaries
    coding: 'gemma3:4b-it-qat',          // Technical responses
    embedding: 'tazarov/all-minilm-l6-v2-f32:latest'
  },
  
  // Other settings (see config.js for full options)
  LOG_LEVEL: 'info'
};
```

### 3. First Run

```bash
# Start the bot
node bot.js

# Expected output:
🔍 Bot script is being loaded...
🔍 Loading config...
🔍 Config loaded successfully!
✅ All services started!

# If first time, scan the QR code with WhatsApp:
📱 Please scan the QR code below to log in:
█████████████████████████████
█████████████████████████████
...
```

### 4. Send Messages

From an allowed WhatsApp number, send:
- "hey how are you?" → Bot responds in English
- "halo apa kabar?" → Bot responds in Indonesian
- "i'm feeling sad today" → Empathetic emotional response
- "how do i write a for loop?" → Technical/coding response

## 📖 How It Works

### Message Processing Flow

```
1. User sends message
   ↓
2. Deduplication check
   ↓
3. Contact authorization
   ↓
4. Message buffering (2s debounce)
   ↓
5. Cognitive analysis:
   - Intent detection
   - Emotion detection
   - Language detection
   - Temporal context
   - Mood drift tracking
   ↓
6. Memory retrieval:
   - Short-term history
   - Long-term summaries
   - Semantic memories
   - Emotional events
   ↓
7. Personality adaptation:
   - Domain-based traits
   - Relationship persona
   - Emotional modifiers
   ↓
8. Model selection:
   - Intent-based routing
   - Emotion-based scoring
   - Temporal context
   ↓
9. AI generation:
   - Primary model attempt
   - Fallback on failure
   - Response validation
   ↓
10. Natural behavior:
    - Calculate typing delay
    - Show presence updates
    - Send message
    ↓
11. Memory updates:
    - Save to short-term
    - Store semantic memory
    - Update personality trends
    - Auto-summarize if needed
    ↓
12. Self-reflection:
    - Evaluate response quality
    - Learn from outcome
```

## 🤖 AI Models

### Primary Models

| Intent | Model | Speed | Purpose |
|--------|-------|-------|---------|
| Emotional | gemma3:4b-it-qat | 11.9s | Empathy & feelings |
| Factual | gemma3:4b-it-qat | 11.9s | Information queries |
| Creative | gemma3:4b-it-qat | 11.9s | Creative/playful |
| Summarization | gemma3:1b-it-qat | 6.4s | Fast summaries |
| Coding | gemma3:4b-it-qat | 11.9s | Technical help |
| Embedding | tazarov/all-minilm-l6-v2-f32 | Fast | Semantic search |

### Fallback Chain

1. **Primary Model** (selected by intent/emotion)
2. **phi3:3.8b** (5.8s - fastest)
3. **gemma3:1b-it-qat** (6.4s - fast & stable)
4. **llama3.2:latest** (8.1s - balanced)
5. **phi4-mini-reasoning:3.8b** (8.4s - quality reasoning)
6. **Hardcoded Responses** (last resort)

### Models to Avoid

❌ **DO NOT USE** these models (known issues):
- `gemma3:1b-it-qat` (hangs/500 errors)
- `gemma3:4b-it-qat` (same family issues)
- `gemma3:12b-it-qat` (same family issues)
- Large models >20B (may timeout)

## 🗂️ Project Structure

```
botwa/
├── bot.js                    # Main bot logic (1835 lines)
├── config.js                 # Configuration settings
├── package.json              # Dependencies
├── Dockerfile               # Docker configuration
├── benchmark.sh             # Model performance testing
│
├── database/                # Database adapters (NEW!)
│   ├── factory.js           # Database factory
│   ├── sqlite.js            # SQLite adapter
│   ├── mongodb.js           # MongoDB adapter
│   ├── json.js              # JSON adapter (legacy)
│   └── migrate.js           # Migration script
│
├── auth/                    # WhatsApp session (auto-generated)
│   ├── creds.json
│   └── ...session files
│
├── memory/                  # Bot memory persistence
│   ├── memory.json          # JSON storage (default)
│   └── botwa.db             # SQLite database (if enabled)
│
└── docs/                    # Documentation
    ├── README.md            # Main documentation
    ├── DATABASE_SETUP.md    # Database setup guide (NEW!)
    ├── COMPLETE_AUDIT.md    # Code & model audit
    └── ...
```

## 🔧 Configuration Options

### Connection Settings
```javascript
MAX_RECONNECT_ATTEMPTS: 5           // Max reconnection tries
RECONNECT_DELAY: 5000               // 5 seconds between retries
STALE_CONNECTION_THRESHOLD: 600000  // 10 minutes before force relogin
```

### Memory Settings
```javascript
DATABASE_TYPE: 'json'               // 'sqlite', 'mongodb', or 'json'
MAX_SHORT_TERM_MESSAGES: 10         // Last N messages per user
MAX_LONG_TERM_SUMMARIES: 5          // Compressed history entries
MAX_EMOTIONAL_EVENTS: 20            // Significant emotional moments
MAX_SEMANTIC_MEMORIES: 10           // Vector embeddings stored
MEMORY_SAVE_DEBOUNCE: 5000          // Auto-save every 5s
```

**💡 For better performance, migrate to SQLite:**
```bash
npm install sqlite3
node database/migrate.js sqlite
# Update config.js: DATABASE_TYPE: 'sqlite'
```

See [DATABASE_SETUP.md](DATABASE_SETUP.md) for detailed database configuration.

### AI Settings
```javascript
AI_MAX_TOKENS: 150                  // Max response length
AI_MAX_RETRIES: 3                   // Retry attempts per model
EMBEDDING_SIMILARITY_THRESHOLD: 0.75 // Semantic search threshold
```

### Behavior Settings
```javascript
DEBOUNCE_DELAY: 2000                // Wait 2s for user to finish typing
REPLY_DELAY: 2000                   // Base reply delay
MIN_REPLY_DELAY: 1000               // Minimum 1s delay
MAX_REPLY_DELAY: 6000               // Maximum 6s delay
REPLY_DELAY_PER_CHAR: 50            // 50ms per character
SKIP_RESPONSE_THRESHOLD: 3          // Ignore after 3 trivial messages
```

## 📊 Performance Benchmarks

Run the benchmark script to test your models:

```bash
chmod +x benchmark.sh
./benchmark.sh
```

Example output:
```
Testing: phi3:3.8b
  ✅ SUCCESS (5800ms)
  Reply: hey! how can i help you today?

Testing: gemma3:1b-it-qat
  ✅ SUCCESS (6400ms)
  Reply: i'm doing well, thanks for asking!
```

## 🐳 Docker Deployment

### Build Image
```bash
# Using Docker Compose (recommended)
docker-compose build

# Using Makefile
make build
```

### Run Container (SQLite)
```bash
# Start with Docker Compose
docker-compose up -d

# Using Makefile
make up

# View logs
docker-compose logs -f botwa
# or
make logs
```

### Run with MongoDB
```bash
# Start with MongoDB
docker-compose -f docker-compose.mongodb.yml up -d

# Using Makefile
make up-mongo

# Access Mongo Express UI
open http://localhost:8081
```

### Common Commands
```bash
# Stop services
docker-compose down
# or
make down

# Restart bot
docker-compose restart botwa
# or
make restart

# View logs
docker-compose logs -f
# or
make logs

# Backup data
./scripts/backup.sh
# or
make backup

# Check status
docker-compose ps
# or
make status
```

### Development Mode
```bash
# Start with hot reload
docker-compose -f docker-compose.dev.yml up
# or
make up-dev
```

See [DOCKER_SETUP.md](DOCKER_SETUP.md) for detailed Docker instructions.

## 🔍 Monitoring & Debugging

### Log Levels
- `debug`: Detailed processing information
- `info`: General operation (default)
- `warn`: Warning messages
- `error`: Error conditions

### View Logs in Real-time
```bash
node bot.js | grep "🧩 AI response"  # Filter AI responses
node bot.js | grep "❌"               # Show errors only
```

### Check Memory File
```bash
# JSON (default)
cat memory/memory.json | jq .

# SQLite
sqlite3 memory/botwa.db "SELECT * FROM chat_memory LIMIT 10;"

# MongoDB
mongo botwa --eval "db.chatMemory.find().limit(10)"
```

### Monitor Health
The bot auto-monitors connection health every 5 minutes and logs:
- Connection status
- Reconnection attempts
- Memory save operations
- Model fallback attempts

## 🧪 Testing

### Test Scenarios

#### 1. English Conversation
```
User: hey there
Bot: hey! what's on your mind?

User: how are you?
Bot: i'm good, just here for you. what's up?
```

#### 2. Indonesian Conversation
```
User: halo
Bot: halo! ada apa nih?

User: gimana kabarnya?
Bot: baik dong, makasih udah nanya. kamu gimana?
```

#### 3. Emotional Support
```
User: i'm feeling really sad today
Bot: hey, i'm here for you. want to talk about what's going on?
```

#### 4. Technical Question
```
User: how do i write a for loop in javascript?
Bot: for loops in js are like: for (let i = 0; i < 10; i++) { ... }
```

## 🛠️ Troubleshooting

### Bot not responding?
1. Check if your number is in `ALLOWED_CONTACTS`
2. Verify bot is logged in (check for QR code)
3. Check logs for errors: `grep "❌" logs.txt`

### Getting timeout errors?
1. Run `benchmark.sh` to test model speeds
2. Update `config.js` with faster models
3. Increase timeout in `bot.js` (aiClient/embedClient)

### Wrong language responses?
1. Check language detection logs: `grep "🌐" logs.txt`
2. Verify language keywords match your messages
3. Clear memory: `rm memory/memory.json` and restart

### Memory not persisting?
1. Check file permissions: `ls -la memory/`
2. Verify graceful shutdown (Ctrl+C, not kill -9)
3. Check for save errors: `grep "💾" logs.txt`

### Gibberish responses?
1. Check for validation logs: `grep "⚠️ Detected gibberish"`
2. Update problematic models in config.js
3. Lower temperature (0.7 → 0.6) for more stable output

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Test thoroughly
4. Submit a pull request

## 🔗 Links

- **GitHub**: https://github.com/wussh/botwa
- **Issues**: Report bugs on GitHub Issues

## 👤 Author

**wussh**
- GitHub: [@wussh](https://github.com/wussh)

## 🙏 Acknowledgments

- **Baileys**: WhatsApp Web API library
- **Ollama**: Local AI model serving
- **Pino**: Fast JSON logging
