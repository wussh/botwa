/**
 * Database Factory - Provides unified interface for different database backends
 * Supports: SQLite (default), MongoDB, and JSON fallback
 */

class DatabaseFactory {
  static async create(type = 'sqlite', options = {}) {
    let db;

    switch (type.toLowerCase()) {
      case 'sqlite':
        const SQLiteMemory = require('./sqlite');
        db = new SQLiteMemory(options.dbPath || 'memory/botwa.db');
        break;

      case 'mongodb':
      case 'mongo':
        const MongoMemory = require('./mongodb');
        db = new MongoMemory(
          options.connectionString || 'mongodb://localhost:27017',
          options.dbName || 'botwa'
        );
        break;

      case 'json':
        // Fallback to JSON file storage (legacy compatibility)
        const JSONMemory = require('./json');
        db = new JSONMemory(options.filePath || 'memory/memory.json');
        break;

      default:
        throw new Error(`Unsupported database type: ${type}`);
    }

    await db.init();
    return db;
  }
}

module.exports = DatabaseFactory;
