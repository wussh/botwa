/**
 * BotWA - Advanced AI WhatsApp Bot
 * Main Entry Point
 * 
 * Features:
 * - Multi-model AI routing
 * - Emotional intelligence
 * - Semantic memory with vector embeddings
 * - Dynamic personality adaptation
 * - Natural conversation flow
 */

import { logger } from './utils/logger.js';
import config from './config/index.js';
import { validateConfig } from './utils/validationUtils.js';
import { memoryManager } from './memory/memoryManager.js';
import { whatsappConnection } from './whatsapp/connection.js';
import MessageHandler from './whatsapp/messageHandler.js';

// Display startup banner
console.log(`
╔═══════════════════════════════════════════╗
║                                           ║
║         🤖 BotWA v2.0.0 (ESM)            ║
║   Advanced AI WhatsApp Bot                ║
║                                           ║
║   Multi-Model Intelligence                ║
║   Emotional Awareness                     ║
║   Semantic Memory                         ║
║                                           ║
╚═══════════════════════════════════════════╝
`);

/**
 * Validate required configuration
 */
function validateRequiredConfig() {
  logger.info('🔍 Validating configuration...');
  
  try {
    validateConfig(config, [
      'AI_API_URL',
      'AI_EMBEDDING_URL',
      'AUTH_FOLDER',
      'MEMORY_FILE'
    ]);
    
    logger.info('✅ Configuration validated');
  } catch (error) {
    logger.error(`❌ Configuration error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Initialize all bot modules
 */
async function initializeModules() {
  try {
    logger.info('🚀 Initializing modules...');

    // Initialize memory manager
    logger.info('💾 Initializing memory manager...');
    await memoryManager.init();
    
    // Display memory stats
    const stats = memoryManager.getStats();
    logger.info(`📊 Memory: ${stats.users} users, ${stats.totalMessages} messages, ${stats.emotionalEvents} events`);

    // Initialize WhatsApp connection
    logger.info('📱 Initializing WhatsApp connection...');
    await whatsappConnection.init();

    // Create message handler
    const messageHandler = new MessageHandler(whatsappConnection);
    
    // Set message handler on connection
    whatsappConnection.setMessageHandler((msgUpsert, sock) => {
      messageHandler.handleMessage(msgUpsert, sock);
    });

    // Start health check
    whatsappConnection.startHealthCheck();

    logger.info('✅ All modules initialized successfully');
    logger.info('🎉 Bot is ready to chat!');
    
  } catch (error) {
    logger.error(`❌ Initialization failed: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

/**
 * Handle graceful shutdown
 */
async function handleShutdown(signal) {
  logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`);

  try {
    // Save memory
    logger.info('💾 Saving memory...');
    memoryManager.saveMemory();

    // Close WhatsApp connection
    logger.info('📱 Closing WhatsApp connection...');
    await whatsappConnection.shutdown();

    logger.info('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    logger.error(`❌ Error during shutdown: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Handle uncaught errors
 */
function setupErrorHandlers() {
  process.on('uncaughtException', (error) => {
    logger.error(`❌ Uncaught Exception: ${error.message}`);
    logger.error(error.stack);
    
    // Try to save memory before exiting
    try {
      memoryManager.saveMemory();
    } catch (saveError) {
      logger.error('Failed to save memory during crash');
    }
    
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('❌ Unhandled Rejection at:', promise);
    logger.error('Reason:', reason);
  });

  // Graceful shutdown signals
  process.on('SIGINT', () => handleShutdown('SIGINT'));
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
}

/**
 * Main function
 */
async function main() {
  try {
    logger.info('🔍 BotWA starting...');
    
    // Setup error handlers
    setupErrorHandlers();
    
    // Validate configuration
    validateRequiredConfig();
    
    // Log configuration summary
    logger.info('⚙️  Configuration:');
    logger.info(`   Database: ${config.DATABASE_TYPE}`);
    logger.info(`   Log Level: ${config.LOG_LEVEL}`);
    logger.info(`   Allowed Contacts: ${config.ALLOWED_CONTACTS.length} numbers`);
    logger.info(`   AI Endpoint: ${config.AI_API_URL}`);
    
    // Initialize all modules
    await initializeModules();
    
  } catch (error) {
    logger.error(`❌ Fatal error: ${error.message}`);
    logger.error(error.stack);
    process.exit(1);
  }
}

// Start the bot
main().catch((error) => {
  logger.error(`❌ Failed to start bot: ${error.message}`);
  process.exit(1);
});

// Export for testing
export { main, initializeModules, validateRequiredConfig };
