# Quick Test Guide - Language Response

## Test Scenarios

### Scenario 1: Pure English Conversation
```
You: hey
Bot: [Should respond in English only]

You: how are you?
Bot: [Should respond in English only]

You: what's up?
Bot: [Should respond in English only]
```

### Scenario 2: Pure Indonesian Conversation
```
You: halo
Bot: [Should respond in Indonesian only]

You: selamat pagi
Bot: [Should respond in Indonesian only]

You: apa kabar?
Bot: [Should respond in Indonesian only]

You: gimana nih?
Bot: [Should respond in Indonesian only]
```

### Scenario 3: Language Switching
```
You: hey there
Bot: [English response]

You: selamat siang
Bot: [Should switch to Indonesian]

You: apa kabar hari ini?
Bot: [Indonesian - memory should persist]

You: okay thanks
Bot: [Should switch back to English]
```

### Scenario 4: Check Logs
Look for these log entries to verify language detection:

```json
{"level":10,"msg":"🌐 Language updated","sender":"...", "lang":"indonesian"}
{"level":10,"msg":"🌐 Language for response","detectedLang":"indonesian","message":"..."}
{"level":30,"msg":"🧩 AI response generated","language":"indonesian",...}
```

## What to Look For

✅ **Good Signs:**
- Bot responds in same language as user
- No mixed language in single response
- Proper capitalization (not all lowercase)
- Language persists across messages
- Logs show correct language detection

❌ **Bad Signs:**
- Bot mixes English and Indonesian in one response
- All lowercase even in English responses
- Wrong language used
- Language keeps switching randomly

## Common Test Messages

### English
- "hey"
- "how are you?"
- "what's going on?"
- "i'm good thanks"
- "tell me more"

### Indonesian
- "halo"
- "selamat pagi"
- "selamat siang"
- "apa kabar?"
- "gimana nih?"
- "lagi ngapain?"
- "udah makan belum?"
- "terima kasih"

### Strong Indicators (should be detected correctly)
- "selamat pagi" → MUST be Indonesian
- "hey there" → MUST be English
- "gimana kabarnya?" → MUST be Indonesian
- "what's on your mind?" → MUST be English

## Running the Test

1. Start the bot:
```bash
node bot.js
```

2. Send test messages from allowed WhatsApp number

3. Check terminal logs for language detection:
```
[timestamp] DEBUG: 🌐 Language updated
    sender: "628..."
    lang: "indonesian"

[timestamp] DEBUG: 🌐 Language for response
    sender: "628..."
    detectedLang: "indonesian"
    message: "selamat pagi"

[timestamp] INFO: 🧩 AI response generated
    language: "indonesian"
    ...
```

4. Verify bot responds in correct language

## Expected Behavior

| User Input | Detected Language | Bot Should Respond In |
|------------|-------------------|----------------------|
| "hey" | english | English |
| "halo" | mixed/indonesian | Indonesian |
| "selamat pagi" | indonesian | Indonesian |
| "what's up?" | english | English |
| "gimana?" | indonesian | Indonesian |
| "apa kabar hari ini dong" | indonesian | Indonesian |
| "tell me what happened" | english | English |

## Troubleshooting

**Problem:** Bot still responds in wrong language
- Check logs for `detectedLang` value
- Verify `languageMemory` is being saved
- Check if `.toLowerCase()` was properly removed

**Problem:** Bot mixes languages
- Verify language instruction is being added to prompt
- Check if `**CRITICAL:**` instruction is in system message
- Increase strength of language instruction

**Problem:** No capitalization in English
- Verify `.toLowerCase()` was removed from line with `let reply =`
- Check base personality doesn't say "lowercase"

---

Send me the logs after testing and I can help debug any issues! 🔍
