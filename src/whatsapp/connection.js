/**
 * WhatsApp Connection Manager
 * Handles WhatsApp socket connection, authentication, and reconnection logic
 */

import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import config from '../config/index.js';

export class WhatsAppConnection {
  constructor() {
    this.sock = null;
    this.reconnectAttempts = 0;
    this.lastSuccessfulConnection = null;
    this.isConnected = false;
    this.messageHandler = null;
  }

  /**
   * Initialize WhatsApp connection
   */
  async init() {
    await this.startBot();
  }

  /**
   * Start the bot and establish connection
   */
  async startBot() {
    try {
      // Load or create auth state
      const { state, saveCreds } = await useMultiFileAuthState(config.AUTH_FOLDER);

      // Fetch latest WhatsApp Web version
      const { version } = await fetchLatestBaileysVersion();
      logger.info({ version }, '📱 Using WhatsApp Web version');

      // Create WhatsApp socket
      this.sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: logger.child({ module: 'baileys' })
      });

      // Save credentials whenever they refresh
      this.sock.ev.on('creds.update', saveCreds);

      // Handle connection updates
      this.sock.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(update);
      });

      // Handle incoming messages
      this.sock.ev.on('messages.upsert', async (msgUpsert) => {
        if (this.messageHandler) {
          await this.messageHandler(msgUpsert, this.sock);
        }
      });

      logger.info('✅ WhatsApp connection initialized');
    } catch (error) {
      logger.error(`❌ Failed to start bot: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handle connection state updates
   * @param {object} update - Connection update object
   */
  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr } = update;

    // Show QR code if provided
    if (qr) {
      logger.info('📱 Please scan the QR code below with your WhatsApp mobile app:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      this.isConnected = false;
      await this.handleDisconnection(lastDisconnect);
    } else if (connection === 'open') {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.lastSuccessfulConnection = new Date();
      logger.info('✅ Connected to WhatsApp!');
    } else if (connection === 'connecting') {
      logger.info('🔄 Connecting to WhatsApp...');
    }
  }

  /**
   * Handle disconnection and reconnection logic
   * @param {object} lastDisconnect - Last disconnect info
   */
  async handleDisconnection(lastDisconnect) {
    const reason = lastDisconnect?.error?.output?.statusCode;
    logger.warn({ reason }, 'Connection closed');

    // Handle logged out
    if (reason === DisconnectReason.loggedOut) {
      logger.error('❌ Logged out. Clearing auth and requiring new login...');
      await this.forceRelogin();
      setTimeout(() => this.startBot(), 2000);
      return;
    }

    // Handle bad session
    if (reason === DisconnectReason.badSession || 
        reason === DisconnectReason.sessionReplaced) {
      logger.error('❌ Bad session detected. Forcing relogin...');
      await this.forceRelogin();
      setTimeout(() => this.startBot(), 2000);
      return;
    }

    // Handle other disconnections with retry logic
    if (reason === DisconnectReason.connectionClosed || 
        reason === DisconnectReason.connectionLost ||
        reason === DisconnectReason.restartRequired) {
      
      this.reconnectAttempts++;
      logger.warn({ 
        attempt: this.reconnectAttempts, 
        max: config.MAX_RECONNECT_ATTEMPTS 
      }, '⚠️ Connection failed');

      if (this.reconnectAttempts >= config.MAX_RECONNECT_ATTEMPTS) {
        logger.error('❌ Max reconnection attempts reached. Forcing relogin...');
        await this.forceRelogin();
        setTimeout(() => this.startBot(), 5000);
        return;
      }

      // Exponential backoff with jitter
      const reconnectDelay = this.calculateReconnectDelay();
      logger.info({ 
        delay: Math.round(reconnectDelay / 1000) 
      }, `🔄 Reconnecting in ${Math.round(reconnectDelay / 1000)} seconds...`);

      setTimeout(() => this.startBot(), reconnectDelay);
    }
  }

  /**
   * Calculate reconnect delay with exponential backoff and jitter
   * @returns {number} Delay in milliseconds
   */
  calculateReconnectDelay() {
    const baseDelay = config.RECONNECT_DELAY;
    const exponentialDelay = baseDelay * Math.pow(2, this.reconnectAttempts - 1);
    const jitter = Math.random() * 1000;
    return exponentialDelay + jitter;
  }

  /**
   * Force relogin by clearing auth state
   */
  async forceRelogin() {
    try {
      const authPath = config.AUTH_FOLDER;
      if (fs.existsSync(authPath)) {
        // Remove all files in auth folder
        const files = fs.readdirSync(authPath);
        for (const file of files) {
          fs.unlinkSync(`${authPath}/${file}`);
        }
        logger.info('🗑️ Auth state cleared');
      }
      this.reconnectAttempts = 0;
    } catch (error) {
      logger.error(`❌ Error clearing auth state: ${error.message}`);
    }
  }

  /**
   * Check for stale connection and reconnect if needed
   */
  checkConnectionHealth() {
    if (!this.lastSuccessfulConnection) return;

    const timeSinceLastConnection = Date.now() - this.lastSuccessfulConnection.getTime();
    
    if (timeSinceLastConnection > config.STALE_CONNECTION_THRESHOLD) {
      logger.warn('⚠️ Connection appears stale, forcing reconnect...');
      if (this.sock) {
        this.sock.end();
      }
      this.startBot();
    }
  }

  /**
   * Start health check interval
   */
  startHealthCheck() {
    setInterval(() => {
      this.checkConnectionHealth();
    }, config.HEALTH_CHECK_INTERVAL);
    
    logger.info('💓 Health check started');
  }

  /**
   * Set message handler function
   * @param {Function} handler - Message handler function
   */
  setMessageHandler(handler) {
    this.messageHandler = handler;
  }

  /**
   * Send a message
   * @param {string} jid - WhatsApp JID (phone number)
   * @param {string} text - Message text
   */
  async sendMessage(jid, text) {
    if (!this.sock || !this.isConnected) {
      throw new Error('Not connected to WhatsApp');
    }

    try {
      await this.sock.sendMessage(jid, { text });
      logger.debug({ jid, text }, '📤 Message sent');
    } catch (error) {
      logger.error(`❌ Failed to send message: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send presence update (typing, online, etc.)
   * @param {string} jid - WhatsApp JID
   * @param {string} type - Presence type ('composing', 'available', 'paused')
   */
  async sendPresenceUpdate(jid, type = 'available') {
    if (!this.sock || !this.isConnected) return;

    try {
      await this.sock.sendPresenceUpdate(type, jid);
    } catch (error) {
      logger.debug(`Failed to send presence update: ${error.message}`);
    }
  }

  /**
   * Mark message as read
   * @param {string} jid - WhatsApp JID
   * @param {string} messageId - Message ID
   */
  async markAsRead(jid, messageId) {
    if (!this.sock || !this.isConnected) return;

    try {
      await this.sock.readMessages([{ remoteJid: jid, id: messageId }]);
    } catch (error) {
      logger.debug(`Failed to mark as read: ${error.message}`);
    }
  }

  /**
   * Get socket instance
   * @returns {object} Socket instance
   */
  getSocket() {
    return this.sock;
  }

  /**
   * Check if connected
   * @returns {boolean} Connection status
   */
  get connected() {
    return this.isConnected;
  }

  /**
   * Gracefully shutdown connection
   */
  async shutdown() {
    logger.info('🛑 Shutting down WhatsApp connection...');
    
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (error) {
        logger.debug('Error during logout (may be expected)');
      }
      
      this.sock.end();
      this.sock = null;
    }
    
    this.isConnected = false;
    logger.info('✅ WhatsApp connection closed');
  }
}

// Export singleton instance
export const whatsappConnection = new WhatsAppConnection();

export default whatsappConnection;
