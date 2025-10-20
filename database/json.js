/**
 * JSON Memory Adapter (Legacy compatibility)
 * Maintains backward compatibility with existing JSON file storage
 */

const fs = require('fs');
const path = require('path');

class JSONMemory {
  constructor(filePath = 'memory/memory.json') {
    this.filePath = filePath;
    this.data = {
      shortTerm: {},
      longTerm: {},
      emotionalEvents: {},
      toneMemory: {},
      languageMemory: {},
      semanticMemory: {},
      personalityTrends: {},
      moodHistory: {},
      relationshipTypes: {}
    };
  }

  async init() {
    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing data
    if (fs.existsSync(this.filePath)) {
      try {
        const content = fs.readFileSync(this.filePath, 'utf8');
        const loaded = JSON.parse(content);
        this.data = { ...this.data, ...loaded };
        console.log('✅ Loaded memory from JSON file');
      } catch (error) {
        console.error('⚠️ Failed to load JSON memory, starting fresh:', error.message);
      }
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      console.error('❌ Failed to save JSON memory:', error.message);
    }
  }

  // ===========================================
  // Chat Memory (Short-term)
  // ===========================================
  
  async getChatMemory(sender, limit = 10) {
    const history = this.data.shortTerm[sender] || [];
    return history.slice(-limit);
  }

  async addChatMessage(sender, role, content) {
    if (!this.data.shortTerm[sender]) {
      this.data.shortTerm[sender] = [];
    }
    this.data.shortTerm[sender].push({ role, content });
    this.save();
  }

  async clearOldChatMemory(sender, keepLast = 10) {
    if (this.data.shortTerm[sender]) {
      this.data.shortTerm[sender] = this.data.shortTerm[sender].slice(-keepLast);
      this.save();
    }
  }

  // ===========================================
  // Long-term Memory
  // ===========================================
  
  async getLongTermMemory(sender, limit = 5) {
    const memories = this.data.longTerm[sender] || [];
    return memories.slice(-limit);
  }

  async addLongTermMemory(sender, summary) {
    if (!this.data.longTerm[sender]) {
      this.data.longTerm[sender] = [];
    }
    this.data.longTerm[sender].push({
      summary,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 5
    if (this.data.longTerm[sender].length > 5) {
      this.data.longTerm[sender] = this.data.longTerm[sender].slice(-5);
    }
    this.save();
  }

  // ===========================================
  // Emotional Events
  // ===========================================
  
  async getEmotionalEvents(sender, limit = 20) {
    const events = this.data.emotionalEvents[sender] || [];
    return events.slice(-limit);
  }

  async addEmotionalEvent(sender, emotion, type, intensity, trigger, snippet) {
    if (!this.data.emotionalEvents[sender]) {
      this.data.emotionalEvents[sender] = [];
    }
    
    this.data.emotionalEvents[sender].push({
      emotion,
      type,
      intensity,
      trigger,
      snippet,
      timestamp: new Date().toISOString(),
      followedUp: false,
      daysAgo: 0
    });
    
    // Keep only last 20
    if (this.data.emotionalEvents[sender].length > 20) {
      this.data.emotionalEvents[sender] = this.data.emotionalEvents[sender].slice(-20);
    }
    this.save();
  }

  async markEventFollowedUp(sender, eventIndex) {
    if (this.data.emotionalEvents[sender]?.[eventIndex]) {
      this.data.emotionalEvents[sender][eventIndex].followedUp = true;
      this.save();
    }
  }

  // ===========================================
  // Tone & Language Memory
  // ===========================================
  
  async getTone(sender) {
    return this.data.toneMemory[sender];
  }

  async setTone(sender, tone) {
    this.data.toneMemory[sender] = tone;
    this.save();
  }

  async getLanguage(sender) {
    return this.data.languageMemory[sender];
  }

  async setLanguage(sender, language) {
    this.data.languageMemory[sender] = language;
    this.save();
  }

  // ===========================================
  // Semantic Memory
  // ===========================================
  
  async getSemanticMemory(sender, limit = 10) {
    const memories = this.data.semanticMemory[sender] || [];
    return memories.slice(-limit);
  }

  async addSemanticMemory(sender, text, emotion, context, embedding, weight = 0.5) {
    if (!this.data.semanticMemory[sender]) {
      this.data.semanticMemory[sender] = [];
    }
    
    this.data.semanticMemory[sender].push({
      text,
      emotion,
      context,
      embedding,
      weight,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10
    if (this.data.semanticMemory[sender].length > 10) {
      this.data.semanticMemory[sender] = this.data.semanticMemory[sender].slice(-10);
    }
    this.save();
  }

  // ===========================================
  // Personality Trends
  // ===========================================
  
  async getPersonalityTrend(sender) {
    return this.data.personalityTrends[sender];
  }

  async setPersonalityTrend(sender, traits) {
    this.data.personalityTrends[sender] = {
      ...traits,
      lastEvolution: Date.now()
    };
    this.save();
  }

  // ===========================================
  // Mood History
  // ===========================================
  
  async getMoodHistory(sender, limit = 20) {
    const history = this.data.moodHistory[sender] || [];
    return history.slice(-limit);
  }

  async addMoodEntry(sender, emotion, hour) {
    if (!this.data.moodHistory[sender]) {
      this.data.moodHistory[sender] = [];
    }
    
    this.data.moodHistory[sender].push({
      emotion,
      hour,
      timestamp: Date.now()
    });
    
    // Keep only last 20
    if (this.data.moodHistory[sender].length > 20) {
      this.data.moodHistory[sender] = this.data.moodHistory[sender].slice(-20);
    }
    this.save();
  }

  // ===========================================
  // Relationship Types
  // ===========================================
  
  async getRelationshipType(sender) {
    return this.data.relationshipTypes[sender];
  }

  async setRelationshipType(sender, type, traits, confidence) {
    this.data.relationshipTypes[sender] = {
      type,
      traits,
      confidence,
      lastUpdated: Date.now()
    };
    this.save();
  }

  // ===========================================
  // Utility Methods
  // ===========================================
  
  async getAllMemoriesForSender(sender) {
    return {
      shortTerm: await this.getChatMemory(sender),
      longTerm: await this.getLongTermMemory(sender),
      events: await this.getEmotionalEvents(sender),
      tone: await this.getTone(sender),
      language: await this.getLanguage(sender)
    };
  }

  async clearAllMemory(sender) {
    delete this.data.shortTerm[sender];
    delete this.data.longTerm[sender];
    delete this.data.emotionalEvents[sender];
    delete this.data.toneMemory[sender];
    delete this.data.languageMemory[sender];
    delete this.data.semanticMemory[sender];
    delete this.data.personalityTrends[sender];
    delete this.data.moodHistory[sender];
    delete this.data.relationshipTypes[sender];
    this.save();
    console.log(`🗑️ Cleared all memory for ${sender}`);
  }

  async close() {
    this.save();
    console.log('✅ JSON memory saved');
  }
}

module.exports = JSONMemory;
