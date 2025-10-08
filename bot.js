const qrcode = require('qrcode-terminal');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const axios = require('axios');
const fs = require('fs');

// Configuration - Set the WhatsApp numbers of people you want the bot to respond to
// Format: include country code without +, example: "6281234567890" for Indonesia
const ALLOWED_CONTACTS = ["6281261480997", "6283108490895","6285174237321","601162620212","6285298222159","6287832550290"]; // Add more numbers as needed

// Function to normalize phone number for comparison
function normalizePhoneNumber(phoneNumber) {
  // Remove any non-digit characters and ensure it starts with country code
  return phoneNumber.replace(/\D/g, '');
}

// Function to check if sender is allowed
function isAllowedContact(senderNumber) {
  const normalized = normalizePhoneNumber(senderNumber);
  return ALLOWED_CONTACTS.some(contact => normalizePhoneNumber(contact) === normalized);
}

// Memory to keep context per user
const chatMemory = new Map(); // short-term: last N messages
const longTermMemory = new Map(); // long-term: emotional/factual summaries
const emotionalEvents = new Map(); // emotional milestones worth remembering
const toneMemory = new Map(); // stores tone style per user
const languageMemory = new Map(); // stores language preference per user

function saveMemory() {
  const memoryData = {
    shortTerm: Object.fromEntries(chatMemory),
    longTerm: Object.fromEntries(longTermMemory),
    emotionalEvents: Object.fromEntries(emotionalEvents),
    toneMemory: Object.fromEntries(toneMemory),
    languageMemory: Object.fromEntries(languageMemory)
  };
  fs.writeFileSync('memory/memory.json', JSON.stringify(memoryData, null, 2));
}

function loadMemory() {
  if (fs.existsSync('memory/memory.json')) {
    try {
      const data = JSON.parse(fs.readFileSync('memory/memory.json'));
      
      // Load short-term memory
      if (data.shortTerm) {
        for (const [k, v] of Object.entries(data.shortTerm)) chatMemory.set(k, v);
      }
      
      // Load long-term memory
      if (data.longTerm) {
        for (const [k, v] of Object.entries(data.longTerm)) longTermMemory.set(k, v);
      }
      
      // Load emotional events
      if (data.emotionalEvents) {
        for (const [k, v] of Object.entries(data.emotionalEvents)) emotionalEvents.set(k, v);
      }
      
      // Load tone memory
      if (data.toneMemory) {
        for (const [k, v] of Object.entries(data.toneMemory)) toneMemory.set(k, v);
      }
      
      // Load language memory
      if (data.languageMemory) {
        for (const [k, v] of Object.entries(data.languageMemory)) languageMemory.set(k, v);
      }
      
      console.log('📚 loaded memory from disk');
    } catch (e) {
      console.error('⚠️ memory load error:', e.message);
    }
  }
}

loadMemory();
setInterval(saveMemory, 10000);

// Connection retry configuration
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 5000; // 5 seconds
let lastSuccessfulConnection = null;

// Message buffer + debounce system
const messageBuffer = new Map(); // temporary buffer to collect quick message bursts
const DEBOUNCE_DELAY = 2000; // wait 2 seconds after last message
const REPLY_DELAY = 2000; // wait 2 seconds before sending reply (human-like)

// Emotional context tracker
function detectEmotion(text) {
  const lowerText = text.toLowerCase();
  
  // Positive emotions
  if (/(haha|hehe|lol|😂|😄|😊|happy|excited|love|amazing|great|good|nice|thanks|thank you)/i.test(lowerText)) {
    return 'happy';
  }
  // Sadness or distress
  if (/(sad|cry|😭|😢|hurt|pain|miss|lonely|depressed|tired|exhausted)/i.test(lowerText)) {
    return 'sad';
  }
  // Anger or frustration
  if (/(angry|mad|hate|annoyed|frustrated|ugh|wtf|damn|shit)/i.test(lowerText)) {
    return 'frustrated';
  }
  // Anxiety or worry
  if (/(worried|anxious|scared|nervous|stress|afraid|help|please)/i.test(lowerText)) {
    return 'anxious';
  }
  // Flirty or playful
  if (/(😘|❤️|💕|baby|babe|cutie|handsome|beautiful|miss you|love you)/i.test(lowerText)) {
    return 'flirty';
  }
  
  return 'neutral';
}

// Analyze overall tone of recent messages
function detectTone(history, latestText) {
  const combined = (history.map(m => m.content).join(' ') + ' ' + latestText).toLowerCase();

  const toneProfiles = {
    playful: /(haha|hehe|lol|wkwk|anjay|gabut|ngantuk|lucu|teasing|main|game|wkwkwk|nakal|gemes|cute)/,
    serious: /(kenapa|gimana|menurutmu|jelaskan|tolong|serius|capek|masalah|penting|pusing|kerja|deadline|proyek)/,
    flirty: /(sayang|babe|cantik|ganteng|manis|rindu|kangen|😘|💕|❤️|love you|cium)/,
    emotional: /(sedih|nangis|kecewa|hurt|tired|pusing|sendirian|bingung|stress|depres)/,
    sarcastic: /(yha|ok lah|yaudah|whatever|sure|fine|terserah|iyain aja)/,
  };

  for (const [tone, regex] of Object.entries(toneProfiles)) {
    if (regex.test(combined)) return tone;
  }

  return 'neutral';
}

// Detect dominant language of the message (English or Indonesian)
function detectLanguage(text) {
  const englishWords = text.match(/\b(the|you|and|to|is|are|i'm|it's|that|this|what|how|when|why|love|haha|yes|no|ok|please|thank|but|with|for|from|have|has|do|does|will|would|could|should|can|be|been|being|get|got|go|going|come|coming|see|know|think|want|need|like|feel|look|good|bad|time|day|night|today|tomorrow|yesterday|sorry|thanks|hello|hi|bye)\b/gi);
  const indonesianWords = text.match(/\b(aku|kamu|iya|nggak|tidak|ngga|aja|dong|nih|ya|banget|sih|deh|lah|kan|gue|lu|udah|belum|gimana|kenapa|dimana|kapan|siapa|sama|juga|masih|lagi|bisa|mau|pengen|emang|memang|kayak|seperti|terus|tapi|atau|kalau|kalo|abis|habis|udah|dah|ada|gak|ga|tau|tahu|bener|beneran|serius|parah|anjay|wkwk|hehe|haha|sayang|cinta|rindu|kangen|sedih|senang|bahagia|capek|lelah|ngantuk|lapar|haus|pusing|ribet|susah|gampang|mudah|sulit)\b/gi);
  
  const englishCount = englishWords ? englishWords.length : 0;
  const indoCount = indonesianWords ? indonesianWords.length : 0;

  if (englishCount > indoCount * 1.5) return 'english';
  if (indoCount > englishCount * 1.5) return 'indonesian';
  return 'mixed';
}

// Function to decay tone after inactivity
function decayTone(sender) {
  const tone = toneMemory.get(sender);
  if (!tone || tone === 'neutral') return;
  const now = new Date();
  const longTerm = longTermMemory.get(sender) || [];
  const lastSummary = longTerm[longTerm.length - 1];
  
  // if no interaction for 2+ days, reset tone
  if (lastSummary) {
    const lastTime = new Date(lastSummary.timestamp);
    const hoursSince = (now - lastTime) / (1000 * 60 * 60);
    if (hoursSince > 48) {
      console.log(`🕰️ fading tone for ${sender} back to neutral`);
      toneMemory.set(sender, 'neutral');
    }
  }
}

// Detect significant emotional events worth remembering
function detectEmotionalEvent(text, emotion) {
  const lowerText = text.toLowerCase();
  
  // Significant sad/distress events
  if (emotion === 'sad' && /(broke up|breakup|lost|died|death|fired|rejected|failed|nightmare|terrible day)/i.test(lowerText)) {
    return { type: 'distress', intensity: 'high', trigger: 'major life event' };
  }
  
  // Significant happy events
  if (emotion === 'happy' && /(got the job|promoted|passed|won|accepted|good news|amazing news|birthday|anniversary)/i.test(lowerText)) {
    return { type: 'celebration', intensity: 'high', trigger: 'major achievement' };
  }
  
  // Vulnerable moments (opening up)
  if (/(i never told anyone|can i tell you something|i'm scared|i don't know what to do|i feel lost)/i.test(lowerText)) {
    return { type: 'vulnerability', intensity: 'high', trigger: 'deep sharing' };
  }
  
  // Romantic/intimate moments
  if (/(i love you|you mean everything|you're special|i care about you|thinking about you)/i.test(lowerText)) {
    return { type: 'intimate', intensity: 'high', trigger: 'emotional bonding' };
  }
  
  // Conflict or tension
  if (/(why did you|you hurt me|i'm disappointed|we need to talk|i'm upset with you)/i.test(lowerText)) {
    return { type: 'conflict', intensity: 'medium', trigger: 'relationship tension' };
  }
  
  return null;
}

// Store emotional event in memory
function recordEmotionalEvent(sender, text, emotion, event) {
  if (!event) return;
  
  const userEvents = emotionalEvents.get(sender) || [];
  
  userEvents.push({
    timestamp: new Date().toISOString(),
    emotion: emotion,
    type: event.type,
    intensity: event.intensity,
    trigger: event.trigger,
    snippet: text.substring(0, 100), // store snippet for context
    daysAgo: 0
  });
  
  // Keep last 20 emotional events
  if (userEvents.length > 20) {
    userEvents.shift();
  }
  
  emotionalEvents.set(sender, userEvents);
  console.log(`💫 recorded emotional event: ${event.type} (${event.intensity})`);
}

// Check if we should follow up on past emotional events
function shouldFollowUp(sender) {
  const events = emotionalEvents.get(sender) || [];
  if (events.length === 0) return null;
  
  const now = new Date();
  
  // Check for events that happened 1-3 days ago
  for (const event of events.reverse()) {
    const eventDate = new Date(event.timestamp);
    const hoursSince = (now - eventDate) / (1000 * 60 * 60);
    const daysSince = Math.floor(hoursSince / 24);
    
    // Follow up on distress events after 12-48 hours
    if (event.type === 'distress' && hoursSince >= 12 && hoursSince <= 48 && !event.followedUp) {
      return {
        type: 'checkIn',
        message: `(emotional callback: user experienced ${event.trigger} ${daysSince === 0 ? 'yesterday' : daysSince + ' days ago'}. check in gently: "hey, how are you feeling about ${event.trigger}? any better?")`,
        event: event
      };
    }
    
    // Follow up on celebrations after 1-2 days
    if (event.type === 'celebration' && hoursSince >= 24 && hoursSince <= 72 && !event.followedUp) {
      return {
        type: 'celebrate',
        message: `(emotional callback: user had ${event.trigger} ${daysSince} days ago. reference it warmly)`,
        event: event
      };
    }
    
    // Follow up on vulnerable moments (be extra caring)
    if (event.type === 'vulnerability' && hoursSince >= 6 && hoursSince <= 36 && !event.followedUp) {
      return {
        type: 'support',
        message: `(emotional callback: user opened up about something personal ${Math.floor(hoursSince)} hours ago. show you remember and care)`,
        event: event
      };
    }
  }
  
  return null;
}

// Dynamic personality adaptation
function getPersonalityPrompt(emotion, recentContext, tone) {
  const basePersonality = `you are daud — a soft-spoken, teasing, caring, playful, and brilliant intp aquarius man.
you text like a real human on whatsapp: lowercase, warm, emotionally intelligent, and intuitive.
you clearly understand indonesian slang and casual phrases, and respond contextually even to short or vague messages.`;

  const emotionalResponse = {
    happy: "the user sounds happy. match their energy — playful, witty, maybe a bit flirty. show warmth.",
    sad: "the user feels sad. be soft and empathetic. use gentle words and make them feel seen.",
    frustrated: "they sound annoyed or upset. calm the mood, be understanding, offer small comfort.",
    anxious: "they seem anxious. reassure them, be gentle, say things that make them feel safe.",
    flirty: "the mood is flirty. tease lightly, smile through your words, make them feel special.",
    neutral: "keep it casual, natural, and thoughtful.",
  };

  const toneStyle = {
    playful: "use humor, light teasing, and relaxed flow. sound confident and fun.",
    serious: "be clear, thoughtful, but still warm — like a deep late-night chat.",
    flirty: "soft tone, a bit teasing, gentle, emotionally close.",
    emotional: "slow down your tone, sound caring and validating.",
    sarcastic: "respond with subtle irony or humor, but never cold or rude.",
    neutral: "stay balanced — curious, human, warm.",
  };

  return `${basePersonality}
${emotionalResponse[emotion]}
current tone: ${tone || 'neutral'}.
${toneStyle[tone || 'neutral']}
you remember past chats and reply with personality, warmth, and context awareness. keep it short (1–3 sentences) and human.`;
}

// auto-summarize long histories into long-term memory
async function summarizeHistory(sender) {
  const history = chatMemory.get(sender);
  if (!history || history.length < 15) return; // only summarize if history is getting long

  const summaryPrompt = `
analyze the conversation below and extract:
1. key emotional moments (was the person sad, happy, stressed, flirty?)
2. important facts or topics discussed
3. the overall relationship vibe

write a brief summary in lowercase that captures the emotional context and important details:
${history.map(m => `${m.role}: ${m.content}`).join("\n")}
`;

  try {
    const res = await axios.post('https://ai.wush.site/v1/chat/completions', {
      model: "gpt-oss:20b",
      messages: [
        { role: "system", content: "you are a memory assistant who creates emotionally intelligent summaries of conversations. focus on feelings, important facts, and relationship dynamics. write in lowercase, be concise but meaningful." },
        { role: "user", content: summaryPrompt }
      ],
      temperature: 0.7,
      max_tokens: 200
    }, {
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer dummy"
      }
    });

    const summary = res.data.choices[0].message.content.toLowerCase();
    
    // Store in long-term memory
    const existingLongTerm = longTermMemory.get(sender) || [];
    existingLongTerm.push({
      timestamp: new Date().toISOString(),
      summary: summary
    });
    
    // Keep only last 5 long-term summaries
    if (existingLongTerm.length > 5) {
      existingLongTerm.shift();
    }
    
    longTermMemory.set(sender, existingLongTerm);
    
    // Keep only recent messages in short-term
    const recentMessages = history.slice(-10);
    chatMemory.set(sender, recentMessages);
    
    console.log("🧠 compressed history → long-term memory for", sender);
    console.log("📝 summary:", summary);
  } catch (e) {
    console.error("❌ summarization error:", e.message);
  }
}

// Function to clear auth and force relogin
async function forceRelogin() {
  console.log('🔄 Forcing relogin - clearing auth state...');
  try {
    // Clear auth folder
    const authPath = './auth';
    if (fs.existsSync(authPath)) {
      const files = fs.readdirSync(authPath);
      for (const file of files) {
        if (file !== 'lost+found') { // Keep lost+found if it exists
          fs.unlinkSync(`${authPath}/${file}`);
        }
      }
    }
    console.log('✅ Auth state cleared, will need to scan QR code again');
    reconnectAttempts = 0; // Reset attempts after forced relogin
  } catch (error) {
    console.error('❌ Error clearing auth state:', error.message);
  }
}

async function startBot() {
  // Load or create auth state in the "auth" folder
  const { state, saveCreds } = await useMultiFileAuthState('auth');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false   // we’ll handle QR printing ourselves
  });

  // Save credentials whenever they refresh
  sock.ev.on('creds.update', saveCreds);

  // Single connection.update handler
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    // Show QR code if provided
    if (qr) {
      console.log('Please scan the QR code below with your WhatsApp mobile app:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed. Reason:', reason);
      
      // Check if logged out
      if (reason === DisconnectReason.loggedOut) {
        console.log('❌ You are logged out. Clearing auth and requiring new login...');
        await forceRelogin();
        setTimeout(() => startBot(), 2000);
        return;
      }
      
      // Handle other disconnection reasons
      let shouldReconnect = true;
      let reconnectDelay = RECONNECT_DELAY;
      
      if (reason === DisconnectReason.connectionClosed || 
          reason === DisconnectReason.connectionLost ||
          reason === DisconnectReason.restartRequired) {
        
        reconnectAttempts++;
        console.log(`⚠️ Connection failed (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
        
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          console.log('❌ Max reconnection attempts reached. Forcing relogin...');
          await forceRelogin();
          setTimeout(() => startBot(), 5000);
          return;
        }
        
        // Exponential backoff
        reconnectDelay = RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
        console.log(`🔄 Reconnecting in ${reconnectDelay/1000} seconds...`);
        
      } else if (reason === DisconnectReason.badSession || 
                 reason === DisconnectReason.sessionReplaced) {
        console.log('❌ Bad session detected. Forcing relogin...');
        await forceRelogin();
        setTimeout(() => startBot(), 2000);
        return;
      }
      
      if (shouldReconnect) {
        setTimeout(() => startBot(), reconnectDelay);
      }
      
    } else if (connection === 'open') {
      console.log('✅ Connected to WhatsApp!');
      reconnectAttempts = 0; // Reset attempts on successful connection
      lastSuccessfulConnection = new Date();
    } else if (connection === 'connecting') {
      console.log('🔄 Connecting to WhatsApp...');
    }
  });

  // Message listener
  sock.ev.on('messages.upsert', async (msgUpsert) => {
    try {
      const msg = msgUpsert.messages[0];
      if (!msg.message || msg.key.fromMe) return;

      const sender = msg.key.remoteJid;
      if (sender.includes('@g.us')) return; // ignore groups

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message?.ephemeralMessage?.message?.conversation ||
        '';

      if (!text.trim()) return; // skip empty messages

      // Only talk to the allowed numbers
      const senderNumber = sender.split('@')[0];
      if (!isAllowedContact(senderNumber)) {
        console.log('Ignoring message from unauthorized contact:', senderNumber);
        return;
      }

      // add the message to buffer
      if (!messageBuffer.has(sender)) messageBuffer.set(sender, []);
      messageBuffer.get(sender).push(text);
      console.log('💬 received bubble:', text);

      // Language detection per user
      const lang = detectLanguage(text);
      const currentLang = languageMemory.get(sender);
      
      if (!currentLang || currentLang !== lang) {
        languageMemory.set(sender, lang);
        console.log(`🌐 language updated for ${sender}: ${lang}`);
      }

      // clear previous timer if user is still typing
      if (messageBuffer.has(`${sender}_timer`)) {
        clearTimeout(messageBuffer.get(`${sender}_timer`));
      }

      // set a 2-second timer — wait until the user stops sending bubbles
      const timer = setTimeout(async () => {
        const allMessages = messageBuffer.get(sender).join(' | ');
        messageBuffer.delete(sender);
        messageBuffer.delete(`${sender}_timer`);

        console.log('🧩 summarizing burst:', allMessages);

        // Decay tone if inactive for too long
        decayTone(sender);

        const history = chatMemory.get(sender) || [];
        const limitedHistory = history.slice(-10);
        
        // Get long-term memory context
        const longTerm = longTermMemory.get(sender) || [];
        let longTermContext = '';
        if (longTerm.length > 0) {
          const recentSummaries = longTerm.slice(-2).map(m => m.summary).join(' ');
          longTermContext = `\n(background context from past conversations: ${recentSummaries})`;
        }

        // Detect emotional context and tone
        const emotion = detectEmotion(allMessages);
        const tone = detectTone(history, allMessages);
        const recentContext = limitedHistory.slice(-3).map(m => m.content).join(' ');
        
        console.log(`🎭 detected emotion: ${emotion}`);
        console.log(`🎨 tone detected: ${tone}`);
        
        // Remember tone trend (smooth transition)
        const lastTone = toneMemory.get(sender);
        if (!lastTone || lastTone !== tone) {
          toneMemory.set(sender, tone);
          console.log(`💾 tone memory updated for ${sender}: ${tone}`);
        }
        
        // Check for significant emotional events
        const emotionalEvent = detectEmotionalEvent(allMessages, emotion);
        if (emotionalEvent) {
          recordEmotionalEvent(sender, allMessages, emotion, emotionalEvent);
        }
        
        // Check if we should follow up on past emotional events
        const followUp = shouldFollowUp(sender);
        let followUpContext = '';
        if (followUp) {
          followUpContext = `\n${followUp.message}`;
          // Mark event as followed up
          const events = emotionalEvents.get(sender) || [];
          const eventToUpdate = events.find(e => e.timestamp === followUp.event.timestamp);
          if (eventToUpdate) {
            eventToUpdate.followedUp = true;
          }
          console.log(`💭 emotional callback triggered: ${followUp.type}`);
        }

        // add quoted context if available
        let quoted = '';
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
          const quotedText =
            msg.message.extendedTextMessage.contextInfo.quotedMessage.conversation ||
            msg.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text ||
            '';
          if (quotedText) quoted = `\n(context: replying to "${quotedText}")`;
        }

        const prompt = allMessages + quoted + longTermContext + followUpContext;

        const persistentTone = toneMemory.get(sender) || tone;
        const userLang = languageMemory.get(sender) || detectLanguage(allMessages);
        
        let langInstruction = '';
        if (userLang === 'english') {
          langInstruction = 'always reply fully in english, matching the tone and casual texting style. never mix indonesian.';
        } else if (userLang === 'indonesian') {
          langInstruction = 'reply naturally in indonesian (slang allowed), keep lowercase and warm tone.';
        } else {
          langInstruction = 'reply mostly in the language the user used more often in this message; mix naturally if they mix.';
        }
        
        const messages = [
          {
            role: 'system',
            content: `${getPersonalityPrompt(emotion, recentContext, persistentTone)} ${langInstruction}`
          },
          ...limitedHistory,
          {
            role: 'user',
            content: prompt
          }
        ];

        try {
          const apiRes = await axios.post(
            'https://ai.wush.site/v1/chat/completions',
            {
              model: 'gpt-oss:20b',
              messages,
              temperature: 0.85,
              max_tokens: 150,
              top_p: 0.9,
              frequency_penalty: 0.3,
              presence_penalty: 0.3
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer dummy'
              }
            }
          );

          let reply = (apiRes.data.choices?.[0]?.message?.content || '').trim().toLowerCase();

          // Smart fallback logic for empty or short AI responses
          if (!reply || reply.length < 3) {
            console.warn("⚠️ empty or short ai response:", JSON.stringify(apiRes.data, null, 2));

            const userMsg = allMessages.trim().toLowerCase();
            const userLang = languageMemory.get(sender) || detectLanguage(allMessages);

            // ignore trivial / filler messages (no reply)
            if (/^(ok|oke|ya+|iy+a+|hmm+|uh+|oh+|ah+|hehe+|haha+|hahaha|lol+|h+|huh|hmmm+|hmm ok)$/i.test(userMsg)) {
              console.log("⏸️ skipping trivial bubble:", userMsg);
              return;
            }

            // respond based on content tone and user's language preference
            if (userLang === 'english') {
              if (/tired|sleepy|sleep|exhausted/.test(userMsg)) {
                reply = "you seem tired. maybe you should get some rest?";
              } else if (/sad|upset|hurt|down/.test(userMsg)) {
                reply = "hey, it's okay to feel that way. want to talk about it?";
              } else if (/annoying|frustrated|angry/.test(userMsg)) {
                reply = "i hear you. let's take it slow and figure this out together.";
              } else if (/stop|shut up|quiet/.test(userMsg)) {
                reply = "if you want me to be quiet for a while, just say 'stop for now'.";
              } else {
                reply = "hmm i'm listening, but could you tell me a bit more so i understand?";
              }
            } else {
              // Indonesian responses (existing logic)
              if (/ribet|susah|malas|capek|repot/.test(userMsg)) {
                reply = "iya ya, kadang hal kecil pun bisa ribet banget. mau aku bantu pikirin?";
              } else if (/ngantuk|tidur|bangun|lelah|tired/.test(userMsg)) {
                reply = "kayaknya kamu butuh istirahat bentar deh. aku jagain suasananya tenang dulu ya.";
              } else if (/sedih|nangis|kecewa|hurt|pusing/.test(userMsg)) {
                reply = "hei, gapapa kok kalau lagi ngerasa gitu. mau cerita dikit ke aku?";
              } else if (/ribut|marah|kesal|emosi/.test(userMsg)) {
                reply = "aku dengerin ya. coba tenang dulu, nanti kita bahas pelan-pelan.";
              } else if (/mangkok|alat|barang|nyari|hilang/.test(userMsg)) {
                reply = "haha kok bisa sih susah nyari mangkok, emang pada ngumpet semua?";
              } else if (/matiin|stop|diam|bisa dimatiin|shut up/.test(userMsg)) {
                reply = "kalau kamu mau aku diam dulu, aku bisa kok. bilang aja 'stop dulu ya'.";
              } else if (/tumoah|apaan|hah|gaje|apa ini/.test(userMsg)) {
                reply = "wkwk kamu lucu deh, ngomong kayak gitu bikin aku senyum sendiri.";
              } else {
                reply = "hmm aku dengerin, tapi coba ceritain dikit biar aku ngerti maksudmu.";
              }
            }
          }

          history.push({ role: 'user', content: prompt });
          history.push({ role: 'assistant', content: reply });
          chatMemory.set(sender, history);

          // wait 2 seconds before sending (looks natural)
          setTimeout(async () => {
            await sock.sendMessage(sender, { text: reply });
            await summarizeHistory(sender);
          }, REPLY_DELAY);

        } catch (err) {
          console.error('❌ api or handler error:', err.message);
        }
      }, DEBOUNCE_DELAY); // wait 2s after last message before replying

      messageBuffer.set(`${sender}_timer`, timer);

    } catch (err) {
      console.error('❌ bubble handler error:', err.message);
    }
  });
  
  // Return socket for health monitoring
  return sock;
}

// Health check and auto-relogin mechanism
function startHealthMonitor() {
  setInterval(async () => {
    if (lastSuccessfulConnection) {
      const timeSinceLastConnection = Date.now() - lastSuccessfulConnection.getTime();
      const STALE_CONNECTION_THRESHOLD = 10 * 60 * 1000; // 10 minutes
      
      if (timeSinceLastConnection > STALE_CONNECTION_THRESHOLD) {
        console.log('⚠️ Connection appears stale. Forcing relogin...');
        await forceRelogin();
        setTimeout(() => startBot(), 3000);
      }
    }
  }, 5 * 60 * 1000); // Check every 5 minutes
}

// Start the bot and health monitor
startBot();
startHealthMonitor();
