/**
 * Emotion Detection Service
 * Detects emotional state from message text
 */

/**
 * Detect the emotion in a message
 * @param {string} text - Message text
 * @returns {string} Detected emotion
 */
export function detectEmotion(text) {
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

/**
 * Detect emotional events worth remembering
 * @param {string} text - Message text
 * @param {string} emotion - Detected emotion
 * @returns {object|null} Emotional event details or null
 */
export function detectEmotionalEvent(text, emotion) {
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

/**
 * Analyze overall tone from message history
 * @param {Array} history - Message history
 * @param {string} latestText - Latest message text
 * @returns {string} Detected tone
 */
export function detectTone(history, latestText) {
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

export default { detectEmotion, detectEmotionalEvent, detectTone };
