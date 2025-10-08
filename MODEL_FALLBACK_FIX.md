# 🔄 Model Fallback System Added

## Problem
The bot was experiencing **500 errors** when certain AI models failed or didn't exist on the server:
- `phi4-mini-reasoning:3.8b` ✅ works (2.95s response)
- `gemma3:1b-it-qat` ❌ hangs/fails
- Other models may also fail causing the bot to crash

## Solution: Automatic Model Fallback

Added intelligent fallback logic that tries multiple models in order of reliability:

### Fallback Chain
1. **Primary Model** (selected by `selectModel()` based on intent/emotion)
2. **Fallback Models** (in order):
   - `phi4-mini-reasoning:3.8b` (most reliable, proven working)
   - `phi3:3.8b` (lightweight, stable)
   - `qwen2.5:7b` (general purpose)
   - `mistral:latest` (last resort)

### How It Works

```javascript
// Try primary model first
try {
  apiRes = await aiClient.post('', {
    model: selectedModel,  // e.g., "gemma3:1b-it-qat"
    messages,
    ...
  });
  reply = apiRes.data.choices[0].message.content.trim().toLowerCase();
} catch (primaryError) {
  logger.warn('⚠️ Primary model failed, trying fallback');
  
  // Try each fallback model in order
  for (const fallbackModel of fallbackModels) {
    try {
      apiRes = await aiClient.post('', {
        model: fallbackModel,  // e.g., "phi4-mini-reasoning:3.8b"
        messages,
        ...
      });
      reply = apiRes.data.choices[0].message.content.trim().toLowerCase();
      logger.info({ fallbackModel }, '✅ Fallback model succeeded');
      break; // Success! Exit loop
    } catch (fallbackError) {
      logger.warn({ fallbackModel }, '❌ Fallback also failed');
      continue; // Try next fallback
    }
  }
}

// If ALL models fail, use hardcoded context-aware fallback
if (!reply || reply.length < 3) {
  reply = fallbacks[userLang][Math.floor(Math.random() * 3)];
  logger.warn('⚠️ All AI models failed, using hardcoded fallback');
}
```

## Benefits

### 1. **No More Crashes**
- If one model fails (500 error, timeout, doesn't exist), bot automatically tries others
- Bot always responds even if all AI models fail

### 2. **Transparent Logging**
```json
{
  "level": "warn",
  "model": "gemma3:1b-it-qat",
  "error": "Request failed with status code 500",
  "msg": "⚠️ Primary model failed, trying fallback"
}

{
  "level": "debug",
  "fallbackModel": "phi4-mini-reasoning:3.8b",
  "msg": "🔄 Attempting fallback model"
}

{
  "level": "info",
  "fallbackModel": "phi4-mini-reasoning:3.8b",
  "msg": "✅ Fallback model succeeded"
}
```

### 3. **Tracks What Actually Worked**
```json
{
  "level": "info",
  "model": "phi4-mini-reasoning:3.8b",  // <-- shows which model actually responded
  "attemptedModels": ["gemma3:1b-it-qat", "phi4-mini-reasoning:3.8b"],  // <-- shows failed attempts
  "msg": "🧩 AI response generated"
}
```

### 4. **Context-Aware Hardcoded Fallbacks**
If ALL AI models fail, bot uses smart fallbacks based on language and context:

**English:**
- "hey, what's on your mind?"
- "i'm here, tell me more"
- "go on, i'm listening"

**Indonesian:**
- "halo, ada apa nih?"
- "aku dengerin kok, lanjut aja"
- "hmm, cerita dong"

## Testing

### Verify Fallback Works

1. **Cause a model to fail** (use non-existent model in config):
```javascript
// config.js
AI_MODELS: {
  emotional: 'fake-model-that-doesnt-exist:1b',  // This will fail
  // ... other models
}
```

2. **Send emotional message** to trigger `emotional` intent

3. **Check logs** - should see:
```
⚠️ Primary model failed, trying fallback
🔄 Attempting fallback model: phi4-mini-reasoning:3.8b
✅ Fallback model succeeded
```

4. **Bot responds normally** despite primary model failure

### Test All Models on Your Server

Run this script to see which models work:

```bash
#!/bin/bash
URL="https://ai.wush.site/v1/chat/completions"
MODELS=(
  "phi4-mini-reasoning:3.8b"
  "gemma3:1b-it-qat"
  "gemma3:4b-it-qat"
  "phi3:3.8b"
  "qwen2.5:7b"
  "mistral:latest"
)

for MODEL in "${MODELS[@]}"; do
  echo "Testing $MODEL..."
  curl -X POST $URL \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ollama" \
    -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}]}"
  echo -e "\n---"
done
```

## Configuration

### Update Fallback Order (Optional)

Edit `bot.js` line ~1650 to change fallback priority:

```javascript
const fallbackModels = [
  'phi4-mini-reasoning:3.8b',  // First fallback (most reliable)
  'phi3:3.8b',                 // Second fallback
  'qwen2.5:7b',                // Third fallback
  'mistral:latest'             // Last resort
];
```

### Disable Specific Models

If a model consistently fails, remove it from `config.js`:

```javascript
// config.js
AI_MODELS: {
  emotional: 'phi4-mini-reasoning:3.8b',  // Use reliable model
  // Don't use: 'gemma3:1b-it-qat' if it keeps failing
}
```

## Monitoring

Watch for these log patterns to identify problematic models:

```bash
# See which models are failing
grep "Primary model failed" logs.txt

# See which fallbacks are being used
grep "Fallback model succeeded" logs.txt

# See if hardcoded fallbacks are triggered (means ALL models failed)
grep "All AI models failed" logs.txt
```

If you see frequent fallbacks to the same model, consider:
1. Removing failing models from `config.js`
2. Checking your AI server status
3. Updating fallback order to prioritize working models

---

**Your bot is now resilient to model failures and will always respond!** 🎉
