# Quick Reference: Key Changes

## New Functions Added

### Message Deduplication
```javascript
const processedMsgIds = [];
function markProcessed(id) { /* ... */ }
function alreadyProcessed(id) { /* ... */ }
```

### Config Validation
```javascript
function requireConfig(key, type = 'string') { /* ... */ }
```

## Updated Functions

### normalizePhoneNumber()
```javascript
// Before
return phoneNumber.replace(/\D/g, '');

// After  
return String(phoneNumber || '').replace(/\D/g, '');
```

### isAllowedContact()
```javascript
// Before
CONFIG.ALLOWED_CONTACTS.some(contact => ...)

// After
ALLOWED_CONTACTS.some(c => ...)
```

### generateEmbedding()
```javascript
// Before
await axios.post(CONFIG.AI_EMBEDDING_URL, {...}, { headers: {...} })

// After
await embedClient.post('', {...})
```

### getAllMemoriesForSender()
```javascript
// Before
[shortTermMemory, longTermMemory, emotionalMemory, ...] // undefined maps!

// After
const shortTerm = chatMemory.get(sender) || [];
const longTerm = longTermMemory.get(sender) || [];
// ... proper map usage
```

### saveMemory() / loadMemory()
```javascript
// Added to both functions:
semanticMemory: Object.fromEntries(semanticMemory),
personalityTrends: Object.fromEntries(personalityTrends),
moodHistory: Object.fromEntries(moodHistory),
relationshipTypes: Object.fromEntries(relationshipTypes)
```

## Message Handler Changes

```javascript
// Added after basic validation:
if (alreadyProcessed(msg.key.id)) return;
markProcessed(msg.key.id);

// Added broadcast filter:
if (sender === 'status@broadcast' || sender.includes('@g.us')) return;

// Added skip trivial:
if (shouldSkipResponse(sender, text)) return;
```

## Presence Update Simplification

```javascript
// Before (3+ calls, nested setTimeout)
setTimeout(() => { sock.sendPresenceUpdate('composing', sender); }, ...);
setTimeout(() => { sock.sendPresenceUpdate('composing', sender); }, ...);
setTimeout(() => { sock.sendPresenceUpdate('available', sender); }, ...);

// After (clean cycle)
await sock.sendPresenceUpdate('composing', sender);
setTimeout(async () => {
  await sock.sendPresenceUpdate('paused', sender);
  await sock.sendMessage(sender, { text: reply });
}, replyDelay);
```

## Shutdown Handlers

```javascript
process.on('SIGINT', () => {
  logger.info('🛑 SIGINT received: saving memory and exiting...');
  try { saveMemory(); } catch {}
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('🛑 SIGTERM received: saving memory and exiting...');
  try { saveMemory(); } catch {}
  process.exit(0);
});
```

## Logging Improvements

Replaced console.log with structured logging:

```javascript
// Before
console.log('💬 received bubble:', text);
console.log(`🎭 detected emotion: ${emotion}`);

// After
logger.debug({ text, sender }, '💬 Received message');
logger.debug({ emotion, tone, dominantMood, moodScore }, '🎭 Emotional analysis');
```

## Constants

```javascript
// Added at top after memory maps
const aiClient = axios.create({ baseURL: CONFIG.AI_API_URL, ... });
const embedClient = axios.create({ baseURL: CONFIG.AI_EMBEDDING_URL, ... });

const processedMsgIds = [];

const ALLOWED_CONTACTS = Array.isArray(CONFIG.ALLOWED_CONTACTS) && ...
  ? CONFIG.ALLOWED_CONTACTS
  : ["6281261480997", ...]; // fallback
```

## Testing Checklist

- [ ] Bot starts without errors (config validation works)
- [ ] Responds to allowed contacts only
- [ ] Ignores groups and status broadcasts
- [ ] Skips trivial messages after threshold
- [ ] Doesn't duplicate responses on reconnect
- [ ] Memory persists across restarts (all maps)
- [ ] Graceful shutdown saves memory (Ctrl+C)
- [ ] Presence updates are smooth (not spammy)
- [ ] Logs are structured and filterable by level

---

All changes are **backward compatible** with your existing memory.json file!
