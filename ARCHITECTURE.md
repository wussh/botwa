# 🏗️ BotWA Architecture - Module Relationships

## Visual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         src/index.js                             │
│                      (Main Entry Point)                          │
│                                                                  │
│  • Initializes all modules                                      │
│  • Orchestrates startup/shutdown                                │
│  • Handles graceful errors                                      │
└──────────────────────┬───────────────────────────────────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌─────────────┐
│   Config     │ │  Logger  │ │  Validation │
│              │ │          │ │             │
│ config/      │ │ utils/   │ │ utils/      │
│ index.js     │ │ logger.js│ │ *.js        │
└──────────────┘ └──────────┘ └─────────────┘
         │             │             │
         └─────────────┼─────────────┘
                       │
         ┌─────────────┼─────────────┐
         │             │             │
         ▼             ▼             ▼
┌──────────────┐ ┌──────────┐ ┌─────────────┐
│   Memory     │ │ WhatsApp │ │     AI      │
│  Manager     │ │Connection│ │  Services   │
│              │ │          │ │             │
│ memory/      │ │whatsapp/ │ │    ai/      │
│memoryMgr.js  │ │connect.js│ │ *.js        │
└──────┬───────┘ └────┬─────┘ └──────┬──────┘
       │              │               │
       │              ▼               │
       │       ┌─────────────┐        │
       │       │  Message    │        │
       └──────▶│  Handler    │◀───────┘
               │             │
               │ whatsapp/   │
               │ messageH.js │
               └─────────────┘
```

## Module Dependencies

### Core Modules (Used by Everyone)
```
config/index.js
  ├── Used by: All modules
  └── Dependencies: None

utils/logger.js
  ├── Used by: All modules
  └── Dependencies: pino, config

utils/validationUtils.js
  ├── Used by: index.js, messageHandler.js
  └── Dependencies: None

utils/phoneUtils.js
  ├── Used by: messageHandler.js
  └── Dependencies: None

utils/memoryUtils.js
  ├── Used by: memoryManager.js
  └── Dependencies: None
```

### AI Layer
```
ai/intentDetector.js
  ├── Used by: messageHandler.js
  └── Dependencies: None

ai/emotionDetector.js
  ├── Used by: messageHandler.js, memoryManager.js
  └── Dependencies: None

ai/languageDetector.js
  ├── Used by: messageHandler.js, memoryManager.js
  └── Dependencies: None

ai/modelSelector.js
  ├── Used by: messageHandler.js
  └── Dependencies: config

ai/aiService.js
  ├── Used by: messageHandler.js, memoryManager.js
  └── Dependencies: axios, config, logger, modelSelector
```

### Memory Layer
```
memory/memoryManager.js
  ├── Used by: index.js, messageHandler.js
  └── Dependencies: fs, logger, config, memoryUtils, aiService
```

### WhatsApp Layer
```
whatsapp/connection.js
  ├── Used by: index.js
  └── Dependencies: baileys, qrcode-terminal, logger, config

whatsapp/messageHandler.js
  ├── Used by: index.js
  └── Dependencies: All AI modules, memoryManager, phoneUtils, 
                    validationUtils, connection
```

### Database Layer (Optional)
```
database/factory.js
  ├── Used by: Can be used instead of memoryManager
  └── Dependencies: sqlite.js, mongodb.js, json.js (dynamic imports)
```

## Data Flow

### Incoming Message Flow
```
WhatsApp Message
      │
      ▼
connection.js (receives)
      │
      ▼
messageHandler.js (processes)
      │
      ├──▶ phoneUtils.js (validate)
      │
      ├──▶ intentDetector.js (analyze)
      │
      ├──▶ emotionDetector.js (analyze)
      │
      ├──▶ languageDetector.js (analyze)
      │
      ├──▶ memoryManager.js (retrieve context)
      │         │
      │         ├──▶ getChat Memory()
      │         ├──▶ searchSemanticMemory()
      │         └──▶ getEmotionalEvents()
      │
      ├──▶ modelSelector.js (choose model)
      │
      ├──▶ aiService.js (generate response)
      │         │
      │         └──▶ generateResponse() → API call
      │
      ├──▶ memoryManager.js (store)
      │         │
      │         ├──▶ addChatMessage()
      │         ├──▶ storeSemanticMemory()
      │         └──▶ recordMood()
      │
      └──▶ connection.js (send reply)
```

### Memory Persistence Flow
```
Memory Changes
      │
      ▼
memoryManager.js
      │
      ├──▶ scheduleSave() (debounced)
      │         │
      │         └──▶ Wait 5 seconds
      │
      └──▶ saveMemory()
                │
                └──▶ fs.writeFileSync(memory.json)
```

### AI Response Flow with Fallback
```
messageHandler.js
      │
      ├──▶ modelSelector.js (select best model)
      │         │
      │         └──▶ Returns: gemma3:4b-it-qat
      │
      └──▶ aiService.js
                │
                ├──▶ Try: gemma3:4b-it-qat
                │    ├─▶ Success? → Return response
                │    └─▶ Fail? ↓
                │
                ├──▶ Fallback 1: phi3:3.8b
                │    ├─▶ Success? → Return response
                │    └─▶ Fail? ↓
                │
                ├──▶ Fallback 2: llama3.2
                │    ├─▶ Success? → Return response
                │    └─▶ Fail? ↓
                │
                └──▶ Fallback 3: phi4-mini
                     └─▶ Success or throw error
```

## Module Characteristics

### Independent Modules (No dependencies on other bot modules)
- ✅ config/index.js
- ✅ utils/phoneUtils.js
- ✅ utils/validationUtils.js
- ✅ utils/memoryUtils.js
- ✅ ai/intentDetector.js
- ✅ ai/emotionDetector.js
- ✅ ai/languageDetector.js

### Service Modules (Provide services to others)
- 🔧 utils/logger.js
- 🔧 ai/modelSelector.js
- 🔧 ai/aiService.js
- 🔧 memory/memoryManager.js
- 🔧 whatsapp/connection.js

### Orchestrator Modules (Coordinate multiple modules)
- 🎯 src/index.js
- 🎯 whatsapp/messageHandler.js

## Import Graph

```
index.js
├── import config
├── import { logger }
├── import { validateConfig }
├── import { memoryManager }
├── import { whatsappConnection }
└── import MessageHandler

messageHandler.js
├── import { logger }
├── import config
├── import { isAllowedContact, extractPhoneFromJid }
├── import { isValidMessage }
├── import { detectIntent }
├── import { detectEmotion, detectTone, detectEmotionalEvent }
├── import { detectLanguage }
├── import { selectModel }
├── import { generateResponse }
└── import { memoryManager }

memoryManager.js
├── import fs
├── import { logger }
├── import config
├── import { truncateArray, calculateDecayFactor, ... }
└── import { getEmbedding }

connection.js
├── import { makeWASocket, useMultiFileAuthState, ... }
├── import qrcode
├── import fs
├── import { logger }
└── import config
```

## Coupling Analysis

### Low Coupling (Good!)
- All utility modules are independent
- AI detection modules are standalone
- Database modules are optional

### Medium Coupling (Expected)
- messageHandler uses AI + Memory + WhatsApp
- memoryManager uses utils + aiService
- aiService uses config + logger

### High Coupling (Acceptable for orchestrators)
- index.js knows about all modules (by design)
- messageHandler coordinates many modules (by design)

## Extensibility Points

### Easy to Add
1. **New AI Models**: Just update modelSelector.js
2. **New Detectors**: Add to ai/ folder
3. **New Utilities**: Add to utils/ folder
4. **New Memory Types**: Extend memoryManager.js
5. **New Message Types**: Extend messageHandler.js

### Plugin Architecture Possible
```javascript
// Future: plugins/
plugins/
├── googleCalendar.js
├── weatherAPI.js
├── reminderSystem.js
└── customCommands.js

// Each plugin can import:
import { memoryManager } from '../memory/memoryManager.js';
import { whatsappConnection } from '../whatsapp/connection.js';
```

## Testing Strategy

### Unit Tests (Isolated)
```
utils/phoneUtils.test.js
  ├── Test normalizePhoneNumber()
  ├── Test isAllowedContact()
  └── No external dependencies needed

ai/intentDetector.test.js
  ├── Test detectIntent()
  └── No external dependencies needed
```

### Integration Tests (Module pairs)
```
memory/memoryManager.test.js
  ├── Test with mock aiService
  └── Test with mock file system

messageHandler.test.js
  ├── Test with mock connection
  ├── Test with mock memoryManager
  └── Test with mock AI services
```

### E2E Tests (Full flow)
```
e2e/fullFlow.test.js
  ├── Start bot
  ├── Send test message
  ├── Verify response
  └── Check memory saved
```

---

## 🎯 Key Takeaways

1. **Clean Dependencies**: Most modules depend only on config and logger
2. **Clear Layers**: Config → Utils → Services → Orchestrators
3. **Low Coupling**: Modules are independent and testable
4. **High Cohesion**: Each module has single responsibility
5. **Easy Extension**: Add new modules without changing existing ones

---

*This architecture enables easy testing, maintenance, and feature additions!*
