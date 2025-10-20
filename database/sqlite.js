/**
 * SQLite Database Adapter for BotWA
 * Lightweight, serverless database - perfect for single instance deployments
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SQLiteMemory {
  constructor(dbPath = 'memory/botwa.db') {
    this.dbPath = dbPath;
    this.db = null;
  }

  /**
   * Initialize database connection and create tables
   */
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('✅ Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  /**
   * Create all necessary tables
   */
  async createTables() {
    const tables = [
      // Chat history (short-term memory)
      `CREATE TABLE IF NOT EXISTS chat_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender (sender),
        INDEX idx_timestamp (timestamp)
      )`,

      // Long-term summaries
      `CREATE TABLE IF NOT EXISTS long_term_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        summary TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender (sender)
      )`,

      // Emotional events
      `CREATE TABLE IF NOT EXISTS emotional_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        emotion TEXT NOT NULL,
        type TEXT NOT NULL,
        intensity TEXT NOT NULL,
        trigger_text TEXT,
        snippet TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        followed_up BOOLEAN DEFAULT 0,
        INDEX idx_sender (sender),
        INDEX idx_emotion (emotion)
      )`,

      // Tone memory
      `CREATE TABLE IF NOT EXISTS tone_memory (
        sender TEXT PRIMARY KEY,
        tone TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Language preference
      `CREATE TABLE IF NOT EXISTS language_memory (
        sender TEXT PRIMARY KEY,
        language TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Semantic memory (with embeddings as JSON blob)
      `CREATE TABLE IF NOT EXISTS semantic_memory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        text TEXT NOT NULL,
        emotion TEXT,
        context TEXT,
        embedding TEXT NOT NULL,
        weight REAL DEFAULT 0.5,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender (sender)
      )`,

      // Personality trends
      `CREATE TABLE IF NOT EXISTS personality_trends (
        sender TEXT PRIMARY KEY,
        curiosity REAL DEFAULT 0.8,
        empathy REAL DEFAULT 0.9,
        humor REAL DEFAULT 0.6,
        flirtiness REAL DEFAULT 0.7,
        logic REAL DEFAULT 0.8,
        playfulness REAL DEFAULT 0.7,
        evolution_count INTEGER DEFAULT 0,
        last_evolution DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      // Mood history
      `CREATE TABLE IF NOT EXISTS mood_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        emotion TEXT NOT NULL,
        hour INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sender (sender),
        INDEX idx_timestamp (timestamp)
      )`,

      // Relationship types
      `CREATE TABLE IF NOT EXISTS relationship_types (
        sender TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        traits TEXT NOT NULL,
        confidence REAL DEFAULT 0.0,
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    for (const sql of tables) {
      await this.run(sql);
    }
    
    console.log('✅ Database tables created');
  }

  /**
   * Helper: Run SQL query
   */
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  /**
   * Helper: Get single row
   */
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Helper: Get all rows
   */
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  // ===========================================
  // Chat Memory (Short-term)
  // ===========================================
  
  async getChatMemory(sender, limit = 10) {
    const rows = await this.all(
      `SELECT role, content FROM chat_memory 
       WHERE sender = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [sender, limit]
    );
    return rows.reverse(); // Return in chronological order
  }

  async addChatMessage(sender, role, content) {
    await this.run(
      'INSERT INTO chat_memory (sender, role, content) VALUES (?, ?, ?)',
      [sender, role, content]
    );
  }

  async clearOldChatMemory(sender, keepLast = 10) {
    await this.run(
      `DELETE FROM chat_memory 
       WHERE sender = ? 
       AND id NOT IN (
         SELECT id FROM chat_memory 
         WHERE sender = ? 
         ORDER BY timestamp DESC 
         LIMIT ?
       )`,
      [sender, sender, keepLast]
    );
  }

  // ===========================================
  // Long-term Memory
  // ===========================================
  
  async getLongTermMemory(sender, limit = 5) {
    return await this.all(
      `SELECT summary, timestamp FROM long_term_memory 
       WHERE sender = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [sender, limit]
    );
  }

  async addLongTermMemory(sender, summary) {
    await this.run(
      'INSERT INTO long_term_memory (sender, summary) VALUES (?, ?)',
      [sender, summary]
    );
    
    // Keep only last 5 summaries
    await this.run(
      `DELETE FROM long_term_memory 
       WHERE sender = ? 
       AND id NOT IN (
         SELECT id FROM long_term_memory 
         WHERE sender = ? 
         ORDER BY timestamp DESC 
         LIMIT 5
       )`,
      [sender, sender]
    );
  }

  // ===========================================
  // Emotional Events
  // ===========================================
  
  async getEmotionalEvents(sender, limit = 20) {
    return await this.all(
      `SELECT * FROM emotional_events 
       WHERE sender = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [sender, limit]
    );
  }

  async addEmotionalEvent(sender, emotion, type, intensity, trigger, snippet) {
    await this.run(
      `INSERT INTO emotional_events 
       (sender, emotion, type, intensity, trigger_text, snippet) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sender, emotion, type, intensity, trigger, snippet]
    );
    
    // Keep only last 20 events
    await this.run(
      `DELETE FROM emotional_events 
       WHERE sender = ? 
       AND id NOT IN (
         SELECT id FROM emotional_events 
         WHERE sender = ? 
         ORDER BY timestamp DESC 
         LIMIT 20
       )`,
      [sender, sender]
    );
  }

  async markEventFollowedUp(eventId) {
    await this.run(
      'UPDATE emotional_events SET followed_up = 1 WHERE id = ?',
      [eventId]
    );
  }

  // ===========================================
  // Tone & Language Memory
  // ===========================================
  
  async getTone(sender) {
    const row = await this.get(
      'SELECT tone FROM tone_memory WHERE sender = ?',
      [sender]
    );
    return row?.tone;
  }

  async setTone(sender, tone) {
    await this.run(
      `INSERT INTO tone_memory (sender, tone, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP) 
       ON CONFLICT(sender) DO UPDATE SET tone = ?, updated_at = CURRENT_TIMESTAMP`,
      [sender, tone, tone]
    );
  }

  async getLanguage(sender) {
    const row = await this.get(
      'SELECT language FROM language_memory WHERE sender = ?',
      [sender]
    );
    return row?.language;
  }

  async setLanguage(sender, language) {
    await this.run(
      `INSERT INTO language_memory (sender, language, updated_at) 
       VALUES (?, ?, CURRENT_TIMESTAMP) 
       ON CONFLICT(sender) DO UPDATE SET language = ?, updated_at = CURRENT_TIMESTAMP`,
      [sender, language, language]
    );
  }

  // ===========================================
  // Semantic Memory
  // ===========================================
  
  async getSemanticMemory(sender, limit = 10) {
    const rows = await this.all(
      `SELECT text, emotion, context, embedding, weight, timestamp 
       FROM semantic_memory 
       WHERE sender = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [sender, limit]
    );
    
    // Parse embedding JSON
    return rows.map(row => ({
      ...row,
      embedding: JSON.parse(row.embedding)
    }));
  }

  async addSemanticMemory(sender, text, emotion, context, embedding, weight = 0.5) {
    await this.run(
      `INSERT INTO semantic_memory 
       (sender, text, emotion, context, embedding, weight) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [sender, text, emotion, JSON.stringify(context), JSON.stringify(embedding), weight]
    );
    
    // Keep only last 10 memories
    await this.run(
      `DELETE FROM semantic_memory 
       WHERE sender = ? 
       AND id NOT IN (
         SELECT id FROM semantic_memory 
         WHERE sender = ? 
         ORDER BY timestamp DESC 
         LIMIT 10
       )`,
      [sender, sender]
    );
  }

  // ===========================================
  // Personality Trends
  // ===========================================
  
  async getPersonalityTrend(sender) {
    return await this.get(
      'SELECT * FROM personality_trends WHERE sender = ?',
      [sender]
    );
  }

  async setPersonalityTrend(sender, traits) {
    const { curiosity, empathy, humor, flirtiness, logic, playfulness, evolutionCount = 0 } = traits;
    
    await this.run(
      `INSERT INTO personality_trends 
       (sender, curiosity, empathy, humor, flirtiness, logic, playfulness, evolution_count, last_evolution) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) 
       ON CONFLICT(sender) DO UPDATE SET 
         curiosity = ?, empathy = ?, humor = ?, flirtiness = ?, 
         logic = ?, playfulness = ?, evolution_count = ?, last_evolution = CURRENT_TIMESTAMP`,
      [sender, curiosity, empathy, humor, flirtiness, logic, playfulness, evolutionCount,
       curiosity, empathy, humor, flirtiness, logic, playfulness, evolutionCount]
    );
  }

  // ===========================================
  // Mood History
  // ===========================================
  
  async getMoodHistory(sender, limit = 20) {
    return await this.all(
      `SELECT emotion, hour, timestamp FROM mood_history 
       WHERE sender = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [sender, limit]
    );
  }

  async addMoodEntry(sender, emotion, hour) {
    await this.run(
      'INSERT INTO mood_history (sender, emotion, hour) VALUES (?, ?, ?)',
      [sender, emotion, hour]
    );
    
    // Keep only last 20 entries
    await this.run(
      `DELETE FROM mood_history 
       WHERE sender = ? 
       AND id NOT IN (
         SELECT id FROM mood_history 
         WHERE sender = ? 
         ORDER BY timestamp DESC 
         LIMIT 20
       )`,
      [sender, sender]
    );
  }

  // ===========================================
  // Relationship Types
  // ===========================================
  
  async getRelationshipType(sender) {
    const row = await this.get(
      'SELECT type, traits, confidence, last_updated FROM relationship_types WHERE sender = ?',
      [sender]
    );
    
    if (row) {
      return {
        ...row,
        traits: JSON.parse(row.traits)
      };
    }
    return null;
  }

  async setRelationshipType(sender, type, traits, confidence) {
    await this.run(
      `INSERT INTO relationship_types 
       (sender, type, traits, confidence, last_updated) 
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) 
       ON CONFLICT(sender) DO UPDATE SET 
         type = ?, traits = ?, confidence = ?, last_updated = CURRENT_TIMESTAMP`,
      [sender, type, JSON.stringify(traits), confidence,
       type, JSON.stringify(traits), confidence]
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
    const tables = [
      'chat_memory',
      'long_term_memory', 
      'emotional_events',
      'semantic_memory',
      'mood_history'
    ];

    for (const table of tables) {
      await this.run(`DELETE FROM ${table} WHERE sender = ?`, [sender]);
    }

    await this.run('DELETE FROM tone_memory WHERE sender = ?', [sender]);
    await this.run('DELETE FROM language_memory WHERE sender = ?', [sender]);
    await this.run('DELETE FROM personality_trends WHERE sender = ?', [sender]);
    await this.run('DELETE FROM relationship_types WHERE sender = ?', [sender]);

    console.log(`🗑️ Cleared all memory for ${sender}`);
  }

  /**
   * Close database connection
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) reject(err);
          else {
            console.log('✅ SQLite connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = SQLiteMemory;
