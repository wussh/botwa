#!/usr/bin/env node
/**
 * Migration Script: JSON to Database
 * Migrates existing memory.json data to SQLite or MongoDB
 * 
 * Usage:
 *   node database/migrate.js sqlite              # Migrate to SQLite
 *   node database/migrate.js mongodb             # Migrate to MongoDB
 *   node database/migrate.js mongodb mongodb://localhost:27017
 */

const fs = require('fs');
const path = require('path');

async function migrate(targetDb, connectionString) {
  console.log('🔄 Starting migration...\n');

  // Load JSON data
  const jsonPath = path.join(__dirname, '..', 'memory', 'memory.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('❌ No memory.json found. Nothing to migrate.');
    process.exit(1);
  }

  let jsonData;
  try {
    jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    console.log('✅ Loaded memory.json');
  } catch (error) {
    console.error('❌ Failed to parse memory.json:', error.message);
    process.exit(1);
  }

  // Initialize target database
  let db;
  try {
    if (targetDb === 'sqlite') {
      const SQLiteMemory = require('./sqlite');
      db = new SQLiteMemory('memory/botwa.db');
    } else if (targetDb === 'mongodb') {
      const MongoMemory = require('./mongodb');
      db = new MongoMemory(connectionString || 'mongodb://localhost:27017', 'botwa');
    } else {
      console.error('❌ Invalid target database. Use: sqlite or mongodb');
      process.exit(1);
    }

    await db.init();
    console.log(`✅ Connected to ${targetDb}\n`);
  } catch (error) {
    console.error(`❌ Failed to connect to ${targetDb}:`, error.message);
    process.exit(1);
  }

  // Migration counters
  const stats = {
    users: 0,
    chatMessages: 0,
    longTermMemories: 0,
    emotionalEvents: 0,
    tones: 0,
    languages: 0,
    semanticMemories: 0,
    personalityTrends: 0,
    moodHistory: 0,
    relationships: 0
  };

  try {
    // Get unique senders
    const senders = new Set();
    Object.keys(jsonData.shortTerm || {}).forEach(s => senders.add(s));
    Object.keys(jsonData.longTerm || {}).forEach(s => senders.add(s));
    Object.keys(jsonData.emotionalEvents || {}).forEach(s => senders.add(s));
    
    console.log(`📊 Found ${senders.size} users to migrate\n`);

    // Migrate each user's data
    for (const sender of senders) {
      console.log(`👤 Migrating data for ${sender}...`);
      stats.users++;

      // 1. Chat Memory (Short-term)
      const chatHistory = jsonData.shortTerm?.[sender] || [];
      for (const msg of chatHistory) {
        await db.addChatMessage(sender, msg.role, msg.content);
        stats.chatMessages++;
      }

      // 2. Long-term Memory
      const longTerm = jsonData.longTerm?.[sender] || [];
      for (const memory of longTerm) {
        await db.addLongTermMemory(sender, memory.summary);
        stats.longTermMemories++;
      }

      // 3. Emotional Events
      const events = jsonData.emotionalEvents?.[sender] || [];
      for (const event of events) {
        await db.addEmotionalEvent(
          sender,
          event.emotion,
          event.type,
          event.intensity,
          event.trigger,
          event.snippet
        );
        stats.emotionalEvents++;
      }

      // 4. Tone Memory
      const tone = jsonData.toneMemory?.[sender];
      if (tone) {
        await db.setTone(sender, tone);
        stats.tones++;
      }

      // 5. Language Preference
      const language = jsonData.languageMemory?.[sender];
      if (language) {
        await db.setLanguage(sender, language);
        stats.languages++;
      }

      // 6. Semantic Memory
      const semanticMemories = jsonData.semanticMemory?.[sender] || [];
      for (const memory of semanticMemories) {
        await db.addSemanticMemory(
          sender,
          memory.text,
          memory.emotion,
          memory.context,
          memory.embedding,
          memory.weight || 0.5
        );
        stats.semanticMemories++;
      }

      // 7. Personality Trends
      const personality = jsonData.personalityTrends?.[sender];
      if (personality) {
        await db.setPersonalityTrend(sender, personality);
        stats.personalityTrends++;
      }

      // 8. Mood History
      const moodHistory = jsonData.moodHistory?.[sender] || [];
      for (const mood of moodHistory) {
        await db.addMoodEntry(sender, mood.emotion, mood.hour);
        stats.moodHistory++;
      }

      // 9. Relationship Types
      const relationship = jsonData.relationshipTypes?.[sender];
      if (relationship) {
        await db.setRelationshipType(
          sender,
          relationship.type,
          relationship.traits,
          relationship.confidence
        );
        stats.relationships++;
      }

      console.log(`  ✅ Migrated user ${sender}`);
    }

    console.log('\n📊 Migration Summary:');
    console.log('═════════════════════════════════════');
    console.log(`👥 Users:                ${stats.users}`);
    console.log(`💬 Chat Messages:        ${stats.chatMessages}`);
    console.log(`📝 Long-term Memories:   ${stats.longTermMemories}`);
    console.log(`😢 Emotional Events:     ${stats.emotionalEvents}`);
    console.log(`🎭 Tone Memories:        ${stats.tones}`);
    console.log(`🌐 Language Preferences: ${stats.languages}`);
    console.log(`🧠 Semantic Memories:    ${stats.semanticMemories}`);
    console.log(`🎨 Personality Trends:   ${stats.personalityTrends}`);
    console.log(`📈 Mood History:         ${stats.moodHistory}`);
    console.log(`💞 Relationships:        ${stats.relationships}`);
    console.log('═════════════════════════════════════');

    // Backup original JSON file
    const backupPath = jsonPath + '.backup.' + Date.now();
    fs.copyFileSync(jsonPath, backupPath);
    console.log(`\n💾 Original file backed up to: ${backupPath}`);

    console.log('\n✅ Migration completed successfully!');
    console.log(`\n🔧 Next steps:`);
    console.log(`   1. Update config.js to set DATABASE_TYPE: '${targetDb}'`);
    console.log(`   2. Restart the bot`);
    console.log(`   3. Verify everything works`);
    console.log(`   4. Delete the backup file if no longer needed\n`);

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage:');
  console.log('  node database/migrate.js sqlite');
  console.log('  node database/migrate.js mongodb');
  console.log('  node database/migrate.js mongodb mongodb://user:pass@host:27017');
  process.exit(1);
}

const targetDb = args[0].toLowerCase();
const connectionString = args[1];

migrate(targetDb, connectionString)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
