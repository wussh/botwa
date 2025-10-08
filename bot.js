console.log("🔍 Bot script is being loaded...");
const qrcode = require('qrcode-terminal');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('baileys');
const axios = require('axios');
const fs = require('fs');
const pino = require('pino');
console.log("🔍 Loading config...");
const CONFIG = require('./config');
console.log("🔍 Config loaded successfully!");

// Setup structured logging
console.log("🔍 Setting up logger...");
const logger = pino({
  level: CONFIG.LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname'
    }
  }
});
console.log("🔍 Logger setup complete!");

// Validate required configuration
console.log("🔍 Validating configuration...");
function requireConfig(key, type = 'string') {
  const v = CONFIG[key];
  if (v == null || typeof v !== type || (type === 'string' && v.trim() === '')) {
    throw new Error(`Invalid CONFIG.${key} (${v}). Please set it in config.`);
  }
}
['AI_API_URL','AI_EMBEDDING_URL','AUTH_FOLDER','MEMORY_FILE'].forEach(k => requireConfig(k));
console.log("🔍 Configuration validated!");

// Configuration - Set the WhatsApp numbers of people you want the bot to respond to
// Format: include country code without +, example: "6281234567890" for Indonesia
console.log("🔍 Setting up contacts...");
const ALLOWED_CONTACTS = Array.isArray(CONFIG.ALLOWED_CONTACTS) && CONFIG.ALLOWED_CONTACTS.length
  ? CONFIG.ALLOWED_CONTACTS
  : ["6281261480997", "6283108490895","6285174237321","601162620212","6285298222159","6287832550290"];
console.log("🔍 Contacts setup complete!");

// Function to normalize phone number for comparison
function normalizePhoneNumber(phoneNumber) {
  return String(phoneNumber || '').replace(/\D/g, '');
}

// Function to check if sender is allowed
function isAllowedContact(senderNumber) {
  const normalized = normalizePhoneNumber(senderNumber);
  return ALLOWED_CONTACTS.some(c => normalizePhoneNumber(c) === normalized);
}

console.log("🔍 Setting up memory maps...");
// Memory to keep context per user
const chatMemory = new Map(); // short-term: last N messages
const longTermMemory = new Map(); // long-term: emotional/factual summaries
const emotionalEvents = new Map(); // emotional milestones worth remembering
const toneMemory = new Map(); // stores tone style per user
const languageMemory = new Map(); // stores language preference per user
const semanticMemory = new Map(); // vector embeddings for semantic recall
console.log("🔍 Memory maps initialized!");
const personalityProfiles = new Map(); // dynamic personality adaptation per user
const behavioralPatterns = new Map(); // user behavior patterns
const responseQuality = new Map(); // track response effectiveness
const moodHistory = new Map(); // track mood drift over time
const personalityTrends = new Map(); // track personality evolution over time
const relationshipTypes = new Map(); // user-specific relationship personas

// Reply Queue System - Prevent overlapping responses
const replyQueue = new Map();

// Message deduplication system - prevent processing duplicates on reconnect
const processedMsgIds = [];
function markProcessed(id) {
  processedMsgIds.push(id);
  if (processedMsgIds.length > 500) processedMsgIds.shift(); // simple LRU of 500
}
function alreadyProcessed(id) {
  return processedMsgIds.includes(id);
}

// Create axios clients once with proper configuration
const aiClient = axios.create({
  baseURL: CONFIG.AI_API_URL,
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dummy' },
  timeout: 15000
});
const embedClient = axios.create({
  baseURL: CONFIG.AI_EMBEDDING_URL,
  headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer dummy' },
  timeout: 15000
});

console.log("🔍 Setting up utility functions...");
// Debounced save system
let saveTimer;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveMemory, CONFIG.MEMORY_SAVE_DEBOUNCE);
}

console.log("🔍 Setting up semantic memory functions...");
// Semantic Memory System with Vector Embeddings
console.log("🔍 About to define generateEmbedding...");
async function generateEmbedding(text) {
  try {
    const { data } = await embedClient.post('', {
      model: CONFIG.AI_MODELS.embedding,
      input: text
    });
    return data.data?.[0]?.embedding || null;
  } catch (error) {
    logger.error({ error: error.message }, '❌ Embedding generation failed');
    return null;
  }
}
console.log("🔍 generateEmbedding defined successfully!");

// Calculate cosine similarity between two vectors
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
console.log("🔍 cosineSimilarity defined successfully!");

// Search semantic memory for similar conversations with weighted relevance
console.log("🔍 About to define searchSemanticMemory...");
async function searchSemanticMemory(sender, currentText, threshold = CONFIG.EMBEDDING_SIMILARITY_THRESHOLD) {
  const userSemanticMemory = semanticMemory.get(sender) || [];
  if (userSemanticMemory.length === 0) return [];
  
  const currentEmbedding = await generateEmbedding(currentText);
  if (!currentEmbedding) return [];
  
  const similarities = userSemanticMemory.map(memory => {
    const similarity = cosineSimilarity(currentEmbedding, memory.embedding);
    // Calculate weighted relevance combining similarity and emotional weight
    const weightedRelevance = similarity * (memory.weight || 0.5);
    
    return {
      ...memory,
      similarity,
      weightedRelevance,
      content: memory.text // Ensure consistent field naming
    };
  });
  
  return similarities
    .filter(memory => memory.similarity >= threshold)
    .sort((a, b) => b.weightedRelevance - a.weightedRelevance) // Sort by weighted relevance
    .slice(0, 3); // Top 3 most relevant memories
}
console.log("🔍 searchSemanticMemory defined successfully!");

// Self-reflection and meta-cognitive evaluation
console.log("🔍 About to define selfReflect...");
async function selfReflect(sender, userMsg, reply, emotion, intent) {
  try {
    const reflectionPrompt = `
Evaluate this conversation exchange:
User: "${userMsg}"
Bot: "${reply}"
Detected emotion: ${emotion}
Detected intent: ${intent}

Was the bot's response:
1. Appropriately emotional and empathetic?
2. Contextually relevant?
3. Human-like and natural?

Provide a brief assessment and one specific improvement suggestion for next time.
Format: "Assessment: [good/needs improvement] | Suggestion: [specific advice]"`;

    const reflectionRes = await aiClient.post('', {
      model: CONFIG.AI_MODELS.summarization, // Use efficient model for reflection
      messages: [
        { 
          role: 'system', 
          content: 'You are a conversation quality evaluator. Be concise and constructive.' 
        },
        { role: 'user', content: reflectionPrompt }
      ],
      temperature: 0.3,
      max_tokens: 100
    });

    const reflection = reflectionRes.data.choices?.[0]?.message?.content || '';
    
    // Store reflection for future improvement
    if (!responseQuality.has(sender)) {
      responseQuality.set(sender, []);
    }
    
    const qualityHistory = responseQuality.get(sender);
    qualityHistory.push({
      timestamp: new Date().toISOString(),
      userMsg: userMsg.substring(0, 50),
      botReply: reply.substring(0, 50),
      emotion,
      intent,
      reflection: reflection.substring(0, 200),
      score: reflection.includes('good') ? 0.8 : 0.4
    });
    
    // Keep only last 10 reflections
    if (qualityHistory.length > 10) {
      qualityHistory.shift();
    }
    
    responseQuality.set(sender, qualityHistory);
    
    logger.debug({ sender, reflection: reflection.substring(0, 100) }, '🔍 Self-reflection completed');
    
  } catch (error) {
    logger.error({ error: error.message }, '❌ Self-reflection failed');
  }
}
console.log("🔍 selfReflect defined successfully!");

console.log("🔍 About to define storeSemanticMemory...");
async function storeSemanticMemory(sender, text, emotion, context) {
  const embedding = await generateEmbedding(text);
  if (!embedding) return;
  
  const userSemanticMemory = semanticMemory.get(sender) || [];
  const memoryEntry = {
    text,
    emotion,
    context,
    embedding,
    timestamp: new Date().toISOString(),
    weight: emotion === 'sad' ? 1.0 : emotion === 'flirty' ? 0.8 : 0.5
  };
  
  userSemanticMemory.push(memoryEntry);
  
  // Keep only recent semantic memories
  if (userSemanticMemory.length > CONFIG.MAX_SEMANTIC_MEMORIES) {
    userSemanticMemory.shift();
  }
  
  semanticMemory.set(sender, userSemanticMemory);
  logger.debug({ sender, emotion, weight: memoryEntry.weight }, '🧠 Semantic memory stored');
}
console.log("🔍 storeSemanticMemory defined successfully!");

// Intent Classification System
console.log("🔍 About to define detectIntent...");
function detectIntent(text) {
  const lowerText = text.toLowerCase();
  
  // Question patterns
  if (/(apa|what|why|how|when|where|who|gimana|kenapa|kapan|dimana|siapa|\?)/i.test(lowerText)) {
    return 'question';
  }
  
  // Command patterns  
  if (/(tell me|make|find|show|help|tolong|bantu|cariin|buatin)/i.test(lowerText)) {
    return 'command';
  }
  
  // Emotional expression
  if (/(i feel|i'm|aku|feeling|sedih|senang|marah|kecewa|excited|love|hate|miss|rindu)/i.test(lowerText)) {
    return 'emotional';
  }
  
  // Technical/coding
  if (/(code|function|bug|error|programming|javascript|python|html|css)/i.test(lowerText)) {
    return 'technical';
  }
  
  // Small talk
  if (/(haha|lol|wkwk|hehe|hmm|ok|ya|iya|nice|cool)/i.test(lowerText)) {
    return 'smalltalk';
  }
  
  return 'casual';
}
console.log("🔍 detectIntent defined successfully!");

// Intelligent Model Router with Adaptive Scoring
console.log("🔍 About to define selectModel...");
function selectModel(intent, emotion, temporalContext, moodDrift) {
  const modelScores = {
    [CONFIG.AI_MODELS.factual]: 0.1,     // qwen2.5:14b
    [CONFIG.AI_MODELS.emotional]: 0.1,   // gpt-oss:20b
    [CONFIG.AI_MODELS.creative]: 0.1,    // gemma3:12b
    [CONFIG.AI_MODELS.coding]: 0.1,      // qwen2.5-coder:7b
    [CONFIG.AI_MODELS.summarization]: 0.1 // phi3:3.8b
  };
  
  // Intent-based scoring
  switch (intent) {
    case 'question':
    case 'command':
      modelScores[CONFIG.AI_MODELS.factual] += 0.7;
      break;
    case 'emotional':
      modelScores[CONFIG.AI_MODELS.emotional] += 0.8;
      break;
    case 'technical':
      modelScores[CONFIG.AI_MODELS.coding] += 0.9;
      break;
    case 'smalltalk':
      modelScores[CONFIG.AI_MODELS.creative] += 0.6;
      break;
    default:
      modelScores[CONFIG.AI_MODELS.emotional] += 0.5; // Default to emotional
  }
  
  // Emotion-based scoring modifiers
  if (['sad', 'anxious', 'frustrated'].includes(emotion)) {
    modelScores[CONFIG.AI_MODELS.emotional] += 0.4;
  }
  
  if (emotion === 'flirty') {
    modelScores[CONFIG.AI_MODELS.creative] += 0.5;
    modelScores[CONFIG.AI_MODELS.emotional] += 0.3;
  }
  
  if (emotion === 'happy' || emotion === 'excited') {
    modelScores[CONFIG.AI_MODELS.creative] += 0.3;
  }
  
  // Temporal context scoring
  if (temporalContext?.timeContext === 'late_night') {
    modelScores[CONFIG.AI_MODELS.emotional] += 0.2; // More intimate at night
  }
  
  if (temporalContext?.isWeekend) {
    modelScores[CONFIG.AI_MODELS.creative] += 0.1; // More playful on weekends
  }
  
  // Mood drift influence
  if (moodDrift?.moodScore < -0.5) {
    modelScores[CONFIG.AI_MODELS.emotional] += 0.3; // Prioritize empathy for negative mood drift
  }
  
  if (moodDrift?.moodScore > 0.5) {
    modelScores[CONFIG.AI_MODELS.creative] += 0.2; // More creative for positive mood drift
  }
  
  // Select highest scoring model
  const selectedEntry = Object.entries(modelScores)
    .sort((a, b) => b[1] - a[1])[0];
  
  const selectedModel = selectedEntry[0];
  const confidence = selectedEntry[1];
  
  logger.debug({ 
    intent, 
    emotion, 
    temporal: temporalContext?.timeContext,
    scores: modelScores, 
    selected: selectedModel, 
    confidence: confidence.toFixed(2) 
  }, '🤖 Adaptive model selection');
  
  return selectedModel;
}
console.log("🔍 selectModel defined successfully!");

// Evolving Personality System - "Daud learns to become himself"
console.log("🔍 About to define evolvePersonality...");
function evolvePersonality(sender, conversationOutcome, traits) {
  const currentTrend = personalityTrends.get(sender) || {
    curiosity: 0.8,
    empathy: 0.9,
    humor: 0.6,
    flirtiness: 0.7,
    logic: 0.8,
    playfulness: 0.7,
    lastEvolution: Date.now(),
    evolutionCount: 0
  };
  
  // Evolution rate - slower evolution for stability
  const EVOLUTION_RATE = 0.05;
  
  // Positive outcome rewards successful traits
  if (conversationOutcome === 'positive') {
    Object.keys(traits).forEach(trait => {
      if (traits[trait] > 0.7) { // High trait usage
        currentTrend[trait] = Math.min(1.0, 
          currentTrend[trait] * (1 - EVOLUTION_RATE) + traits[trait] * EVOLUTION_RATE
        );
      }
    });
  }
  
  // Negative outcome adjusts traits down slightly
  if (conversationOutcome === 'negative') {
    Object.keys(traits).forEach(trait => {
      if (traits[trait] > 0.8) { // Overly high trait usage
        currentTrend[trait] = Math.max(0.1, 
          currentTrend[trait] * (1 + EVOLUTION_RATE) - 0.1
        );
      }
    });
  }
  
  currentTrend.lastEvolution = Date.now();
  currentTrend.evolutionCount += 1;
  
  personalityTrends.set(sender, currentTrend);
  
  logger.debug({ 
    sender, 
    outcome: conversationOutcome, 
    evolution: currentTrend,
    count: currentTrend.evolutionCount 
  }, '🧬 Personality evolved');
  
  return currentTrend;
}

// Memory-based trait dominance - personality follows conversation domain
function adjustTraitsForDomain(sender, text, currentTraits) {
  const adjustedTraits = { ...currentTraits };
  const lowerText = text.toLowerCase();
  
  // Work/serious domains
  if (/work|project|deadline|job|career|business|meeting|task/.test(lowerText)) {
    adjustedTraits.logic = Math.min(1.0, adjustedTraits.logic + 0.1);
    adjustedTraits.empathy = Math.min(1.0, adjustedTraits.empathy + 0.05);
    adjustedTraits.playfulness = Math.max(0.1, adjustedTraits.playfulness - 0.05);
  }
  
  // Emotional/relationship domains
  if (/love|relationship|family|friend|feel|heart|miss|care|emotion/.test(lowerText)) {
    adjustedTraits.empathy = Math.min(1.0, adjustedTraits.empathy + 0.15);
    adjustedTraits.flirtiness = Math.min(1.0, adjustedTraits.flirtiness + 0.1);
    adjustedTraits.logic = Math.max(0.1, adjustedTraits.logic - 0.05);
  }
  
  // Fun/creative domains
  if (/game|fun|joke|laugh|dream|art|music|creative|play|adventure/.test(lowerText)) {
    adjustedTraits.playfulness = Math.min(1.0, adjustedTraits.playfulness + 0.1);
    adjustedTraits.humor = Math.min(1.0, adjustedTraits.humor + 0.1);
    adjustedTraits.curiosity = Math.min(1.0, adjustedTraits.curiosity + 0.05);
  }
  
  // Learning/intellectual domains
  if (/learn|study|book|idea|think|understand|explain|knowledge|question/.test(lowerText)) {
    adjustedTraits.curiosity = Math.min(1.0, adjustedTraits.curiosity + 0.15);
    adjustedTraits.logic = Math.min(1.0, adjustedTraits.logic + 0.1);
  }
  
  return adjustedTraits;
}

// User-tailored Personas - Relationship-specific personality profiles
function determineRelationshipType(sender, conversationHistory) {
  const history = conversationHistory || [];
  const recentMessages = history.slice(-20).map(h => h.content).join(' ').toLowerCase();
  
  const relationshipPatterns = {
    romantic: {
      keywords: /love|babe|sayang|miss|rindu|cute|handsome|beautiful|kiss|hug|❤️|💕|😘/,
      score: 0,
      traits: { flirtiness: 0.9, empathy: 0.9, playfulness: 0.8, humor: 0.7 }
    },
    friend: {
      keywords: /friend|buddy|bro|sis|hang out|chill|fun|game|movie|laugh|joke/,
      score: 0,
      traits: { playfulness: 0.9, humor: 0.9, curiosity: 0.8, empathy: 0.7 }
    },
    counselor: {
      keywords: /problem|advice|help|sad|depressed|stress|worry|anxious|hurt|pain/,
      score: 0,
      traits: { empathy: 1.0, logic: 0.8, curiosity: 0.7, humor: 0.3 }
    },
    mentor: {
      keywords: /learn|teach|explain|understand|study|work|career|goal|improve/,
      score: 0,
      traits: { logic: 0.9, curiosity: 0.9, empathy: 0.7, humor: 0.6 }
    },
    companion: {
      keywords: /daily|routine|chat|talk|share|boring|random|anything|everything/,
      score: 0,
      traits: { curiosity: 0.8, empathy: 0.8, humor: 0.7, playfulness: 0.7 }
    }
  };
  
  // Score each relationship type
  Object.keys(relationshipPatterns).forEach(type => {
    const pattern = relationshipPatterns[type];
    const matches = (recentMessages.match(pattern.keywords) || []).length;
    pattern.score = matches;
  });
  
  // Find dominant relationship type
  const dominantType = Object.entries(relationshipPatterns)
    .sort((a, b) => b[1].score - a[1].score)[0];
  
  const relationshipType = dominantType[1].score > 0 ? dominantType[0] : 'companion';
  
  // Store relationship type
  relationshipTypes.set(sender, {
    type: relationshipType,
    traits: relationshipPatterns[relationshipType].traits,
    confidence: Math.min(1.0, dominantType[1].score / 10),
    lastUpdated: Date.now()
  });
  
  logger.debug({ 
    sender, 
    relationshipType, 
    confidence: relationshipPatterns[relationshipType].score,
    traits: relationshipPatterns[relationshipType].traits 
  }, '💞 Relationship persona determined');
  
  return relationshipPatterns[relationshipType].traits;
}

// Apply relationship-specific personality bias
function applyRelationshipPersona(sender, baseTraits, conversationHistory) {
  const relationship = relationshipTypes.get(sender);
  
  if (!relationship || Date.now() - relationship.lastUpdated > 7 * 24 * 60 * 60 * 1000) {
    // Re-determine relationship if stale or missing
    const personaTraits = determineRelationshipType(sender, conversationHistory);
    return blendTraits(baseTraits, personaTraits, 0.3); // 30% persona influence
  }
  
  return blendTraits(baseTraits, relationship.traits, 0.3);
}

function blendTraits(baseTraits, personaTraits, influence) {
  const blended = {};
  
  Object.keys(baseTraits).forEach(trait => {
    const baseValue = baseTraits[trait];
    const personaValue = personaTraits[trait] || baseValue;
    blended[trait] = baseValue * (1 - influence) + personaValue * influence;
  });
  
  return blended;
}

// Reply Queue System to prevent overlapping messages
async function enqueueReply(sender, replyAction) {
  const existingQueue = replyQueue.get(sender) || Promise.resolve();
  
  const newQueue = existingQueue
    .then(async () => {
      try {
        await replyAction();
      } catch (error) {
        logger.error({ sender, error: error.message }, '❌ Queued reply failed');
      }
    })
    .catch(error => {
      logger.error({ sender, error: error.message }, '❌ Queue processing error');
    });
  
  replyQueue.set(sender, newQueue);
  return newQueue;
}

// Dynamic Personality Adaptation with Evolution
function getPersonalityProfile(sender) {
  // Use evolved personality trends if available
  const evolved = personalityTrends.get(sender);
  if (evolved) {
    return {
      curiosity: evolved.curiosity,
      empathy: evolved.empathy,
      humor: evolved.humor,
      flirtiness: evolved.flirtiness,
      logic: evolved.logic,
      playfulness: evolved.playfulness
    };
  }
  
  // Default profile for new users
  const defaultProfile = {
    curiosity: 0.8,
    empathy: 0.9,
    humor: 0.6,
    flirtiness: 0.7,
    logic: 0.8,
    playfulness: 0.7
  };
  
  return defaultProfile;
}

function adaptPersonality(sender, emotion, intent, messageText) {
  const profile = getPersonalityProfile(sender);
  let adaptation = { ...profile };
  
  // Apply domain-based trait adjustments
  adaptation = adjustTraitsForDomain(sender, messageText || '', adaptation);
  
  // Apply relationship-specific persona
  const conversationHistory = chatMemory.get(sender) || [];
  adaptation = applyRelationshipPersona(sender, adaptation, conversationHistory);
  
  // Emotional adaptations
  if (emotion === 'sad') {
    adaptation.empathy = Math.min(1.0, adaptation.empathy + 0.1);
    adaptation.humor = Math.max(0.1, adaptation.humor - 0.2);
  } else if (emotion === 'flirty') {
    adaptation.flirtiness = Math.min(1.0, adaptation.flirtiness + 0.1);
    adaptation.playfulness = Math.min(1.0, adaptation.playfulness + 0.1);
  } else if (emotion === 'frustrated') {
    adaptation.empathy = Math.min(1.0, adaptation.empathy + 0.15);
    adaptation.logic = Math.min(1.0, adaptation.logic + 0.1);
  }
  
  // Intent adaptations
  if (intent === 'question') {
    adaptation.logic = Math.min(1.0, adaptation.logic + 0.1);
    adaptation.curiosity = Math.min(1.0, adaptation.curiosity + 0.1);
  }
  
  personalityProfiles.set(sender, adaptation);
  
  // Calculate dominant traits for context
  const dominantTraits = Object.entries(adaptation)
    .filter(([trait, value]) => value > 0.7)
    .map(([trait]) => trait);
  
  const confidence = Object.values(adaptation).reduce((sum, val) => sum + val, 0) / Object.keys(adaptation).length;
  
  // Get relationship context
  const relationship = relationshipTypes.get(sender);
  const relationshipContext = relationship ? relationship.type : 'companion';
  
  return { ...adaptation, dominantTraits, confidence, relationshipType: relationshipContext };
}

// Natural Behavior Simulation
function calculateReplyDelay(replyText, emotion, intent) {
  const baseDelay = CONFIG.MIN_REPLY_DELAY;
  const lengthDelay = replyText.length * CONFIG.REPLY_DELAY_PER_CHAR;
  const randomness = Math.random() * 1000;
  
  // Emotional modifiers
  let emotionalModifier = 1.0;
  if (emotion === 'sad') emotionalModifier = 1.3; // Slower, more thoughtful
  if (emotion === 'excited' || emotion === 'happy') emotionalModifier = 0.8; // Faster
  if (emotion === 'flirty') emotionalModifier = 1.1; // Slightly delayed, playful
  
  const totalDelay = Math.min(
    CONFIG.MAX_REPLY_DELAY,
    (baseDelay + lengthDelay + randomness) * emotionalModifier
  );
  
  return Math.round(totalDelay);
}

// Contextual Response Management
const consecutiveTrivialMessages = new Map();

function shouldSkipResponse(sender, messageText) {
  const trivialPattern = /^(ok|oke|ya+|iy+a+|hmm+|uh+|oh+|ah+|hehe+|haha+|lol+)$/i;
  
  if (trivialPattern.test(messageText.trim())) {
    const count = (consecutiveTrivialMessages.get(sender) || 0) + 1;
    consecutiveTrivialMessages.set(sender, count);
    
    if (count >= CONFIG.SKIP_RESPONSE_THRESHOLD) {
      logger.debug({ sender, count }, '⏸️ Skipping response due to consecutive trivial messages');
      return true;
    }
  } else {
    consecutiveTrivialMessages.set(sender, 0); // Reset counter
  }
  
  return false;
}

// Emotion persistence and mood drift tracking
function trackMoodDrift(sender, currentEmotion) {
  const history = moodHistory.get(sender) || [];
  const now = Date.now();
  
  // Add current mood entry
  history.push({
    emotion: currentEmotion,
    timestamp: now,
    hour: new Date().getHours()
  });
  
  // Keep last 20 mood entries
  const recentHistory = history.slice(-20);
  moodHistory.set(sender, recentHistory);
  
  // Calculate mood consistency and drift
  const last24h = recentHistory.filter(entry => now - entry.timestamp < 24 * 60 * 60 * 1000);
  
  if (last24h.length > 0) {
    const moodCounts = {};
    last24h.forEach(entry => {
      moodCounts[entry.emotion] = (moodCounts[entry.emotion] || 0) + 1;
    });
    
    const dominantMood = Object.entries(moodCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
    
    const moodScore = calculateMoodScore(last24h, currentEmotion);
    
    // Update persistent tone based on mood drift
    const currentTone = toneMemory.get(sender) || 'neutral';
    let adjustedTone = currentTone;
    
    if (dominantMood === 'sad' && moodScore < -0.5) {
      adjustedTone = 'emotional';
    } else if (dominantMood === 'happy' && moodScore > 0.5) {
      adjustedTone = 'playful';
    } else if (dominantMood === 'flirty') {
      adjustedTone = 'flirty';
    }
    
    if (adjustedTone !== currentTone) {
      toneMemory.set(sender, adjustedTone);
      logger.debug({ sender, oldTone: currentTone, newTone: adjustedTone, moodScore }, '🎭 Mood drift adjusted tone');
    }
    
    return { dominantMood, moodScore, adjustedTone };
  }
  
  return { dominantMood: currentEmotion, moodScore: 0, adjustedTone: 'neutral' };
}

function calculateMoodScore(moodHistory, currentEmotion) {
  let score = 0;
  const weights = { happy: 1, excited: 1, flirty: 0.5, neutral: 0, sad: -1, frustrated: -1, anxious: -0.8 };
  
  moodHistory.forEach((entry, index) => {
    const weight = weights[entry.emotion] || 0;
    const recency = (index + 1) / moodHistory.length; // More recent = higher influence
    score += weight * recency;
  });
  
  return score / Math.max(moodHistory.length, 1);
}

// Enhanced temporal awareness with timezone support
function getTemporalContext() {
  const tz = 'Asia/Jakarta';
  const now = new Date();
  const hour = parseInt(now.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }));
  const day = now.getDay();
  const dayName = now.toLocaleDateString('en-US', { timeZone: tz, weekday: 'long' });
  
  let timeContext = '';
  let greeting = '';
  let mood = '';
  
  if (hour >= 5 && hour < 10) {
    timeContext = 'early_morning';
    greeting = hour < 7 ? 'good morning! ☀️' : 'morning! ☀️';
    mood = 'fresh, energetic';
  } else if (hour >= 10 && hour < 12) {
    timeContext = 'late_morning';
    greeting = '';
    mood = 'productive, focused';
  } else if (hour >= 12 && hour < 17) {
    timeContext = 'afternoon';
    greeting = '';
    mood = 'calm, steady';
  } else if (hour >= 17 && hour < 20) {
    timeContext = 'early_evening';
    greeting = '';
    mood = 'relaxed, social';
  } else if (hour >= 20 && hour < 23) {
    timeContext = 'evening';
    greeting = '';
    mood = 'cozy, reflective';
  } else {
    timeContext = 'late_night';
    greeting = hour >= 23 ? 'late night vibes 🌙' : '';
    mood = 'intimate, thoughtful';
  }
  
  const isWeekend = day === 0 || day === 6;
  const workContext = isWeekend ? 'weekend' : 'weekday';
  
  return { 
    timeContext, 
    hour, 
    isWeekend, 
    dayName, 
    greeting,
    mood,
    workContext
  };
}

// Self-Evaluation System
const responseQualityHistory = new Map();

function evaluateResponseQuality(originalMessage, generatedResponse, userReaction) {
  const score = {
    relevance: calculateRelevanceScore(originalMessage, generatedResponse),
    engagement: calculateEngagementScore(userReaction),
    timestamp: Date.now(),
    messageType: originalMessage,
    responseLength: generatedResponse.length
  };
  
  return score;
}

function calculateRelevanceScore(originalMessage, response) {
  // Simple keyword matching for relevance
  const originalWords = originalMessage.toLowerCase().split(/\s+/);
  const responseWords = response.toLowerCase().split(/\s+/);
  
  const commonWords = originalWords.filter(word => 
    responseWords.some(rWord => rWord.includes(word) || word.includes(rWord))
  );
  
  return Math.min(1.0, commonWords.length / Math.max(originalWords.length, 3));
}

function calculateEngagementScore(userReaction) {
  // Measure engagement based on user's next response time and content
  if (!userReaction) return 0.5; // Neutral if no reaction yet
  
  const positivePatterns = /thanks|terima|bagus|good|lucu|funny|haha|😊|😄|❤️|👍/i;
  const negativePatterns = /gak|tidak|stop|bosan|boring|aneh|weird|😒|😞|👎/i;
  
  if (positivePatterns.test(userReaction)) return 0.8;
  if (negativePatterns.test(userReaction)) return 0.2;
  
  return 0.5; // Neutral
}

function updateQualityMetrics(sender, qualityScore) {
  if (!responseQualityHistory.has(sender)) {
    responseQualityHistory.set(sender, []);
  }
  
  const history = responseQualityHistory.get(sender);
  history.push(qualityScore);
  
  // Keep only last 20 evaluations
  if (history.length > 20) {
    history.shift();
  }
  
  responseQualityHistory.set(sender, history);
  
  // Calculate running averages
  const avgRelevance = history.reduce((sum, item) => sum + item.relevance, 0) / history.length;
  const avgEngagement = history.reduce((sum, item) => sum + item.engagement, 0) / history.length;
  
  logger.info({ 
    sender, 
    avgRelevance: avgRelevance.toFixed(2), 
    avgEngagement: avgEngagement.toFixed(2),
    sampleSize: history.length 
  }, '📊 Quality metrics updated');
  
  return { avgRelevance, avgEngagement };
}

// Behavioral Pattern Learning
function analyzeBehavioralPattern(sender) {
  const memories = getAllMemoriesForSender(sender);
  const patterns = {
    preferredTopics: new Map(),
    activeTimePatterns: [],
    communicationStyle: 'neutral',
    responsePreferences: new Map()
  };
  
  // Analyze preferred topics
  memories.forEach(memory => {
    if (memory.type === 'short_term' || memory.type === 'long_term') {
      const words = memory.message.toLowerCase().split(/\s+/);
      words.forEach(word => {
        if (word.length > 3) { // Skip short words
          patterns.preferredTopics.set(word, (patterns.preferredTopics.get(word) || 0) + 1);
        }
      });
    }
  });
  
  // Analyze active time patterns
  memories.forEach(memory => {
    if (memory.timestamp) {
      const hour = new Date(memory.timestamp).getHours();
      patterns.activeTimePatterns.push(hour);
    }
  });
  
  // Determine communication style based on language choices
  const recentEmotions = memories
    .filter(m => m.type === 'emotional')
    .slice(-10)
    .map(m => m.emotion);
  
  if (recentEmotions.includes('excited') || recentEmotions.includes('happy')) {
    patterns.communicationStyle = 'enthusiastic';
  } else if (recentEmotions.includes('sad') || recentEmotions.includes('angry')) {
    patterns.communicationStyle = 'supportive';
  } else if (recentEmotions.includes('flirty')) {
    patterns.communicationStyle = 'playful';
  }
  
  logger.debug({ sender, patterns }, '🧠 Behavioral pattern analyzed');
  return patterns;
}

function getAllMemoriesForSender(sender) {
  const all = [];

  const shortTerm = chatMemory.get(sender) || [];
  shortTerm.forEach(m => all.push({ type: 'short_term', message: m.content, timestamp: 0 }));

  const longTerm = longTermMemory.get(sender) || [];
  longTerm.forEach(s => all.push({ type: 'long_term', message: s.summary, timestamp: new Date(s.timestamp || Date.now()).getTime() }));

  const events = emotionalEvents.get(sender) || [];
  events.forEach(e => all.push({ type: 'emotional', message: e.snippet, emotion: e.emotion, timestamp: new Date(e.timestamp).getTime() }));

  const tone = toneMemory.get(sender);
  if (tone) all.push({ type: 'tone', message: tone, timestamp: 0 });

  const lang = languageMemory.get(sender);
  if (lang) all.push({ type: 'language', message: lang, timestamp: 0 });

  return all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

function saveMemory() {
  try {
    const memoryData = {
      shortTerm: Object.fromEntries(chatMemory),
      longTerm: Object.fromEntries(longTermMemory),
      emotionalEvents: Object.fromEntries(emotionalEvents),
      toneMemory: Object.fromEntries(toneMemory),
      languageMemory: Object.fromEntries(languageMemory),
      semanticMemory: Object.fromEntries(semanticMemory),
      personalityTrends: Object.fromEntries(personalityTrends),
      moodHistory: Object.fromEntries(moodHistory),
      relationshipTypes: Object.fromEntries(relationshipTypes),
      lastSaved: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG.MEMORY_FILE, JSON.stringify(memoryData, null, 2));
    logger.debug('💾 Memory saved to disk');
  } catch (error) {
    logger.error({ error: error.message }, '❌ Failed to save memory');
  }
}

function loadMemory() {
  if (fs.existsSync(CONFIG.MEMORY_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONFIG.MEMORY_FILE));
      
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
      
      // Load semantic memory
      if (data.semanticMemory) {
        for (const [k, v] of Object.entries(data.semanticMemory)) semanticMemory.set(k, v);
      }
      
      // Load personality trends
      if (data.personalityTrends) {
        for (const [k, v] of Object.entries(data.personalityTrends)) personalityTrends.set(k, v);
      }
      
      // Load mood history
      if (data.moodHistory) {
        for (const [k, v] of Object.entries(data.moodHistory)) moodHistory.set(k, v);
      }
      
      // Load relationship types
      if (data.relationshipTypes) {
        for (const [k, v] of Object.entries(data.relationshipTypes)) relationshipTypes.set(k, v);
      }
      
      logger.info('📚 Memory loaded from disk');
    } catch (e) {
      logger.error({ error: e.message }, '⚠️ Memory load error');
      // Create backup of corrupted file
      const backupPath = `${CONFIG.MEMORY_FILE}.corrupted.${Date.now()}`;
      try {
        fs.renameSync(CONFIG.MEMORY_FILE, backupPath);
        logger.warn({ backupPath }, '⚠️ Corrupted memory file backed up');
      } catch (backupError) {
        logger.error({ error: backupError.message }, '❌ Failed to backup corrupted file');
      }
    }
  }
}

console.log("🔍 About to load memory...");
loadMemory();
console.log("🔍 Memory loaded successfully!");

console.log("🔍 Setting up connection variables...");
// Connection retry configuration
let reconnectAttempts = 0;
let lastSuccessfulConnection = null;

console.log("🔍 Setting up message buffer...");
// Message buffer + debounce system
const messageBuffer = new Map(); // temporary buffer to collect quick message bursts

console.log("🔍 Setting up emotion detection...");
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
    const res = await aiClient.post('', {
      model: "gpt-oss:20b",
      messages: [
        { role: "system", content: "you are a memory assistant who creates emotionally intelligent summaries of conversations. focus on feelings, important facts, and relationship dynamics. write in lowercase, be concise but meaningful." },
        { role: "user", content: summaryPrompt }
      ],
      temperature: 0.7,
      max_tokens: 200
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
  logger.info('🔄 Forcing relogin - clearing auth state...');
  try {
    // Clear auth folder
    const authPath = CONFIG.AUTH_FOLDER;
    if (fs.existsSync(authPath)) {
      const files = fs.readdirSync(authPath);
      for (const file of files) {
        if (file !== 'lost+found') { // Keep lost+found if it exists
          fs.unlinkSync(`${authPath}/${file}`);
        }
      }
    }
    logger.info('✅ Auth state cleared, will need to scan QR code again');
    reconnectAttempts = 0; // Reset attempts after forced relogin
  } catch (error) {
    logger.error({ error: error.message }, '❌ Error clearing auth state');
  }
}

async function startBot() {
  // Load or create auth state in the "auth" folder
  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.AUTH_FOLDER);

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
      logger.info('Please scan the QR code below with your WhatsApp mobile app:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      logger.warn({ reason }, 'Connection closed');
      
      // Check if logged out
      if (reason === DisconnectReason.loggedOut) {
        logger.error('❌ Logged out. Clearing auth and requiring new login...');
        await forceRelogin();
        setTimeout(() => startBot(), 2000);
        return;
      }
      
      // Handle other disconnection reasons
      let shouldReconnect = true;
      let reconnectDelay = CONFIG.RECONNECT_DELAY;
      
      if (reason === DisconnectReason.connectionClosed || 
          reason === DisconnectReason.connectionLost ||
          reason === DisconnectReason.restartRequired) {
        
        reconnectAttempts++;
        logger.warn({ attempt: reconnectAttempts, max: CONFIG.MAX_RECONNECT_ATTEMPTS }, '⚠️ Connection failed');
        
        if (reconnectAttempts >= CONFIG.MAX_RECONNECT_ATTEMPTS) {
          logger.error('❌ Max reconnection attempts reached. Forcing relogin...');
          await forceRelogin();
          setTimeout(() => startBot(), 5000);
          return;
        }
        
        // Exponential backoff with jitter
        reconnectDelay = CONFIG.RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1);
        const jitter = Math.random() * 1000;
        reconnectDelay += jitter;
        logger.info({ delay: Math.round(reconnectDelay/1000) }, `🔄 Reconnecting in ${Math.round(reconnectDelay/1000)} seconds...`);
        
      } else if (reason === DisconnectReason.badSession || 
                 reason === DisconnectReason.sessionReplaced) {
        logger.error('❌ Bad session detected. Forcing relogin...');
        await forceRelogin();
        setTimeout(() => startBot(), 2000);
        return;
      }
      
      if (shouldReconnect) {
        setTimeout(() => startBot(), reconnectDelay);
      }
      
    } else if (connection === 'open') {
      logger.info('✅ Connected to WhatsApp!');
      reconnectAttempts = 0; // Reset attempts on successful connection
      lastSuccessfulConnection = new Date();
    } else if (connection === 'connecting') {
      logger.info('🔄 Connecting to WhatsApp...');
    }
  });

  // Message listener
  sock.ev.on('messages.upsert', async (msgUpsert) => {
    try {
      const msg = msgUpsert.messages[0];
      if (!msg.message || msg.key.fromMe) return;
      
      // Deduplication check
      if (alreadyProcessed(msg.key.id)) return;
      markProcessed(msg.key.id);

      const sender = msg.key.remoteJid;
      // Ignore status broadcasts and groups
      if (sender === 'status@broadcast' || sender.includes('@g.us')) return;

      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message?.ephemeralMessage?.message?.conversation ||
        '';

      if (!text.trim()) return; // skip empty messages
      
      // Skip trivial responses early
      if (shouldSkipResponse(sender, text)) return;

      // Only talk to the allowed numbers
      const senderNumber = sender.split('@')[0];
      if (!isAllowedContact(senderNumber)) {
        logger.debug({ senderNumber }, 'Ignoring message from unauthorized contact');
        return;
      }

      // add the message to buffer
      if (!messageBuffer.has(sender)) messageBuffer.set(sender, []);
      messageBuffer.get(sender).push(text);
      logger.debug({ text, sender }, '💬 Received message');

      // Language detection per user
      const lang = detectLanguage(text);
      const currentLang = languageMemory.get(sender);
      
      if (!currentLang || currentLang !== lang) {
        languageMemory.set(sender, lang);
        logger.debug({ sender, lang }, '🌐 Language updated');
        scheduleSave(); // Save when language changes
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

        logger.debug({ allMessages }, '🧩 Processing message burst');

        // Cognitive Analysis Phase
        const messageIntent = detectIntent(allMessages);
        const temporalContext = getTemporalContext();
        const behavioralPattern = analyzeBehavioralPattern(sender);
        
        logger.debug({ 
          intent: messageIntent, 
          temporal: temporalContext.timeContext,
          isWeekend: temporalContext.isWeekend 
        }, '🧠 Cognitive analysis');

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

        // Detect emotional context and tone with mood drift tracking
        const emotion = detectEmotion(allMessages);
        const moodDrift = trackMoodDrift(sender, emotion);
        const tone = detectTone(history, allMessages);
        const recentContext = limitedHistory.slice(-3).map(m => m.content).join(' ');
        
        logger.debug({ emotion, tone, dominantMood: moodDrift.dominantMood, moodScore: moodDrift.moodScore.toFixed(2) }, '🎭 Emotional analysis');
        
        // Remember tone trend (smooth transition)
        const lastTone = toneMemory.get(sender);
        if (!lastTone || lastTone !== tone) {
          toneMemory.set(sender, tone);
          logger.debug({ sender, tone }, '💾 Tone memory updated');
          scheduleSave(); // Save when tone changes
        }
        
        // Store semantic memory for cognitive recall
        await storeSemanticMemory(sender, allMessages, {
          emotion: emotion,
          intent: messageIntent,
          temporal: temporalContext,
          tone: tone
        });
        
        // Retrieve relevant past conversations for context with weighted relevance
        const relevantMemories = await searchSemanticMemory(sender, allMessages, 0.65);
        let semanticContext = '';
        if (relevantMemories.length > 0) {
          const weightedContext = relevantMemories.map(m => 
            `[${(m.weightedRelevance).toFixed(2)}] ${m.content.substring(0, 80)}...`
          ).join('\n');
          semanticContext = `\nRelevant memories:\n${weightedContext}`;
          logger.debug({ count: relevantMemories.length }, '🧠 Weighted memories recalled');
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

        const prompt = allMessages + quoted + longTermContext + followUpContext + semanticContext;

        // Multi-step reasoning chain for decision transparency
        const reasoningChain = [];
        reasoningChain.push({ step: 'detect_intent', result: messageIntent, confidence: 0.8 });
        reasoningChain.push({ step: 'detect_emotion', result: emotion, confidence: 0.7 });
        reasoningChain.push({ step: 'temporal_context', result: temporalContext.timeContext, confidence: 1.0 });
        reasoningChain.push({ step: 'mood_drift', result: moodDrift.dominantMood, confidence: moodDrift.moodScore });
        
        // Decision logic based on reasoning
        if (emotion === 'sad' && messageIntent === 'question') {
          reasoningChain.push({ step: 'prioritize_empathy', result: 'empathy_over_logic', reasoning: 'User is sad, prioritizing emotional support' });
        }
        
        if (temporalContext.timeContext === 'late_night' && emotion !== 'neutral') {
          reasoningChain.push({ step: 'adjust_intimacy', result: 'increase_warmth', reasoning: 'Late night + emotional = more intimate tone' });
        }
        
        if (behavioralPattern.communicationStyle === 'playful' && emotion === 'happy') {
          reasoningChain.push({ step: 'match_energy', result: 'playful_response', reasoning: 'Match user\'s playful energy' });
        }
        
        console.log('🧠 reasoning chain:', reasoningChain.map(r => `${r.step}:${r.result}`).join(' → '));

        // Select optimal AI model using adaptive scoring
        const selectedModel = selectModel(messageIntent, emotion, temporalContext, moodDrift);
        console.log(`🤖 selected model: ${selectedModel} for intent: ${messageIntent}`);
        
        // Apply dynamic personality adaptation with domain awareness
        const personalityAdaptation = adaptPersonality(sender, emotion, messageIntent, allMessages);
        console.log(`🎭 personality adaptation:`, personalityAdaptation);

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
            content: `${getPersonalityPrompt(emotion, recentContext, persistentTone)} ${langInstruction}

${temporalContext.greeting ? temporalContext.greeting + ' ' : ''}Current time: ${temporalContext.timeContext} (${temporalContext.hour}:00), ${temporalContext.workContext}. Ambient mood: ${temporalContext.mood}.

Personality profile: You are currently expressing ${personalityAdaptation.dominantTraits.join(', ')} traits (${personalityAdaptation.relationshipType} relationship).

Cognitive context: ${reasoningChain.slice(-2).map(r => r.step + ':' + r.result).join(', ')}.${semanticContext ? '\n' + semanticContext : ''}`
          },
          ...limitedHistory,
          {
            role: 'user',
            content: prompt
          }
        ];

        try {
          const apiRes = await aiClient.post('', {
            model: selectedModel,
            messages,
            temperature: 0.85,
            max_tokens: 150,
            top_p: 0.9,
            frequency_penalty: 0.3,
            presence_penalty: 0.3
          });

          let reply = (apiRes.data.choices?.[0]?.message?.content || '').trim().toLowerCase();
          
          // Enhanced structured logging for AI response
          const usage = apiRes.data.usage || {};
          logger.info({
            sender,
            intent: messageIntent,
            emotion,
            tone,
            model: selectedModel,
            temporalContext: temporalContext.timeContext,
            relationshipType: personalityAdaptation.relationshipType,
            dominantTraits: personalityAdaptation.dominantTraits,
            moodScore: moodDrift.moodScore.toFixed(2),
            tokens: {
              prompt: usage.prompt_tokens || 0,
              completion: usage.completion_tokens || 0,
              total: usage.total_tokens || 0
            },
            responseLength: reply.length,
            reasoning: reasoningChain.length
          }, '🧩 AI response generated');

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

          // Natural behavior simulation - calculate dynamic reply delay
          const replyDelay = calculateReplyDelay(reply, emotion, messageIntent);
          logger.debug({ replyDelay, emotion, intent: messageIntent }, '⏰ Natural delay calculated');
          
          // Send response with natural delay using queue system
          enqueueReply(sender, async () => {
            await sock.sendPresenceUpdate('composing', sender);
            setTimeout(async () => {
              await sock.sendPresenceUpdate('paused', sender);
              await sock.sendMessage(sender, { text: reply });
              
              // Self-reflection after response (meta-cognitive layer)
              setTimeout(() => {
                selfReflect(sender, allMessages, reply, emotion, messageIntent);
              }, 1000);
              
              await summarizeHistory(sender);
            }, replyDelay);
          });

        } catch (err) {
          console.error('❌ api or handler error:', err.message);
        }
      }, CONFIG.DEBOUNCE_DELAY); // wait 2s after last message before replying

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
      
      if (timeSinceLastConnection > CONFIG.STALE_CONNECTION_THRESHOLD) {
        logger.warn('⚠️ Connection appears stale. Forcing relogin...');
        await forceRelogin();
        setTimeout(() => startBot(), 3000);
      }
    }
  }, CONFIG.HEALTH_CHECK_INTERVAL); // Check every 5 minutes
}

// Graceful shutdown handlers
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

// Start the bot and health monitor
try {
  console.log("🚀 About to start bot...");
  startBot();
  console.log("🏥 About to start health monitor...");
  startHealthMonitor();
  console.log("✅ All services started!");
} catch (error) {
  console.error("❌ Error starting services:", error);
}