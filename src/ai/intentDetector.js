/**
 * Intent Detection Service
 * Classifies user message intent
 */

/**
 * Detect the intent of a message
 * @param {string} text - Message text
 * @returns {string} Intent category
 */
export function detectIntent(text) {
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

export default detectIntent;
