/**
 * AI Service
 * Handles communication with AI API endpoints
 */

import axios from 'axios';
import config from '../config/index.js';
import { logger } from '../utils/logger.js';
import { isGibberish } from '../utils/validationUtils.js';
import { getFallbackModels } from './modelSelector.js';

// Create axios clients
export const aiClient = axios.create({
  baseURL: config.AI_API_URL,
  headers: { 
    'Content-Type': 'application/json', 
    'Authorization': 'Bearer ollama' 
  },
  timeout: 25000
});

export const embedClient = axios.create({
  baseURL: config.AI_EMBEDDING_URL,
  headers: { 
    'Content-Type': 'application/json', 
    'Authorization': 'Bearer ollama' 
  },
  timeout: 15000
});

/**
 * Generate AI response with fallback support
 * @param {Array} messages - Conversation messages
 * @param {string} model - Primary model to use
 * @param {number} maxTokens - Maximum tokens in response
 * @returns {Promise<string>} Generated response
 */
export async function generateResponse(messages, model, maxTokens = config.AI_MAX_TOKENS) {
  const fallbacks = [model, ...getFallbackModels(model)];
  let lastError = null;
  
  for (const currentModel of fallbacks) {
    try {
      logger.info(`🤖 Trying model: ${currentModel}`);
      
      const response = await aiClient.post('', {
        model: currentModel,
        messages,
        max_tokens: maxTokens,
        temperature: 0.8,
        stream: false
      });
      
      const text = response.data?.choices?.[0]?.message?.content?.trim();
      
      if (!text || isGibberish(text)) {
        logger.warn(`⚠️ Model ${currentModel} returned gibberish, trying fallback`);
        continue;
      }
      
      logger.info(`✅ Success with model: ${currentModel}`);
      return text;
      
    } catch (error) {
      lastError = error;
      logger.warn(`❌ Model ${currentModel} failed: ${error.message}`);
      
      // If it's the last model in fallback chain, throw error
      if (currentModel === fallbacks[fallbacks.length - 1]) {
        throw new Error(`All models failed. Last error: ${error.message}`);
      }
    }
  }
  
  throw new Error(`Failed to generate response: ${lastError?.message || 'Unknown error'}`);
}

/**
 * Get vector embedding for text
 * @param {string} text - Text to embed
 * @param {string} model - Embedding model to use
 * @returns {Promise<Array<number>>} Vector embedding
 */
export async function getEmbedding(text, model = config.AI_MODELS.embedding) {
  try {
    const response = await embedClient.post('', {
      model,
      input: text
    });
    
    const embedding = response.data?.data?.[0]?.embedding;
    
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response');
    }
    
    return embedding;
    
  } catch (error) {
    logger.error(`❌ Embedding failed: ${error.message}`);
    throw error;
  }
}

/**
 * Generate a summary of conversation history
 * @param {Array} messages - Messages to summarize
 * @param {string} model - Model to use for summarization
 * @returns {Promise<string>} Summary text
 */
export async function summarizeConversation(messages, model = config.AI_MODELS.summarization) {
  const conversationText = messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n');
  
  const summaryMessages = [
    {
      role: 'system',
      content: 'Summarize the key points and emotional themes of this conversation concisely.'
    },
    {
      role: 'user',
      content: conversationText
    }
  ];
  
  try {
    return await generateResponse(summaryMessages, model, 100);
  } catch (error) {
    logger.error(`❌ Summarization failed: ${error.message}`);
    return 'Unable to generate summary';
  }
}

/**
 * Retry an async function with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delay - Initial delay in ms
 * @returns {Promise} Result of the function
 */
export async function retryWithBackoff(fn, maxRetries = config.AI_MAX_RETRIES, delay = config.AI_RETRY_DELAY) {
  let lastError;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries - 1) {
        const backoffDelay = delay * Math.pow(2, attempt);
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${backoffDelay}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  throw lastError;
}

export default {
  aiClient,
  embedClient,
  generateResponse,
  getEmbedding,
  summarizeConversation,
  retryWithBackoff
};
