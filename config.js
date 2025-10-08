module.exports = {
  // WhatsApp Bot Configuration
  ALLOWED_CONTACTS: ["6281261480997", "6283108490895","6285174237321","601162620212","6285298222159","6287832550290"],
  
  // Connection & Retry Settings
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 5000, // 5 seconds
  STALE_CONNECTION_THRESHOLD: 10 * 60 * 1000, // 10 minutes
  
  // Message Processing
  DEBOUNCE_DELAY: 2000, // wait 2 seconds after last message
  REPLY_DELAY: 2000, // wait 2 seconds before sending reply (human-like)
  
  // Memory Management
  MEMORY_SAVE_DEBOUNCE: 5000, // 5 seconds
  MAX_SHORT_TERM_MESSAGES: 10,
  MAX_LONG_TERM_SUMMARIES: 5,
  MAX_EMOTIONAL_EVENTS: 20,
  MEMORY_COMPRESSION_THRESHOLD: 15,
  
  // AI Settings
  AI_API_URL: 'https://ai.wush.site/v1/chat/completions',
  AI_EMBEDDING_URL: 'https://ai.wush.site/v1/embeddings',
  
  // Model routing based on intent
  AI_MODELS: {
    emotional: 'gemma3:4b-it-qat',                       // empathetic responses (5.8s - fastest!)
    factual: 'gemma3:4b-it-qat',                  // accurate information (6.4s - fast)
    creative: 'gemma3:4b-it-qat',         // creative/reasoning (8.4s - good quality)
    summarization: 'gemma3:1b-it-qat',            // efficient summarization (6.4s - fastest small)
    coding: 'gemma3:4b-it-qat',                          // technical responses (5.8s - fast)
    embedding: 'tazarov/all-minilm-l6-v2-f32:latest'  // semantic embeddings
  },
  
  AI_MAX_TOKENS: 150,
  AI_MAX_RETRIES: 3,
  AI_RETRY_DELAY: 2000,
  
  // Context Management
  TONE_DECAY_HOURS: 48,
  ACTIVITY_FADE_HOURS: 1,
  HEALTH_CHECK_INTERVAL: 5 * 60 * 1000, // 5 minutes
  
  // Cognitive Intelligence
  EMBEDDING_SIMILARITY_THRESHOLD: 0.75,
  MAX_SEMANTIC_MEMORIES: 10,
  BEHAVIORAL_PATTERN_WINDOW: 7, // days
  PERSONALITY_ADAPTATION_RATE: 0.1,
  
  // Natural Behavior
  MIN_REPLY_DELAY: 1000,
  MAX_REPLY_DELAY: 6000,
  REPLY_DELAY_PER_CHAR: 50,
  SKIP_RESPONSE_THRESHOLD: 3, // consecutive trivial messages
  QUALITY_EVALUATION_DELAY: 5000,   // Delay before evaluating response quality
  
  // Personality Adaptation Thresholds
  PERSONALITY_CONFIDENCE_THRESHOLD: 0.6,
  EMOTION_WEIGHT_FACTOR: 0.4,
  INTENT_WEIGHT_FACTOR: 0.6,
  
  // File Paths
  MEMORY_FILE: 'memory/memory.json',
  AUTH_FOLDER: 'auth',
  
  // Logging
  LOG_LEVEL: 'info'
};
