/**
 * Emotion Detection Service
 * Detects emotional state from message text
 */

// Pre-compiled emotion patterns for better performance
const EMOTION_PATTERNS = {
  happy: /(haha|hehe|lol|😂|😄|😊|happy|excited|love|amazing|great|good|nice|thanks|thank you)/i,
  sad: /(sad|cry|😭|😢|hurt|pain|miss|lonely|depressed|tired|exhausted)/i,
  frustrated: /(angry|mad|hate|annoyed|frustrated|ugh|wtf|damn|shit)/i,
  anxious: /(worried|anxious|scared|nervous|stress|afraid|help|please)/i,
  flirty: /(😘|❤️|💕|baby|babe|cutie|handsome|beautiful|miss you|love you)/i
};

/**
 * Detect the emotion in a message
 * @param {string} text - Message text
 * @returns {string} Detected emotion
 */
export function detectEmotion(text) {
  const lowerText = text.toLowerCase();
  
  // Test patterns in order of priority
  if (EMOTION_PATTERNS.happy.test(lowerText)) {
    return 'happy';
  }
  
  if (EMOTION_PATTERNS.sad.test(lowerText)) {
    return 'sad';
  }
  
  if (EMOTION_PATTERNS.frustrated.test(lowerText)) {
    return 'frustrated';
  }
  
  if (EMOTION_PATTERNS.anxious.test(lowerText)) {
    return 'anxious';
  }
  
  if (EMOTION_PATTERNS.flirty.test(lowerText)) {
    return 'flirty';
  }
  
  return 'neutral';
}

// Pre-compiled event detection patterns
const EVENT_PATTERNS = {
  distress: /(broke up|breakup|lost|died|death|fired|rejected|failed|nightmare|terrible day)/i,
  celebration: /(got the job|promoted|passed|won|accepted|good news|amazing news|birthday|anniversary)/i,
  vulnerability: /(i never told anyone|can i tell you something|i'm scared|i don't know what to do|i feel lost)/i,
  intimate: /(i love you|you mean everything|you're special|i care about you|thinking about you)/i,
  conflict: /(why did you|you hurt me|i'm disappointed|we need to talk|i'm upset with you)/i
};

/**
 * Detect emotional events worth remembering
 * @param {string} text - Message text
 * @param {string} emotion - Detected emotion
 * @returns {object|null} Emotional event details or null
 */
export function detectEmotionalEvent(text, emotion) {
  const lowerText = text.toLowerCase();
  
  // Significant sad/distress events
  if (emotion === 'sad' && EVENT_PATTERNS.distress.test(lowerText)) {
    return { type: 'distress', intensity: 'high', trigger: 'major life event' };
  }
  
  // Significant happy events
  if (emotion === 'happy' && EVENT_PATTERNS.celebration.test(lowerText)) {
    return { type: 'celebration', intensity: 'high', trigger: 'major achievement' };
  }
  
  // Vulnerable moments (opening up)
  if (EVENT_PATTERNS.vulnerability.test(lowerText)) {
    return { type: 'vulnerability', intensity: 'high', trigger: 'deep sharing' };
  }
  
  // Romantic/intimate moments
  if (EVENT_PATTERNS.intimate.test(lowerText)) {
    return { type: 'intimate', intensity: 'high', trigger: 'emotional bonding' };
  }
  
  // Conflict or tension
  if (EVENT_PATTERNS.conflict.test(lowerText)) {
    return { type: 'conflict', intensity: 'medium', trigger: 'relationship tension' };
  }
  
  return null;
}

// Pre-compiled tone patterns
const TONE_PATTERNS = {
  playful: /(haha|hehe|lol|wkwk|anjay|gabut|ngantuk|lucu|teasing|main|game|wkwkwk|nakal|gemes|cute)/,
  serious: /(kenapa|gimana|menurutmu|jelaskan|tolong|serius|capek|masalah|penting|pusing|kerja|deadline|proyek)/,
  flirty: /(sayang|babe|cantik|ganteng|manis|rindu|kangen|😘|💕|❤️|love you|cium)/,
  emotional: /(sedih|nangis|kecewa|hurt|tired|pusing|sendirian|bingung|stress|depres)/,
  sarcastic: /(yha|ok lah|yaudah|whatever|sure|fine|terserah|iyain aja)/,
};

/**
 * Analyze overall tone from message history
 * @param {Array} history - Message history
 * @param {string} latestText - Latest message text
 * @returns {string} Detected tone
 */
export function detectTone(history, latestText) {
  const combined = (history.map(m => m.content).join(' ') + ' ' + latestText).toLowerCase();

  for (const [tone, regex] of Object.entries(TONE_PATTERNS)) {
    if (regex.test(combined)) return tone;
  }

  return 'neutral';
}

export default { detectEmotion, detectEmotionalEvent, detectTone };
