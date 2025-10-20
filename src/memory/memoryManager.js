/**
 * Memory Manager
 * Manages all types of bot memory including short-term, long-term, 
 * emotional events, semantic memory, and user preferences
 */

import fs from 'fs';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';
import { truncateArray, calculateDecayFactor, cosineSimilarity, findSimilarMemories } from '../utils/memoryUtils.js';
import { getEmbedding } from '../ai/aiService.js';

export class MemoryManager {
  constructor() {
    // Memory stores (using Maps for efficient lookup)
    this.chatMemory = new Map();          // Short-term: last N messages
    this.longTermMemory = new Map();      // Long-term: summaries
    this.emotionalEvents = new Map();     // Emotional milestones
    this.toneMemory = new Map();          // Conversation tone
    this.languageMemory = new Map();      // Language preference
    this.semanticMemory = new Map();      // Vector embeddings
    this.personalityProfiles = new Map(); // User personalities
    this.behavioralPatterns = new Map();  // Behavior tracking
    this.responseQuality = new Map();     // Response effectiveness
    this.moodHistory = new Map();         // Mood drift
    this.personalityTrends = new Map();   // Personality evolution
    this.relationshipTypes = new Map();   // Relationship personas
    
    // Save timer for debouncing
    this.saveTimer = null;
  }

  /**
   * Initialize memory manager by loading from disk
   */
  async init() {
    this.loadMemory();
    logger.info('✅ MemoryManager initialized');
  }

  /**
   * Get short-term chat memory for a user
   * @param {string} sender - User identifier
   * @returns {Array} Chat history
   */
  getChatMemory(sender) {
    return this.chatMemory.get(sender) || [];
  }

  /**
   * Add message to short-term memory
   * @param {string} sender - User identifier
   * @param {object} message - Message object with role and content
   */
  addChatMessage(sender, message) {
    const history = this.getChatMemory(sender);
    history.push(message);
    
    // Truncate to max length
    const truncated = truncateArray(history, config.MAX_SHORT_TERM_MESSAGES);
    this.chatMemory.set(sender, truncated);
    
    this.scheduleSave();
  }

  /**
   * Get long-term memory summaries for a user
   * @param {string} sender - User identifier
   * @returns {Array} Long-term summaries
   */
  getLongTermMemory(sender) {
    return this.longTermMemory.get(sender) || [];
  }

  /**
   * Add long-term memory summary
   * @param {string} sender - User identifier
   * @param {string} summary - Summary text
   * @param {object} metadata - Additional metadata
   */
  addLongTermMemory(sender, summary, metadata = {}) {
    const summaries = this.getLongTermMemory(sender);
    
    summaries.push({
      summary,
      timestamp: new Date().toISOString(),
      ...metadata
    });
    
    // Keep only recent summaries
    const truncated = truncateArray(summaries, config.MAX_LONG_TERM_SUMMARIES);
    this.longTermMemory.set(sender, truncated);
    
    this.scheduleSave();
  }

  /**
   * Get emotional events for a user
   * @param {string} sender - User identifier
   * @returns {Array} Emotional events
   */
  getEmotionalEvents(sender) {
    return this.emotionalEvents.get(sender) || [];
  }

  /**
   * Record an emotional event
   * @param {string} sender - User identifier
   * @param {object} event - Event details
   */
  recordEmotionalEvent(sender, event) {
    const events = this.getEmotionalEvents(sender);
    
    events.push({
      ...event,
      timestamp: new Date().toISOString(),
      daysAgo: 0
    });
    
    // Keep last N events
    const truncated = truncateArray(events, config.MAX_EMOTIONAL_EVENTS);
    this.emotionalEvents.set(sender, truncated);
    
    logger.info(`💫 Recorded emotional event: ${event.type} (${event.intensity})`);
    this.scheduleSave();
  }

  /**
   * Get tone memory for a user
   * @param {string} sender - User identifier
   * @returns {string} Tone
   */
  getTone(sender) {
    return this.toneMemory.get(sender) || 'neutral';
  }

  /**
   * Set tone memory for a user
   * @param {string} sender - User identifier
   * @param {string} tone - Tone value
   */
  setTone(sender, tone) {
    this.toneMemory.set(sender, tone);
    this.scheduleSave();
  }

  /**
   * Decay tone after inactivity
   * @param {string} sender - User identifier
   */
  decayTone(sender) {
    const tone = this.getTone(sender);
    if (!tone || tone === 'neutral') return;
    
    const summaries = this.getLongTermMemory(sender);
    if (summaries.length === 0) return;
    
    const lastSummary = summaries[summaries.length - 1];
    const lastTime = new Date(lastSummary.timestamp);
    const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);
    
    if (hoursSince > config.TONE_DECAY_HOURS) {
      logger.debug(`🕰️ Fading tone for ${sender} back to neutral`);
      this.setTone(sender, 'neutral');
    }
  }

  /**
   * Get language preference for a user
   * @param {string} sender - User identifier
   * @returns {string} Language preference
   */
  getLanguage(sender) {
    return this.languageMemory.get(sender) || 'mixed';
  }

  /**
   * Set language preference for a user
   * @param {string} sender - User identifier
   * @param {string} language - Language preference
   */
  setLanguage(sender, language) {
    this.languageMemory.set(sender, language);
    this.scheduleSave();
  }

  /**
   * Store semantic memory with vector embedding
   * @param {string} sender - User identifier
   * @param {string} text - Text to store
   * @param {object} context - Additional context
   */
  async storeSemanticMemory(sender, text, context = {}) {
    try {
      const embedding = await getEmbedding(text);
      
      const memories = this.semanticMemory.get(sender) || [];
      memories.push({
        text,
        embedding,
        timestamp: new Date().toISOString(),
        ...context
      });
      
      // Keep last N semantic memories
      const truncated = truncateArray(memories, config.MAX_SEMANTIC_MEMORIES);
      this.semanticMemory.set(sender, truncated);
      
      this.scheduleSave();
    } catch (error) {
      logger.error(`❌ Failed to store semantic memory: ${error.message}`);
    }
  }

  /**
   * Search semantic memory using vector similarity
   * @param {string} sender - User identifier
   * @param {string} queryText - Query text
   * @param {number} threshold - Similarity threshold
   * @returns {Array} Similar memories
   */
  async searchSemanticMemory(sender, queryText, threshold = config.EMBEDDING_SIMILARITY_THRESHOLD) {
    try {
      const memories = this.semanticMemory.get(sender);
      if (!memories || memories.length === 0) return [];
      
      const queryEmbedding = await getEmbedding(queryText);
      const similar = findSimilarMemories(queryEmbedding, memories, threshold, 5);
      
      if (similar.length > 0) {
        logger.debug(`🧠 Found ${similar.length} similar memories`);
      }
      
      return similar;
    } catch (error) {
      logger.error(`❌ Semantic search failed: ${error.message}`);
      return [];
    }
  }

  /**
   * Get personality profile for a user
   * @param {string} sender - User identifier
   * @returns {object} Personality profile
   */
  getPersonalityProfile(sender) {
    return this.personalityProfiles.get(sender) || this.getDefaultPersonality();
  }

  /**
   * Get default personality profile
   * @returns {object} Default personality
   */
  getDefaultPersonality() {
    return {
      curiosity: 0.7,
      empathy: 0.8,
      humor: 0.6,
      flirtiness: 0.3,
      logic: 0.7,
      playfulness: 0.5
    };
  }

  /**
   * Update personality profile
   * @param {string} sender - User identifier
   * @param {object} traits - Personality traits to update
   */
  updatePersonalityProfile(sender, traits) {
    const current = this.getPersonalityProfile(sender);
    const updated = { ...current, ...traits };
    this.personalityProfiles.set(sender, updated);
    this.scheduleSave();
  }

  /**
   * Get mood history for a user
   * @param {string} sender - User identifier
   * @returns {Array} Mood history
   */
  getMoodHistory(sender) {
    return this.moodHistory.get(sender) || [];
  }

  /**
   * Record mood
   * @param {string} sender - User identifier
   * @param {string} emotion - Current emotion
   * @param {number} intensity - Intensity score
   */
  recordMood(sender, emotion, intensity = 0.5) {
    const history = this.getMoodHistory(sender);
    
    history.push({
      emotion,
      intensity,
      timestamp: new Date().toISOString()
    });
    
    // Keep last 20 mood entries
    const truncated = truncateArray(history, 20);
    this.moodHistory.set(sender, truncated);
    
    this.scheduleSave();
  }

  /**
   * Calculate mood drift (trend)
   * @param {string} sender - User identifier
   * @returns {object} Mood drift analysis
   */
  calculateMoodDrift(sender) {
    const history = this.getMoodHistory(sender);
    if (history.length < 2) {
      return { moodScore: 0, trend: 'stable' };
    }
    
    // Convert emotions to numeric scores
    const emotionScores = {
      happy: 1,
      excited: 1,
      neutral: 0,
      sad: -1,
      anxious: -0.8,
      frustrated: -0.9,
      flirty: 0.5
    };
    
    const scores = history.map(m => emotionScores[m.emotion] || 0);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    
    // Calculate trend
    let trend = 'stable';
    if (avgScore > 0.3) trend = 'positive';
    else if (avgScore < -0.3) trend = 'negative';
    
    return { moodScore: avgScore, trend };
  }

  /**
   * Get relationship type for a user
   * @param {string} sender - User identifier
   * @returns {string} Relationship type
   */
  getRelationshipType(sender) {
    return this.relationshipTypes.get(sender) || 'friend';
  }

  /**
   * Set relationship type
   * @param {string} sender - User identifier
   * @param {string} type - Relationship type (romantic/friend/counselor/mentor/companion)
   */
  setRelationshipType(sender, type) {
    this.relationshipTypes.set(sender, type);
    this.scheduleSave();
  }

  /**
   * Check if should follow up on past emotional events
   * @param {string} sender - User identifier
   * @returns {object|null} Event to follow up on
   */
  shouldFollowUp(sender) {
    const events = this.getEmotionalEvents(sender);
    if (events.length === 0) return null;
    
    const now = Date.now();
    
    // Check for events 1-3 days ago
    for (const event of events.reverse()) {
      const eventTime = new Date(event.timestamp).getTime();
      const daysSince = (now - eventTime) / (1000 * 60 * 60 * 24);
      
      if (daysSince >= 1 && daysSince <= 3 && event.intensity === 'high') {
        return { ...event, daysSince: Math.floor(daysSince) };
      }
    }
    
    return null;
  }

  /**
   * Schedule memory save (debounced)
   */
  scheduleSave() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveMemory(), config.MEMORY_SAVE_DEBOUNCE);
  }

  /**
   * Save all memory to disk
   */
  saveMemory() {
    try {
      const memoryData = {
        shortTerm: Object.fromEntries(this.chatMemory),
        longTerm: Object.fromEntries(this.longTermMemory),
        emotionalEvents: Object.fromEntries(this.emotionalEvents),
        toneMemory: Object.fromEntries(this.toneMemory),
        languageMemory: Object.fromEntries(this.languageMemory),
        semanticMemory: Object.fromEntries(this.semanticMemory),
        personalityProfiles: Object.fromEntries(this.personalityProfiles),
        behavioralPatterns: Object.fromEntries(this.behavioralPatterns),
        responseQuality: Object.fromEntries(this.responseQuality),
        moodHistory: Object.fromEntries(this.moodHistory),
        personalityTrends: Object.fromEntries(this.personalityTrends),
        relationshipTypes: Object.fromEntries(this.relationshipTypes),
        lastSaved: new Date().toISOString()
      };
      
      fs.writeFileSync(config.MEMORY_FILE, JSON.stringify(memoryData, null, 2));
      logger.debug('💾 Memory saved to disk');
    } catch (error) {
      logger.error(`❌ Failed to save memory: ${error.message}`);
    }
  }

  /**
   * Load memory from disk
   */
  loadMemory() {
    if (!fs.existsSync(config.MEMORY_FILE)) {
      logger.info('📚 No existing memory file found, starting fresh');
      return;
    }
    
    try {
      const data = JSON.parse(fs.readFileSync(config.MEMORY_FILE, 'utf8'));
      
      // Load all memory types
      const memoryMaps = [
        ['shortTerm', this.chatMemory],
        ['longTerm', this.longTermMemory],
        ['emotionalEvents', this.emotionalEvents],
        ['toneMemory', this.toneMemory],
        ['languageMemory', this.languageMemory],
        ['semanticMemory', this.semanticMemory],
        ['personalityProfiles', this.personalityProfiles],
        ['behavioralPatterns', this.behavioralPatterns],
        ['responseQuality', this.responseQuality],
        ['moodHistory', this.moodHistory],
        ['personalityTrends', this.personalityTrends],
        ['relationshipTypes', this.relationshipTypes]
      ];
      
      for (const [key, map] of memoryMaps) {
        if (data[key]) {
          for (const [k, v] of Object.entries(data[key])) {
            map.set(k, v);
          }
        }
      }
      
      logger.info('📚 Memory loaded from disk');
    } catch (error) {
      logger.error(`⚠️ Memory load error: ${error.message}`);
      
      // Backup corrupted file
      const backupPath = `${config.MEMORY_FILE}.corrupted.${Date.now()}`;
      try {
        fs.renameSync(config.MEMORY_FILE, backupPath);
        logger.warn(`⚠️ Corrupted memory file backed up to ${backupPath}`);
      } catch (backupError) {
        logger.error(`❌ Failed to backup corrupted file: ${backupError.message}`);
      }
    }
  }

  /**
   * Clear all memory for a user
   * @param {string} sender - User identifier
   */
  clearUserMemory(sender) {
    this.chatMemory.delete(sender);
    this.longTermMemory.delete(sender);
    this.emotionalEvents.delete(sender);
    this.toneMemory.delete(sender);
    this.languageMemory.delete(sender);
    this.semanticMemory.delete(sender);
    this.personalityProfiles.delete(sender);
    this.behavioralPatterns.delete(sender);
    this.responseQuality.delete(sender);
    this.moodHistory.delete(sender);
    this.personalityTrends.delete(sender);
    this.relationshipTypes.delete(sender);
    
    this.scheduleSave();
    logger.info(`🗑️ Cleared all memory for ${sender}`);
  }

  /**
   * Get memory statistics
   * @returns {object} Memory statistics
   */
  getStats() {
    return {
      users: this.chatMemory.size,
      totalMessages: Array.from(this.chatMemory.values())
        .reduce((sum, messages) => sum + messages.length, 0),
      emotionalEvents: Array.from(this.emotionalEvents.values())
        .reduce((sum, events) => sum + events.length, 0),
      semanticMemories: Array.from(this.semanticMemory.values())
        .reduce((sum, memories) => sum + memories.length, 0)
    };
  }
}

// Export singleton instance
export const memoryManager = new MemoryManager();

export default memoryManager;
