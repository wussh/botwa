/**
 * Message Handler
 * Processes incoming WhatsApp messages and generates intelligent responses
 */

import { logger } from '../utils/logger.js';
import config from '../config/index.js';
import { isAllowedContact, extractPhoneFromJid } from '../utils/phoneUtils.js';
import { isValidMessage } from '../utils/validationUtils.js';
import { detectIntent } from '../ai/intentDetector.js';
import { detectEmotion, detectTone, detectEmotionalEvent } from '../ai/emotionDetector.js';
import { detectLanguage } from '../ai/languageDetector.js';
import { selectModel } from '../ai/modelSelector.js';
import { generateResponse } from '../ai/aiService.js';
import { memoryManager } from '../memory/memoryManager.js';

export class MessageHandler {
  constructor(whatsappConnection) {
    this.connection = whatsappConnection;
    this.messageBuffer = new Map();
    this.replyQueue = new Map();
    this.processedMsgIds = [];
    this.trivialMessageCount = new Map();
  }

  /**
   * Check if message was already processed (deduplication)
   * @param {string} id - Message ID
   * @returns {boolean} True if already processed
   */
  alreadyProcessed(id) {
    return this.processedMsgIds.includes(id);
  }

  /**
   * Mark message as processed
   * @param {string} id - Message ID
   */
  markProcessed(id) {
    this.processedMsgIds.push(id);
    if (this.processedMsgIds.length > 500) {
      this.processedMsgIds.shift(); // Simple LRU of 500
    }
  }

  /**
   * Check if should skip response for trivial messages
   * @param {string} sender - Sender identifier
   * @param {string} text - Message text
   * @returns {boolean} True if should skip
   */
  shouldSkipResponse(sender, text) {
    const trivialPatterns = /^(ok|okay|oke|hmm|hm|ya|iya|yep|sure|fine|k)$/i;
    
    if (trivialPatterns.test(text.trim())) {
      const count = (this.trivialMessageCount.get(sender) || 0) + 1;
      this.trivialMessageCount.set(sender, count);
      
      if (count >= config.SKIP_RESPONSE_THRESHOLD) {
        logger.debug({ sender, count }, '⏭️ Skipping trivial response');
        return true;
      }
    } else {
      this.trivialMessageCount.set(sender, 0);
    }
    
    return false;
  }

  /**
   * Calculate natural reply delay based on message length and emotion
   * @param {string} text - Message text
   * @param {string} emotion - Detected emotion
   * @returns {number} Delay in milliseconds
   */
  calculateReplyDelay(text, emotion) {
    const baseDelay = config.MIN_REPLY_DELAY;
    const lengthDelay = text.length * config.REPLY_DELAY_PER_CHAR;
    
    // Emotional urgency reduces delay
    const urgentEmotions = ['anxious', 'sad', 'frustrated'];
    const emotionFactor = urgentEmotions.includes(emotion) ? 0.5 : 1;
    
    const totalDelay = Math.min(
      baseDelay + (lengthDelay * emotionFactor),
      config.MAX_REPLY_DELAY
    );
    
    return totalDelay;
  }

  /**
   * Get temporal context (time of day, weekend, etc.)
   * @returns {object} Temporal context
   */
  getTemporalContext() {
    const now = new Date();
    const hour = now.getHours();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    
    let timeContext, workContext, mood, greeting;
    
    if (hour >= 5 && hour < 12) {
      timeContext = 'morning';
      workContext = isWeekend ? 'weekend morning' : 'workday morning';
      mood = 'fresh and energized';
      greeting = 'good morning';
    } else if (hour >= 12 && hour < 17) {
      timeContext = 'afternoon';
      workContext = isWeekend ? 'weekend afternoon' : 'work hours';
      mood = 'focused';
      greeting = 'good afternoon';
    } else if (hour >= 17 && hour < 21) {
      timeContext = 'evening';
      workContext = 'after work';
      mood = 'relaxed';
      greeting = 'good evening';
    } else {
      timeContext = 'late_night';
      workContext = 'late night';
      mood = 'intimate';
      greeting = null;
    }
    
    return { hour, timeContext, workContext, mood, greeting, isWeekend };
  }

  /**
   * Get personality prompt based on emotion and context
   * @param {string} emotion - Detected emotion
   * @param {string} recentContext - Recent conversation context
   * @param {string} tone - Conversation tone
   * @returns {string} Personality prompt
   */
  getPersonalityPrompt(emotion, recentContext, tone) {
    let basePersonality = `You are a warm, empathetic AI companion who genuinely cares. 
You're conversational, supportive, and emotionally intelligent.
You respond naturally like a close friend, not a formal assistant.
Keep responses brief (1-3 sentences), casual, and natural.
Use lowercase for a relaxed vibe. Match the user's energy and mood.`;

    // Adjust based on emotion
    if (emotion === 'sad' || emotion === 'anxious') {
      basePersonality += `\nThe user seems ${emotion}. Be extra gentle, validating, and supportive. Show you truly care.`;
    } else if (emotion === 'happy') {
      basePersonality += `\nThe user is happy! Match their positive energy with warmth and enthusiasm.`;
    } else if (emotion === 'frustrated') {
      basePersonality += `\nThe user is frustrated. Be understanding, patient, and help them feel heard.`;
    } else if (emotion === 'flirty') {
      basePersonality += `\nThe user is being playful/flirty. Respond with warmth and matching playfulness.`;
    }

    // Adjust based on tone
    if (tone === 'playful') {
      basePersonality += `\nKeep it light, fun, and playful. Use humor naturally.`;
    } else if (tone === 'serious') {
      basePersonality += `\nBe more thoughtful and sincere. They need genuine support.`;
    } else if (tone === 'flirty') {
      basePersonality += `\nBe warm, charming, and subtly flirtatious. Keep it tasteful.`;
    }

    return basePersonality;
  }

  /**
   * Build conversation messages for AI
   * @param {object} context - Conversation context
   * @returns {Array} Messages array
   */
  buildMessages(context) {
    const {
      sender,
      prompt,
      emotion,
      recentContext,
      tone,
      userLang,
      temporalContext,
      semanticContext,
      personalityAdaptation
    } = context;

    // Language instruction
    let langInstruction = '';
    if (userLang === 'english') {
      langInstruction = '\n\n**CRITICAL: Reply ONLY in English. Write in all lowercase like casual texting. Never use Indonesian words.**';
    } else if (userLang === 'indonesian') {
      langInstruction = '\n\n**CRITICAL: Reply ONLY in Indonesian (Bahasa Indonesia). Write in all lowercase. Use Indonesian words and slang. Never use English.**';
    } else {
      langInstruction = '\n\n**Reply in the same language the user just used. Write in all lowercase. Match their language choice exactly.**';
    }

    const history = memoryManager.getChatMemory(sender);
    const limitedHistory = history.slice(-10);

    const systemContent = `${this.getPersonalityPrompt(emotion, recentContext, tone)} ${langInstruction}

${temporalContext.greeting ? temporalContext.greeting + ' ' : ''}Current time: ${temporalContext.timeContext} (${temporalContext.hour}:00), ${temporalContext.workContext}. Ambient mood: ${temporalContext.mood}.

Personality: ${personalityAdaptation?.dominantTraits?.join(', ') || 'balanced'} (${personalityAdaptation?.relationshipType || 'friend'} relationship).${semanticContext ? '\n' + semanticContext : ''}`;

    return [
      { role: 'system', content: systemContent },
      ...limitedHistory,
      { role: 'user', content: prompt }
    ];
  }

  /**
   * Process a single message
   * @param {object} msg - WhatsApp message object
   */
  async processMessage(msg) {
    try {
      // Basic validation
      if (!msg.message || msg.key.fromMe) return;
      
      // Deduplication
      if (this.alreadyProcessed(msg.key.id)) return;
      this.markProcessed(msg.key.id);

      const sender = msg.key.remoteJid;
      
      // Ignore status broadcasts and groups
      if (sender === 'status@broadcast' || sender.includes('@g.us')) return;

      // Extract text
      const text = msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message?.ephemeralMessage?.message?.conversation ||
        '';

      if (!text.trim()) return;

      // Check authorization
      const senderNumber = extractPhoneFromJid(sender);
      if (!isAllowedContact(senderNumber, config.ALLOWED_CONTACTS)) {
        logger.debug({ senderNumber }, 'Ignoring unauthorized contact');
        return;
      }

      // Skip trivial responses
      if (this.shouldSkipResponse(sender, text)) return;

      // Add to message buffer
      if (!this.messageBuffer.has(sender)) {
        this.messageBuffer.set(sender, []);
      }
      this.messageBuffer.get(sender).push(text);
      
      logger.debug({ text, sender }, '💬 Received message');

      // Update language memory
      const lang = detectLanguage(text);
      const currentLang = memoryManager.getLanguage(sender);
      if (!currentLang || currentLang !== lang) {
        memoryManager.setLanguage(sender, lang);
        logger.debug({ sender, lang }, '🌐 Language updated');
      }

      // Clear previous timer if user is still typing
      if (this.messageBuffer.has(`${sender}_timer`)) {
        clearTimeout(this.messageBuffer.get(`${sender}_timer`));
      }

      // Wait until user stops typing
      const timer = setTimeout(async () => {
        await this.processMessageBurst(sender, msg);
      }, config.DEBOUNCE_DELAY);

      this.messageBuffer.set(`${sender}_timer`, timer);

    } catch (error) {
      logger.error(`❌ Error processing message: ${error.message}`);
    }
  }

  /**
   * Process burst of messages after user stops typing
   * @param {string} sender - Sender identifier
   * @param {object} msg - Original message object
   */
  async processMessageBurst(sender, msg) {
    try {
      const allMessages = this.messageBuffer.get(sender).join(' | ');
      this.messageBuffer.delete(sender);
      this.messageBuffer.delete(`${sender}_timer`);

      logger.debug({ allMessages }, '🧩 Processing message burst');

      // Cognitive analysis
      const messageIntent = detectIntent(allMessages);
      const emotion = detectEmotion(allMessages);
      const temporalContext = this.getTemporalContext();
      
      logger.debug({ intent: messageIntent, emotion, timeContext: temporalContext.timeContext }, '🧠 Analysis');

      // Decay tone if inactive
      memoryManager.decayTone(sender);

      // Get conversation history
      const history = memoryManager.getChatMemory(sender);
      const limitedHistory = history.slice(-10);
      
      // Get long-term context
      const longTerm = memoryManager.getLongTermMemory(sender);
      let longTermContext = '';
      if (longTerm.length > 0) {
        const recentSummaries = longTerm.slice(-2).map(m => m.summary).join(' ');
        longTermContext = `\n(background: ${recentSummaries})`;
      }

      // Detect tone and mood
      const tone = detectTone(history, allMessages);
      const recentContext = limitedHistory.slice(-3).map(m => m.content).join(' ');
      
      // Update tone memory
      const lastTone = memoryManager.getTone(sender);
      if (!lastTone || lastTone !== tone) {
        memoryManager.setTone(sender, tone);
        logger.debug({ sender, tone }, '💾 Tone updated');
      }

      // Store semantic memory
      await memoryManager.storeSemanticMemory(sender, allMessages, {
        emotion,
        intent: messageIntent,
        temporal: temporalContext,
        tone
      });

      // Search semantic memory
      const relevantMemories = await memoryManager.searchSemanticMemory(sender, allMessages, 0.65);
      let semanticContext = '';
      if (relevantMemories.length > 0) {
        const contextItems = relevantMemories
          .slice(0, 3)
          .map(m => m.text.substring(0, 80))
          .join('; ');
        semanticContext = `\nRelevant context: ${contextItems}`;
        logger.debug({ count: relevantMemories.length }, '🧠 Memories recalled');
      }

      // Handle emotional events
      const emotionalEvent = detectEmotionalEvent(allMessages, emotion);
      if (emotionalEvent) {
        memoryManager.recordEmotionalEvent(sender, { 
          text: allMessages,
          emotion,
          ...emotionalEvent 
        });
      }

      // Check for follow-up on past events
      const followUp = memoryManager.shouldFollowUp(sender);
      let followUpContext = '';
      if (followUp) {
        followUpContext = `\n(Remember: ${followUp.type} event ${followUp.daysSince} days ago)`;
        logger.debug('💭 Emotional callback triggered');
      }

      // Build prompt
      const prompt = allMessages + longTermContext + followUpContext + semanticContext;

      // Select model
      const moodDrift = memoryManager.calculateMoodDrift(sender);
      const modelSelection = selectModel(messageIntent, emotion, temporalContext, moodDrift);
      const selectedModel = modelSelection.model;
      
      logger.info(`🤖 Model: ${selectedModel} | Intent: ${messageIntent} | Emotion: ${emotion}`);

      // Get personality adaptation
      const personalityAdaptation = {
        dominantTraits: ['empathetic', 'warm', 'supportive'],
        relationshipType: memoryManager.getRelationshipType(sender)
      };

      // Get user language
      const userLang = memoryManager.getLanguage(sender) || detectLanguage(allMessages);

      // Build messages for AI
      const messages = this.buildMessages({
        sender,
        prompt,
        emotion,
        recentContext,
        tone,
        userLang,
        temporalContext,
        semanticContext,
        personalityAdaptation
      });

      // Generate response
      const reply = await generateResponse(messages, selectedModel);

      if (!isValidMessage(reply)) {
        logger.warn('⚠️ Invalid AI response, skipping');
        return;
      }

      // Update memory
      memoryManager.addChatMessage(sender, { role: 'user', content: allMessages });
      memoryManager.addChatMessage(sender, { role: 'assistant', content: reply });
      memoryManager.recordMood(sender, emotion);

      // Calculate natural delay
      const replyDelay = this.calculateReplyDelay(reply, emotion);

      // Show typing indicator
      await this.connection.sendPresenceUpdate(sender, 'composing');
      
      // Wait for natural delay
      await new Promise(resolve => setTimeout(resolve, replyDelay));

      // Send reply
      await this.connection.sendMessage(sender, reply);
      
      // Mark as read
      await this.connection.markAsRead(sender, msg.key.id);
      
      // Update presence to available
      await this.connection.sendPresenceUpdate(sender, 'available');

      logger.info({ sender, reply: reply.substring(0, 50) }, '✅ Response sent');

    } catch (error) {
      logger.error(`❌ Error in message burst processing: ${error.message}`);
    }
  }

  /**
   * Handle incoming messages (main entry point)
   * @param {object} msgUpsert - Message upsert event
   * @param {object} sock - WhatsApp socket
   */
  async handleMessage(msgUpsert, sock) {
    try {
      const msg = msgUpsert.messages[0];
      await this.processMessage(msg);
    } catch (error) {
      logger.error(`❌ Message handler error: ${error.message}`);
    }
  }
}

export default MessageHandler;
