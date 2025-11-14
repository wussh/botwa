/**
 * Intent Detection Service
 * Classifies user message intent
 */

// Pre-compiled regex patterns for better performance
const PATTERNS = {
  question: /(apa|what|why|how|when|where|who|gimana|kenapa|kapan|dimana|siapa|\?)/i,
  command: /(tell me|make|find|show|help|tolong|bantu|cariin|buatin)/i,
  emotional: /(i feel|i'm|aku|feeling|sedih|senang|marah|kecewa|excited|love|hate|miss|rindu)/i,
  technical: /(code|function|bug|error|programming|javascript|python|html|css)/i,
  smalltalk: /(haha|lol|wkwk|hehe|hmm|ok|ya|iya|nice|cool)/i
};

/**
 * Detect the intent of a message
 * @param {string} text - Message text
 * @returns {string} Intent category
 */
export function detectIntent(text) {
  const lowerText = text.toLowerCase();
  
  // Test patterns in order of priority
  if (PATTERNS.question.test(lowerText)) {
    return 'question';
  }
  
  if (PATTERNS.command.test(lowerText)) {
    return 'command';
  }
  
  if (PATTERNS.emotional.test(lowerText)) {
    return 'emotional';
  }
  
  if (PATTERNS.technical.test(lowerText)) {
    return 'technical';
  }
  
  if (PATTERNS.smalltalk.test(lowerText)) {
    return 'smalltalk';
  }
  
  return 'casual';
}

export default detectIntent;
