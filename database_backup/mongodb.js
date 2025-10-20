/**
 * MongoDB Database Adapter for BotWA
 * Flexible NoSQL database - perfect for complex queries and scalability
 */

const { MongoClient } = require('mongodb');

class MongoMemory {
  constructor(connectionString = 'mongodb://localhost:27017', dbName = 'botwa') {
    this.connectionString = connectionString;
    this.dbName = dbName;
    this.client = null;
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async init() {
    try {
      this.client = new MongoClient(this.connectionString);
      await this.client.connect();
      this.db = this.client.db(this.dbName);
      
      // Create indexes for better performance
      await this.createIndexes();
      
      console.log('✅ Connected to MongoDB database');
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error);
      throw error;
    }
  }

  /**
   * Create indexes on collections
   */
  async createIndexes() {
    const collections = {
      chatMemory: [
        { key: { sender: 1, timestamp: -1 } },
        { key: { timestamp: 1 }, expireAfterSeconds: 30 * 24 * 60 * 60 } // Auto-delete after 30 days
      ],
      longTermMemory: [
        { key: { sender: 1, timestamp: -1 } }
      ],
      emotionalEvents: [
        { key: { sender: 1, timestamp: -1 } },
        { key: { emotion: 1 } },
        { key: { followedUp: 1 } }
      ],
      toneMemory: [
        { key: { sender: 1 }, unique: true }
      ],
      languageMemory: [
        { key: { sender: 1 }, unique: true }
      ],
      semanticMemory: [
        { key: { sender: 1, timestamp: -1 } }
      ],
      personalityTrends: [
        { key: { sender: 1 }, unique: true }
      ],
      moodHistory: [
        { key: { sender: 1, timestamp: -1 } },
        { key: { timestamp: 1 }, expireAfterSeconds: 7 * 24 * 60 * 60 } // Auto-delete after 7 days
      ],
      relationshipTypes: [
        { key: { sender: 1 }, unique: true }
      ]
    };

    for (const [collectionName, indexes] of Object.entries(collections)) {
      const collection = this.db.collection(collectionName);
      for (const index of indexes) {
        await collection.createIndex(index.key, index);
      }
    }

    console.log('✅ MongoDB indexes created');
  }

  // ===========================================
  // Chat Memory (Short-term)
  // ===========================================
  
  async getChatMemory(sender, limit = 10) {
    const docs = await this.db.collection('chatMemory')
      .find({ sender })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return docs.reverse().map(doc => ({
      role: doc.role,
      content: doc.content
    }));
  }

  async addChatMessage(sender, role, content) {
    await this.db.collection('chatMemory').insertOne({
      sender,
      role,
      content,
      timestamp: new Date()
    });
  }

  async clearOldChatMemory(sender, keepLast = 10) {
    const docs = await this.db.collection('chatMemory')
      .find({ sender })
      .sort({ timestamp: -1 })
      .skip(keepLast)
      .toArray();
    
    if (docs.length > 0) {
      const idsToDelete = docs.map(doc => doc._id);
      await this.db.collection('chatMemory').deleteMany({
        _id: { $in: idsToDelete }
      });
    }
  }

  // ===========================================
  // Long-term Memory
  // ===========================================
  
  async getLongTermMemory(sender, limit = 5) {
    const docs = await this.db.collection('longTermMemory')
      .find({ sender })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
    
    return docs.map(doc => ({
      summary: doc.summary,
      timestamp: doc.timestamp
    }));
  }

  async addLongTermMemory(sender, summary) {
    await this.db.collection('longTermMemory').insertOne({
      sender,
      summary,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 5 summaries
    const docs = await this.db.collection('longTermMemory')
      .find({ sender })
      .sort({ timestamp: -1 })
      .skip(5)
      .toArray();
    
    if (docs.length > 0) {
      const idsToDelete = docs.map(doc => doc._id);
      await this.db.collection('longTermMemory').deleteMany({
        _id: { $in: idsToDelete }
      });
    }
  }

  // ===========================================
  // Emotional Events
  // ===========================================
  
  async getEmotionalEvents(sender, limit = 20) {
    return await this.db.collection('emotionalEvents')
      .find({ sender })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async addEmotionalEvent(sender, emotion, type, intensity, trigger, snippet) {
    await this.db.collection('emotionalEvents').insertOne({
      sender,
      emotion,
      type,
      intensity,
      trigger,
      snippet,
      timestamp: new Date().toISOString(),
      followedUp: false,
      daysAgo: 0
    });
    
    // Keep only last 20 events
    const docs = await this.db.collection('emotionalEvents')
      .find({ sender })
      .sort({ timestamp: -1 })
      .skip(20)
      .toArray();
    
    if (docs.length > 0) {
      const idsToDelete = docs.map(doc => doc._id);
      await this.db.collection('emotionalEvents').deleteMany({
        _id: { $in: idsToDelete }
      });
    }
  }

  async markEventFollowedUp(eventId) {
    await this.db.collection('emotionalEvents').updateOne(
      { _id: eventId },
      { $set: { followedUp: true } }
    );
  }

  async getUnfollowedEvents(sender, minHours = 12, maxHours = 48) {
    const minDate = new Date(Date.now() - maxHours * 60 * 60 * 1000);
    const maxDate = new Date(Date.now() - minHours * 60 * 60 * 1000);
    
    return await this.db.collection('emotionalEvents')
      .find({
        sender,
        followedUp: false,
        timestamp: {
          $gte: minDate.toISOString(),
          $lte: maxDate.toISOString()
        }
      })
      .sort({ timestamp: -1 })
      .toArray();
  }

  // ===========================================
  // Tone & Language Memory
  // ===========================================
  
  async getTone(sender) {
    const doc = await this.db.collection('toneMemory').findOne({ sender });
    return doc?.tone;
  }

  async setTone(sender, tone) {
    await this.db.collection('toneMemory').updateOne(
      { sender },
      { 
        $set: { 
          tone, 
          updatedAt: new Date() 
        } 
      },
      { upsert: true }
    );
  }

  async getLanguage(sender) {
    const doc = await this.db.collection('languageMemory').findOne({ sender });
    return doc?.language;
  }

  async setLanguage(sender, language) {
    await this.db.collection('languageMemory').updateOne(
      { sender },
      { 
        $set: { 
          language, 
          updatedAt: new Date() 
        } 
      },
      { upsert: true }
    );
  }

  // ===========================================
  // Semantic Memory
  // ===========================================
  
  async getSemanticMemory(sender, limit = 10) {
    return await this.db.collection('semanticMemory')
      .find({ sender })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async addSemanticMemory(sender, text, emotion, context, embedding, weight = 0.5) {
    await this.db.collection('semanticMemory').insertOne({
      sender,
      text,
      emotion,
      context,
      embedding,
      weight,
      timestamp: new Date().toISOString()
    });
    
    // Keep only last 10 memories
    const docs = await this.db.collection('semanticMemory')
      .find({ sender })
      .sort({ timestamp: -1 })
      .skip(10)
      .toArray();
    
    if (docs.length > 0) {
      const idsToDelete = docs.map(doc => doc._id);
      await this.db.collection('semanticMemory').deleteMany({
        _id: { $in: idsToDelete }
      });
    }
  }

  // ===========================================
  // Personality Trends
  // ===========================================
  
  async getPersonalityTrend(sender) {
    return await this.db.collection('personalityTrends').findOne({ sender });
  }

  async setPersonalityTrend(sender, traits) {
    await this.db.collection('personalityTrends').updateOne(
      { sender },
      { 
        $set: { 
          ...traits,
          lastEvolution: Date.now()
        } 
      },
      { upsert: true }
    );
  }

  // ===========================================
  // Mood History
  // ===========================================
  
  async getMoodHistory(sender, limit = 20) {
    return await this.db.collection('moodHistory')
      .find({ sender })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();
  }

  async addMoodEntry(sender, emotion, hour) {
    await this.db.collection('moodHistory').insertOne({
      sender,
      emotion,
      hour,
      timestamp: Date.now()
    });
    
    // Keep only last 20 entries
    const docs = await this.db.collection('moodHistory')
      .find({ sender })
      .sort({ timestamp: -1 })
      .skip(20)
      .toArray();
    
    if (docs.length > 0) {
      const idsToDelete = docs.map(doc => doc._id);
      await this.db.collection('moodHistory').deleteMany({
        _id: { $in: idsToDelete }
      });
    }
  }

  // ===========================================
  // Relationship Types
  // ===========================================
  
  async getRelationshipType(sender) {
    return await this.db.collection('relationshipTypes').findOne({ sender });
  }

  async setRelationshipType(sender, type, traits, confidence) {
    await this.db.collection('relationshipTypes').updateOne(
      { sender },
      { 
        $set: { 
          type,
          traits,
          confidence,
          lastUpdated: Date.now()
        } 
      },
      { upsert: true }
    );
  }

  // ===========================================
  // Utility Methods
  // ===========================================
  
  async getAllMemoriesForSender(sender) {
    const [shortTerm, longTerm, events, tone, language] = await Promise.all([
      this.getChatMemory(sender),
      this.getLongTermMemory(sender),
      this.getEmotionalEvents(sender),
      this.getTone(sender),
      this.getLanguage(sender)
    ]);

    return {
      shortTerm,
      longTerm,
      events,
      tone,
      language
    };
  }

  async clearAllMemory(sender) {
    const collections = [
      'chatMemory',
      'longTermMemory',
      'emotionalEvents',
      'toneMemory',
      'languageMemory',
      'semanticMemory',
      'personalityTrends',
      'moodHistory',
      'relationshipTypes'
    ];

    for (const collectionName of collections) {
      await this.db.collection(collectionName).deleteMany({ sender });
    }

    console.log(`🗑️ Cleared all memory for ${sender}`);
  }

  /**
   * Get statistics for monitoring
   */
  async getStats() {
    const collections = await this.db.listCollections().toArray();
    const stats = {};

    for (const coll of collections) {
      const count = await this.db.collection(coll.name).countDocuments();
      stats[coll.name] = count;
    }

    return stats;
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      console.log('✅ MongoDB connection closed');
    }
  }
}

module.exports = MongoMemory;
